import React, { createContext, useReducer } from 'react';

// SCREENS: 'HOME', 'CITY_SELECTION', 'GAME', 'RESULT'
const initialState = {
  screen: 'HOME',
  token: null,
  googleUser: null,
  showClueModal: true,
  answerMethod: 'MCQ',
  total_answers: 0,
  correct_answers: 0,
  lastRoundPoints: 0,
  nickname: localStorage.getItem('tebakinaja_nickname') || '',
  city: '',
  placesList: [],
  playedPlaces: [],
  currentQuestion: null,
  round: 1,
  maxRounds: 5,
  score: 0,
  timeLeft: 60,
  timerActive: false,
  funFacts: [],
  isLoading: false,
  loadingMessage: '',
  error: null,
  mapInstance: null,
  circleCenter: null,   // { lat, lng } — tengah lingkaran yang sudah di-offset
  circleRadius: 3000,   // dalam meter, default easy
};

const gameReducer = (state, action) => {
  switch (action.type) {
    case 'SET_TOKEN':
      return { ...state, token: action.payload };
    case 'SET_GOOGLE_USER':
      return { ...state, googleUser: action.payload };
    case 'TOGGLE_CLUE_MODAL':
      return { ...state, showClueModal: action.payload };
    case 'UPDATE_ACCURACY':
      return {
        ...state,
        total_answers: state.total_answers + action.payload.total,
        correct_answers: state.correct_answers + action.payload.correct
      };
    case 'SET_NICKNAME':
      localStorage.setItem('tebakinaja_nickname', action.payload);
      return { ...state, nickname: action.payload };
    case 'SET_SCREEN':
      return { ...state, screen: action.payload };
    case 'SET_CITY':
      return { ...state, city: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload.status, loadingMessage: action.payload.message || '' };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_MAP_INSTANCE':
      return { ...state, mapInstance: action.payload };
    case 'START_GAME':
      return {
        ...state,
        placesList: action.payload.placesList,
        screen: 'GAME',
        round: 1,
        score: 0,
        playedPlaces: [],
        funFacts: [],
        error: null
      };
    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.payload.question,
        playedPlaces: [...state.playedPlaces, action.payload.placeName],
        answerMethod: action.payload.method || 'MCQ',
        showClueModal: true,
        lastRoundPoints: 0,
        circleCenter: null,   // reset setiap ronde baru
        circleRadius: 3000,
        timeLeft: 60,
        timerActive: true,
      };
    case 'SET_CIRCLE':
      return {
        ...state,
        circleCenter: action.payload.center,
        circleRadius: action.payload.radius,
      };
    case 'TICK_TIMER':
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
    case 'STOP_TIMER':
      return { ...state, timerActive: false };
    case 'ANSWER_RESULT':
      return {
        ...state,
        score: state.score + action.payload.points,
        lastRoundPoints: action.payload.points,
        funFacts: [...state.funFacts, action.payload.factData],
        timerActive: false
      };
    case 'NEXT_ROUND':
      return { ...state, round: state.round + 1, currentQuestion: null };
    case 'END_GAME':
      return { ...state, screen: 'RESULT', timerActive: false };
    case 'RESET_GAME':
      return {
        ...initialState,
        nickname: state.nickname,
        mapInstance: state.mapInstance,
        token: state.token,
        googleUser: state.googleUser
      };
    default:
      return state;
  }
};

export const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};
