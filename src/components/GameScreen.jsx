import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameLogic } from '../hooks/useGameLogic';
import CluePanel from './CluePanel';
import MapView from './MapView';
import AnswerInput from './AnswerInput';
import { Timer, Trophy, ArrowRight, Info } from 'lucide-react';

const GameScreen = () => {
  const { state, submitAnswer, nextRound } = useGameLogic();
  const [mapGuess, setMapGuess] = useState(null);
  const [lastAnswerStatus, setLastAnswerStatus] = useState(null); // 'correct', 'wrong', null
  
  const question = state.currentQuestion;

  const handleSubmit = (method, data) => {
    const isCorrect = submitAnswer(method, data);
    setLastAnswerStatus(isCorrect ? 'correct' : 'wrong');
  };

  const handleNextRound = () => {
    setLastAnswerStatus(null);
    setMapGuess(null);
    nextRound();
  };

  if (!question && state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-lg font-bold text-slate-700">{state.loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (!question) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-6"
    >
      {/* Header */}
      <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-heading font-extrabold text-dark">Tebakin<span className="text-primary">Aja</span> 🗺️</span>
          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold ml-2">
            Ronde {state.round}/{state.maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-secondary-dark font-extrabold text-xl">
            <Trophy fill="currentColor" size={24} />
            {state.score} pts
          </div>
          
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg
            ${state.timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}
          `}>
            <Timer size={20} />
            00:{state.timeLeft.toString().padStart(2, '0')}
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left Column: Clue & Input */}
        <motion.div 
          className="w-full lg:w-[450px] flex flex-col gap-6"
          animate={lastAnswerStatus === 'wrong' ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <div className="flex-1 min-h-[250px]">
             <CluePanel clue={question.clue} difficulty={question.difficulty} />
          </div>
          
          <div className="relative">
            <AnswerInput 
              choices={question.choices} 
              onSubmit={handleSubmit}
              disabled={!state.timerActive}
              mapGuess={mapGuess}
            />

            {/* Answer Overlay */}
            <AnimatePresence>
              {!state.timerActive && lastAnswerStatus && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl z-20 flex flex-col items-center justify-center p-6 text-center shadow-lg border border-slate-100"
                >
                  {lastAnswerStatus === 'correct' ? (
                    <>
                      <div className="text-5xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-green-600 mb-1">BENAR!</h3>
                      <p className="text-slate-600 font-medium mb-4">Itu adalah <span className="font-bold text-dark">{question.answer}</span></p>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-2">😢</div>
                      <h3 className="text-2xl font-bold text-red-600 mb-1">SALAH / WAKTU HABIS</h3>
                      <p className="text-slate-600 font-medium mb-4">Jawaban yang benar: <span className="font-bold text-dark">{question.answer}</span></p>
                    </>
                  )}
                  
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm text-left w-full mb-6 flex gap-3 border border-blue-100">
                    <Info className="shrink-0 mt-0.5" size={18} />
                    <p><strong>Tahukah Kamu?</strong> {question.fun_fact}</p>
                  </div>

                  <button 
                    onClick={handleNextRound}
                    className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl shadow-[0_4px_0_0_#0F766E] transition-all flex items-center gap-2"
                  >
                    {state.round >= state.maxRounds ? 'Lihat Hasil Akhir' : 'Lanjut Ronde Berikutnya'} <ArrowRight size={18} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Column: Map */}
        <div className="flex-1 min-h-[400px] lg:min-h-0">
           <MapView onMapClick={(pos) => setMapGuess(pos)} />
        </div>

      </div>
    </motion.div>
  );
};

export default GameScreen;
