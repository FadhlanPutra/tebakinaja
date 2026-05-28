import React, { useState, useContext, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Check, Trash2, LogOut } from 'lucide-react';
import { importToken, generateToken, updateUserData, getUserData } from '../services/tokenService';
import { db, syncLeaderboardNickname } from '../services/firebaseService';
import { authSignIn, authSignOut, getAuthProvider } from '../services/authService';
import { useGoogleLogin } from '@react-oauth/google';
import { GoogleLogin } from '@react-oauth/google';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GameContext } from '../context/GameContext';
import Swal from 'sweetalert2';

// ─── Cooldown config per tombol ────────────────────────────────────────────────
// key: nama unik tombol (juga dipakai sebagai key localStorage)
// duration: lama cooldown dalam detik

const COOLDOWN_CONFIG = {
  import: 10,        // 10 detik setelah klik Impor
  resetToken: 3600,  // 1 jam setelah Hapus Akun
  nickname: 60,      // 1 menit setelah ubah Nickname
};

// ─── Helper: simpan timestamp expired ke localStorage ─────────────────────────

const setCooldownStorage = (key, seconds) => {
  const expiredAt = Date.now() + seconds * 1000;
  localStorage.setItem(`tebakinaja_cooldown_${key}`, expiredAt.toString());
  sessionStorage.setItem(`tebakinaja_cooldown_${key}`, expiredAt.toString());
};

// ─── Helper: baca sisa cooldown dalam detik (0 = tidak ada cooldown) ──────────

