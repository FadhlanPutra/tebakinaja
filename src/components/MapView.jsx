import React, { useCallback } from 'react';
import { GoogleMap, Marker, Circle } from '@react-google-maps/api';
// import { useGameLogic } from '../hooks/useGameLogic';
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

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  clickableIcons: false,
  styles: [
    // Sembunyikan label POI agar tidak bocorkan jawaban
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  ],
};

const MapView = ({ onMapClick, isClickable, mapGuess }) => {
  // const { setMapInstance, state } = useGameLogic();
  const { state, dispatch } = useContext(GameContext);
  const setMapInstance = (map) => dispatch({ type: 'SET_MAP_INSTANCE', payload: map });

  const onLoad = useCallback((map) => {
    setMapInstance(map);
  }, [setMapInstance]);

  const handleMapClick = (e) => {
    if (!isClickable) return;
    onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  };

  const showActualLocation = !state.timerActive && state.currentQuestion;

  return (
    // Absolute inset-0 — mengisi seluruh parent GameScreen
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Hint overlay saat MAP mode dan modal tersembunyi */}
      {isClickable && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md font-bold text-sm text-slate-700 pointer-events-none"
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
              fillColor: '#3B82F6',
              fillOpacity: 0.15,
              strokeColor: '#2563EB',
              strokeOpacity: 0.6,
              strokeWeight: 2,
              clickable: false,
            }}
          />
        )}
        {/* Marker tebakan user */}
        {mapGuess && !showActualLocation && (
          <Marker
            position={mapGuess}
            animation={window.google.maps.Animation.DROP}
          />
        )}

        {/* Marker lokasi sebenarnya (muncul setelah jawab) */}
        {showActualLocation && (
          <Marker
            position={{ lat: state.currentQuestion.lat, lng: state.currentQuestion.lng }}
            icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default MapView;