import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, HelpCircle, Trophy, Play, X, Settings, UserRound } from 'lucide-react';
import { GameContext } from '../context/GameContext';
import { getLeaderboard, syncLeaderboardNickname } from '../services/firebaseService';
import { updateUserData } from '../services/tokenService';
import { authRestoreSession } from '../services/authService';
import SettingsPage from './SettingsPage';
import { getOrCreateToken, getUserData } from '../services/tokenService';

const MapIllustration = () => {
  const pins = [
    { id: 1, top: '25%', left: '20%' },
    { id: 2, top: '65%', left: '35%' },
    { id: 3, top: '40%', left: '50%' },
    { id: 4, top: '75%', left: '70%' },
    { id: 5, top: '45%', left: '85%' }
  ];

  return (
    <div className="relative w-full h-40 bg-slate-50 dark:bg-slate-900 rounded-2xl mb-8 overflow-hidden border border-slate-100 dark:border-slate-800 flex items-center justify-center transition-colors duration-300">
      <svg className="absolute w-full h-full opacity-10 text-primary" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path fill="currentColor" d="M10,40 Q20,20 40,30 T70,40 T90,30 Q95,60 80,70 T40,80 T10,60 Z" />
      </svg>
      
      {pins.map((pin, i) => (
        <motion.div
          key={pin.id}
          className="absolute text-secondary"
          style={{ top: pin.top, left: pin.left }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 + (i * 0.2), type: "spring", stiffness: 300, damping: 15 }}
        >
          <MapPin size={28} fill="currentColor" className="drop-shadow-md" />
        </motion.div>
      ))}
    </div>
  );
};

