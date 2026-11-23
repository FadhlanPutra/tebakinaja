import { useContext, useEffect, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import { fetchPlacesByCity } from '../services/placesService';
import { generateGameClue } from '../services/geminiService';
import { getPlaceWeights, incrementPlaceWeight, pickWeightedPlace } from '../services/placeWeightService';
import { 
  saveCluesToCache, 
  getClueFromCache, 
  deleteSessionCache,
  cleanupOldCache,
  generateSessionId 
} from '../services/clueCacheService';
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
    // console.log('[startGame] START', city);
    dispatch({ type: 'SET_CITY', payload: city });
    dispatch({ type: 'SET_ERROR', payload: null });
    
    try {
      cleanupOldCache();
      
      // console.log('[startGame] Fetching places...');
      dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Mencari tempat ikonik di ${city}...` } });
      const places = await fetchPlacesByCity(city);
      // console.log('[startGame] Places fetched:', places.length);

      if (places.length < state.maxRounds) {
        throw new Error("Tidak menemukan cukup landmark di kota ini.");
      }

      const sessionId = generateSessionId(state.token || 'guest');
      dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

      // Siapkan clue ronde 1 dulu — baru masuk layar game (hindari peta kosong)
      await prepareNextRound(places, [], sessionId, 1, city);
      dispatch({ type: 'START_GAME', payload: { placesList: places } });
      // console.log('[startGame] prepareNextRound DONE');

      prefetchRemainingClues(places, [places[0]?.name], sessionId, city);

    } catch (error) {
      console.error('[startGame] ERROR:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      dispatch({ type: 'SET_LOADING', payload: { status: false } });
    }
  };

  /**
   * Fetch clue ronde 2-5 di background dalam 1 batch Gemini
   * Hasilnya disimpan ke Firestore cache
   */
  const prefetchRemainingClues = async (placesList, playedPlaces, sessionId, city) => {
    try {
      const remainingRounds = [2, 3, 4, 5];
      const clues = {};
      let currentPlayed = [...playedPlaces];

      const userToken = state.token || 'guest';
      const weights = await getPlaceWeights(
        city || state.city, 
        userToken
      );

      // Generate semua clue ronde 2-5 secara paralel
      const cluePromises = remainingRounds.map(async (round) => {
        const availablePlaces = placesList.filter(p => !currentPlayed.includes(p.name));
        if (availablePlaces.length === 0) return null;

        const targetPlace = pickWeightedPlace(availablePlaces, weights);
        currentPlayed.push(targetPlace.name);

        incrementPlaceWeight(city, userToken, targetPlace.name);

        const clueData = await generateGameClue(targetPlace, placesList);
        return { round, clueData, placeName: targetPlace.name };
      });

      const results = await Promise.all(cluePromises);

      results.forEach((result) => {
        if (result) {
          clues[result.round.toString()] = {
            ...result.clueData,
            placeName: result.placeName,
            method: pickMethod(),
          };
        }
      });

      // Simpan semua ke Firestore cache sekaligus
      await saveCluesToCache(sessionId, clues);
      // console.log('[GameLogic] Background prefetch complete');

    } catch (error) {
      console.error('[GameLogic] Background prefetch failed:', error);
      // Tidak crash — kalau prefetch gagal, ronde berikutnya akan fetch langsung
    }
  };

  const prepareNextRound = async (
    placesList = state.placesList,
    playedPlaces = state.playedPlaces,
    sessionId = state.sessionId,
    round = state.round,
    city = state.city
  ) => {
    // console.log('[prepareNextRound] START round:', round);
    dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Model AI sedang membuat teka-teki...` } });

    try {
      if (round > 1 && sessionId) {
        // console.log('[prepareNextRound] Checking cache for round:', round);
        const cachedClue = await getClueFromCache(sessionId, round);

        if (cachedClue) {
          // console.log('[prepareNextRound] Cache HIT round:', round);
          dispatch({
            type: 'SET_QUESTION',
            payload: {
              question: cachedClue,
              placeName: cachedClue.placeName,
              method: cachedClue.method || pickMethod(),
              activateTimer: state.screen === 'GAME',
            }
          });

          if (cachedClue.difficulty) {
            const config = DIFFICULTY_CONFIG[cachedClue.difficulty];
            const offsetCenter = offsetCoordinate(cachedClue.lat, cachedClue.lng, config.radius);
            dispatch({
              type: 'SET_CIRCLE',
              payload: {
                center: offsetCenter,
                radius: config.radius * 1000,
              }
            });
          }
          return;
        }

        // console.log('[prepareNextRound] Cache MISS round:', round);
      }

      const availablePlaces = placesList.filter(p => !playedPlaces.includes(p.name));
      // console.log('[prepareNextRound] Available places:', availablePlaces.length);

      const userToken = state.token || 'guest';
      const weights = await getPlaceWeights(city, userToken);
      const targetPlace = pickWeightedPlace(availablePlaces, weights);
      // console.log('[prepareNextRound] Target place:', targetPlace?.name);

      // console.log('[prepareNextRound] Calling Gemini...');
      const questionData = await generateGameClue(targetPlace, placesList);
      // console.log('[prepareNextRound] Gemini DONE:', questionData?.answer);

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
      // console.log('[prepareNextRound] FINALLY - setting loading false');
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
      // Game selesai — hapus cache sesi ini
      if (state.sessionId) {
        deleteSessionCache(state.sessionId);
      }
      dispatch({ type: 'END_GAME' });
    } else {
      dispatch({
        type: 'SET_LOADING',
        payload: { status: true, message: 'Menyiapkan ronde berikutnya...' },
      });
      dispatch({ type: 'NEXT_ROUND' });
      await prepareNextRound(
        state.placesList,
        state.playedPlaces,
        state.sessionId,
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
