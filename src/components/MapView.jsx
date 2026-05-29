import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, Circle, Polyline } from '@react-google-maps/api';
import { useContext } from 'react';
import { GameContext } from '../context/GameContext';

const mapContainerStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
};

const INDONESIA_CENTER = { lat: -2.548926, lng: 118.0148634 };

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const LIGHT_MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const MapView = ({ onMapClick, isClickable, mapGuess }) => {
  const { state, dispatch } = useContext(GameContext);
  const setMapInstance = (map) => dispatch({ type: 'SET_MAP_INSTANCE', payload: map });

  // State untuk track dark mode
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );

  // Observer untuk deteksi perubahan class di <html>
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
    styles: isDarkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
  };

  const onLoad = useCallback((map) => {
    setMapInstance(map);
  }, [setMapInstance]);

  const handleMapClick = (e) => {
    if (!isClickable) return;
    onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  };

  const showActualLocation = !state.timerActive && state.currentQuestion;

  // Auto-fit bounds agar tebakan dan jawaban terlihat sekaligus
  useEffect(() => {
    if (showActualLocation && mapGuess && state.mapInstance && state.answerMethod === 'MAP') {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: mapGuess.lat, lng: mapGuess.lng });
      bounds.extend({ lat: state.currentQuestion.lat, lng: state.currentQuestion.lng });
      state.mapInstance.fitBounds(bounds, {
        top: 80, right: 40, bottom: 200, left: 40
      });
    }
  }, [showActualLocation]);

  return (
    // Absolute inset-0 — mengisi seluruh parent GameScreen
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Hint overlay saat MAP mode dan modal tersembunyi */}
      {isClickable && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md font-bold text-sm text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700/50 transition-colors duration-300 pointer-events-none"
          style={{ animation: 'bounce 1s infinite' }}
        >
          👆 Klik peta untuk menandai lokasi
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={
          state.answerMethod === 'MAP' && state.circleCenter
            ? state.circleCenter  // fokus ke tengah lingkaran (sudah di-offset)
            : state.currentQuestion
              ? { lat: state.currentQuestion.lat, lng: state.currentQuestion.lng }
              : INDONESIA_CENTER
        }
        zoom={
          state.answerMethod === 'MAP' && state.circleRadius
            ? state.circleRadius > 8000 ? 10 : state.circleRadius > 4000 ? 11 : 12
            : state.currentQuestion ? 11 : 5
        }
        onLoad={onLoad}
        onClick={handleMapClick}
        options={mapOptions}
      >
        {/* Lingkaran radius — hanya tampil di MAP mode */}
        {state.answerMethod === 'MAP' && state.circleCenter && (
          <Circle
            center={state.circleCenter}
            radius={state.circleRadius}
            options={{
              fillColor: isDarkMode ? '#60A5FA' : '#3B82F6',
              fillOpacity: 0.15,
              strokeColor: isDarkMode ? '#93C5FD' : '#2563EB',
              strokeOpacity: 0.7,
              strokeWeight: 2,
              clickable: false,
            }}
          />
        )}
        {/* Garis jarak antara tebakan user dan jawaban sebenarnya */}
        {showActualLocation && mapGuess && state.answerMethod === 'MAP' && (
          <Polyline
            path={[
              { lat: mapGuess.lat, lng: mapGuess.lng },
              { lat: state.currentQuestion.lat, lng: state.currentQuestion.lng }
            ]}
            options={{
              strokeColor: '#EF4444',
              strokeOpacity: 0.8,
              strokeWeight: 2.5,
              geodesic: true,
              icons: [{
                icon: {
                  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 3,
                  strokeColor: '#EF4444',
                },
                offset: '100%',
              }]
            }}
          />
        )}

        {/* Marker tebakan user — tetap tampil setelah jawab */}
        {mapGuess && (
          <Marker
            position={mapGuess}
            animation={window.google.maps.Animation.DROP}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#EF4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        )}

        {/* Marker lokasi sebenarnya setelah jawab */}
        {showActualLocation && (
          <Marker
            position={{ lat: state.currentQuestion.lat, lng: state.currentQuestion.lng }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#10B981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default MapView;