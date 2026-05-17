import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Play } from 'lucide-react';
import { GameContext } from '../context/GameContext';

const cities = [
  // Jawa
  'Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Semarang',
  'Malang', 'Solo', 'Bogor', 'Depok', 'Tangerang',
  // Sumatera
  'Medan', 'Palembang', 'Pekanbaru', 'Padang', 'Batam',
  // Kalimantan
  'Balikpapan', 'Banjarmasin', 'Pontianak', 'Samarinda',
  // Sulawesi
  'Makassar', 'Manado',
  // Bali & NTB
  'Denpasar', 'Mataram',
  // Papua
  'Jayapura',
];

const CitySelection = ({ startGame, onBack }) => {
  const { state } = useContext(GameContext);
  const [selectedCity, setSelectedCity] = useState('Jakarta');
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredCities = cities.filter(city =>
    city.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.relative')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="min-h-screen flex items-center justify-center p-4 relative"
    >
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0D9488 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full relative z-10 border border-slate-100">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-semibold text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Beranda
        </button>

        <div className="flex justify-center mb-6">
          <div className="bg-primary-light p-4 rounded-full">
            <MapPin size={48} className="text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-heading font-extrabold text-center text-dark mb-2">
          Tebakin<span className="text-primary">Aja</span>
        </h1>
        <p className="text-slate-500 text-center mb-8 font-sans">
          Uji pengetahuanmu tentang landmark dan tempat ikonik di Indonesia!
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Pilih Kota Destinasi
            </label>
            <div className="relative">
              {/* Search input */}
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCities.length > 0) {
                    setSelectedCity(filteredCities[0]);
                    setSearch(filteredCities[0]);
                    setIsDropdownOpen(false);
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Cari kota..."
                className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 py-3 px-4 rounded-xl focus:outline-none focus:bg-white focus:border-primary transition-colors font-semibold"
              />

              {/* Dropdown hasil search */}
              {isDropdownOpen && filteredCities.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredCities.map(city => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setSearch(city);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors
                        ${selectedCity === city ? 'text-primary bg-primary-light' : 'text-slate-700'}
                      `}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}

              {/* Kalau search tidak ketemu */}
              {isDropdownOpen && search && filteredCities.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm text-slate-500 text-center">
                  Kota tidak ditemukan
                </div>
              )}
            </div>

            {/* Kota yang dipilih */}
            {selectedCity && (
              <p className="text-xs text-slate-500 mt-2">
                Kota dipilih: <span className="font-bold text-primary">{selectedCity}</span>
              </p>
            )}
          </div>

          {state.error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-semibold border border-red-200">
              {state.error}
            </div>
          )}

          <button
            onClick={() => startGame(selectedCity)}
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