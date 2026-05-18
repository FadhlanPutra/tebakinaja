import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebaseService';

const WEIGHT_MODE = import.meta.env.VITE_PLACE_WEIGHT_MODE || 'per_user';

/**
 * Ambil used_count untuk semua tempat di kota tertentu
 * Mode per_user: data per token user
 * Mode global: data shared semua user
 */
export const getPlaceWeights = async (city, userToken) => {
  const cityKey = city.toLowerCase().trim();

  try {
    if (WEIGHT_MODE === 'per_user') {
      const docRef = doc(db, 'place_weights', `${userToken}_${cityKey}`);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data().weights || {} : {};
    } else {
      // Global mode — ambil dari places_cache langsung
      const docRef = doc(db, 'places_cache', cityKey);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return {};

      const places = docSnap.data().places || [];
      const weights = {};
      places.forEach(p => {
        weights[p.name] = p.used_count || 0;
      });
      return weights;
    }
  } catch (error) {
    console.error('[PlaceWeight] Failed to get weights:', error);
    return {};
  }
};

/**
 * Update used_count setelah tempat dipakai sebagai soal
 */
export const incrementPlaceWeight = async (city, userToken, placeName) => {
  const cityKey = city.toLowerCase().trim();

  try {
    if (WEIGHT_MODE === 'per_user') {
      const docRef = doc(db, 'place_weights', `${userToken}_${cityKey}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          [`weights.${placeName}`]: increment(1),
        });
      } else {
        await setDoc(docRef, {
          token: userToken,
          city: cityKey,
          weights: { [placeName]: 1 },
          updated_at: Date.now(),
        });
      }
    } else {
      // Global mode — update di places_cache
      const docRef = doc(db, 'places_cache', cityKey);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const places = docSnap.data().places || [];
      const updatedPlaces = places.map(p =>
        p.name === placeName
          ? { ...p, used_count: (p.used_count || 0) + 1 }
          : p
      );
      await updateDoc(docRef, { places: updatedPlaces });
    }
  } catch (error) {
    console.error('[PlaceWeight] Failed to increment weight:', error);
  }
};

/**
 * Pilih tempat berdasarkan weighted RNG
 * Tempat dengan used_count terendah punya peluang 70% dipilih
 * Tempat dengan used_count lebih tinggi punya peluang 30%
 */
export const pickWeightedPlace = (availablePlaces, weights) => {
  if (availablePlaces.length === 0) return null;
  if (availablePlaces.length === 1) return availablePlaces[0];

  // Hitung used_count untuk setiap tempat
  const placesWithCount = availablePlaces.map(p => ({
    ...p,
    usedCount: weights[p.name] || 0,
  }));

  // Cari angka minimum
  const minCount = Math.min(...placesWithCount.map(p => p.usedCount));

  // Pisahkan ke dua pool
  const lowPool  = placesWithCount.filter(p => p.usedCount === minCount);
  const highPool = placesWithCount.filter(p => p.usedCount > minCount);

  // Kalau semua sama → pilih random biasa
  if (highPool.length === 0) {
    return lowPool[Math.floor(Math.random() * lowPool.length)];
  }

  // 70% chance pilih dari lowPool, 30% dari highPool
  const rand = Math.random();
  const pool = rand < 0.7 ? lowPool : highPool;
  return pool[Math.floor(Math.random() * pool.length)];
};
