import React, { useState, useEffect, useContext } from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import { GameContext } from '../context/GameContext';
import MapView from './MapView';
import ClueModal from './ClueModal';
import { Settings, Timer, Trophy, HelpCircle } from 'lucide-react';
import SettingsPage from './SettingsPage';
import Swal from 'sweetalert2';
import { LogOut } from 'lucide-react';

const GameScreen = ({submitAnswer, nextRound}) => {
  // const { state, submitAnswer, nextRound } = useGameLogic();
  const { dispatch } = useContext(GameContext);
  const { state } = useContext(GameContext);
  const [mapGuess, setMapGuess] = useState(null);
  const [lastAnswerStatus, setLastAnswerStatus] = useState(null);
  const [mapResultStatus, setMapResultStatus] = useState(null);
  const [textResultStatus, setTextResultStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);

  const question = state.currentQuestion;

  // Deteksi waktu habis (time-up) — timerActive jadi false tanpa user submit
  useEffect(() => {
    if (!state.timerActive && question && lastAnswerStatus === null) {
      setLastAnswerStatus('timeout');
      dispatch({ type: 'TOGGLE_CLUE_MODAL', payload: true });
    }
  }, [state.timerActive, question]);

  const handleSubmit = (method, data) => {
    const result = submitAnswer(method, data);
    setLastAnswerStatus(result.isCorrect ? 'correct' : 'wrong');
    if (result.mapResultStatus) setMapResultStatus(result.mapResultStatus);
    if (result.textResultStatus) setTextResultStatus(result.textResultStatus);
    dispatch({ type: 'TOGGLE_CLUE_MODAL', payload: true });
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleNextRound = () => {
    setLastAnswerStatus(null);
    setMapResultStatus(null);
    setTextResultStatus(null);
    setMapGuess(null);
    nextRound();
  };

  const handleExitGame = async () => {
    let countdown = 5;
  
    const result = await Swal.fire({
      title: 'Keluar dari Game?',
      html: `Progress kamu akan hilang dan tidak tersimpan.<br/><br/><b id="swal-exit-countdown">Tombol aktif dalam ${countdown} detik...</b>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, keluar',
      cancelButtonText: 'Lanjut Main',
      allowOutsideClick: false,
      didOpen: () => {
        const confirmBtn = Swal.getConfirmButton();
        const countdownEl = document.getElementById('swal-exit-countdown');
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.cursor = 'not-allowed';
      
        const timer = setInterval(() => {
          countdown--;
          if (countdownEl) {
            countdownEl.textContent = countdown > 0
              ? `Tombol aktif dalam ${countdown} detik...`
              : 'Yakin ingin keluar?';
          }
          if (countdown <= 0) {
            clearInterval(timer);
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
          }
        }, 1000);
      },
    });
  
    if (result.isConfirmed) {
      dispatch({ type: 'RESET_GAME' });
    }
  };

  const handleMapClick = (pos) => {
    setMapGuess(pos);
    // Setelah klik peta, modal muncul kembali otomatis
    dispatch({ type: 'TOGGLE_CLUE_MODAL', payload: true });
  };

  // Peta hanya bisa diklik kalau MAP mode, modal tertutup, dan timer masih jalan
  const isMapClickable =
    state.answerMethod === 'MAP' &&
    !state.showClueModal &&
    state.timerActive;
    
    if (state.isLoading && !question) {
    console.log('[GameScreen] isLoading:', state.isLoading, 'question:', state.currentQuestion?.answer);
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 z-50">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center transition-colors duration-300">
            {state.loadingMessage || 'Memuat...'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            Mohon tunggu sebentar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* ── Header tipis fixed di atas ────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 shadow-sm px-4 h-14 flex items-center justify-between transition-colors duration-300 text-slate-800 dark:text-slate-200">
        <div className="flex items-center gap-2">
          <span>TebakinAja 🗺️</span>
          <button
            onClick={handleExitGame}
            className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-300"
            title="Keluar dari game"
          >
            <LogOut size={18} />
          </button>

          <span>Ronde {state.round}/{state.maxRounds}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Tombol cara bermain */}
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-300"
          >
            <HelpCircle size={20} />
          </button>

          {/* Tombol settings */}
          <button 
            onClick={() => setShowSettings(true)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-300"
          >
            <Settings size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-secondary-dark dark:text-secondary font-extrabold text-sm transition-colors duration-300">
              <Trophy fill="currentColor" size={16} />
              {state.score} pts
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-sm transition-colors duration-300
              ${state.timeLeft <= 10 
                ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400 animate-pulse' 
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300'}`}
            >
              <Timer size={15} />
              00:{state.timeLeft.toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      </header>

      {/* ── Peta full-screen ──────────────────────────────────────── */}
      <MapView
        onMapClick={handleMapClick}
        isClickable={isMapClickable}
        mapGuess={mapGuess}
      />

      {/* Render SettingsPage modal */}
      <SettingsPage 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        token={state.token}
        setToken={(t) => dispatch({ type: 'SET_TOKEN', payload: t })}
        nickname={state.nickname}
        setNickname={(n) => dispatch({ type: 'SET_NICKNAME', payload: n })}
      />

      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          />
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 max-w-md w-full relative z-10 transition-colors duration-300">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 transition-colors duration-300">🗺️ Cara Bermain</h3>
            <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-300 transition-colors duration-300">
              <li className="flex gap-3"><span className="font-bold text-primary dark:text-primary-light">1.</span> Baca clue yang diberikan tentang sebuah tempat ikonik</li>
              <li className="flex gap-3"><span className="font-bold text-primary dark:text-primary-light">2.</span> Tebak lokasinya — sistem akan pilihkan caranya: klik peta, pilih jawaban, atau ketik nama</li>
              <li className="flex gap-3"><span className="font-bold text-primary dark:text-primary-light">3.</span> Semakin cepat dan tepat, skor makin tinggi</li>
              <li className="flex gap-3"><span className="font-bold text-primary dark:text-primary-light">4.</span> Selesaikan 5 ronde dan masuk leaderboard!</li>
            </ol>
            <button 
              onClick={() => setShowHowToPlay(false)}
              className="w-full mt-6 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors duration-300 shadow-[0_4px_0_0_#0F766E]"
            >
              Mengerti!
            </button>
          </div>
        </div>
      )}

      {/* ── Modal floating di atas peta ───────────────────────────── */}
      {question && (
        <ClueModal
          question={question}
          method={state.answerMethod}
          mapGuess={mapGuess}
          onSubmit={handleSubmit}
          onNextRound={handleNextRound}
          lastAnswerStatus={lastAnswerStatus}
          mapResultStatus={mapResultStatus}
          textResultStatus={textResultStatus}
          timerActive={state.timerActive}
          round={state.round}
          maxRounds={state.maxRounds}
        />
      )}
    </div>
  );
};

export default GameScreen;
