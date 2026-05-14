import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Play } from 'lucide-react';
import { useGameLogic } from '../hooks/useGameLogic';

const CitySelection = () => {
  const { startGame, state } = useGameLogic();
  const [selectedCity, setSelectedCity] = useState('Jakarta');

  const cities = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Bali'];

  const handleStart = () => {
    startGame(selectedCity);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center p-4 relative"
    >
      {/* Subtle Batik Pattern Background Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0D9488 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full relative z-10 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-primary-light p-4 rounded-full">
            <MapPin size={48} className="text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-heading font-extrabold text-center text-dark mb-2">Tebakin<span className="text-primary">Aja</span></h1>
        <p className="text-slate-500 text-center mb-8 font-sans">
          Uji pengetahuanmu tentang landmark dan tempat ikonik di Indonesia!
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Pilih Kota Destinasi</label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-700 py-3 px-4 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-primary transition-colors font-semibold"
              >
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
              </div>
            </div>
          </div>

          {state.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-semibold border border-red-200">
              {state.error}
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={state.isLoading}
            className="w-full bg-secondary hover:bg-secondary-dark text-dark font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#D97706] hover:shadow-[0_2px_0_0_#D97706] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {state.isLoading ? (
              <span className="animate-pulse">{state.loadingMessage || 'Memuat...'}</span>
            ) : (
              <>Mulai Main <Play fill="currentColor" size={20} /></>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default CitySelection;
