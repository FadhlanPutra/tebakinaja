import { useContext, useEffect, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import { fetchPlacesByCity } from '../services/placesService';
import { generateGameClue, generateGameCluesBatch } from '../services/geminiService';
import { getPlaceWeights, incrementPlaceWeight, pickWeightedPlace } from '../services/placeWeightService';
import { getPlaceClue, savePlaceClue, getCachedPlaceNames, cleanupOldClues } from '../services/clueCacheService';
import confetti from 'canvas-confetti';
import Fuse from 'fuse.js';

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const GENERIC_TOKENS = new Set([
  'mall', 'mal', 'plaza', 'pusat', 'center', 'city', 'kota',
  'taman', 'lapangan', 'pasar', 'alun', 'alun-alun', 'stasiun',
  'terminal', 'jalan', 'jl', 'gedung', 'hotel', 'restoran',
  'rumah', 'sakit', 'rs', 'museum', 'monumen', 'pantai',
  'masjid', 'gereja', 'kampus', 'universitas', 'sekolah',
]);

const tokenWeight = (token) => (GENERIC_TOKENS.has(token) ? 0.35 : 1);

const METHOD_MULT = { MCQ: 0.7, MAP: 1.0, TEXT: 1.5 };

// Batch: berapa tempat dibuat clue-nya dalam 1 request Gemini
const CLUE_BATCH_SIZE = 10;
// Berapa kali 1 batch di-retry kalau JSON gagal/kepotong
const CLUE_BATCH_RETRIES = 2;

// Dedup generate clue per tempat lintas pemanggil (cegah request Gemini ganda)
const inFlightClues = new Map();
// Cleanup cache Firestore cukup 1x per hari, bukan tiap startGame
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_STORAGE_KEY = 'tebakinaja_clue_cleanup';

// Jalankan cleanup cache maksimal 1x/hari (throttle via localStorage)
const maybeCleanupClues = () => {
  try {
    const last = Number(localStorage.getItem(CLEANUP_STORAGE_KEY) || 0);
    if (Date.now() - last < CLEANUP_INTERVAL_MS) return;
    localStorage.setItem(CLEANUP_STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage tidak tersedia — tetap coba cleanup
  }
  cleanupOldClues();
};

// Skor TEXT: 0 (salah), 0.5 (hampir), atau 1 (tepat)
const scoreText = (accepted, raw) => {
  const input = normalizeText(raw);
  if (input.length < 3) return 0;

  const vocab = Array.from(
    new Set(accepted.flatMap((a) => a.split(' ')).filter((t) => t.length >= 4))
  );
  const fuse = new Fuse(vocab, { threshold: 0.25 });

  // Koreksi typo per kata
  const userTokens = input.split(' ').filter(Boolean).map((t) => (
    accepted.some((a) => a.split(' ').includes(t))
      ? t
      : (fuse.search(t)[0]?.item ?? t)
  ));

  let best = { overlap: 0, answer: '' };
  for (const a of accepted) {
    const answerTokens = a.split(' ');
    const total = answerTokens.reduce((s, t) => s + tokenWeight(t), 0) || 1;
    const hit = answerTokens.reduce(
      (s, t) => s + (userTokens.includes(t) ? tokenWeight(t) : 0),
      0
    );
    if (hit / total > best.overlap) best = { overlap: hit / total, answer: a };
  }

  // Wajib menyebut minimal 1 kata spesifik (bukan generik)
  const hasSpecific = best.answer
    .split(' ')
    .some((t) => !GENERIC_TOKENS.has(t) && userTokens.includes(t));
  if (!hasSpecific) return 0;

  if (best.overlap >= 0.85) return 1;
  if (best.overlap >= 0.6) return 0.5;
  return 0;
};

const buildAcceptedAnswers = (question = {}) => {
  const out = new Set();
  [...(question.accepted_answers || []), question.answer]
    .filter(Boolean)
    .forEach((ans) => {
      const n = normalizeText(ans);
      if (!n) return;
      out.add(n);
      const stripped = n.replace(/^(mall|mal|plaza|pusat|the)\s+/, '').trim();
      if (stripped.split(' ').filter(Boolean).length >= 2) out.add(stripped);
    });
  return Array.from(out).filter(Boolean);
};

const pickMethod = () => {
  const rand = Math.random();
  if (rand < 0.40) return 'MAP';
  if (rand < 0.75) return 'MCQ';
  return 'TEXT';
};

const pickDifficulty = () => {
  const rand = Math.random();
  if (rand < 0.40) return 'easy';
  if (rand < 0.75) return 'medium';
  return 'hard';
};

const DIFFICULTY_CONFIG = {
  easy:   { preciseThreshold: 0.2, radius: 3,  wrongThreshold: 6  },
  medium: { preciseThreshold: 0.5, radius: 7,  wrongThreshold: 14 },
  hard:   { preciseThreshold: 1.0, radius: 12, wrongThreshold: 24 },
};

// Hitung skor MAP berdasarkan jarak dan radius difficulty
const calculateMapScore = (distanceKm, radiusKm) => {
  const ratio = distanceKm / radiusKm;
  return Math.round(500 * Math.exp(-ratio * 2));
};

// Skor MAP: 1 di pusat, menurun kuadratik hingga 0 di tepi radius
const mapFraction = (d, { preciseThreshold: p, radius: r }) => (
  d <= p ? 1 : d >= r ? 0 : Math.pow(1 - (d - p) / (r - p), 2)
);

// Offset koordinat acak 30-80% dari radius ke arah acak
// Dipakai untuk geser tengah lingkaran agar tidak tepat di jawaban
const offsetCoordinate = (lat, lng, radiusKm) => {
  const distanceKm = radiusKm * (0.3 + Math.random() * 0.5);
  const angle = Math.random() * 2 * Math.PI;
  const deltaLat = (distanceKm / 111) * Math.cos(angle);
  const deltaLng = (distanceKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
  return {
    lat: lat + deltaLat,
    lng: lng + deltaLng,
  };
};

// Helper function for Haversine distance
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

export const useGameLogic = () => {
  const { state, dispatch } = useContext(GameContext);
  const timerRef = useRef(null);

  // Timer Effect
  useEffect(() => {
    if (state.timerActive && state.timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, 1000);
    } else if (state.timeLeft === 0 && state.timerActive) {
      // Time's up
      handleTimeUp();
    }
    return () => clearTimeout(timerRef.current);
  }, [state.timeLeft, state.timerActive]);

  const setMapInstance = (map) => {
    dispatch({ type: 'SET_MAP_INSTANCE', payload: map });
  };

  const startGame = async (city) => {
    dispatch({ type: 'SET_CITY', payload: city });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      maybeCleanupClues();

      dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Mencari tempat ikonik di ${city}...` } });
      const places = await fetchPlacesByCity(city);

      if (places.length < state.maxRounds) {
        throw new Error("Tidak menemukan cukup landmark di kota ini.");
      }

      const userToken = state.token || 'guest';
      const weights = await getPlaceWeights(city, userToken);
      const sequence = buildRoundSequence(places, state.maxRounds, weights);

      // Siapkan clue ronde 1 dulu — baru masuk layar game (hindari peta kosong)
      await prepareNextRound(places, sequence, 1, city);
      dispatch({ type: 'START_GAME', payload: { placesList: places, roundPlaces: sequence } });

      // Prewarm ronde 2..N di background ke cache per-tempat (global, reusable)
      prewarmClues(places, sequence, city);
    } catch (error) {
      console.error('[startGame] ERROR:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: { status: false } });
    }
  };

  /**
   * Susun urutan tempat untuk tiap ronde (distinct, weighted, tidak berulang
   * dalam satu game). used_count di-increment saat clue benar-benar disajikan
   * (lihat prepareNextRound), bukan di sini, agar tidak bias saat game gagal.
   */
  const buildRoundSequence = (placesList, count, weights) => {
    const sequence = [];
    const pool = [...placesList];
    const localWeights = { ...weights };

    while (sequence.length < count && pool.length > 0) {
      const chosen = pickWeightedPlace(pool, localWeights);
      if (!chosen) break;

      sequence.push(chosen);
      const idx = pool.findIndex(p => p.name === chosen.name);
      if (idx !== -1) pool.splice(idx, 1);

      localWeights[chosen.name] = (localWeights[chosen.name] || 0) + 1;
    }
    return sequence;
  };

  /**
   * Ambil clue satu tempat dari cache per-tempat (global). Kalau belum ada,
   * generate 1 BATCH (maks CLUE_BATCH_SIZE tempat uncached) dalam 1 request
   * Gemini, simpan semua ke Firestore, lalu kembalikan clue tempat ini.
   */
  const generateClueForPlace = async (place, placesList, city, preferredPlaces = []) => {
    const cached = await getPlaceClue(city, place.name);
    if (cached) return cached;

    // Kumpulkan batch tempat yang belum punya clue. Prioritaskan tempat yang
    // memang akan dipakai (roundPlaces) agar 1 request menghangatkan banyak ronde.
    const cachedNames = await getCachedPlaceNames(city);
    const batch = [];
    const addCandidate = (p) => {
      if (!p || batch.length >= CLUE_BATCH_SIZE) return;
      if (cachedNames.has(p.name)) return;
      if (batch.some(b => b.name === p.name)) return;
      batch.push(p);
    };

    preferredPlaces.forEach(addCandidate);
    addCandidate(place);
    for (const p of placesList) {
      if (batch.length >= CLUE_BATCH_SIZE) break;
      addCandidate(p);
    }

    // Generate batch dengan retry (1 request per percobaan, sekuensial)
    let results = null;
    for (let attempt = 0; attempt <= CLUE_BATCH_RETRIES && !results; attempt++) {
      try {
        results = await generateGameCluesBatch(batch, placesList);
      } catch (error) {
        console.warn(`[GameLogic] Batch attempt ${attempt + 1} failed:`, error.message);
      }
    }

    if (!results || results.size === 0) {
      // Fallback: generate tempat ini saja agar ronde tidak macet
      const single = await generateGameClue(place, placesList);
      await savePlaceClue(city, place.name, single);
      return single;
    }

    // Simpan semua hasil batch ke cache global
    await Promise.all(
      batch.map(async (p) => {
        const clue = results.get(p.name);
        if (clue) await savePlaceClue(city, p.name, clue);
      })
    );

    const clue = results.get(place.name);
    if (clue) return clue;

    // Tempat ini tidak ada di hasil batch — generate & simpan sendiri
    const single = await generateGameClue(place, placesList);
    await savePlaceClue(city, place.name, single);
    return single;
  };

  // Dedup: gabungkan pemanggilan bersamaan untuk tempat yang sama agar tidak
  // menembak Gemini dua kali (mis. dua pemain start kota dingin bersamaan).
  const getClueForPlace = (place, placesList, city, preferredPlaces = []) => {
    const key = `${String(city).toLowerCase().trim()}__${place.name}`;
    const existing = inFlightClues.get(key);
    if (existing) return existing;

    const promise = generateClueForPlace(place, placesList, city, preferredPlaces);
    inFlightClues.set(key, promise);
    const clear = () => {
      if (inFlightClues.get(key) === promise) inFlightClues.delete(key);
    };
    promise.then(clear, clear);
    return promise;
  };

  /**
   * Prewarm ronde 2..N di background secara sekuensial (1 request pada satu
   * waktu). Aman gagal — ronde terkait akan generate ulang saat dibuka.
   */
  const prewarmClues = async (placesList, sequence, city) => {
    try {
      for (const place of sequence.slice(1)) {
        await getClueForPlace(place, placesList, city, sequence);
      }
    } catch (error) {
      console.error('[GameLogic] Prewarm failed:', error);
    }
  };

  const prepareNextRound = async (
    placesList = state.placesList,
    roundPlaces = state.roundPlaces,
    round = state.round,
    city = state.city
  ) => {
    dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Model AI sedang membuat teka-teki...` } });

    try {
      let targetPlace;
      let questionData;

      const plannedPlace = Array.isArray(roundPlaces) ? roundPlaces[round - 1] : null;

      if (plannedPlace) {
        targetPlace = plannedPlace;
        questionData = await getClueForPlace(plannedPlace, placesList, city, roundPlaces);
      } else {
        // Fallback kalau urutan tidak tersedia — pilih tempat acak dari yang belum dimainkan
        const played = state.playedPlaces || [];
        let availablePlaces = placesList.filter(p => !played.includes(p.name));
        if (availablePlaces.length === 0) availablePlaces = placesList;

        targetPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
        questionData = await generateGameClue(targetPlace, placesList);
        await savePlaceClue(city, targetPlace.name, questionData);
      }

      // Increment used_count hanya saat clue benar-benar disajikan
      incrementPlaceWeight(city, state.token || 'guest', targetPlace.name);

      const method = pickMethod();
      dispatch({
        type: 'SET_QUESTION',
        payload: {
          question: questionData,
          placeName: targetPlace.name,
          method,
          activateTimer: state.screen === 'GAME',
        }
      });

      const difficulty = questionData.difficulty || 'medium';
      const config = DIFFICULTY_CONFIG[difficulty];
      const offsetCenter = offsetCoordinate(targetPlace.lat, targetPlace.lng, config.radius);
      dispatch({
        type: 'SET_CIRCLE',
        payload: {
          center: offsetCenter,
          radius: config.radius * 1000,
        }
      });

    } catch (error) {
      console.error('[prepareNextRound] ERROR:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { status: false } });
    }
  };
  const submitAnswer = (method, data) => {
    if (!state.timerActive || !state.currentQuestion) return { isCorrect: false, mapResultStatus: null, textResultStatus: null };
    dispatch({ type: 'STOP_TIMER' });

    let isCorrect = false;
    let points = 0;
    let distanceInfo = null;
    let mapResultStatus = null;
    let textResultStatus = null;

    if (method === 'TEXT') {
      const frac = scoreText(buildAcceptedAnswers(state.currentQuestion), data);
      isCorrect = frac > 0;
      points = Math.round((100 + state.timeLeft) * frac * METHOD_MULT.TEXT);
      textResultStatus = frac === 1 ? 'correct' : frac > 0 ? 'almost' : 'wrong';
    } else if (method === 'MCQ') {
      isCorrect = data === state.currentQuestion.answer;
      if (isCorrect) points = Math.round((100 + state.timeLeft) * METHOD_MULT.MCQ);
    } else if (method === 'MAP') {
      const { lat, lng } = data;
      const answerLat = state.currentQuestion.lat;
      const answerLng = state.currentQuestion.lng;
      const difficulty = state.currentQuestion.difficulty || 'medium';
      const config = DIFFICULTY_CONFIG[difficulty];
      const distance = getDistanceFromLatLonInKm(lat, lng, answerLat, answerLng);
      distanceInfo = distance.toFixed(1);

      const frac = mapFraction(distance, config);
      isCorrect = frac > 0;
      points = Math.round((100 + state.timeLeft) * frac * METHOD_MULT.MAP);
      mapResultStatus = distance <= config.preciseThreshold
        ? 'correct'
        : frac > 0 ? 'almost' : 'wrong';
    }

    handleResult(isCorrect, method, points, distanceInfo, mapResultStatus);
    return { isCorrect, mapResultStatus: mapResultStatus || null, textResultStatus: textResultStatus || null };
  };

  const handleTimeUp = () => {
    dispatch({ type: 'STOP_TIMER' });
    handleResult(false, 'TIME_UP', 0, null);
  };

  const handleResult = (isCorrect, method, points = 0, distanceInfo = null, mapResultStatus = null) => {
    dispatch({
      type: 'UPDATE_ACCURACY',
      payload: {
        total: 1,
        correct: isCorrect ? 1 : 0
      }
    });

    if (isCorrect && points > 0) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0D9488', '#FBBF24', '#ffffff']
      });
    }

    let finalFact = state.currentQuestion.fun_fact;
    if (distanceInfo !== null && method === 'MAP') {
      if (isCorrect) {
        finalFact += `\n\nTebakanmu berjarak ${distanceInfo} km dari lokasi sebenarnya.`;
      } else {
        finalFact += `\n\nTebakanmu berjarak ${distanceInfo} km — terlalu jauh dari lokasi sebenarnya.`;
      }
    }

    dispatch({
      type: 'ANSWER_RESULT',
      payload: {
        points,
        factData: {
          name: state.currentQuestion.answer,
          fact: finalFact,
          correct: isCorrect,
          method,
          mapResultStatus: mapResultStatus || null,
        }
      }
    });
  };

  const nextRound = async () => {
    if (state.round >= state.maxRounds) {
      dispatch({ type: 'END_GAME' });
    } else {
      dispatch({
        type: 'SET_LOADING',
        payload: { status: true, message: 'Menyiapkan ronde berikutnya...' },
      });
      dispatch({ type: 'NEXT_ROUND' });
      await prepareNextRound(
        state.placesList,
        state.roundPlaces,
        state.round + 1,
        state.city
      );
    }
  };

  const resetGame = () => {
    dispatch({ type: 'RESET_GAME' });
  };

  return {
    state,
    setMapInstance,
    startGame,
    submitAnswer,
    nextRound,
    resetGame
  };
};
