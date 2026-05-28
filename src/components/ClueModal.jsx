import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertCircle, ArrowRight, Info, Map } from 'lucide-react';
import { GameContext } from '../context/GameContext';

const getDifficultyStyle = (diff) => {
  switch (diff?.toLowerCase()) {
    case 'easy':   return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 transition-colors duration-300';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 transition-colors duration-300';
    case 'hard':   return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 transition-colors duration-300';
    default:       return 'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 transition-colors duration-300';
  }
};

const ClueModal = ({
  question,
  method,
  mapGuess,
  onSubmit,
  onNextRound,
  lastAnswerStatus,
  mapResultStatus,
  textResultStatus,
  timerActive,
  round,
  maxRounds,
}) => {
  const { state, dispatch } = useContext(GameContext);
  const [textInput, setTextInput]       = useState('');
  const [selectedChoice, setSelectedChoice] = useState(null);

  // Reset input saat soal baru masuk
  useEffect(() => {
    setTextInput('');
    setSelectedChoice(null);
  }, [question]);

  // Modal tampil: selalu kalau timer berhenti (tampilkan hasil), atau kalau showClueModal = true
  const showModal = !timerActive || state.showClueModal;

  const isResultMode = !timerActive;

  const isSubmitDisabled =
    !timerActive ||
    (method === 'MAP'  ? !mapGuess :
      method === 'MCQ'  ? !selectedChoice :
      textInput.trim() === '');

  const handleSubmit = () => {
    if (method === 'MAP'  && mapGuess)           onSubmit('MAP', mapGuess);
    else if (method === 'MCQ' && selectedChoice) onSubmit('MCQ', selectedChoice);
    else if (method === 'TEXT' && textInput.trim()) onSubmit('TEXT', textInput.trim());
  };

  const handleHideModal = () => {
    dispatch({ type: 'TOGGLE_CLUE_MODAL', payload: false });
  };

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          key="clue-modal"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-[480px]"
        >
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-600 transition-colors duration-300 overflow-hidden">

            {/* ── HASIL (setelah jawab / waktu habis) ───────────────── */}
            {isResultMode ? (
              <div className="p-6">
                <div className="text-center mb-4">
                  {/* TEXT mode — benar */}
                  {lastAnswerStatus === 'correct' && method === 'TEXT' && textResultStatus === 'correct' && (
                    <>
                      <div className="text-5xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-green-600">BENAR!</h3>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 transition-colors duration-300">Itu adalah <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span></p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-full font-bold transition-colors duration-300">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {/* TEXT mode — hampir benar */}
                  {lastAnswerStatus === 'correct' && method === 'TEXT' && textResultStatus === 'almost' && (
                    <>
                      <div className="text-5xl mb-2">📝</div>
                      <h3 className="text-2xl font-bold text-orange-500">HAMPIR TEPAT!</h3>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 transition-colors duration-300">
                        Jawaban lengkapnya: <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-full font-bold transition-colors duration-300">
                        +{state.lastRoundPoints || 0} pts 📝
                      </div>
                    </>
                  )}

                  {/* MCQ mode — benar */}
                  {lastAnswerStatus === 'correct' && method === 'MCQ' && (
                    <>
                      <div className="text-5xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-green-600">BENAR!</h3>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 transition-colors duration-300">Itu adalah <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span></p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-full font-bold transition-colors duration-300">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {lastAnswerStatus === 'correct' && method === 'MAP' && mapResultStatus === 'correct' && (
                    <>
                      <div className="text-5xl mb-2">🎯</div>
                      <h3 className="text-2xl font-bold text-green-600">TEPAT SASARAN!</h3>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mt-1 transition-colors duration-300">
                        Itu adalah <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 px-4 py-2 rounded-full font-bold text-lg transition-colors duration-300">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {lastAnswerStatus === 'correct' && method === 'MAP' && mapResultStatus === 'almost' && (
                    <>
                      <div className="text-5xl mb-2">📍</div>
                      <h3 className="text-2xl font-bold text-orange-500">HAMPIR TEPAT!</h3>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mt-1 transition-colors duration-300">
                        Itu adalah <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-full font-bold text-lg transition-colors duration-300">
                        +{state.lastRoundPoints || 0} pts 📍
                      </div>
                    </>
                  )}
                  
                  {lastAnswerStatus === 'wrong' && (
                    <>
                      <div className="text-5xl mb-2">❌</div>
                      <h3 className="text-2xl font-bold text-red-600">Jawaban Salah</h3>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mt-1 transition-colors duration-300">
                        Jawaban yang benar: <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span>
                      </p>
                    </>
                  )}
                  
                  {lastAnswerStatus === 'timeout' && (
                    <>
                      <div className="text-5xl mb-2">⏰</div>
                      <h3 className="text-2xl font-bold text-orange-500">Waktu Habis!</h3>
                      <p className="text-slate-600 dark:text-slate-300 font-medium mt-1 transition-colors duration-300">
                        Jawaban yang benar: <span className="font-bold text-slate-800 dark:text-slate-100">{question.answer}</span>
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-4 rounded-2xl text-sm text-left mb-5 flex gap-3 border border-blue-100 dark:border-blue-800 transition-colors duration-300">
                  <Info className="shrink-0 mt-0.5" size={18} />
                  <p><strong>Tahukah Kamu?</strong> {question.fun_fact}</p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onNextRound}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 px-6 rounded-2xl shadow-[0_4px_0_0_#0F766E] transition-all flex items-center justify-center gap-2"
                >
                  {round >= maxRounds ? 'Lihat Hasil Akhir' : 'Lanjut Ronde Berikutnya'}
                  <ArrowRight size={18} />
                </motion.button>
              </div>

            ) : (
              /* ── CLUE + INPUT ─────────────────────────────────────── */
              <div className="p-5">
                {/* Header clue */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-heading font-bold text-primary dark:text-primary-light flex items-center gap-1.5 text-sm transition-colors duration-300">
                    <AlertCircle size={15} />
                    PETUNJUK LOKASI
                  </h2>
                  {question.difficulty && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border transition-colors duration-300 ${getDifficultyStyle(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  )}
                </div>

                {/* Teks clue */}
                <p className="text-slate-700 dark:text-slate-200 text-base leading-relaxed font-medium italic mb-4 transition-colors duration-300">
                  "{question.clue || 'Memuat petunjuk...'}"
                </p>

                {/* ── TEXT mode ─────────────────────────────────────── */}
                {method === 'TEXT' && (
                  <div className="mb-4">
                    <input
                      name='tebakan'
                      id='tebakan'
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={!timerActive}
                      placeholder="Ketik nama tempat di sini..."
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && !isSubmitDisabled && handleSubmit()}
                      className="w-full bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-3 px-4 rounded-xl focus:outline-none focus:border-primary transition-colors font-semibold disabled:opacity-60 duration-300"
                    />
                  </div>
                )}

                {/* ── MCQ mode ──────────────────────────────────────── */}
                {method === 'MCQ' && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {question.choices?.map((choice, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedChoice(choice)}
                        disabled={!timerActive}
                        className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left duration-300
                          ${selectedChoice === choice
                            ? 'border-primary bg-primary-light dark:bg-primary/20 text-primary-dark dark:text-primary'
                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:border-primary-light hover:bg-slate-50 dark:hover:bg-slate-600'}
                          ${!timerActive ? 'opacity-60 cursor-not-allowed' : ''}
                        `}
                      >
                        {['A', 'B', 'C', 'D'][idx]}. {choice}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── MAP mode info ──────────────────────────────────── */}
                {method === 'MAP' && (
                  <div className="mb-4">
                    {mapGuess ? (
                      <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-blue-900/30 border border-teal-200 dark:border-blue-800 rounded-xl px-4 py-3 text-sm transition-colors duration-300">
                        <MapPin size={16} className="shrink-0" />
                        Titik dipilih ✅ — klik peta lagi untuk ganti lokasi
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-300">
                        <Map size={16} className="shrink-0" />
                        Tutup modal, lalu klik lokasi di peta
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tombol aksi ───────────────────────────────────── */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={isSubmitDisabled ? {} : { scale: 1.02 }}
                    whileTap={isSubmitDisabled ? {} : { scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-extrabold py-3.5 px-4 rounded-2xl shadow-[0_4px_0_0_#0F766E] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] disabled:cursor-not-allowed"
                  >
                    TEBAK 🎯
                  </motion.button>

                  {/* Tombol tutup hanya di MAP mode */}
                  {method === 'MAP' && timerActive && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleHideModal}
                      className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-bold py-3.5 px-4 rounded-2xl transition-all flex items-center gap-1.5 text-sm whitespace-nowrap duration-300"
                    >
                      <MapPin size={15} /> Pilih Lokasi
                    </motion.button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClueModal;