const getRemainingCooldown = (key) => {
  const stored =
    localStorage.getItem(`tebakinaja_cooldown_${key}`) ||
    sessionStorage.getItem(`tebakinaja_cooldown_${key}`);
  if (!stored) return 0;
  const remaining = Math.ceil((parseInt(stored) - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
};

// ─── Helper: format detik ke teks yang readable ────────────────────────────────

const formatSeconds = (seconds) => {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} jam`;
  if (seconds >= 60)   return `${Math.ceil(seconds / 60)} menit`;
  return `${seconds} detik`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Komponen SettingsPage
// ═══════════════════════════════════════════════════════════════════════════════

const SettingsPage = ({ isOpen, onClose, token, setToken, nickname, setNickname }) => {
  const { state, dispatch } = useContext(GameContext);
  const { googleUser } = state;

  const PROVIDER = getAuthProvider();

  // Login handler — kondisional berdasarkan provider
  const googleOAuthLogin = PROVIDER === 'google'
    ? useGoogleLogin({
        onSuccess: async (credentialResponse) => {
          try {
            const user = await authSignIn(token, credentialResponse);
            dispatch({ type: 'SET_GOOGLE_USER', payload: user });
            setMessage('Berhasil login dengan Google!');
            setTimeout(() => setMessage(''), 8000);
          } catch {
            setMessage('Gagal login dengan Google.');
            setTimeout(() => setMessage(''), 8000);
          }
        },
        onError: () => {
          setMessage('Gagal login dengan Google.');
          setTimeout(() => setMessage(''), 8000);
        },
        flow: 'auth-code',
      })
    : null;

  const [copied, setCopied]               = useState(false);
  const [inputNickname, setInputNickname] = useState(nickname);
  const [inputToken, setInputToken]       = useState('');
  const [message, setMessage]             = useState('');
  const [userStats, setUserStats]         = useState({ total_games: 0, highest_score: 0, total_answers: 0, correct_answers: 0 });
  const [showToken, setShowToken]         = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('tebakinaja_theme') === 'dark'
  );

  const handleToggleDarkMode = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('tebakinaja_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Cooldown state: { import: <sisa detik>, resetToken: <sisa detik> }
  const [cooldowns, setCooldowns] = useState({});

  // ─── Ticker: sync cooldown dari localStorage setiap detik ──────────────────

  useEffect(() => {
    const tick = () => {
      setCooldowns({
        import:     getRemainingCooldown('import'),
        resetToken: getRemainingCooldown('resetToken'),
        nickname: getRemainingCooldown('nickname'),
      });
    };
    tick(); // langsung cek saat pertama mount
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Fetch statistik user saat modal dibuka ─────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const fetchStats = async () => {
      const identifier = googleUser?.uid || token;
      if (!identifier) return;
      const data = await getUserData(identifier);
      if (data) {
        setUserStats({
          total_games:     data.total_games     || 0,
          highest_score:   data.highest_score   || 0,
          total_answers:   data.total_answers   || 0,
          correct_answers: data.correct_answers || 0,
        });
      }
    };
    fetchStats();
  }, [isOpen, googleUser, token]);

  const maskToken = (t) => {
    if (!t) return '';
    return t[0] + '***-***' + t[t.length - 1];
  };

  if (!isOpen) return null;

  // ─── Handler: salin token ───────────────────────────────────────────────────

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Helper: validasi nickname via OpenRouter ──────────────────────────────

  const validateNickname = async (name) => {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace('/api/generate-clue', '') || '';
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      dispatch({ type: 'SET_LOADING', payload: { status: true, message: `Memeriksa nickname...` } });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(`${BACKEND_URL}/api/validate-nickname`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Token': import.meta.env.VITE_APP_SECRET_TOKEN,
          },
          body: JSON.stringify({ nickname: name }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          dispatch({ type: 'SET_LOADING', payload: { status: false } });
          return true;
        }
        const data = await response.json();
        dispatch({ type: 'SET_LOADING', payload: { status: false } });
        return data.appropriate ?? true;
      } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        console.warn(`[validateNickname] Attempt ${attempt} failed (${isTimeout ? 'timeout 5s' : err.message})`);
        if (attempt === MAX_RETRIES) {
          dispatch({ type: 'SET_LOADING', payload: { status: false } });
          return true; // fallback: allow setelah semua retry gagal
        }
        await new Promise(res => setTimeout(res, 500));
      }
    }
    dispatch({ type: 'SET_LOADING', payload: { status: false } });
    return true;
  };

  // ─── Handler: simpan nickname ───────────────────────────────────────────────

  const handleSaveNickname = async () => {
    if (!inputNickname.trim()) {
      setMessage('Masukan nickname terlebih dahulu');
      setTimeout(() => setMessage(''), 4000)
      return;
    }

    setMessage('Memeriksa nickname...');
    const isAppropriate = await validateNickname(inputNickname.trim());
    if (!isAppropriate) {
      setMessage('Nickname tidak pantas, coba yang lain!');
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    const trimmedNickname = inputNickname.trim();
    const identifier = googleUser?.uid || token;

    setNickname(trimmedNickname);
    localStorage.setItem('tebakinaja_nickname', trimmedNickname);
    await updateUserData(identifier, { nickname: trimmedNickname });
    await syncLeaderboardNickname(identifier, trimmedNickname);
    setMessage('Nickname berhasil disimpan!');
    setTimeout(() => setMessage(''), 4000);
    setCooldownStorage('nickname', COOLDOWN_CONFIG.nickname);
  };

  // ─── Handler: auto-format input token ──────────────────────────────────────

  const handleTokenInput = (e) => {
    let value = e.target.value.replace(/[^A-Z0-9a-z]/gi, '').toUpperCase();
    value = value.slice(0, 8);
    if (value.length > 4) value = value.slice(0, 4) + '-' + value.slice(4);
    setInputToken(value);
  };

  // ─── Handler: impor token ───────────────────────────────────────────────────

  const handleImportToken = async () => {
    if (!inputToken.trim()) {
      setMessage('Masukan token terlebih dahulu');
      setTimeout(() => setMessage(''), 4000)
      return;
    }

    const data = await importToken(inputToken.trim().toUpperCase());
    if (data) {
      setToken(data.token);
      setNickname(data.nickname || '');
      setInputNickname(data.nickname || '');
      localStorage.setItem('tebakinaja_nickname', data.nickname || '');
      setMessage('Token berhasil diimpor!');
      setInputToken('');
      setTimeout(() => setMessage(''), 4000);
    } else {
      setMessage('Token tidak valid!');
      setTimeout(() => setMessage(''), 5000);
    }

    // Cooldown selalu aktif setelah klik, berhasil atau tidak
    setCooldownStorage('import', COOLDOWN_CONFIG.import);
  };

  // ─── Handler: hapus akun ────────────────────────────────────────────────────

  const handleResetToken = async () => {
    // Hitung mundur 5 detik di SweetAlert sebelum tombol konfirmasi aktif
    let countdown = 8;

    const result = await Swal.fire({
      title: 'Hapus Akun?',
      html: `Semua progress kamu akan hilang permanen dan tidak bisa dikembalikan.<span id="swal-countdown"></span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal',
      allowOutsideClick: false,

      // Tombol confirm disabled dulu, baru aktif setelah countdown
      didOpen: () => {
        const confirmBtn = Swal.getConfirmButton();
        const countdownEl = document.getElementById('swal-countdown');
        confirmBtn.disabled = true;
        confirmBtn.textContent = `${countdown} detik`
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.cursor = 'not-allowed';

        const timer = setInterval(() => {
          countdown--;
          if (countdownEl) {
            // countdownEl.textContent = countdown > 0
            //   ? `Tombol aktif dalam ${countdown} detik...`
            //   : 'Baca peringatan di atas sebelum melanjutkan.';
            confirmBtn.textContent = countdown > 0
              ? `${countdown} detik`
              : 'Ya, hapus!';
          }
          if (countdown <= 0) {
            clearInterval(timer);
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
          }
        }, 1000);
      },
    });

    if (result.isConfirmed) {
      const newToken = generateToken();
      localStorage.setItem('tebakinaja_token', newToken);
      setToken(newToken);

      const docRef = doc(db, 'users', newToken);
      await setDoc(docRef, {
        token: newToken,
        nickname: nickname || '',
        created_at: serverTimestamp(),
        total_games: 0,
        highest_score: 0,
        total_answers: 0,
        correct_answers: 0,
      });

      setMessage('Akun berhasil dihapus. Token baru telah dibuat.');
      setTimeout(() => setMessage(''), 3000);
      // Cooldown aktif setelah confirm
      setCooldownStorage('resetToken', COOLDOWN_CONFIG.resetToken);
    }

  };

  // ─── Handler: login Google ──────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    if (PROVIDER === 'google') {
      googleOAuthLogin();
    } else {
      try {
        const user = await authSignIn(token);
        dispatch({ type: 'SET_GOOGLE_USER', payload: user });
        setMessage('Berhasil login dengan Google!');
        setTimeout(() => setMessage(''), 3000);
      } catch {
        setMessage('Gagal login dengan Google.');
        setTimeout(() => setMessage(''), 3000);
      }
    }
  };

  // ─── Handler: logout Google ─────────────────────────────────────────────────

  const handleGoogleLogout = async () => {
    let countdown = 4;

    const result = await Swal.fire({
      title: 'Keluar dari Google?',
      html: `Kamu akan keluar dari akun Google.<span id="swal-logout-countdown"></span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0D9488',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Ya, keluar!',
      cancelButtonText: 'Batal',
      allowOutsideClick: false,
      didOpen: () => {
        const confirmBtn = Swal.getConfirmButton();
        const countdownEl = document.getElementById('swal-logout-countdown');
        confirmBtn.textContent = `${countdown} detik`
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.cursor = 'not-allowed';

        const timer = setInterval(() => {
          countdown--;
          if (countdownEl) {
            confirmBtn.textContent = countdown > 0
              ? `${countdown} detik`
              : 'Ya, keluar!';
          }
          if (countdown <= 0) {
            clearInterval(timer);
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
          }
        }, 1000);
      },
    });

    if (result.isConfirmed) {
      await authSignOut();
      dispatch({ type: 'SET_GOOGLE_USER', payload: null });
      setMessage('Berhasil keluar dari akun Google.');
      setTimeout(() => setMessage(''), 7000);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10 flex flex-col max-h-[90vh] overflow-y-auto transition-colors duration-300"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-2 transition-colors duration-300">
          <X size={24} />
        </button>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2 transition-colors duration-300">
          ⚙️ Settings
        </h3>

        <div className="space-y-6">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors duration-300">
                {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors duration-300">
                Sesuaikan tampilan dengan preferensimu
              </p>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                isDarkMode ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {!googleUser ? (
            <>
              {/* Token */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 transition-colors duration-300">Token Kamu:</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 py-3 px-4 rounded-xl font-mono font-bold flex items-center justify-center tracking-widest transition-colors duration-300">
                    {showToken ? token : maskToken(token)}
                  </div>
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-xl font-bold transition-colors duration-300 text-sm"
                  >
                    {showToken ? 'Sembunyikan' : 'Lihat'}
                  </button>
                  <button onClick={handleCopy} className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-xl font-bold flex items-center gap-2 transition-colors duration-300">
                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />} {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 transition-colors duration-300">🔒 Token bersifat rahasia. Gunakan token ini untuk lanjutkan progress di perangkat lain melalui menu <strong>Pindah Perangkat</strong> di bawah.</p>

                {/* Login Google */}
                {PROVIDER === 'google' ? (
                  <div className="w-full mt-4">
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        try {
                          const user = await authSignIn(token, credentialResponse);
                          dispatch({ type: 'SET_GOOGLE_USER', payload: user });
                          setMessage('Berhasil login dengan Google!');
                          setTimeout(() => setMessage(''), 3000);
                        } catch {
                          setMessage('Gagal login dengan Google.');
                          setTimeout(() => setMessage(''), 3000);
                        }
                      }}
                      onError={() => {
                        setMessage('Gagal login dengan Google.');
                        setTimeout(() => setMessage(''), 3000);
                      }}
                      text="signin_with_google"
                      shape="rectangular"
                      theme="outline"
                      locale="id"
                    />
                  </div>
                ) : (
                  <button onClick={handleGoogleLogin} className="w-full mt-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-300 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Login dengan Google
                  </button>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center transition-colors duration-300">Simpan progress lebih aman tanpa perlu ingat token</p>
              </div>

              <hr className="border-slate-100 dark:border-slate-700 transition-colors duration-300" />

              {/* Pindah perangkat */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 transition-colors duration-300">Pindah Perangkat:</label>
                <div className="flex gap-2">
                  <input
                    name='token'
                    id='token'
                    type="text"
                    value={inputToken}
                    onChange={handleTokenInput}
                    disabled={!!cooldowns.import}
                    placeholder="Masukkan token..."
                    className="flex-1 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 px-4 rounded-xl focus:outline-none focus:border-primary font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
                  />
                  <button
                    disabled={!!cooldowns.import}
                    onClick={handleImportToken}
                    className={`font-bold py-3 px-4 rounded-xl transition-colors duration-300 whitespace-nowrap ${
                      cooldowns.import
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-800'
                    }`}
                  >
                    {cooldowns.import ? `⏳ ${formatSeconds(cooldowns.import)}` : 'Impor'}
                  </button>
                </div>
                <p className="text-xs text-orange-500 dark:text-orange-400 mt-2 font-medium flex gap-1 items-start transition-colors duration-300">
                  <span>⚠️</span> Progress perangkat ini akan diganti dengan data token tersebut
                </p>
              </div>

              <hr className="border-slate-100 dark:border-slate-700 transition-colors duration-300" />

              {/* Hapus akun */}
              <button
                disabled={!!cooldowns.resetToken}
                onClick={handleResetToken}
                className={`w-full font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-300 border ${
                  cooldowns.resetToken
                    ? 'bg-slate-100 dark:bg-slate-750 text-slate-400 dark:text-slate-550 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'
                }`}
              >
                <Trash2 size={18} />
                {cooldowns.resetToken ? `⏳ Hapus Akun (${formatSeconds(cooldowns.resetToken)})` : 'Hapus Akun'}
              </button>
            </>
          ) : (
            <>
              {/* Profil Google */}
              <div className="flex flex-col items-center mb-2">
                <img src={googleUser.photoURL || 'https://via.placeholder.com/150'} alt="Profile" className="w-20 h-20 rounded-full mb-3 shadow-md border-2 border-white dark:border-slate-700 object-cover" />
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors duration-300">{googleUser.displayName}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors duration-300">{googleUser.email}</p>
              </div>

              {/* Statistik */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4 transition-colors duration-300">
                <h5 className="font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 transition-colors duration-300">📊 Statistik:</h5>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm font-medium">
                  <div className="text-slate-500 dark:text-slate-400 transition-colors duration-300">Total Game</div>
                  <div className="text-right text-slate-800 dark:text-slate-100 transition-colors duration-300">{userStats.total_games}</div>
                  <div className="text-slate-500 dark:text-slate-400 transition-colors duration-300">Skor Tertinggi</div>
                  <div className="text-right text-slate-800 dark:text-slate-100 transition-colors duration-300">{userStats.highest_score}</div>
                  <div className="text-slate-500 dark:text-slate-400 transition-colors duration-300">Akurasi</div>
                  <div className="text-right text-slate-800 dark:text-slate-100 transition-colors duration-300">
                    {userStats.total_answers > 0 ? ((userStats.correct_answers / userStats.total_answers) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              <button onClick={handleGoogleLogout} className="w-full bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors duration-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                <LogOut size={18} /> Keluar dari akun Google
              </button>
            </>
          )}

          <hr className="border-slate-100 dark:border-slate-700 transition-colors duration-300" />

          {/* Ganti nickname */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 transition-colors duration-300">Ganti Nickname:</label>
            <div className="flex gap-2">
              <input
                type="text"
                name='nama'
                id='nama'
                value={inputNickname}
                onChange={(e) => setInputNickname(e.target.value)}
                placeholder="Nickname baru..."
                maxLength={20}
                className="flex-1 appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-3 px-4 rounded-xl focus:outline-none focus:border-primary font-semibold transition-colors duration-300"
              />
              <button
                onClick={handleSaveNickname}
                disabled={!!cooldowns.nickname}
                className={`font-bold py-3 px-4 rounded-xl transition-colors duration-300 ${
                  cooldowns.nickname
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-dark text-white'
                }`}
              >
                {cooldowns.nickname ? `⏳ ${formatSeconds(cooldowns.nickname)}` : 'Simpan'}
              </button>
            </div>
            {state.isLoading && (() => {
              console.log('[Loading Overlay Rendered]', {
                isLoading: state.isLoading,
                message: state.loadingMessage,
                screen: state.screen
              });
            
              return (
                <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 z-50">
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl flex flex-col items-center gap-4 border border-slate-100 dark:border-slate-700/50 transition-colors duration-300">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200 text-center transition-colors duration-300">
                      {state.loadingMessage || 'Memuat...'}
                    </p>
              
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                      Mohon tunggu sebentar
                    </p>
                  </div>
                </div>
              );
            })()}
            {message && (
              <p className="mt-2 text-sm font-medium text-center text-blue-600 dark:text-blue-400">
                {message}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;