import { useContext, useEffect, useRef } from 'react';
import { GameContext } from '../context/GameContext';
import { fetchPlacesByCity } from '../services/placesService';
import { generateGameClue } from '../services/geminiService';
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
  easy:   { radius: 3,  wrongThreshold: 6  },
  medium: { radius: 7,  wrongThreshold: 14 },
  hard:   { radius: 12, wrongThreshold: 24 },
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
      const places = await fetchPlacesByCity(city);
      if (places.length < state.maxRounds) {
        throw new Error("Tidak menemukan cukup landmark di kota ini.");
      }
      dispatch({ type: 'START_GAME', payload: { placesList: places } });
      await prepareNextRound(places, []);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const prepareNextRound = async (placesList = state.placesList, playedPlaces = state.playedPlaces) => {
    dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Menyiapkan pertanyaan...` } });
    
    try {
      // Pick random place not played yet
      const availablePlaces = placesList.filter(p => !playedPlaces.includes(p.name));
      const targetPlace = availablePlaces[Math.floor(Math.random() * availablePlaces.length)];
      const desiredDifficulty = pickDifficulty();
      
      // biarkan model langsung memutuskan difficult game sudah sesuai (lebih cepat)
      let questionData = await generateGameClue(targetPlace, placesList);
      let attempts = 1;
      
      // biarkan model cek ulang pertanyaan difficult sudah sesuai atau belum (lebih akurat tapi lambat)
      // while (questionData.difficulty !== desiredDifficulty && attempts < 2) {
      //   questionData = await generateGameClue(targetPlace, placesList);
      //   attempts++;
      // }
      
      dispatch({ 
        type: 'SET_QUESTION', 
        payload: { question: questionData, placeName: targetPlace.name, method: pickMethod() } 
      });

      // Set lingkaran radius dengan tengah yang sudah di-offset
      const difficulty = questionData.difficulty || 'medium';
      const config = DIFFICULTY_CONFIG[difficulty];
      const offsetCenter = offsetCoordinate(targetPlace.lat, targetPlace.lng);

      dispatch({
        type: 'SET_CIRCLE',
        payload: {
          center: offsetCenter,
          radius: config.radius * 1000, // convert km ke meter untuk Google Maps Circle
        }
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { status: false } });
    }
  };

  const submitAnswer = (method, data) => {
    if (!state.timerActive || !state.currentQuestion) return;
    dispatch({ type: 'STOP_TIMER' });

    let isCorrect = false;
    let points = 0;
    let distanceInfo = null;

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

      // Minimum panjang input
      const shortestAnswer = acceptedAnswers.reduce((a, b) => 
        a.length < b.length ? a : b
      );
      const minLength = Math.max(4, Math.floor(shortestAnswer.length * 0.4));

      if (userInput.length < minLength) {
        // Terlalu pendek → 0 poin, salah
        isCorrect = false;
        points = 0;
      } else {
        // Cek exact/fuzzy match dulu
        const fuse = new Fuse(acceptedAnswers, { 
          threshold: 0.3,
          minMatchCharLength: 4,
          ignoreLocation: true,
        });
        const exactResult = fuse.search(userInput);

        if (exactResult.length > 0) {
          // Match bagus → poin penuh
          isCorrect = true;
          points = 100 + (state.timeLeft * 2);
        } else {
          // Cek partial match dengan threshold lebih longgar
          const fusePartial = new Fuse(acceptedAnswers, { 
            threshold: 0.6,
            minMatchCharLength: 3,
            ignoreLocation: true,
          });
          const partialResult = fusePartial.search(userInput);

          if (partialResult.length > 0) {
            const shortestAccepted = acceptedAnswers.reduce((a, b) => 
              a.length < b.length ? a : b
            );

            const lengthRatio = userInput.length / shortestAccepted.length;

            if (lengthRatio < 0.4) {
              isCorrect = false;
              points = 0;
            } else if (lengthRatio < 0.6) {
              isCorrect = true;
              points = 20;
            } else {
              isCorrect = true;
              points = 40;
            }
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

      if (distance > config.wrongThreshold) {
        // Di luar batas threshold → salah
        isCorrect = false;
        points = 0;
        distanceInfo = distance.toFixed(1);
      } else {
        // Dalam threshold → benar, hitung poin berdasarkan jarak
        isCorrect = true;
        points = calculateMapScore(distance, config.radius);
        distanceInfo = distance.toFixed(1);
      }
    }

    handleResult(isCorrect, method, points, distanceInfo);
    return isCorrect;
  };

  const handleTimeUp = () => {
    dispatch({ type: 'STOP_TIMER' });
    handleResult(false, 'TIME_UP', 0, null);
  };

  const handleResult = (isCorrect, method, points = 0, distanceInfo = null) => {
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
          method
        }
      }
    });
  };

  const nextRound = async () => {
    if (state.round >= state.maxRounds) {
      dispatch({ type: 'END_GAME' });
    } else {
      dispatch({ type: 'NEXT_ROUND' });
      await prepareNextRound();
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
