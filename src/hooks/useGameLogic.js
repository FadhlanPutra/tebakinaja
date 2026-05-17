import { useContext, useEffect, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import { fetchPlacesByCity } from '../services/placesService';
import { generateGameClue } from '../services/geminiService';
import { 
  saveCluesToCache, 
  getClueFromCache, 
  deleteSessionCache,
  cleanupOldCache,
  generateSessionId 
} from '../services/clueCacheService';
import confetti from 'canvas-confetti';
import Fuse from 'fuse.js';

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

// Offset koordinat secara acak sejauh 0.5-1.5 km ke arah acak
// Dipakai untuk geser tengah lingkaran agar tidak tepat di jawaban
const offsetCoordinate = (lat, lng, minKm = 0.5, maxKm = 1.5) => {
  const distanceKm = minKm + Math.random() * (maxKm - minKm);
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
    dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Mencari landmark di ${city}...` } });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Cleanup cache lama saat memulai game baru
      cleanupOldCache(); // tidak perlu await, biarkan jalan di background

      const places = await fetchPlacesByCity(city);
      if (places.length < state.maxRounds) {
        throw new Error("Tidak menemukan cukup landmark di kota ini.");
      }

      // Generate session ID baru untuk game ini
      const sessionId = generateSessionId(state.token || 'guest');
      dispatch({ type: 'SET_SESSION_ID', payload: sessionId });

      dispatch({ type: 'START_GAME', payload: { placesList: places } });

      // Fetch clue ronde 1 langsung — tampilkan secepat mungkin
      await prepareNextRound(places, [], sessionId, 1);

      // Background fetch clue ronde 2-5 sekaligus dalam 1 batch
      prefetchRemainingClues(places, [places[0]?.name], sessionId);

    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  /**
   * Fetch clue ronde 2-5 di background dalam 1 batch Gemini
   * Hasilnya disimpan ke Firestore cache
   */
  const prefetchRemainingClues = async (placesList, playedPlaces, sessionId) => {
    try {
      const remainingRounds = [2, 3, 4, 5];
      const clues = {};
      let currentPlayed = [...playedPlaces];

      // Generate semua clue ronde 2-5 secara paralel
      const cluePromises = remainingRounds.map(async (round) => {
        const availablePlaces = placesList.filter(p => !currentPlayed.includes(p.name));
        if (availablePlaces.length === 0) return null;

        const targetPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
        currentPlayed.push(targetPlace.name);

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
      console.log('[GameLogic] Background prefetch complete');

    } catch (error) {
      console.error('[GameLogic] Background prefetch failed:', error);
      // Tidak crash — kalau prefetch gagal, ronde berikutnya akan fetch langsung
    }
  };

  const prepareNextRound = async (
    placesList = state.placesList,
    playedPlaces = state.playedPlaces,
    sessionId = state.sessionId,
    round = state.round
  ) => {
    dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Menyiapkan pertanyaan...` } });
    
    try {
      // Ronde 2-5: coba ambil dari cache dulu
      if (round > 1 && sessionId) {
        const cachedClue = await getClueFromCache(sessionId, round);

        if (cachedClue) {
          console.log(`[GameLogic] Cache hit untuk ronde ${round}`);
          dispatch({
            type: 'SET_QUESTION',
            payload: {
              question: cachedClue,
              placeName: cachedClue.placeName,
              method: cachedClue.method || pickMethod(),
            }
          });

          // Set circle untuk MAP mode
          if (cachedClue.difficulty) {
            const config = DIFFICULTY_CONFIG[cachedClue.difficulty];
            const offsetCenter = offsetCoordinate(cachedClue.lat, cachedClue.lng);
            dispatch({
              type: 'SET_CIRCLE',
              payload: {
                center: offsetCenter,
                radius: config.radius * 1000,
              }
            });
          }

          return; // Selesai, tidak perlu fetch ke Gemini
        }

        console.log(`[GameLogic] Cache miss untuk ronde ${round}, fetch ke Gemini...`);
      }

      // Ronde 1 atau cache miss → fetch langsung ke Gemini
      const availablePlaces = placesList.filter(p => !playedPlaces.includes(p.name));
      const targetPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];

      const questionData = await generateGameClue(targetPlace, placesList);
      const method = pickMethod();

      dispatch({ 
        type: 'SET_QUESTION', 
        payload: { question: questionData, placeName: targetPlace.name, method }
      });

      // Set lingkaran radius dengan tengah yang sudah di-offset
      const difficulty = questionData.difficulty || 'medium';
      const config = DIFFICULTY_CONFIG[difficulty];
      const offsetCenter = offsetCoordinate(targetPlace.lat, targetPlace.lng);

      dispatch({
        type: 'SET_CIRCLE',
        payload: {
          center: offsetCenter,
          radius: config.radius * 1000,
        }
      });
    } catch (error) {
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

    // if (method === 'TEXT') {
    //   const acceptedAnswers = state.currentQuestion.accepted_answers || [state.currentQuestion.answer];
    //   const fuse = new Fuse(acceptedAnswers, { threshold: 0.35 });
    //   const result = fuse.search(data.trim());
    //   isCorrect = result.length > 0;
    //   if (isCorrect) points = 100 + (state.timeLeft * 2);
    // } else if (method === 'MCQ') {
    //   isCorrect = data === state.currentQuestion.answer;
    //   if (isCorrect) points = 100 + (state.timeLeft * 2);
    // } else if (method === 'MAP') {
    //   const { lat, lng } = data;
    //   const distance = getDistanceFromLatLonInKm(lat, lng, state.currentQuestion.lat, state.currentQuestion.lng);
    //   isCorrect = true;
    //   points = calculateMapScore(distance);
    //   distanceInfo = distance.toFixed(1);
    // }

    if (method === 'TEXT') {
      const acceptedAnswers = state.currentQuestion.accepted_answers ||
                              [state.currentQuestion.answer];
      const userInput = data.trim().toLowerCase();

      const shortestAnswer = acceptedAnswers.reduce((a, b) =>
        a.length < b.length ? a : b
      );
      const minLength = Math.max(4, Math.floor(shortestAnswer.length * 0.4));

      if (userInput.length < minLength) {
        isCorrect = false;
        points = 0;
        textResultStatus = 'wrong';
      } else {
        const fuse = new Fuse(acceptedAnswers, {
          threshold: 0.3,
          minMatchCharLength: 4,
          ignoreLocation: true,
        });
        const exactResult = fuse.search(userInput);

        if (exactResult.length > 0) {
          isCorrect = true;
          points = 100 + (state.timeLeft * 2);
          textResultStatus = 'correct';
        } else {
          const fusePartial = new Fuse(acceptedAnswers, {
            threshold: 0.6,
            minMatchCharLength: 3,
            ignoreLocation: true,
          });
          const partialResult = fusePartial.search(userInput);

          if (partialResult.length > 0) {
            const lengthRatio = userInput.length / shortestAnswer.length;

            if (lengthRatio < 0.4) {
              isCorrect = false;
              points = 0;
              textResultStatus = 'wrong';
            } else if (lengthRatio < 0.6) {
              isCorrect = true;
              points = Math.round((100 + (state.timeLeft * 2)) * 0.3);
              textResultStatus = 'almost';
            } else {
              isCorrect = true;
              points = Math.round((100 + (state.timeLeft * 2)) * 0.5);
              textResultStatus = 'almost';
            }
          } else {
            isCorrect = false;
            points = 0;
            textResultStatus = 'wrong';
          }
        }
      }
    } else if (method === 'MCQ') {
      isCorrect = data === state.currentQuestion.answer;
      if (isCorrect) points = 100 + (state.timeLeft * 2);
    } else if (method === 'MAP') {
      const { lat, lng } = data;
      const answerLat = state.currentQuestion.lat;
      const answerLng = state.currentQuestion.lng;
      const difficulty = state.currentQuestion.difficulty || 'medium';
      const config = DIFFICULTY_CONFIG[difficulty];
      const distance = getDistanceFromLatLonInKm(lat, lng, answerLat, answerLng);
      distanceInfo = distance.toFixed(1);

      if (distance <= config.preciseThreshold) {
        // Tepat sasaran → benar penuh
        isCorrect = true;
        mapResultStatus = 'correct';
        points = 100 + (state.timeLeft * 2);
      } else if (distance <= config.radius) {
        // Dalam radius tapi tidak presisi → hampir benar
        isCorrect = true;
        mapResultStatus = 'almost';
        points = Math.round((100 + (state.timeLeft * 2)) * 0.5);
      } else if (distance <= config.wrongThreshold) {
        // Di luar radius tapi masih dalam threshold → hampir benar tapi sedikit
        isCorrect = true;
        mapResultStatus = 'almost';
        points = Math.round((100 + (state.timeLeft * 2)) * 0.3);
      } else {
        // Terlalu jauh → salah
        isCorrect = false;
        mapResultStatus = 'wrong';
        points = 0;
      }
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
      dispatch({ type: 'NEXT_ROUND' });
      await prepareNextRound(
        state.placesList,
        state.playedPlaces,
        state.sessionId,
        state.round + 1  // ronde berikutnya
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
