import React, { useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { GameProvider, GameContext } from './context/GameContext';
import LandingPage from './components/LandingPage';
import CitySelection from './components/CitySelection';
import GameScreen from './components/GameScreen';
import ResultScreen from './components/ResultScreen';
import { AnimatePresence } from 'framer-motion';
import { useGameLogic } from './hooks/useGameLogic';

const libraries = ['places'];

const MainApp = () => {
  const { state, startGame, submitAnswer, nextRound, resetGame } = useGameLogic();
  const { dispatch } = useContext(GameContext);
  

  // Load Google Maps API at the root level
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: libraries
  });

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 p-4 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Error Memuat Peta</h1>
          <p>Pastikan API Key Google Maps Anda valid dan diatur di .env</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="w-full min-h-screen relative overflow-hidden bg-light">
      <AnimatePresence mode="wait">
        {state.screen === 'HOME' && <LandingPage key="home" />}
        {state.screen === 'CITY_SELECTION' && 
          <CitySelection 
            key="city_selection" 
            startGame={startGame}
            onBack={() => dispatch({ type: 'SET_SCREEN', payload: 'HOME' })}
          />}
        {state.screen === 'GAME' && 
          <GameScreen key="game" submitAnswer={submitAnswer} nextRound={nextRound} />}
        {state.screen === 'RESULT' && 
          <ResultScreen key="result" />}
      </AnimatePresence>
    </main>
  );
};

function App() {
  return (
    <GameProvider>
      <MainApp />
    </GameProvider>
  );
}

export default App;
