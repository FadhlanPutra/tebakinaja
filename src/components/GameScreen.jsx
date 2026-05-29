import React, { useState, useEffect, useContext } from 'react';
import { GameContext } from '../context/GameContext';
import MapView from './MapView';
import ClueModal from './ClueModal';
import { Settings, Timer, Trophy, HelpCircle } from 'lucide-react';
import SettingsPage from './SettingsPage';
import Swal from 'sweetalert2';
import { LogOut } from 'lucide-react';

const GameScreen = ({submitAnswer, nextRound}) => {
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
      html: `Progress kamu akan hilang dan tidak tersimpan.<br/><br/><span id="swal-exit-countdown"></span>`,
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
        confirmBtn.textContent = `${countdown} detik`
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.cursor = 'not-allowed';
      
        const timer = setInterval(() => {
          countdown--;
          if (countdownEl) {
            confirmBtn.textContent = countdown > 0
              ? `${countdown} detik`
              : 'Ya, keluar!';
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

  // Jangan tampilkan peta sebelum clue dari server siap — hindari layar kosong
  if (!question) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 z-50 supports-[height:100dvh]:h-[100dvh] h-screen">
        {state.error ? (
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl max-w-sm mx-4 border border-slate-100 dark:border-slate-700/50 text-center">
            <p className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">Gagal memuat ronde</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">{state.error}</p>
            <button
              onClick={() => dispatch({ type: 'RESET_GAME' })}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors"
            >
              Kembali ke Menu
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-700/50 mx-4 max-w-sm">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center">
              {state.loadingMessage || 'Menyiapkan teka-teki...'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              AI sedang membuat clue untuk ronde ini
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden supports-[height:100dvh]:h-[100dvh] h-screen">
      {/* ── Header tipis fixed di atas ────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700/50 shadow-sm px-2.5 sm:px-4 h-12 sm:h-14 flex items-center justify-between gap-2 transition-colors duration-300 text-slate-800 dark:text-slate-200 pt-[env(safe-area-inset-top,0px)] min-h-[calc(3rem+env(safe-area-inset-top,0px))] sm:min-h-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="hidden sm:inline text-sm font-bold truncate">TebakinAja 🗺️</span>
          <span className="sm:hidden text-base" aria-hidden>🗺️</span>
          <button
            onClick={handleExitGame}
            className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-300 shrink-0 p-1"
            title="Keluar dari game"
          >
            <LogOut size={18} />
          </button>

          <span className="text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0">
            R{state.round}/{state.maxRounds}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-300 p-1.5"
            aria-label="Cara bermain"
          >
            <HelpCircle size={18} className="sm:w-5 sm:h-5" />
          </button>

          <button 
            onClick={() => setShowSettings(true)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-300 p-1.5"
            aria-label="Pengaturan"
          >
            <Settings size={18} className="sm:w-5 sm:h-5" />
          </button>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 text-secondary-dark dark:text-secondary font-extrabold text-xs sm:text-sm transition-colors duration-300">
              <Trophy fill="currentColor" size={14} className="sm:w-4 sm:h-4 shrink-0" />
              <span className="tabular-nums">{state.score}</span>
            </div>
            <div className={`flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold text-xs sm:text-sm transition-colors duration-300 tabular-nums
              ${state.timeLeft <= 10 
                ? 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400 animate-pulse' 
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300'}`}
            >
              <Timer size={14} className="sm:w-[15px] sm:h-[15px] shrink-0" />
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
