import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Abstraction layer to call Gemini API either directly (Direct Mode)
 * or through the backend proxy (Proxy Mode)
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string>} The generated text
 */
export const generateClue = async (prompt) => {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // Fallback ke gateway Nutaraline (via backend /api/fall/nutaraline)
  const generateWithNutaraline = async () => {
    if (!BACKEND_URL) {
      throw new Error('Fallback Nutaraline tidak tersedia: VITE_BACKEND_URL kosong');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(`${BACKEND_URL}/api/fall/nutaraline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Token': import.meta.env.VITE_APP_SECRET_TOKEN,
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Nutaraline fallback gagal: ${res.status} ${errText}`);
      }
      const data = await res.json();
      if (!data.text) throw new Error('Nutaraline fallback: respons kosong');
      return data.text;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    if (API_KEY) {
      // console.log('[GeminiService] Running in Direct Mode (Frontend SDK)');
      const genAI = new GoogleGenerativeAI(API_KEY);
      const MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-3.1-flash-lite";
      const model = genAI.getGenerativeModel({ model: MODEL });

      const generateWithRetry = async (model, payload, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await model.generateContent(payload);
          } catch (error) {
            if (error.message?.includes('503') && i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
              continue;
            }
            throw error;
          }
        }
      };

      const result = await generateWithRetry(model, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
      });

      return result.response.text();
    } else {
      // console.log('[GeminiService] Running in Proxy Mode (Backend Server)');

      // Gemini dicoba 1x saja (backend juga 1x, tanpa retry). Gagal apa pun,
      // termasuk 429/503 -> langsung fallback ke Nutaraline. Timeout > timeout backend (12 dtk).
      const MAX_RETRIES = 1;
      const TIMEOUT_MS = 15000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          // console.log(`[GeminiService] Attempt ${attempt}/${MAX_RETRIES}...`);

          const response = await fetch(`${BACKEND_URL}/api/generate-clue`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-App-Token': import.meta.env.VITE_APP_SECRET_TOKEN,
            },
            body: JSON.stringify({ prompt }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // console.log('[GeminiService] Response status:', response.status);

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Gagal memanggil backend proxy: ${response.status} ${response.statusText}. ${errorText}`);
          }

          const data = await response.json();
          if (!data.text) throw new Error('Backend proxy mengembalikan respons kosong');
          return data.text;

        } catch (err) {
          clearTimeout(timeoutId);

          const isTimeout = err.name === 'AbortError';
          console.warn(`[GeminiService] Attempt ${attempt} failed (${isTimeout ? 'timeout' : err.message})`);

          if (attempt === MAX_RETRIES) {
            throw new Error('Gagal mengambil data dari Gemini setelah beberapa percobaan.');
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  } catch (geminiError) {
    console.warn('[GeminiService] Gemini gagal, fallback ke Nutaraline:', geminiError?.message);
    return generateWithNutaraline();
  }
};

/**
 * Generate clue and facts from Gemini based on place data
 * @param {Object} placeData - Data from Google Places API (name, address, etc.)
 * @returns {Promise<Object>} JSON containing clue, answer, difficulty, fun_fact, choices, lat, lng
 */
/**
 * Tentukan difficulty dari popularitas (userRatingCount) relatif terhadap
 * tempat lain di kota yang sama. Makin banyak ulasan → makin terkenal → easy.
 * Mengembalikan null kalau data tidak cukup, sehingga model jadi fallback.
 * @param {Object} placeData
 * @param {Array} otherPlaces
 * @returns {'easy'|'medium'|'hard'|null}
 */
const computeDifficultyFromData = (placeData, otherPlaces = []) => {
  const own = placeData.userRatingCount;
  if (typeof own !== 'number' || own <= 0) return null;

  const counts = otherPlaces
    .map(p => p.userRatingCount)
    .filter(c => typeof c === 'number' && c > 0);
  if (counts.length < 3) return null;

  const rank = counts.filter(c => c <= own).length / counts.length;
  if (rank >= 0.8) return 'easy';
  if (rank >= 0.4) return 'medium';
  return 'hard';
};

const normalizeName = (value = '') =>
  String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Rakit clueData final dari output model mentah + data tempat.
 * Dipakai bersama oleh generateGameClue (single) dan generateGameCluesBatch
 * agar logika difficulty, distractor/choices, dan lat/lng tidak berbeda.
 */
const assembleClue = (raw, place, allPlaces = []) => {
  const lat = place.lat
    ?? place.geometry?.location?.lat?.()
    ?? place.location?.lat?.();

  const lng = place.lng
    ?? place.geometry?.location?.lng?.()
    ?? place.location?.lng?.();

  const answer = raw.answer || place.name;

  const sameCategory = allPlaces.filter(
    p => p.name !== place.name && p.category === place.category
  );
  const distractorPool = sameCategory.length >= 3
    ? sameCategory
    : allPlaces.filter(p => p.name !== place.name);
  const distractors = distractorPool
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    .map(p => p.name);
  const choices = [...distractors, answer].sort(() => 0.5 - Math.random());

  const difficulty = computeDifficultyFromData(place, allPlaces) || raw.difficulty || 'medium';

  return {
    ...raw,
    answer,
    accepted_answers: raw.accepted_answers || [place.name, place.name.toLowerCase()],
    difficulty,
    choices,
    lat,
    lng,
  };
};

/**
 * Generate clue untuk BANYAK tempat dalam SATU request Gemini.
 * Mengurangi jumlah request drastis (1 request untuk N tempat).
 * @param {Array} places - tempat yang mau dibuatkan clue (mis. 10)
 * @param {Array} allPlaces - seluruh tempat di kota (untuk distractor & difficulty)
 * @returns {Promise<Map<string, Object>>} map placeName -> clueData
 */
export const generateGameCluesBatch = async (places, allPlaces = []) => {
  if (!places || places.length === 0) return new Map();

  const list = places
    .map((p, i) => `${i + 1}. Nama: ${p.name} | Kategori: ${p.category || 'tempat umum'} | Alamat: ${p.address || 'Indonesia'}`)
    .join('\n');

  const prompt = `
    Anda adalah AI pembuat kuis game geoguessr bernama "TebakinAja".
    Buatkan 1 teka-teki untuk SETIAP tempat pada daftar berikut.

    DAFTAR TEMPAT:
    ${list}

    ATURAN (berlaku untuk semua tempat):
    - clue 2-3 kalimat, maksimal 280 karakter, fun dan relatable
    - JANGAN sebut atau memuat potongan kata apa pun dari nama tempat di clue
    - accepted_answers: variasi SPESIFIK & unik (nama lengkap, singkatan populer, versi tanpa awalan mall/plaza/the); minimal 2 kata ATAU akronim unik; JANGAN kata generik yang merujuk banyak tempat
    - fun_fact: 1-2 kalimat, fakta yang bisa diverifikasi; hanya tulis yang kamu yakin benar, jangan mengarang tahun/angka/nama
    - "answer" harus PERSIS sama dengan nama tempat
    - "place_name" harus PERSIS sama dengan nama tempat pada daftar

    Respons HANYA JSON array (tanpa teks lain), urutan dan jumlah SAMA dengan daftar:
    [
      { "place_name": "Nama Tempat", "clue": "...", "answer": "Nama Tempat", "accepted_answers": ["..."], "fun_fact": "..." }
    ]
  `;

  const responseText = await generateClue(prompt);
  const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(`Batch JSON tidak valid: ${parseError.message}`);
  }

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('Batch hasil kosong atau bukan array');
  }

  const map = new Map();
  places.forEach((place) => {
    const target = normalizeName(place.name);
    const raw = arr.find((a) =>
      (a.place_name && normalizeName(a.place_name) === target) ||
      (a.answer && normalizeName(a.answer) === target)
    );
    if (raw) map.set(place.name, assembleClue(raw, place, allPlaces));
  });

  if (map.size === 0) {
    throw new Error('Tidak ada entri batch yang cocok dengan daftar tempat');
  }

  return map;
};

export const generateGameClue = async (placeData, otherPlaces) => {
  try {
    const prompt = `
      Anda adalah AI pembuat kuis game geoguessr bernama "TebakinAja".
      Buatkan 1 soal teka-teki tentang tempat berikut:
      Nama Tempat: ${placeData.name}
      Kategori: ${placeData.category || 'tempat umum'}
      Alamat: ${placeData.address || 'Indonesia'}

      ATURAN DIFFICULTY (wajib ikuti):
      - "easy": tempat yang SANGAT terkenal, dikenal hampir semua orang Indonesia (Monas, GBK, dsb)
      - "medium": tempat yang cukup dikenal warga lokal kota tersebut
      - "hard": tempat yang hanya dikenal orang yang tinggal atau sering ke kota tersebut

      JANGAN jadikan tempat dengan nama asing/kolonial/tidak umum sebagai soal "easy" atau "medium".
      Kalau nama tempatnya tidak umum dikenal, wajib pilih "hard".

      ATURAN CLUE:
      - Sesuaikan dengan kategori: restoran → bahas menu/suasana, mall → bahas tenant/arsitektur, taman → bahas aktivitas
      - JANGAN selalu bahas sejarah kolonial
      - JANGAN sebut nama tempat di clue
      - JANGAN memuat kata apa pun dari nama tempat, termasuk potongan katanya
      - Buat clue yang fun dan relatable, bukan seperti buku sejarah
      - Clue 2-3 kalimat, maksimal 280 karakter

      ATURAN FAKTA:
      - fun_fact 1-2 kalimat, berisi fakta yang bisa diverifikasi
      - Hanya tulis fakta yang kamu yakin benar
      - Kalau tidak yakin, deskripsikan dari kategori dan area alamat saja
      - Jangan mengarang tahun, angka, atau nama

      Untuk accepted_answers:
      - WAJIB isi dengan variasi nama yang SPESIFIK dan UNIK untuk tempat ini saja
      - Berikan 8-15 variasi accepted_answers yang realistis dipakai orang lokal
      - JANGAN masukkan kata tunggal yang bersifat generik dan bisa merujuk ke banyak tempat lain
      - Setiap accepted_answer minimal harus terdiri dari 2 kata ATAU merupakan singkatan/akronim yang unik
      - Sertakan variasi: nama lengkap, singkatan populer, ejaan tanpa tanda baca, alias lokal, dan versi tanpa awalan umum (misal tanpa kata "mall/plaza/the")
      - Contoh BENAR untuk "Mall Artha Gading": ["mall artha gading", "artha gading", "MAG"]
      - Contoh SALAH untuk "Mall Artha Gading": ["mall", "artha", "gading", "mal"]
      - Contoh BENAR untuk "Cibinong City Mall": ["cibinong city mall", "CCM", "cibinong mall"]
      - Contoh SALAH untuk "Cibinong City Mall": ["mall", "cibinong", "city mall"]
      - Contoh BENAR untuk "Monumen Nasional": ["monumen nasional", "monas", "tugu monas"]
      - Contoh SALAH untuk "Monumen Nasional": ["monumen", "tugu", "nasional"]
      - Singkatan/akronim yang unik dan dikenal luas tetap boleh meskipun 1 kata (contoh: "monas", "GBK", "TMII")

      Respons HANYA JSON murni:
      {
        "clue": "...",
        "answer": "${placeData.name}",
        "accepted_answers": [...],
        "difficulty": "easy|medium|hard",
        "fun_fact": "..."
      }
    `;

    const responseText = await generateClue(prompt);
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText.replace(/```json/gi, '').replace(/```/g, '').trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON:", parseError);
      // Fallback
      jsonResult = {
        clue: `Tempat ikonik di sekitar ${placeData.address}. Sangat populer dikunjungi. Bisakah kamu menebaknya?`,
        answer: placeData.name,
        accepted_answers: [placeData.name, placeData.name.toLowerCase()],
        difficulty: "medium",
        fun_fact: `Tempat ini adalah salah satu landmark kebanggaan kota.`
      };
    }

    // Difficulty ditentukan dari data popularitas; model hanya fallback.
    // assembleClue menyatukan difficulty, distractor/choices, dan lat/lng.
    return assembleClue(jsonResult, placeData, otherPlaces);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Gagal mengambil data dari AI. Periksa API Key atau koneksi Anda.");
  }
};