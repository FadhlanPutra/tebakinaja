import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertCircle, ArrowRight, Info, Map } from 'lucide-react';
import { GameContext } from '../context/GameContext';

const getDifficultyStyle = (diff) => {
  switch (diff?.toLowerCase()) {
    case 'easy':   return 'bg-green-100 text-green-700 border-green-200';
    case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'hard':   return 'bg-red-100 text-red-700 border-red-200';
    default:       return 'bg-slate-100 text-slate-700 border-slate-200';
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
          <div className="bg-white/96 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/70 overflow-hidden">

            {/* ── HASIL (setelah jawab / waktu habis) ───────────────── */}
            {isResultMode ? (
              <div className="p-6">
                <div className="text-center mb-4">
                  {/* TEXT mode — benar */}
                  {lastAnswerStatus === 'correct' && method === 'TEXT' && textResultStatus === 'correct' && (
                    <>
                      <div className="text-5xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-green-600">BENAR!</h3>
                      <p className="text-slate-600 mt-1">Itu adalah <span className="font-bold">{question.answer}</span></p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-full font-bold">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {/* TEXT mode — hampir benar */}
                  {lastAnswerStatus === 'correct' && method === 'TEXT' && textResultStatus === 'almost' && (
                    <>
                      <div className="text-5xl mb-2">📝</div>
                      <h3 className="text-2xl font-bold text-orange-500">HAMPIR TEPAT!</h3>
                      <p className="text-slate-600 mt-1">
                        Jawaban lengkapnya: <span className="font-bold">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-full font-bold">
                        +{state.lastRoundPoints || 0} pts 📝
                      </div>
                    </>
                  )}

                  {/* MCQ mode — benar */}
                  {lastAnswerStatus === 'correct' && method === 'MCQ' && (
                    <>
                      <div className="text-5xl mb-2">🎉</div>
                      <h3 className="text-2xl font-bold text-green-600">BENAR!</h3>
                      <p className="text-slate-600 mt-1">Itu adalah <span className="font-bold">{question.answer}</span></p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-full font-bold">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {lastAnswerStatus === 'correct' && method === 'MAP' && mapResultStatus === 'correct' && (
                    <>
                      <div className="text-5xl mb-2">🎯</div>
                      <h3 className="text-2xl font-bold text-green-600">TEPAT SASARAN!</h3>
                      <p className="text-slate-600 font-medium mt-1">
                        Itu adalah <span className="font-bold">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-full font-bold text-lg">
                        +{state.lastRoundPoints || 0} pts ⭐
                      </div>
                    </>
                  )}

                  {lastAnswerStatus === 'correct' && method === 'MAP' && mapResultStatus === 'almost' && (
                    <>
                      <div className="text-5xl mb-2">📍</div>
                      <h3 className="text-2xl font-bold text-orange-500">HAMPIR TEPAT!</h3>
                      <p className="text-slate-600 font-medium mt-1">
                        Itu adalah <span className="font-bold">{question.answer}</span>
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-full font-bold text-lg">
                        +{state.lastRoundPoints || 0} pts 📍
                      </div>
                    </>
                  )}
                  
                  {lastAnswerStatus === 'wrong' && (
                    <>
                      <div className="text-5xl mb-2">❌</div>
                      <h3 className="text-2xl font-bold text-red-600">Jawaban Salah</h3>
                      <p className="text-slate-600 font-medium mt-1">
                        Jawaban yang benar: <span className="font-bold">{question.answer}</span>
                      </p>
                    </>
                  )}
                  
                  {lastAnswerStatus === 'timeout' && (
                    <>
                      <div className="text-5xl mb-2">⏰</div>
                      <h3 className="text-2xl font-bold text-orange-500">Waktu Habis!</h3>
                      <p className="text-slate-600 font-medium mt-1">
                        Jawaban yang benar: <span className="font-bold">{question.answer}</span>
                      </p>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl text-sm text-left mb-5 flex gap-3 border border-blue-100">
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
                  <h2 className="font-heading font-bold text-primary flex items-center gap-1.5 text-sm">
                    <AlertCircle size={15} />
                    PETUNJUK LOKASI
                  </h2>
                  {question.difficulty && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${getDifficultyStyle(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  )}
                </div>

                {/* Teks clue */}
                <p className="text-slate-700 text-base leading-relaxed font-medium italic mb-4">
                  "{question.clue || 'Memuat petunjuk...'}"
                </p>

                {/* ── TEXT mode ─────────────────────────────────────── */}
                {method === 'TEXT' && (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={!timerActive}
                      placeholder="Ketik nama tempat di sini..."
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && !isSubmitDisabled && handleSubmit()}
                      className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 py-3 px-4 rounded-xl focus:outline-none focus:border-primary transition-colors font-semibold disabled:opacity-60"
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
                        className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left
                          ${selectedChoice === choice
                            ? 'border-primary bg-primary/10 text-primary-dark'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-slate-50'}
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
                      <div className="flex items-center gap-2 text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm font-semibold">
                        <MapPin size={16} className="shrink-0" />
                        Titik dipilih ✅ — klik peta lagi untuk ganti lokasi
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium">
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
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-2xl transition-all flex items-center gap-1.5 text-sm whitespace-nowrap"
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
