import React from 'react';
import { Map, AlertCircle } from 'lucide-react';

const CluePanel = ({ clue, difficulty }) => {
  
  const getDifficultyColor = (diff) => {
    switch(diff?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full relative overflow-hidden">
      {/* Decorative element */}
      <div className="absolute -top-10 -right-10 opacity-5">
        <Map size={150} />
      </div>

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h2 className="font-heading font-bold text-primary flex items-center gap-2">
          <AlertCircle size={20} />
          PETUNJUK LOKASI
        </h2>
        
        {difficulty && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getDifficultyColor(difficulty)}`}>
            {difficulty}
          </span>
        )}
      </div>

      <div className="flex-1 relative z-10">
        <p className="text-slate-700 text-lg leading-relaxed font-medium italic">
          "{clue || "Memuat petunjuk..."}"
        </p>
      </div>
    </div>
  );
};

export default CluePanel;
