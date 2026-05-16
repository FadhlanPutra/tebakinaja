import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Generate clue and facts from Gemini based on place data
 * @param {Object} placeData - Data from Google Places API (name, address, etc.)
 * @returns {Promise<Object>} JSON containing clue, answer, difficulty, fun_fact, choices, lat, lng
 */
export const generateGameClue = async (placeData, otherPlaces) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    // const model = genAI.getGenerativeModel({
    //   model: "gemini-2.0-flash",
    //   generationConfig: {
    //     responseMimeType: "application/json", // hanya jalan di v1beta
    //   }
    // });

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
- Buat clue yang fun dan relatable, bukan seperti buku sejarah

Respons HANYA JSON murni:
{
  "clue": "...",
  "answer": "${placeData.name}",
  "accepted_answers": [...],
  "difficulty": "easy|medium|hard",
  "fun_fact": "..."
}
`;

    const generateWithRetry = async (model, payload, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await model.generateContent(payload);
        } catch (error) {
          if (error.message?.includes('503') && i < maxRetries - 1) {
            // Tunggu 2 detik sebelum retry
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            continue;
          }
          throw error;
        }
      }
    };

    const result = await generateWithRetry(model, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 }
    });

    const responseText = result.response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText.replace(/```json/gi, '').replace(/```/g, '').trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON:", parseError);
      // Fallback
      jsonResult = {
        clue: `Tempat ikonik di sekitar ${placeData.formatted_address}. Sangat populer dikunjungi. Bisakah kamu menebaknya?`,
        answer: placeData.name,
        accepted_answers: [placeData.name, placeData.name.toLowerCase()],
        difficulty: "medium",
        fun_fact: `Tempat ini adalah salah satu landmark kebanggaan kota.`
      };
    }

    // Generate distractors for choices
    const distractors = otherPlaces
      .filter(p => p.name !== placeData.name)
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
