import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseService';

/**
 * Fetch famous places using Google Places API
 * @param {string} city - Name of the city
 * @param {Object} mapInstance - Google Maps instance for PlacesService
 * @returns {Promise<Array>} List of place objects
 */
export const fetchPlacesByCity = async (city, mapInstance) => {
  const cacheCollection = "places_cache";
  const cityKey = city.toLowerCase();

  try {
    // Cek dokumen di Firestore: collection "places_cache", doc = nama kota (lowercase)
    const docRef = doc(db, cacheCollection, cityKey);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const fetchedAt = new Date(data.fetched_at).getTime();
      const now = new Date().getTime();
      const diffTime = now - fetchedAt;
      const isCacheValid = diffTime < 7 * 24 * 60 * 60 * 1000;

      // Dokumen ada DAN fetched_at kurang dari 7 hari yang lalu?
      if (isCacheValid && data.places && data.places.length > 0) {
        // Return places dari cache dan kembalikan struktur fungsi yang dibutuhkan
        return data.places.map(p => ({
          ...p,
          geometry: {
            location: {
              lat: () => p.lat,
              lng: () => p.lng
            }
          }
        }));
      }
    }
  } catch (error) {
    console.error("Firestore cache read error:", error);
    // Kalau Firestore gagal diakses karena apapun, fallback langsung ke Places API dan jangan crash aplikasinya
  }

  // Fetch ke Google Places API
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      return reject(new Error("Google Maps API belum dimuat"));
    }

    // Gunakan map instance yang diteruskan atau buat dummy div
    const service = new window.google.maps.places.PlacesService(
      mapInstance || document.createElement('div')
    );

    const request = {
      query: `tempat wisata terkenal landmark bersejarah di ${city} Indonesia`,
      fields: ['name', 'geometry', 'formatted_address', 'place_id', 'photos']
    };
    
    service.textSearch(request, async (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        // Filter out places without geometry just in case
        const validResults = results.filter(place => place.geometry && place.geometry.location);
        
        try {
          // Simpan ke Firestore
          const docRef = doc(db, cacheCollection, cityKey);
          
          const placesToSave = validResults.map(p => ({
            name: p.name,
            lat: typeof p.geometry.location.lat === 'function' ? p.geometry.location.lat() : p.geometry.location.lat,
            lng: typeof p.geometry.location.lng === 'function' ? p.geometry.location.lng() : p.geometry.location.lng,
            formatted_address: p.formatted_address || '',
            place_id: p.place_id || ''
          }));

          await setDoc(docRef, {
            fetched_at: new Date().toISOString(),
            places: placesToSave
          });
        } catch (error) {
          console.error("Firestore cache write error:", error);
          // Tetap lanjut tanpa crash kalau gagal simpan
        }

        resolve(validResults);
      } else {
        reject(new Error(`Gagal mencari tempat di kota ${city}. Status: ${status}`));
      }
    });
  });
};
