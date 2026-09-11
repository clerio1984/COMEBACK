import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Smartphone, MapPin, Eye } from 'lucide-react';

interface AdminTrackerMapProps {
  latitude: number;
  longitude: number;
  deviceName: string;
  status: 'active' | 'stolen' | 'suspended' | 'investigating';
  timestamp?: string;
  simNumber?: string;
}

export const AdminTrackerMap: React.FC<AdminTrackerMapProps> = ({
  latitude,
  longitude,
  deviceName,
  status,
  timestamp,
  simNumber
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map instance to avoid initialization collision
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView([latitude, longitude], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    // Build custom marker HTML depending on status
    const isStolen = status === 'stolen' || status === 'investigating';
    const markerColor = isStolen ? 'bg-red-600' : 'bg-[#009739]';
    const ringColor = isStolen ? 'bg-red-500' : 'bg-green-500';

    const trackerIcon = L.divIcon({
      className: 'admin-tracker-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 ${ringColor} rounded-full opacity-30 animate-ping"></div>
          <div class="absolute w-7 h-7 ${ringColor} rounded-full opacity-15 animate-pulse"></div>
          <div class="w-6 h-6 rounded-full ${markerColor} border-2 border-white shadow-xl flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([latitude, longitude], { icon: trackerIcon }).addTo(map);
    markerRef.current = marker;

    // Bind custom elegant popup
    const popupContent = `
      <div class="p-2 font-sans">
        <h4 class="font-black text-xs uppercase text-gray-900">${deviceName}</h4>
        <p class="text-[9px] text-gray-500 uppercase mt-0.5">Estado: <span class="font-black ${isStolen ? 'text-red-600' : 'text-green-600'}">${status}</span></p>
        ${simNumber ? `<p class="text-[9px] text-gray-500 uppercase">SIM: <span class="font-bold text-gray-800">${simNumber}</span></p>` : ''}
        ${timestamp ? `<p class="text-[8px] text-gray-400 mt-1">Registado em: ${new Date(timestamp).toLocaleTimeString('pt-MZ')}</p>` : ''}
        <p class="text-[8px] text-blue-600 font-mono mt-1">${latitude.toFixed(5)}, ${longitude.toFixed(5)}</p>
      </div>
    `;
    marker.bindPopup(popupContent).openPopup();

    // Draw accuracy/search circle
    const circle = L.circle([latitude, longitude], {
      radius: isStolen ? 600 : 300,
      color: isStolen ? '#ef4444' : '#009739',
      fillColor: isStolen ? '#ef4444' : '#009739',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 4'
    }).addTo(map);
    circleRef.current = circle;

    // Invalidate map size to make sure rendering is accurate
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, deviceName, status, timestamp, simNumber]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-gray-150 shadow-inner bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-[320px] z-10" />
      <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-1.5">
        <span className="flex h-2 w-2 relative">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${status === 'stolen' ? 'bg-red-400' : 'bg-green-400'} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'stolen' ? 'bg-red-500' : 'bg-green-500'}`}></span>
        </span>
        <span className="text-[9px] font-black uppercase text-gray-700 tracking-wider">
          {status === 'stolen' ? 'Rastreamento Crítico' : 'Sinal GPS Online'}
        </span>
      </div>
    </div>
  );
};
