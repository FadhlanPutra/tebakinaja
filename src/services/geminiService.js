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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Generate distractors for choices
    const distractors = otherPlaces
      .filter(p => p.name !== placeData.name)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(p => p.name);
    
    // Add correct answer and shuffle
    const choices = [...distractors, placeData.name].sort(() => 0.5 - Math.random());

    const prompt = `
Anda adalah AI pembuat kuis game geoguessr bernama "TebakinAja".
Buatkan 1 soal teka-teki tentang tempat berikut:
Nama Tempat: ${placeData.name}
Alamat: ${placeData.formatted_address || "Indonesia"}

Aturan:
1. 'clue': Buat 1-2 kalimat petunjuk yang menarik, deskriptif, membahas ciri fisik, sejarah, atau kegiatan di sana, TAPI JANGAN PERNAH menyebutkan nama tempatnya secara langsung atau sebagian dari namanya.
2. 'difficulty': Pilih antara "easy", "medium", atau "hard".
3. 'fun_fact': Berikan satu fakta unik, lucu, atau historis tentang tempat ini.

Respons HANYA berupa JSON murni dengan struktur persis seperti di bawah ini, tanpa awalan/akhiran markdown:
{
  "clue": "isi petunjuk disini",
  "answer": "${placeData.name}",
  "accepted_answers": ["nama resmi", "nama populer", "singkatan", "sebutan lain"],
  "difficulty": "medium",
  "fun_fact": "isi fakta unik disini"
}

Untuk accepted_answers: isi dengan semua variasi nama yang umum dipakai masyarakat lokal, singkatan populer, dan nama resminya. Contoh untuk "Monumen Nasional": ["monumen nasional", "monas", "tugu monas", "national monument"]
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      }
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

    return {
      ...jsonResult,
      choices,
      lat: placeData.geometry.location.lat(),
      lng: placeData.geometry.location.lng()
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Gagal mengambil data dari AI. Periksa API Key atau koneksi Anda.");
  }
};
