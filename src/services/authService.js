import { jwtDecode } from 'jwt-decode';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseService';

const PROVIDER = import.meta.env.VITE_OAUTH_PROVIDER || 'firebase';

// ─── Shared: proses data user ke Firestore setelah login berhasil ──────────────
// Dipakai oleh kedua provider

export const processUserLogin = async (user, currentToken) => {
  // user = { uid, displayName, email, photoURL }
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const tokenRef = doc(db, 'users', currentToken);
    const tokenSnap = await getDoc(tokenRef);

    if (tokenSnap.exists()) {
      // Migrasi data token anonymous ke akun Google
      const tokenData = tokenSnap.data();
      await setDoc(userRef, {
        uid: user.uid,
        nickname: tokenData.nickname || user.displayName,
        email: user.email,
        photo_url: user.photoURL,
        linked_token: currentToken,
        created_at: serverTimestamp(),
        total_games: tokenData.total_games || 0,
        highest_score: tokenData.highest_score || 0,
        total_answers: tokenData.total_answers || 0,
        correct_answers: tokenData.correct_answers || 0,
      });
    } else {
      await setDoc(userRef, {
        uid: user.uid,
        nickname: user.displayName,
        email: user.email,
        photo_url: user.photoURL,
        linked_token: currentToken,
        created_at: serverTimestamp(),
        total_games: 0,
        highest_score: 0,
        total_answers: 0,
        correct_answers: 0,
      });
    }
  } else {
    await updateDoc(userRef, {
      email: user.email,
      photo_url: user.photoURL,
    });
  }

  return user;
};

// ─── Provider: Firebase Auth ───────────────────────────────────────────────────

const firebaseSignIn = async (currentToken) => {
  const { signInWithPopup, getAuth, GoogleAuthProvider } = await import('firebase/auth');
  const { app } = await import('./firebaseService');
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = {
    uid: result.user.uid,
    displayName: result.user.displayName,
    email: result.user.email,
    photoURL: result.user.photoURL,
  };
  return processUserLogin(user, currentToken);
};

const firebaseSignOut = async () => {
  const { signOut, getAuth } = await import('firebase/auth');
  const { app } = await import('./firebaseService');
  const auth = getAuth(app);
  await signOut(auth);
  clearGoogleSession();
};

const firebaseRestoreSession = async () => {
  // Firebase auto-restore session via onAuthStateChanged
  // Dipanggil sekali di LandingPage
  return new Promise((resolve) => {
    import('firebase/auth').then(({ getAuth, onAuthStateChanged }) => {
      import('./firebaseService').then(({ app }) => {
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          unsubscribe();
          if (firebaseUser) {
            resolve({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
            });
          } else {
            resolve(null);
          }
        });
      });
    });
  });
};

// ─── Provider: Google OAuth (Cloud Console) ────────────────────────────────────

const googleRestoreSession = () => {
  const credential = localStorage.getItem('tebakinaja_google_credential');
  if (!credential) return null;
  try {
    const decoded = jwtDecode(credential);
    if (decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('tebakinaja_google_credential');
      return null;
    }
    return {
      uid: decoded.sub,
      displayName: decoded.name,
      email: decoded.email,
      photoURL: decoded.picture,
    };
  } catch {
    localStorage.removeItem('tebakinaja_google_credential');
    return null;
  }
};

// ─── Session helpers ───────────────────────────────────────────────────────────

export const saveGoogleSession = (credential) => {
  localStorage.setItem('tebakinaja_google_credential', credential);
};

export const clearGoogleSession = () => {
  localStorage.removeItem('tebakinaja_google_credential');
};

// ─── Public API — dipakai oleh komponen, tidak peduli provider ────────────────

export const authSignIn = async (currentToken, credentialResponse = null) => {
  if (PROVIDER === 'firebase') {
    return firebaseSignIn(currentToken);
  } else {
    // credentialResponse.credential adalah JWT string
    const decoded = jwtDecode(credentialResponse.credential);
    const user = {
      uid: decoded.sub,
      displayName: decoded.name,
      email: decoded.email,
      photoURL: decoded.picture,
    };
    saveGoogleSession(credentialResponse.credential);
    return processUserLogin(user, currentToken);
  }
};

export const authSignOut = async () => {
  if (PROVIDER === 'firebase') {
    return firebaseSignOut();
  } else {
    clearGoogleSession();
  }
};

export const authRestoreSession = async () => {
  if (PROVIDER === 'firebase') {
    return firebaseRestoreSession();
  } else {
    return googleRestoreSession();
  }
};

export const getAuthProvider = () => PROVIDER;
