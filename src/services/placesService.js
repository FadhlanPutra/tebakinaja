import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseService';

// Cache validity: 7 hari
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_COLLECTION = 'places_cache';

/**
 * Fetch famous places using Google Places API (new Place class)
 * Hasil di-cache ke Firestore agar tidak fetch ulang untuk kota yang sama.
 * @param {string} city - Nama kota
 * @returns {Promise<Array>} List of place objects
 */
export const fetchPlacesByCity = async (city) => {
  const cityKey = city.toLowerCase().trim();

  // ─── 1. Cek Firestore cache dulu ───────────────────────────────────────────
  try {
    const docRef = doc(db, CACHE_COLLECTION, cityKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const fetchedAt = new Date(data.fetched_at).getTime();
      const isCacheValid = (Date.now() - fetchedAt) < CACHE_DURATION_MS;

      if (isCacheValid && data.places && data.places.length > 0) {
        console.log(`[PlacesService] Cache hit untuk kota: ${city} (${data.places.length} tempat)`);
        return data.places;
      }

      console.log(`[PlacesService] Cache expired untuk kota: ${city}, fetch ulang...`);
    } else {
      console.log(`[PlacesService] Tidak ada cache untuk kota: ${city}, fetch baru...`);
    }
  } catch (error) {
    console.error('[PlacesService] Firestore cache read error:', error);
    // Fallback ke Places API, jangan crash
  }

  // ─── 2. Fetch ke Google Places API (per kategori) ──────────────────────────
  try {
    if (!window.google?.maps?.places?.Place) {
      throw new Error('Google Maps Places API belum dimuat');
    }

    // Query per kategori agar hasil lebih variatif
    const queries = [
      `tempat makan restoran kuliner khas populer di ${city} Indonesia`,
      `pusat perbelanjaan mall terkenal di ${city} Indonesia`,
      `taman hiburan rekreasi wisata alam di ${city} Indonesia`,
      `tempat bersejarah landmark monumen ikonik di ${city} Indonesia`,
      `cafe kedai kopi hits tempat nongkrong di ${city} Indonesia`,
    ];

    const allPlaces = [];

    // Fetch tiap kategori secara berurutan
    for (const query of queries) {
      try {
        const { places } = await window.google.maps.places.Place.searchByText({
          textQuery: query,
          fields: ['displayName', 'location', 'rating', 'types', 'formattedAddress'],
          maxResultCount: 5, // 5 per kategori × 5 kategori = max 25 total
          language: 'id',
        });

        if (places && places.length > 0) {
          allPlaces.push(...places);
          console.log(`[PlacesService] "${query}" → ${places.length} tempat ditemukan`);
        }
      } catch (queryError) {
        console.warn(`[PlacesService] Query gagal: "${query}"`, queryError);
        // Lanjut ke query berikutnya kalau satu gagal
      }
    }

    if (allPlaces.length === 0) {
      console.warn(`[PlacesService] Tidak ada tempat ditemukan di kota: ${city}`);
      return [];
    }

    // ─── 3. Filter dan deduplicate berdasarkan nama ─────────────────────────
    const seen = new Set();
    const mappedPlaces = allPlaces
      .filter(p => {
        if (!p.location || !p.displayName) return false;
        if (seen.has(p.displayName)) return false;
        seen.add(p.displayName);
        return true;
      })
      .map(place => ({
        name: place.displayName,
        lat: place.location.lat(),
        lng: place.location.lng(),
        rating: place.rating || 0,
        category: place.types?.[0] || 'landmark',
        address: place.formattedAddress || '',
      }));

    console.log(`[PlacesService] Total ${mappedPlaces.length} tempat unik ditemukan di ${city}`);

    // ─── 4. Simpan ke Firestore cache ───────────────────────────────────────
    try {
      const docRef = doc(db, CACHE_COLLECTION, cityKey);
      await setDoc(docRef, {
        fetched_at: new Date().toISOString(),
        city: city,
        places: mappedPlaces,
      });
      console.log(`[PlacesService] Cache tersimpan untuk kota: ${city}`);
    } catch (cacheError) {
      console.error('[PlacesService] Firestore cache write error:', cacheError);
      // Tetap lanjut tanpa crash kalau gagal simpan cache
    }

    return mappedPlaces;

  } catch (error) {
    console.error(`[PlacesService] Gagal mencari tempat di kota ${city}:`, error);
    return [];
  }
};