import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Play } from 'lucide-react';
import { GameContext } from '../context/GameContext';

const cities = [
  // Jawa
  'Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Semarang',
  'Malang', 'Solo', 'Bogor', 'Depok', 'Tangerang', 'Bekasi',
  'Serang', 'Cilegon', 'Tasikmalaya', 'Cirebon', 'Sukabumi',
  'Kediri', 'Madiun', 'Blitar', 'Mojokerto', 'Jember',
  'Purwokerto', 'Pekalongan', 'Salatiga', 'Tegal',
  // Sumatera
  'Medan', 'Palembang', 'Pekanbaru', 'Padang', 'Batam',
  'Banda Aceh', 'Jambi', 'Bengkulu', 'Bandar Lampung',
  'Pangkal Pinang', 'Tanjung Pinang', 'Lubuk Linggau',
  // Kalimantan
  'Balikpapan', 'Banjarmasin', 'Pontianak', 'Samarinda',
  'Palangka Raya', 'Tarakan', 'Bontang', 'Singkawang',
  // Sulawesi
  'Makassar', 'Manado', 'Palu', 'Kendari', 'Gorontalo',
  'Parepare', 'Palopo', 'Bitung', 'Kotamobagu',
  // Bali & Nusa Tenggara
  'Denpasar', 'Mataram', 'Kupang', 'Singaraja', 'Bima',
  // Maluku & Papua
  'Jayapura', 'Ambon', 'Sorong', 'Manokwari', 'Ternate',
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

      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 max-w-md w-full relative z-10 border border-slate-100 dark:border-slate-750 transition-colors duration-300">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold text-sm mb-6 transition-colors duration-300"
        >
          <ArrowLeft size={16} /> Kembali ke Beranda
        </button>

        <div className="flex justify-center mb-6">
          <div className="bg-primary-light dark:bg-primary-dark/20 p-4 rounded-full transition-colors duration-300">
            <MapPin size={48} className="text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-heading font-extrabold text-center text-dark dark:text-white mb-2 transition-colors duration-300">
          Tebakin<span className="text-primary">Aja</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-8 font-sans transition-colors duration-300">
          Uji pengetahuanmu tentang landmark dan tempat ikonik di Indonesia!
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 transition-colors duration-300">
              Pilih Kota Destinasi
            </label>
            <div className="relative">
              {/* Search input */}
              <input
                name='kota'
                id='kota'
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
                className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 px-4 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-primary transition-colors duration-300 font-semibold"
              />

              {/* Dropdown hasil search */}
              {isDropdownOpen && filteredCities.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto transition-colors duration-300">
                  {filteredCities.map(city => (
                    <button
                      key={city}
                      onClick={() => {
                        setSelectedCity(city);
                        setSearch(city);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-300
                        ${selectedCity === city ? 'text-primary dark:text-primary-light bg-primary-light dark:bg-primary-dark/30' : 'text-slate-700 dark:text-slate-300'}
                      `}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}

              {/* Kalau search tidak ketemu */}
              {isDropdownOpen && search && filteredCities.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 text-sm text-slate-500 dark:text-slate-400 text-center transition-colors duration-300">
                  Kota tidak ditemukan
                </div>
              )}
            </div>

            {/* Kota yang dipilih */}
            {selectedCity && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 transition-colors duration-300">
                Kota dipilih: <span className="font-bold text-primary">{selectedCity}</span>
              </p>
            )}
          </div>

          {state.error && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-900/50 transition-colors duration-300">
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

          {state.isLoading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{state.loadingMessage || 'Memuat...'}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CitySelection;