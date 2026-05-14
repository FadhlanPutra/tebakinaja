# 🗺️ TebakinAja

> **Seberapa kenal kamu dengan kotamu sendiri?**

TebakinAja adalah web game teka-teki berbasis lokasi dengan kearifan lokal Indonesia. Clue tentang tempat-tempat ikonik di kotamu di-generate secara real-time oleh AI. Tidak ada soal yang hardcoded, setiap sesi selalu berbeda.

![TebakinAja](https://img.shields.io/badge/Made%20with-Gemini%20AI-blue?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react) ![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase) ![Google Cloud](https://img.shields.io/badge/Deploy-Cloud%20Run-4285F4?style=flat-square&logo=googlecloud)

---

## 🎮 Cara Main

1. **Masukkan nickname** di halaman utama
2. **Pilih kota** yang ingin kamu tantang
3. **Baca clue** yang di-generate AI tentang sebuah tempat ikonik
4. **Tebak lokasinya** — pilih salah satu dari tiga cara:
   - 📍 **Klik di peta** — skor berdasarkan seberapa dekat tebakanmu
   - ⌨️ **Ketik nama tempatnya** — AI mengenali singkatan dan nama populer lokal
   - 🔤 **Pilih dari 4 opsi** — pilih jawaban yang menurutmu benar
5. **Lihat skor dan fun fact** setelah setiap ronde
6. **Selesaikan 5 ronde** dan masuk leaderboard global!

---

## ✨ Fitur Utama

### 🤖 AI-Powered Clue Generation
Setiap soal di-generate langsung oleh **Gemini 2.0 Flash** berdasarkan data tempat dari Google Places API. Tidak ada database soal, setiap sesi selalu fresh dan bervariasi.

### 📍 Sistem Skor Berbasis Jarak (Map Mode)
Terinspirasi dari GeoGuessr, skor peta dihitung menggunakan formula eksponensial berdasarkan jarak tebakanmu dari lokasi sebenarnya. Semakin dekat, semakin tinggi poinmu. Maksimal 500 poin.

### 🏷️ Fuzzy Matching + Accepted Answers
Gemini tahu bahwa "Monas" = "Monumen Nasional", "MAG" = "Mall Artha Gading". Jawaban teks divalidasi menggunakan **Fuse.js** dengan toleransi typo ringan sehingga tidak perlu menulis nama persis sama.

### 🏆 Leaderboard Global
Bersaing dengan pemain lain dari seluruh Indonesia. Skor tersimpan di **Firebase Firestore** secara real-time.

### 🔑 Sistem Token Identitas
Tidak perlu login. Setiap pemain mendapat token unik (format: `XXXX-XXXX`) yang tersimpan di browser. Gunakan token yang sama untuk melanjutkan progress di perangkat lain melalui halaman Settings.

### ⚡ Server-Side Caching
Data tempat dari Google Places API di-cache di Firestore selama 7 hari per kota, menghemat API quota secara signifikan meski banyak user mengakses kota yang sama.

---

## 🛠️ Tech Stack

| Kategori | Teknologi |
|----------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS + Framer Motion |
| AI | Google Gemini 2.0 Flash |
| Maps | Google Maps JavaScript API + Places API |
| Database | Firebase Firestore |
| Deploy | Google Cloud Run (Docker) |
| Icons | Lucide React |

---

## 🚀 Cara Menjalankan Lokal

### Prerequisites
- Node.js >= 18
- API Key Gemini (dari [aistudio.google.com](https://aistudio.google.com))
- API Key Google Maps Platform
- Project Firebase dengan Firestore aktif

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

4. Isi nilai di .env sesuai dengan API key masing-masing

5. Jalankan development server
```bash
npm run dev
```

6. Buka `http://localhost:3000`

<!--
---

## 🐳 Deploy ke Google Cloud Run

1. Build Docker image
```bash
docker build -t tebakinaja .
```

2. Tag dan push ke Google Container Registry
```bash
docker tag tebakinaja gcr.io/PROJECT_ID/tebakinaja
docker push gcr.io/PROJECT_ID/tebakinaja
```

3. Deploy ke Cloud Run
```bash
gcloud run deploy tebakinaja \
  --image gcr.io/PROJECT_ID/tebakinaja \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars VITE_GEMINI_API_KEY=...,VITE_MAPS_API_KEY=...
```

--- -->

<!-- ## 📁 Struktur Project

```
tebakinaja/
├── src/
│   ├── components/
│   │   ├── LandingPage.jsx      # Halaman utama + leaderboard + cara main
│   │   ├── CitySelection.jsx    # Pilih kota dengan autocomplete
│   │   ├── GameScreen.jsx       # Layout utama game
│   │   ├── CluePanel.jsx        # Panel tampilan clue + difficulty
│   │   ├── MapView.jsx          # Google Maps interaktif
│   │   ├── AnswerInput.jsx      # Input teks + MCQ + indikator peta
│   │   ├── ResultScreen.jsx     # Layar akhir + rangkuman + confetti
│   │   └── SettingsPage.jsx     # Kelola token + nickname
│   ├── context/
│   │   └── GameContext.jsx      # Global state management
│   ├── hooks/
│   │   └── useGameLogic.js      # Game logic + scoring + timer
│   ├── services/
│   │   ├── geminiService.js     # Integrasi Gemini AI
│   │   ├── placesService.js     # Google Places + Firestore cache
│   │   ├── firebaseService.js   # Firestore leaderboard
│   │   └── tokenService.js      # Sistem token identitas user
│   ├── App.jsx
│   └── main.jsx
├── Dockerfile
├── .env.example
└── package.json
``` -->

<!-- ---

## 🏆 Dibuat untuk #JuaraVibeCoding

Project ini dibuat sebagai submission untuk **#JuaraVibeCoding** — program Google for Developers Indonesia yang mendorong siapa saja untuk membangun dan merilis aplikasi menggunakan AI.

**Kategori:** 🎮 Game — Sang Pembuat Keseruan -->

---

## 📄 Lisensi

MIT License — bebas digunakan dan dimodifikasi.