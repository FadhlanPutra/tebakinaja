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
      // Kuliner & Nongkrong
      `tempat makan restoran kuliner khas populer di ${city} Indonesia`,
      `cafe kedai kopi hits tempat nongkrong di ${city} Indonesia`,
      `pasar tradisional pasar kuliner oleh oleh terkenal di ${city} Indonesia`,
      // Wisata & Hiburan
      `taman hiburan rekreasi wisata alam populer di ${city} Indonesia`,
      `pantai wisata bahari populer di ${city} Indonesia`,
      `kebun binatang taman safari wahana wisata di ${city} Indonesia`,
      // Landmark & Tempat Ikonik
      `tempat bersejarah landmark monumen ikonik di ${city} Indonesia`,
      `jembatan tugu air mancur landmark kota di ${city} Indonesia`,
      `museum galeri seni budaya terkenal di ${city} Indonesia`,
      // Lifestyle & Kota
      `pusat perbelanjaan mall terkenal di ${city} Indonesia`,
      `stadion gelanggang olahraga terkenal di ${city} Indonesia`,
      // Pendidikan & Ibadah
      `universitas negeri kampus PTN terkenal di ${city} Indonesia`,
      `masjid gereja pura vihara ikonik bersejarah terkenal landmark kota di ${city} Indonesia`,
    ];

    const allPlaces = [];

    // Fetch tiap kategori secara berurutan
    for (const query of queries) {
      try {
        const { places } = await window.google.maps.places.Place.searchByText({
          textQuery: query,
          fields: [
            'displayName',
            'location',
            'rating',
            'userRatingCount',
            'types',
            'formattedAddress',
          ],
          maxResultCount: 8, // 8 per kategori × 13 kategori = max 104 total
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

    // ─── 3. Filter, deduplicate, dan validasi ──────────────────────────────────
    const seen = new Set();
    const cityLower = city.toLowerCase();

    // Daftar keyword yang menandakan bukan tempat wisata/landmark
    const EXCLUDED_KEYWORDS = [
      'toko', 'warung', 'depot', 'laundry', 'salon', 'klinik',
      'apotek', 'bengkel', 'kantor', 'ruko', 'kos', 'kontrakan',
      'semi indor', 'semi indoor', // hasil aneh dari Places API
    ];

    const mappedPlaces = allPlaces
      .filter(p => {
        // Wajib punya lokasi dan nama
        if (!p.location || !p.displayName) return false;

        // Deduplicate
        if (seen.has(p.displayName)) return false;
        seen.add(p.displayName);

        // Filter rating minimum 4.3
        if ((p.rating || 0) < 4.3) return false;

        // Filter minimum 100 ulasan — pastikan tempat cukup dikenal
        if ((p.userRatingCount || 0) < 100) return false;

        // Filter nama yang mengandung keyword bukan wisata
        const nameLower = p.displayName.toLowerCase();
        if (EXCLUDED_KEYWORDS.some(kw => nameLower.includes(kw))) return false;

        // Filter alamat harus mengandung nama kota
        // Ini mencegah tempat dari kota lain masuk ke cache kota ini
        const addressLower = (p.formattedAddress || '').toLowerCase();
        const cityVariants = [
          cityLower,
          `kota ${cityLower}`,
          `kabupaten ${cityLower}`,
          `kab. ${cityLower}`,
        ];
        const isInCity = cityVariants.some(variant => addressLower.includes(variant));
        if (!isInCity) return false;

        return true;
      })
      .map(place => ({
        name: place.displayName,
        lat: place.location.lat(),
        lng: place.location.lng(),
        rating: place.rating || 0,
        userRatingCount: place.userRatingCount || 0,
        category: place.types?.[0] || 'landmark',
        address: place.formattedAddress || '',
        used_count: 0,
      }));

    console.log(`[PlacesService] Total ${mappedPlaces.length} tempat valid ditemukan di ${city}`);

    // Kalau hasil terlalu sedikit setelah filter, log warning
    if (mappedPlaces.length < 5) {
      console.warn(`[PlacesService] Hanya ${mappedPlaces.length} tempat valid di ${city} — mungkin tidak cukup untuk 5 ronde`);
    }

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