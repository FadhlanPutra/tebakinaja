import { motion } from 'framer-motion';

/**
 * LoadingSpinner — komponen spinner reusable
 *
 * Props:
 * - size: ukuran spinner dalam pixel (default: 40)
 * - color: warna border spinner (default: '#0D9488' = teal primary)
 * - text: teks opsional di bawah spinner
 * - fullscreen: kalau true, spinner di tengah layar dengan overlay
 */
const LoadingSpinner = ({
  size = 40,
  color = '#0D9488',
  text = '',
  fullscreen = false,
}) => {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        style={{
          width: size,
          height: size,
          border: `4px solid ${color}22`, // warna transparan untuk track
          borderTop: `4px solid ${color}`,
          borderRadius: '50%',
        }}
      />
      {text && (
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;