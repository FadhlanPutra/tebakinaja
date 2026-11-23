import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './firebaseService';

// Cache clue bersifat GLOBAL per-tempat (dibagikan semua user).
// Memakai koleksi 'clue_cache' (sudah ada rules). Doc ID = `${city}__${slug}`
// sehingga lintas sesi & lintas pemain, clue yang sama tidak dibuat ulang.
// Doc lama ber-shape { clues: {...} } tidak bentrok karena ID-nya berbeda.
const CLUE_COLLECTION = 'clue_cache';

const placeKey = (city, placeName) =>
  `${String(city).toLowerCase().trim()}__${String(placeName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;

/**
 * Ambil clue satu tempat dari cache global.
 * @returns {Object|null} clueData atau null kalau belum pernah dibuat
 */
export const getPlaceClue = async (city, placeName) => {
  try {
    const docRef = doc(db, CLUE_COLLECTION, placeKey(city, placeName));
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data().clue || null;
  } catch (error) {
    console.error('[ClueCache] getPlaceClue failed:', error);
    return null;
  }
};

/**
 * Simpan clue satu tempat ke cache global.
 */
export const savePlaceClue = async (city, placeName, clue) => {
  try {
    const docRef = doc(db, CLUE_COLLECTION, placeKey(city, placeName));
    await setDoc(docRef, {
      city: String(city).toLowerCase().trim(),
      place_name: placeName,
      clue,
      created_at: Date.now(),
    });
  } catch (error) {
    console.error('[ClueCache] savePlaceClue failed:', error);
  }
};

/**
 * Ambil himpunan nama tempat yang SUDAH punya clue untuk satu kota.
 * Dipakai untuk menentukan batch uncached tanpa nembak Gemini.
 * @returns {Promise<Set<string>>}
 */
export const getCachedPlaceNames = async (city) => {
  try {
    const cityKey = String(city).toLowerCase().trim();
    const q = query(collection(db, CLUE_COLLECTION), where('city', '==', cityKey));
    const snapshot = await getDocs(q);
    const names = new Set();
    snapshot.forEach((docSnap) => {
      const name = docSnap.data().place_name;
      if (name) names.add(name);
    });
    return names;
  } catch (error) {
    console.error('[ClueCache] getCachedPlaceNames failed:', error);
    return new Set();
  }
};

/**
 * Hapus clue yang lebih tua dari maxAgeMs (default 30 hari).
 * Dipanggil saat startGame agar collection tidak membengkak.
 */
export const cleanupOldClues = async (maxAgeMs = 30 * 24 * 60 * 60 * 1000) => {
  try {
    const cutoff = Date.now() - maxAgeMs;
    const q = query(collection(db, CLUE_COLLECTION), where('created_at', '<', cutoff));
    const snapshot = await getDocs(q);

    const deletePromises = [];
    snapshot.forEach((docSnap) => deletePromises.push(deleteDoc(docSnap.ref)));
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  } catch (error) {
    console.error('[ClueCache] cleanupOldClues failed:', error);
  }
};