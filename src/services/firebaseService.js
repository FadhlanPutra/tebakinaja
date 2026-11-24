import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, doc, updateDoc, where, writeBatch } from "firebase/firestore";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Jumlah dokumen yang diambil sebelum disaring. Lebih besar dari tampilan (10)
// supaya entry yang disembunyikan (leaderboard === false) tidak mengurangi isi top 10.
const LEADERBOARD_SIZE = 10;
const LEADERBOARD_FETCH = 30;

export const updateUserStats = async (identifier, stats) => {
  try {
    const docRef = doc(db, 'users', identifier);
    await updateDoc(docRef, stats);
  } catch (error) {
    console.error("Error updating user stats: ", error);
    throw error;
  }
};

export const saveScore = async (scoreData) => {
  const LEADERBOARD_MODE = import.meta.env.VITE_LEADERBOARD_MODE || 'unique';

  // Entry baru tampil di leaderboard secara default. Caller boleh menimpa
  // lewat scoreData.leaderboard. Update entry lama TIDAK menyentuh field ini,
  // jadi nilai false yang diset manual di Firestore tetap bertahan.
  const newEntry = { leaderboard: true, ...scoreData };

  try {
    if (LEADERBOARD_MODE === 'unique') {
      // Cari entry yang sudah ada berdasarkan token atau uid
      const identifier = scoreData.token;
      if (!identifier) {
        // Tidak ada identifier → tambah entry baru saja
        await addDoc(collection(db, 'leaderboard'), newEntry);
        return;
      }

      // Query leaderboard berdasarkan token
      const q = query(
        collection(db, 'leaderboard'),
        where('token', '==', identifier)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Belum ada entry → buat baru
        await addDoc(collection(db, 'leaderboard'), newEntry);
      } else {
        // Sudah ada entry → update hanya kalau skor baru lebih tinggi
        const existingDoc = querySnapshot.docs[0];
        const existingScore = existingDoc.data().score || 0;

        if (scoreData.score > existingScore) {
          await updateDoc(existingDoc.ref, {
            nickname: scoreData.nickname,
            score: scoreData.score,
            city: scoreData.city,
            rounds: scoreData.rounds,
            created_at: scoreData.created_at,
          });
          // console.log('[Leaderboard] Score updated:', scoreData.score);
        } else {
          // Tetap sinkronkan profil publik (mis. nickname terbaru)
          await updateDoc(existingDoc.ref, {
            nickname: scoreData.nickname,
            city: scoreData.city,
          });
          // console.log('[Leaderboard] Existing score higher, profile synced');
        }
      }
    } else {
      // Mode 'all' → semua entry masuk seperti sebelumnya
      await addDoc(collection(db, 'leaderboard'), newEntry);
    }
  } catch (error) {
    console.error('[Leaderboard] Failed to save score:', error);
    throw error;
  }
};

export const syncLeaderboardNickname = async (identifier, nickname) => {
  if (!identifier || !nickname) return;

  try {
    const leaderboardRef = collection(db, 'leaderboard');
    const tokenQuery = query(leaderboardRef, where('token', '==', identifier));
    const uidQuery = query(leaderboardRef, where('uid', '==', identifier));

    const [tokenDocs, uidDocs] = await Promise.all([getDocs(tokenQuery), getDocs(uidQuery)]);
    const docsMap = new Map();

    tokenDocs.forEach((snap) => docsMap.set(snap.id, snap.ref));
    uidDocs.forEach((snap) => docsMap.set(snap.id, snap.ref));

    if (docsMap.size === 0) return;

    const batch = writeBatch(db);
    docsMap.forEach((ref) => {
      batch.update(ref, { nickname });
    });
    await batch.commit();
  } catch (error) {
    console.error('[Leaderboard] Failed to sync nickname:', error);
    throw error;
  }
};

export const getLeaderboard = async () => {
  try {
    // Ambil lebih banyak dari 10, lalu saring di klien. Cara ini tidak butuh
    // composite index Firestore, dan dokumen lama tanpa field `leaderboard`
    // tetap tampil (hanya `leaderboard === false` yang disembunyikan).
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(LEADERBOARD_FETCH));
    const querySnapshot = await getDocs(q);
    const leaderboard = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.leaderboard === false) return;
      leaderboard.push({ id: doc.id, ...data });
    });
    return leaderboard.slice(0, LEADERBOARD_SIZE);
  } catch (e) {
    console.error("Error getting leaderboard: ", e);
    throw e;
  }
};

export { db };