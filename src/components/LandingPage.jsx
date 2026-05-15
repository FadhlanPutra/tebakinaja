import React, { useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, HelpCircle, Trophy, Play, X, Settings } from 'lucide-react';
import { GameContext } from '../context/GameContext';
import { getLeaderboard } from '../services/firebaseService';
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
    <div className="relative w-full h-40 bg-slate-50 rounded-2xl mb-8 overflow-hidden border border-slate-100 flex items-center justify-center">
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

  const handleStart = () => {
    if (!localNickname.trim()) return;
    dispatch({ type: 'SET_NICKNAME', payload: localNickname });
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
        className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 p-3 z-20 bg-white rounded-full shadow-md border border-slate-100 transition-all hover:scale-110"
      >
        <Settings size={24} />
      </button>

      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0D9488 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full relative z-10 border border-slate-100 flex flex-col items-center"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-2 mb-6">
          <span className="text-3xl">🗺️</span>
          <h1 className="text-4xl font-heading font-extrabold text-dark">Tebakin<span className="text-primary">Aja</span></h1>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full">
          <MapIllustration />
        </motion.div>

        <motion.h2 variants={itemVariants} className="text-xl font-bold text-center text-slate-800 mb-3 leading-tight">
          Seberapa kenal kamu dengan kotamu sendiri?
        </motion.h2>
        <motion.p variants={itemVariants} className="text-slate-500 text-sm text-center mb-8 font-medium leading-relaxed">
          Kita sering lebih tahu tempat viral di kota lain daripada di kota kita sendiri. TebakinAja hadir untuk mengubah itu jadi tantangan seru berbasis kearifan lokal Indonesia.
        </motion.p>

        <motion.div variants={itemVariants} className="flex gap-4 w-full mb-8">
          <button 
            onClick={() => setShowHowToPlay(true)}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 px-3 rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 text-sm"
          >
            <HelpCircle size={18} className="text-primary" /> Cara Main
          </button>
          <button 
            onClick={openLeaderboard}
            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 px-3 rounded-xl transition-colors border border-slate-200 flex items-center justify-center gap-2 text-sm"
          >
            <Trophy size={18} className="text-secondary" /> Leaderboard
          </button>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">Siapa namamu?</label>
          <input 
            type="text" 
            placeholder="Masukkan nickname..."
            maxLength={20}
            value={localNickname}
            onChange={(e) => setLocalNickname(e.target.value)}
            className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-700 py-3 px-4 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-primary transition-colors font-semibold"
          />
        </motion.div>

        <motion.button
          variants={itemVariants}
          whileHover={localNickname.trim() ? { scale: 1.02 } : {}}
          whileTap={localNickname.trim() ? { scale: 0.95 } : {}}
          onClick={handleStart}
          disabled={!localNickname.trim()}
          className="w-full bg-secondary hover:bg-secondary-dark text-dark font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#D97706] hover:shadow-[0_2px_0_0_#D97706] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-[4px]"
        >
          Mulai Main <Play fill="currentColor" size={20} />
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
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10"
            >
              <button onClick={() => setShowHowToPlay(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <HelpCircle className="text-primary" /> Cara Main TebakinAja
              </h3>
              <ul className="space-y-4 text-slate-600 font-medium text-sm md:text-base">
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
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10 max-h-[85vh] flex flex-col"
            >
              <button onClick={() => setShowLeaderboard(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2 shrink-0">
                <Trophy className="text-secondary" fill="currentColor" /> Leaderboard Top 10
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loadingLeaderboard ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : leaderboardError ? (
                  <div className="text-center py-8 text-slate-500 font-medium">
                    Leaderboard belum tersedia
                  </div>
                ) : leaderboardData.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-medium">
                    Belum ada skor. Jadilah yang pertama!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaderboardData.map((entry, idx) => (
                      <div key={entry.id} className="flex items-center bg-slate-50 border border-slate-100 p-3 rounded-xl gap-4 transition-colors hover:bg-slate-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400 border border-slate-200'}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 truncate">{entry.nickname}</h4>
                          <p className="text-xs text-slate-500 truncate">{entry.city} • {new Date(entry.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="font-extrabold text-primary shrink-0 text-lg">
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
