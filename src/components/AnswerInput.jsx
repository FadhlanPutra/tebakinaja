import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AnswerInput = ({ onSubmit, choices, disabled, mapGuess }) => {
  const [textInput, setTextInput] = useState('');
  const [selectedChoice, setSelectedChoice] = useState(null);

  // Clear inputs when disabled changes (round resets) or map is clicked
  useEffect(() => {
    if (!disabled) {
      setTextInput('');
      setSelectedChoice(null);
    }
  }, [disabled]);

  useEffect(() => {
    if (mapGuess) {
      setTextInput('📍 Titik Peta Dipilih');
      setSelectedChoice(null);
    }
  }, [mapGuess]);

  const handleTextChange = (e) => {
    if(disabled) return;
    setTextInput(e.target.value);
    setSelectedChoice(null);
  };

  const handleChoiceClick = (choice) => {
    if(disabled) return;
    setSelectedChoice(choice);
    setTextInput('');
  };

  const handleSubmit = () => {
    if (mapGuess && textInput.includes('Titik Peta')) {
      onSubmit('MAP', mapGuess);
    } else if (selectedChoice) {
      onSubmit('MCQ', selectedChoice);
    } else if (textInput.trim() !== '') {
      onSubmit('TEXT', textInput);
    }
  };

  const isSubmitDisabled = disabled || (!mapGuess && !selectedChoice && textInput.trim() === '');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      
      {/* Text Input */}
      <div className="mb-4">
        <input 
          type="text" 
          value={textInput}
          onChange={handleTextChange}
          disabled={disabled || (mapGuess && textInput.includes('Peta'))}
          placeholder="Ketik nama tempat di sini..."
          className="w-full bg-slate-50 border-2 border-slate-200 text-slate-700 py-3 px-4 rounded-xl focus:outline-none focus:border-primary transition-colors font-semibold disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="h-px bg-slate-200 flex-1"></div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ATAU PILIH</span>
        <div className="h-px bg-slate-200 flex-1"></div>
      </div>

      {/* Multiple Choice */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {choices?.map((choice, idx) => (
          <button
            key={idx}
            onClick={() => handleChoiceClick(choice)}
            disabled={disabled}
            className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left truncate
              ${selectedChoice === choice 
                ? 'border-primary bg-primary-light text-primary-dark' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-light hover:bg-slate-50'
              }
              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
          >
            {['A','B','C','D'][idx]}. {choice}
          </button>
        ))}
      </div>

      <motion.button 
        whileHover={{ scale: isSubmitDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isSubmitDisabled ? 1 : 0.98 }}
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className="w-full bg-primary hover:bg-primary-dark text-white font-extrabold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#0F766E] transition-all flex items-center justify-center text-lg disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] disabled:cursor-not-allowed"
      >
        TEBAK SEKARANG! 🎯
      </motion.button>
    </div>
  );
};

export default AnswerInput;
