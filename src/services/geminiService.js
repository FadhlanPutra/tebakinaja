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

    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 20000;

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
        return data.text;

      } catch (err) {
        clearTimeout(timeoutId);

        const isTimeout = err.name === 'AbortError';
        console.warn(`[GeminiService] Attempt ${attempt} failed (${isTimeout ? 'timeout' : err.message})`);

        if (attempt === MAX_RETRIES) {
          throw new Error('Gagal mengambil data dari AI setelah beberapa percobaan. Coba lagi.');
        }

        // console.log(`[GeminiService] Retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
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

    // Difficulty ditentukan dari data popularitas; model hanya fallback
    const computedDifficulty = computeDifficultyFromData(placeData, otherPlaces);
    if (computedDifficulty) {
      jsonResult.difficulty = computedDifficulty;
    }

    // Generate distractors for choices — prioritas kategori yang sama agar
    // pemain tidak bisa menebak dari jenis tempatnya
    const sameCategory = otherPlaces.filter(
      p => p.name !== placeData.name && p.category === placeData.category
    );
    const distractorPool = sameCategory.length >= 3
      ? sameCategory
      : otherPlaces.filter(p => p.name !== placeData.name);
    const distractors = distractorPool
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(p => p.name);

    // Add correct answer and shuffle
    const choices = [...distractors, jsonResult.answer].sort(() => 0.5 - Math.random());

    const lat = placeData.lat 
      ?? placeData.geometry?.location?.lat?.() 
      ?? placeData.location?.lat?.();

    const lng = placeData.lng 
      ?? placeData.geometry?.location?.lng?.() 
      ?? placeData.location?.lng?.();

  return {
    ...jsonResult,
    choices,
    lat,
    lng,
  };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Gagal mengambil data dari AI. Periksa API Key atau koneksi Anda.");
  }
};