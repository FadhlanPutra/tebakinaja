import { db } from './firebaseService';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, query, collection, where, getDocs, writeBatch } from 'firebase/firestore';

export const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const randStr = (len) => {
    const array = new Uint8Array(len);
    crypto.getRandomValues(array);
    return Array.from(array, (x) => chars[x % chars.length]).join('');
  };

  return `${randStr(4)}-${randStr(4)}`;
};

export const getOrCreateToken = async () => {
  try {
    let token = localStorage.getItem('tebakinaja_token');
    
    if (!token) {
      token = generateToken();
      localStorage.setItem('tebakinaja_token', token);
      
      const docRef = doc(db, 'users', token);
      await setDoc(docRef, {
        token: token,
        nickname: localStorage.getItem('tebakinaja_nickname') || '',
        created_at: serverTimestamp(),
        total_games: 0,
        highest_score: 0,
        total_answers: 0,
        correct_answers: 0
      });
    } else {
      const docRef = doc(db, 'users', token);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
         await setDoc(docRef, {
            token: token,
            nickname: localStorage.getItem('tebakinaja_nickname') || '',
            created_at: serverTimestamp(),
            total_games: 0,
            highest_score: 0,
            total_answers: 0,
            correct_answers: 0
         });
      }
    }
    return token;
  } catch (error) {
    console.error('Error getting/creating token:', error);
    return null;
  }
};

export const importToken = async (token) => {
  try {
    const docRef = doc(db, 'users', token);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      localStorage.setItem('tebakinaja_token', token);
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error importing token:', error);
    return null;
  }
};

export const getUserData = async (token) => {
  try {
    const docRef = doc(db, 'users', token);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const updateUserData = async (token, data) => {
  try {
    const docRef = doc(db, 'users', token);
    await updateDoc(docRef, data);
  } catch (error) {
    console.error('Error updating user data:', error);
  }
};

export const migrateTokenToGoogle = async (token, uid) => {
  try {
    const tokenDocRef = doc(db, 'users', token);
    const tokenSnap = await getDoc(tokenDocRef);
    if (tokenSnap.exists()) {
      const data = tokenSnap.data();
      const googleDocRef = doc(db, 'users', uid);
      
      const batch = writeBatch(db);
      
      batch.set(googleDocRef, {
        ...data,
        uid: uid,
        linked_token: token
      }, { merge: true });

      const q = query(collection(db, "leaderboard"), where("token", "==", token));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((docSnap) => {
        batch.update(docSnap.ref, { uid: uid });
      });
      
      await batch.commit();
    }
  } catch (error) {
    console.error("Error migrating token to Google: ", error);
    throw error;
  }
};
