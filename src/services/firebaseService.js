import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
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

export const saveScore = async (data) => {
  try {
    const docRef = await addDoc(collection(db, "leaderboard"), data);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
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
