import React, { useContext, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, Gamepad2, Trophy } from 'lucide-react';
import { GameContext } from '../context/GameContext';
import { getUserData } from '../services/tokenService';

const StatCard = ({ icon, label, value, colorClass }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 flex items-start gap-3 transition-colors duration-300">
    <div className={`p-2 rounded-xl ${colorClass}`}>{icon}</div>
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  </div>
);

const ProfilePage = () => {
  const { state, dispatch } = useContext(GameContext);
  const [stats, setStats] = useState({
    total_games: 0,
    highest_score: 0,
    total_answers: 0,
    correct_answers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const identifier = state.googleUser?.uid || state.token;
      if (!identifier) {
        setLoading(false);
        return;
      }

      const data = await getUserData(identifier);
      setStats({
        total_games: data?.total_games || 0,
        highest_score: data?.highest_score || 0,
        total_answers: data?.total_answers || 0,
        correct_answers: data?.correct_answers || 0,
      });
      setLoading(false);
    };

    loadStats();
  }, [state.googleUser, state.token]);

  const wrongAnswers = useMemo(
    () => Math.max(0, stats.total_answers - stats.correct_answers),
    [stats.total_answers, stats.correct_answers]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'HOME' })}
          className="mb-5 inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors font-semibold"
        >
          <ArrowLeft size={18} />
          Kembali
        </button>

        <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg mb-5">
          <p className="text-sm text-primary-light mb-1">Profil Pemain</p>
          <h1 className="text-3xl font-extrabold">{state.nickname || 'Pemain'}</h1>
          <p className="text-primary-light mt-2 text-sm">
            Ringkasan performa kamu di semua permainan.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              icon={<CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />}
              label="Jawaban Benar"
              value={stats.correct_answers}
              colorClass="bg-green-100 dark:bg-green-950/40"
            />
            <StatCard
              icon={<XCircle size={20} className="text-red-600 dark:text-red-400" />}
              label="Jawaban Salah"
              value={wrongAnswers}
              colorClass="bg-red-100 dark:bg-red-950/40"
            />
            <StatCard
              icon={<Gamepad2 size={20} className="text-blue-600 dark:text-blue-400" />}
              label="Total Permainan"
              value={stats.total_games}
              colorClass="bg-blue-100 dark:bg-blue-950/40"
            />
            <StatCard
              icon={<Trophy size={20} className="text-amber-600 dark:text-amber-400" />}
              label="Skor Tertinggi"
              value={stats.highest_score}
              colorClass="bg-amber-100 dark:bg-amber-950/40"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfilePage;
