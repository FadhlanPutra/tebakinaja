import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
// import { useGameLogic } from '../hooks/useGameLogic';
import { Trophy, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { saveScore, updateUserStats } from '../services/firebaseService';
import { useRef } from 'react';
import { updateUserData, getUserData } from '../services/tokenService';
import { increment } from 'firebase/firestore';
import { useContext } from 'react';
import { GameContext } from '../context/GameContext';

const ResultScreen = () => {
  // const { state, resetGame } = useGameLogic();
  const { state, dispatch } = useContext(GameContext);
  const resetGame = () => dispatch({ type: 'RESET_GAME' });
  const scoreSaved = useRef(false);

  useEffect(() => {
    if (state.score > 0 && !scoreSaved.current && state.nickname) {
      scoreSaved.current = true;
      saveScore({
        nickname: state.nickname,
        city: state.city,
        score: state.score,
        rounds: state.maxRounds,
        created_at: Date.now(),
        token: state.token || null
      }).catch(err => console.error("Failed to save score:", err));

      const identifier = state.googleUser?.uid || state.token;
      if (identifier) {
        getUserData(identifier).then(userData => {
          const currentHighestScore = userData?.highest_score || 0;
          updateUserStats(identifier, {
            total_games: increment(1),
            highest_score: Math.max(state.score, currentHighestScore),
            total_answers: increment(state.total_answers),
            correct_answers: increment(state.correct_answers)
          }).catch(err => console.error("Failed to update user stats:", err));
        });
      }
    }

    if (state.score > 0) {
      // Big confetti burst for finishing
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#0D9488', '#FBBF24']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#0D9488', '#FBBF24']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [state.score]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen flex items-center justify-center p-4 py-10"
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-100">
        
        <div className="bg-gradient-to-br from-primary to-primary-dark p-10 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
          <Trophy size={64} className="mx-auto mb-4 text-secondary drop-shadow-lg" fill="currentColor" />
          <h1 className="text-3xl font-heading font-bold mb-2 relative z-10">Permainan Selesai!</h1>
          <p className="text-primary-light font-medium relative z-10">Total Skor Akhir Kamu</p>
          <div className="text-7xl font-extrabold text-secondary mt-2 mb-4 drop-shadow-md relative z-10">
            {state.score} <span className="text-2xl font-bold">pts</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm inline-block px-4 py-2 rounded-xl text-white font-semibold text-sm relative z-10">
            Akurasi Sesi ini: {state.correct_answers}/{state.total_answers} benar ({state.total_answers > 0 ? ((state.correct_answers / state.total_answers) * 100).toFixed(0) : 0}%)
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Rangkuman Perjalanan</h2>
          
          <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {state.funFacts.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-4">
                <div className="shrink-0 mt-1">
                  {item.correct ? (
                    <CheckCircle className="text-green-500" size={24} />
                  ) : (
                    <XCircle className="text-red-500" size={24} />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    Ronde {idx + 1}: {item.name}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                      via {item.method}
                    </span>
                  </h4>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    {item.fact}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={resetGame}
            className="w-full bg-secondary hover:bg-secondary-dark text-dark font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#D97706] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#D97706] transition-all flex items-center justify-center gap-2 text-lg"
          >
            Main Lagi <RotateCcw size={20} />
          </button>
        </div>

      </div>
    </motion.div>
  );
};

export default ResultScreen;