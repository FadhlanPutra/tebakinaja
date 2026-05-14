import React, { useCallback, useState } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { useGameLogic } from '../hooks/useGameLogic';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1rem'
};

const center = {
  lat: -2.548926,
  lng: 118.0148634
};

const MapView = ({ onMapClick }) => {
  const { setMapInstance, state } = useGameLogic();
  const [markerPos, setMarkerPos] = useState(null);

  const onLoad = useCallback(function callback(map) {
    setMapInstance(map);
  }, [setMapInstance]);

  const handleMapClick = (e) => {
    if (!state.timerActive) return; // Disable clicks if time is up or answered
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    onMapClick({ lat, lng });
  };

  // If game is in answered state, show actual location
  const showActualLocation = !state.timerActive && state.currentQuestion;

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-inner border-4 border-slate-200">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md font-bold text-sm text-slate-700 pointer-events-none">
        Klik Peta untuk Menebak 📍
      </div>
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={state.currentQuestion ? { lat: state.currentQuestion.lat, lng: state.currentQuestion.lng } : center}
        zoom={state.currentQuestion ? 11 : 5}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] } // Hide labels to not cheat
          ]
        }}
      >
        {/* User's Guess Marker */}
        {markerPos && !showActualLocation && (
          <Marker position={markerPos} animation={window.google.maps.Animation.DROP} />
        )}

        {/* Actual Answer Marker (Shown after answer) */}
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
