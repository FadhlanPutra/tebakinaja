import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const token = localStorage.getItem('tebakinaja_token');
      
      const initialData = {
        uid: user.uid,
        nickname: user.displayName || 'Pemain',
        email: user.email,
        photo_url: user.photoURL,
        created_at: new Date(),
        total_games: 0,
        highest_score: 0,
        total_answers: 0,
        correct_answers: 0
      };

      await setDoc(docRef, initialData);

      if (token) {
        const { migrateTokenToGoogle } = await import('./tokenService');
        await migrateTokenToGoogle(token, user.uid);
      }
    }
    
    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL
    };
  } catch (error) {
    console.error("Error signing in with Google: ", error);
    throw error;
  }
};

export const signOutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out: ", error);
    throw error;
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

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
