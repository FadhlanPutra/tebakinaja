import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebaseService';

const CACHE_COLLECTION = 'clue_cache';

/**
 * Simpan batch clue ke Firestore cache
 * @param {string} sessionId - ID unik sesi game
 * @param {Object} clues - object berisi clue per ronde { 2: clueData, 3: clueData, ... }
 */
export const saveCluesToCache = async (sessionId, clues) => {
  try {
    const docRef = doc(db, CACHE_COLLECTION, sessionId);
    await setDoc(docRef, {
      created_at: Date.now(),
      used_rounds: [],  // track ronde mana yang sudah diambil
      clues,
    });
    console.log(`[ClueCache] Saved ${Object.keys(clues).length} clues for session ${sessionId}`);
  } catch (error) {
    console.error('[ClueCache] Failed to save clues:', error);
  }
};

/**
 * Ambil clue dari cache berdasarkan nomor ronde
 * @param {string} sessionId
 * @param {number} round - nomor ronde (2-5)
 * @returns clueData atau null kalau tidak ada
 */
export const getClueFromCache = async (sessionId, round) => {
  try {
    const docRef = doc(db, CACHE_COLLECTION, sessionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    const clue = data.clues?.[round.toString()];

    if (!clue) return null;

    // Tandai ronde ini sudah digunakan
    await updateDoc(docRef, {
      used_rounds: [...(data.used_rounds || []), round],
    });

    return clue;
  } catch (error) {
    console.error('[ClueCache] Failed to get clue:', error);
    return null;
  }
};

/**
 * Hapus cache sesi yang sudah selesai
 * @param {string} sessionId
 */
export const deleteSessionCache = async (sessionId) => {
  try {
    await deleteDoc(doc(db, CACHE_COLLECTION, sessionId));
    console.log(`[ClueCache] Deleted cache for session ${sessionId}`);
  } catch (error) {
    console.error('[ClueCache] Failed to delete cache:', error);
  }
};

/**
 * Cleanup cache lama — dipanggil saat startGame
 * Hapus cache yang umurnya > 24 jam DAN bukan dibuat dalam 10 menit terakhir
 */
export const cleanupOldCache = async () => {
  try {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const tenMinutesAgo = now - 10 * 60 * 1000;

    const snapshot = await getDocs(collection(db, CACHE_COLLECTION));
    
    const deletePromises = [];
    snapshot.forEach((docSnap) => {
      const { created_at } = docSnap.data();
      const isOlderThanOneDay = created_at < oneDayAgo;
      const isNewerThanTenMinutes = created_at > tenMinutesAgo;

      // Hapus hanya kalau lebih dari 24 jam DAN bukan yang baru dibuat
      if (isOlderThanOneDay && !isNewerThanTenMinutes) {
        deletePromises.push(deleteDoc(docSnap.ref));
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      console.log(`[ClueCache] Cleaned up ${deletePromises.length} old cache entries`);
    }
  } catch (error) {
    console.error('[ClueCache] Cleanup failed:', error);
  }
};

/**
 * Generate session ID unik untuk satu game
 */
export const generateSessionId = (token) => {
  return `${token}_${Date.now()}`;
};
