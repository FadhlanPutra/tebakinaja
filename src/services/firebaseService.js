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
  
  try {
    if (LEADERBOARD_MODE === 'unique') {
      // Cari entry yang sudah ada berdasarkan token atau uid
      const identifier = scoreData.token;
      if (!identifier) {
        // Tidak ada identifier → tambah entry baru saja
        await addDoc(collection(db, 'leaderboard'), scoreData);
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
        await addDoc(collection(db, 'leaderboard'), scoreData);
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
          console.log('[Leaderboard] Score updated:', scoreData.score);
        } else {
          // Tetap sinkronkan profil publik (mis. nickname terbaru)
          await updateDoc(existingDoc.ref, {
            nickname: scoreData.nickname,
            city: scoreData.city,
          });
          console.log('[Leaderboard] Existing score higher, profile synced');
        }
      }
    } else {
      // Mode 'all' → semua entry masuk seperti sebelumnya
      await addDoc(collection(db, 'leaderboard'), scoreData);
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
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    const leaderboard = [];
    querySnapshot.forEach((doc) => {
      leaderboard.push({ id: doc.id, ...doc.data() });
    });
    return leaderboard;
  } catch (e) {
    console.error("Error getting leaderboard: ", e);
    throw e;
  }
};

export { db };
