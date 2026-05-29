# 🗺️ TebakinAja

> **Seberapa kenal kamu dengan kotamu sendiri?**

TebakinAja adalah web game teka-teki berbasis lokasi dengan kearifan lokal Indonesia. Clue tentang tempat-tempat ikonik di kotamu di-generate secara real-time oleh AI — tidak ada soal yang hardcoded, setiap sesi selalu berbeda.

![TebakinAja](https://img.shields.io/badge/Made%20with-Gemini%20AI-blue?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase) ![Google Cloud](https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4?style=flat-square&logo=googlecloud) ![Cloudflare](https://img.shields.io/badge/Backend-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)

---

## 🎮 Cara Main

1. **Masukkan nickname** di halaman utama
2. **Pilih kota** yang ingin kamu tantang — tersedia 57+ kota besar Indonesia
3. **Baca clue** yang di-generate AI tentang sebuah tempat ikonik
4. **Tebak lokasinya** — sistem menentukan metode jawab setiap ronde:
   - 📍 **Klik di peta** — lingkaran radius ditampilkan, skor berdasarkan seberapa dekat tebakanmu
   - 🔤 **Pilih dari 4 opsi** — pilih jawaban yang menurutmu benar
   - ⌨️ **Ketik nama tempatnya** — AI mengenali singkatan dan nama populer lokal
5. **Lihat skor dan fun fact** setelah setiap ronde
6. **Selesaikan 5 ronde** dan masuk leaderboard global!

---

## ✨ Fitur Utama

### 🤖 AI-Powered Clue Generation
Setiap soal di-generate langsung oleh **Gemini** berdasarkan data tempat dari Google Places API. Tidak ada database soal — setiap sesi selalu fresh dan bervariasi. Clue disesuaikan dengan kategori tempat: restoran, mall, taman, landmark, cafe, dan lainnya.

### 🗺️ Full-Screen Immersive Map
Peta Google Maps mengisi seluruh layar seperti GeoGuessr. Clue ditampilkan sebagai modal floating yang menimpa peta — tidak ada layout terbagi yang membuang ruang layar.

### 📍 Sistem Skor Berbasis Jarak (Map Mode)
Skor dihitung berdasarkan seberapa dekat titik yang dipilih dengan lokasi sebenarnya:
- **Tepat sasaran** (dalam zona presisi) → poin penuh
- **Hampir tepat** (dalam radius) → poin 50%
- **Agak jauh** (di luar radius tapi dalam threshold) → poin 30%
- **Terlalu jauh** → 0 poin

Radius berbeda per difficulty: Easy 3km, Medium 7km, Hard 12km.

### 🏷️ Fuzzy Matching + Accepted Answers (Text Mode)
Gemini generate variasi nama lokal yang diterima. Validasi menggunakan **Fuse.js** dengan toleransi typo — tapi dengan pengecekan panjang dan relevansi untuk mencegah jawaban terlalu generik.

### ⚡ Pre-fetch Clue Cache
Clue ronde 2-5 di-generate di background saat pemain sedang mengerjakan ronde 1 — membuat perpindahan ronde jadi hampir instan.

### 🏆 Leaderboard Global
Bersaing dengan pemain lain dari seluruh Indonesia. Setiap akun hanya bisa masuk leaderboard sekali dengan skor tertinggi — tidak ada satu akun yang mendominasi.

### 🔑 Sistem Token + Google OAuth
Tidak perlu daftar akun. Setiap pemain mendapat token unik yang tersimpan di browser. Bisa login dengan Google untuk keamanan lebih dan sinkronisasi antar perangkat.

### 🎯 Weighted RNG Pemilihan Tempat
Tempat yang jarang muncul diprioritaskan — memastikan variasi soal maksimal dan tidak ada tempat yang terus berulang.

### 🌙 Dark Mode
Toggle dark/light mode di Settings — preferensi tersimpan di browser.

### ⚡ Server-Side Caching
Data tempat dari Google Places API di-cache di Firestore selama 7 hari per kota — menghemat API quota secara signifikan.

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS + Framer Motion |
| AI | Google Gemini (via Cloudflare Workers backend) |
| Maps | Google Maps JavaScript API + Places API |
| Database | Firebase Firestore |
| Auth | Google OAuth + Anonymous Token System |
| Deploy | Google Cloud Run (Docker + Nginx) |
| Icons | Lucide React |

---

## 🚀 Cara Menjalankan Lokal

### Prerequisites
- Node.js >= 18
- Google Maps Platform API Key
- Gemini API Key (dari [aistudio.google.com](https://aistudio.google.com)) **atau** Cloudflare Workers backend
- Project Firebase dengan Firestore aktif
- Google OAuth Client ID (dari Google Cloud Console)

### Setup

1. Clone repository ini
```bash
git clone https://github.com/FadhlanPutra/tebakinaja.git
cd tebakinaja
```

2. Install dependencies
```bash
npm install
```

3. Copy file environment variable
```bash
cp .env.example .env
```

4. Isi nilai di `.env`:
```env
VITE_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Pilih salah satu — Gemini langsung atau via backend
VITE_GEMINI_API_KEY=           # Isi ini untuk mode langsung
VITE_BACKEND_URL=              # Isi ini untuk mode backend (lebih aman)
VITE_APP_SECRET_TOKEN=         # Token untuk autentikasi ke backend

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id

VITE_OAUTH_PROVIDER=google
VITE_GOOGLE_CLIENT_ID=your_google_client_id

VITE_LEADERBOARD_MODE=unique
VITE_PLACE_WEIGHT_MODE=per_user
```

5. Jalankan development server
```bash
npm run dev
```

6. Buka `http://localhost:3000`

---

## 🐳 Deploy ke Google Cloud Run

Auto-deploy via GitHub tersedia menggunakan Cloud Build. Setiap push ke branch `main` otomatis trigger build dan deploy.

### Setup Cloud Build Trigger

1. Buat trigger di Cloud Build → Connect ke GitHub repo
2. Build configuration: `cloudbuild.yaml`
3. Tambahkan semua substitution variables (`_VITE_*`) sesuai `.env`

### Manual Deploy

```bash
gcloud run deploy tebakinaja \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated \
  --port 8080
```

---

## 📁 Struktur Project

```
tebakinaja/
├── src/
│   ├── components/
│   │   ├── LandingPage.jsx       # Halaman utama + leaderboard + cara main
│   │   ├── CitySelection.jsx     # Pilih kota dengan search
│   │   ├── GameScreen.jsx        # Layout utama game (full-screen map)
│   │   ├── ClueModal.jsx         # Modal floating clue + jawaban
│   │   ├── MapView.jsx           # Google Maps full-screen + radius circle
│   │   ├── ResultScreen.jsx      # Layar akhir + rangkuman + leaderboard
│   │   └── SettingsPage.jsx      # Token, Google OAuth, dark mode
│   ├── context/
│   │   └── GameContext.jsx       # Global state management
│   ├── hooks/
│   │   └── useGameLogic.js       # Game logic + scoring + timer + prefetch
│   ├── services/
│   │   ├── geminiService.js      # Integrasi Gemini AI (direct/proxy mode)
│   │   ├── placesService.js      # Google Places + Firestore cache
│   │   ├── firebaseService.js    # Firestore leaderboard + stats
│   │   ├── authService.js        # Google OAuth (Firebase/Cloud Console)
│   │   ├── tokenService.js       # Anonymous token system
│   │   ├── clueCacheService.js   # Pre-fetch clue cache
│   │   └── placeWeightService.js # Weighted RNG pemilihan tempat
│   ├── App.jsx
│   └── main.jsx
├── Dockerfile
├── cloudbuild.yaml
├── .env.example
└── package.json
```

---

## 🏆 Dibuat untuk #JuaraVibeCoding

Project ini dibuat sebagai submission untuk **#JuaraVibeCoding** — program Google for Developers Indonesia yang mendorong siapa saja untuk membangun dan merilis aplikasi menggunakan AI.

**Kategori:** 🎮 Game — Sang Pembuat Keseruan

**Tech highlight:**
- Gemini AI generate clue dinamis berdasarkan data Places API — tidak ada soal hardcoded
- Sistem pre-fetch background untuk loading yang hampir instan antar ronde
- Weighted RNG untuk variasi tempat yang maksimal
- Full-stack: React + Firebase + Cloudflare Workers + Google Cloud Run

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.