const LandingPage = () => {
  const { state, dispatch } = useContext(GameContext);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [localNickname, setLocalNickname] = useState(state.nickname || '');
  const [nicknameError, setNicknameError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const validateNickname = async (name) => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace('/api/generate-clue', '') || '';
    const MAX_RETRIES = 1;
    const TIMEOUT_MS = 10000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Memeriksa nickname...` } });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(`${BACKEND_URL}/api/validate-nickname`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Token': import.meta.env.VITE_APP_SECRET_TOKEN,
          },
          body: JSON.stringify({ nickname: name }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          dispatch({ type: 'SET_LOADING', payload: { status: false } });
          return true;
        }
        const data = await response.json();
        dispatch({ type: 'SET_LOADING', payload: { status: false } });
        return data.appropriate ?? true;
      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        console.warn(`[validateNickname] Attempt ${attempt} failed (${isTimeout ? 'timeout 5s' : err.message})`);
        if (attempt === MAX_RETRIES) {
          dispatch({ type: 'SET_LOADING', payload: { status: false } });
          return true; // fallback: allow setelah semua retry gagal
        }
        await new Promise(res => setTimeout(res, 500));
      }
    }
    dispatch({ type: 'SET_LOADING', payload: { status: false } });
    return true;
  };

  useEffect(() => {
    getOrCreateToken().then(async (t) => {
      if (t) {
        dispatch({ type: 'SET_TOKEN', payload: t });
        const data = await getUserData(t);
        if (data && data.nickname) {
          dispatch({ type: 'SET_NICKNAME', payload: data.nickname });
          setLocalNickname(data.nickname);
        }
      }
    });

    const restoreSession = async () => {
      const savedUser = await authRestoreSession();
      if (savedUser) {
        dispatch({ type: 'SET_GOOGLE_USER', payload: savedUser });
      }
    };
    restoreSession();
  }, [dispatch]);

  const handleStart = async () => {
    if (!localNickname.trim() || isValidating) return;
    setNicknameError('');
    setIsValidating(true);
    const isAppropriate = await validateNickname(localNickname.trim());
    if (!isAppropriate) {
      setNicknameError('Nickname tidak pantas, coba yang lain!');
      setIsValidating(false);
      return;
    }
    // Simpan nickname ke Firestore juga
    const trimmedNickname = localNickname.trim();
    const identifier = state.googleUser?.uid || state.token;

    dispatch({ type: 'SET_NICKNAME', payload: trimmedNickname });
    if (identifier) {
      await updateUserData(identifier, { nickname: trimmedNickname });
      await syncLeaderboardNickname(identifier, trimmedNickname);
    }
    setIsValidating(false);
    dispatch({ type: 'SET_SCREEN', payload: 'CITY_SELECTION' });
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(false);
    try {
      const data = await getLeaderboard();
      setLeaderboardData(data);
    } catch (err) {
      setLeaderboardError(true);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const openLeaderboard = () => {
    setShowLeaderboard(true);
    fetchLeaderboard();
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: 20 }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-4 relative"
    >
      <button 
        onClick={() => setShowSettings(true)} 
        className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-3 z-20 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-110"
      >
        <Settings size={24} />
      </button>
      <button
        onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'PROFILE' })}
        className="absolute top-4 right-20 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-3 z-20 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-110"
        title="Lihat profil"
      >
        <UserRound size={24} />
      </button>

      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0D9488 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 max-w-md w-full relative z-10 border border-slate-100 dark:border-slate-700 flex flex-col items-center transition-colors duration-300"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-6">
          <span className="text-3xl">🗺️</span>
          <h1 className="text-4xl font-heading font-extrabold text-dark dark:text-white transition-colors duration-300">Tebakin<span className="text-primary">Aja</span></h1>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full">
          <MapIllustration />
        </motion.div>

        <motion.h2 variants={itemVariants} className="text-xl font-bold text-center text-slate-800 dark:text-slate-200 mb-3 leading-tight transition-colors duration-300">
          Seberapa kenal kamu dengan kotamu sendiri?
        </motion.h2>
        <motion.p variants={itemVariants} className="text-slate-500 dark:text-slate-400 text-sm text-center mb-8 font-medium leading-relaxed transition-colors duration-300">
          Kita sering lebih tahu tempat viral di kota lain daripada di kota kita sendiri. TebakinAja hadir untuk mengubah itu jadi tantangan seru berbasis kearifan lokal Indonesia.
        </motion.p>

        <motion.div variants={itemVariants} className="flex gap-4 w-full mb-8">
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="flex-1 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 px-3 rounded-xl transition-colors duration-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm"
          >
            <HelpCircle size={18} className="text-primary" /> Cara Main
          </button>
          <button 
            onClick={openLeaderboard}
            className="flex-1 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 px-3 rounded-xl transition-colors duration-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-sm"
          >
            <Trophy size={18} className="text-secondary" /> Leaderboard
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full mb-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 transition-colors duration-300">Siapa namamu?</label>
          <input 
            name='nama'
            id='nama'
            type="text" 
            placeholder="Masukkan nickname..."
            maxLength={20}
            value={localNickname}
            onChange={(e) => { setLocalNickname(e.target.value); setNicknameError(''); }}
            className="w-full appearance-none bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 px-4 rounded-xl leading-tight focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary transition-colors duration-300 font-semibold"
          />
          {nicknameError && (
            <p className="mt-2 text-sm text-red-500 font-semibold">{nicknameError}</p>
          )}
        </motion.div>

        {state.isLoading && (
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
        )}

        <motion.button
          variants={itemVariants}
          whileHover={localNickname.trim() && !isValidating ? { scale: 1.02 } : {}}
          whileTap={localNickname.trim() && !isValidating ? { scale: 0.95 } : {}}
          onClick={handleStart}
          disabled={!localNickname.trim() || isValidating}
          className="w-full bg-secondary hover:bg-secondary-dark text-dark font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#D97706] hover:shadow-[0_2px_0_0_#D97706] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-[4px]"
        >
          {isValidating ? <span className="animate-pulse">Memeriksa...</span> : <>Pilih Kota <Play fill="currentColor" size={20} /></>}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showHowToPlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowHowToPlay(false)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10 transition-colors duration-300"
            >
              <button onClick={() => setShowHowToPlay(false)} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-2 transition-colors duration-300">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 transition-colors duration-300">
                <HelpCircle className="text-primary" /> Cara Main TebakinAja
              </h3>
              <ul className="space-y-4 text-slate-600 dark:text-slate-300 font-medium text-sm md:text-base transition-colors duration-300">
                <li className="flex gap-3 items-start"><span className="text-xl leading-none">🏙️</span> <span>Pilih kota yang ingin kamu tantang</span></li>
                <li className="flex gap-3 items-start"><span className="text-xl leading-none">🔍</span> <span>Baca clue tentang sebuah tempat</span></li>
                <li className="flex gap-3 items-start"><span className="text-xl leading-none">📍</span> <span>Tebak lokasinya di peta atau ketik jawabannya</span></li>
                <li className="flex gap-3 items-start"><span className="text-xl leading-none">⚡</span> <span>Semakin cepat & tepat, skor makin tinggi</span></li>
                <li className="flex gap-3 items-start"><span className="text-xl leading-none">🏆</span> <span>Saingi skor pemain lain di leaderboard!</span></li>
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaderboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowLeaderboard(false)}
            />
            <motion.div
              variants={modalVariants} initial="hidden" animate="visible" exit="exit"
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10 max-h-[85vh] flex flex-col transition-colors duration-300"
            >
              <button onClick={() => setShowLeaderboard(false)} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-2 transition-colors duration-300">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 shrink-0 transition-colors duration-300">
                <Trophy className="text-secondary" fill="currentColor" /> Leaderboard Top 10
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loadingLeaderboard ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : leaderboardError ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 font-medium transition-colors duration-300">
                    Leaderboard belum tersedia
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400 font-medium transition-colors duration-300">
                    Belum ada skor. Jadilah yang pertama!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboardData.map((entry, idx) => (
                      <div key={entry.id} className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3 rounded-xl gap-4 transition-colors duration-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors duration-300 ${
                          idx === 0 
                            ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400' 
                            : idx === 1 
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' 
                              : idx === 2 
                                ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400' 
                                : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-350 border border-slate-200 dark:border-slate-650'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate transition-colors duration-300">{entry.nickname}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate transition-colors duration-300">{entry.city} • {new Date(entry.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>                        </div>
                        <div className="font-extrabold text-primary dark:text-primary-light shrink-0 text-lg transition-colors duration-300">
                          {entry.score}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsPage 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
            token={state.token}
            setToken={(t) => dispatch({ type: 'SET_TOKEN', payload: t })}
            nickname={state.nickname}
            setNickname={(n) => {
              dispatch({ type: 'SET_NICKNAME', payload: n });
              setLocalNickname(n);
            }}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default LandingPage;