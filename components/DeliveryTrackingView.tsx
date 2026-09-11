
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Item, Category } from '../types';

interface DeliveryTrackingViewProps {
  item: Item;
  onBack: () => void;
}

const DeliveryTrackingView: React.FC<DeliveryTrackingViewProps> = ({ item, onBack }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const transitMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);

  const isHighValue = (item.reward && item.reward >= 2000) || [
    Category.DOCUMENTS, Category.ELECTRONICS, Category.WALLETS, Category.BAGS, Category.KEYS
  ].includes(item.category);

  const frequentLogsActive = localStorage.getItem('frequentHighValueTrackingLogs') === 'true';

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([item.latitude || -25.9692, item.longitude || 32.5732], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapRef.current = map;

    // Marcador de destino
    const destLat = item.deliveryLatitude || item.latitude || -25.9692;
    const destLng = item.deliveryLongitude || item.longitude || 32.5732;

    if (destLat && destLng) {
      const destIcon = L.divIcon({
        className: 'dest-icon',
        html: `<div class="bg-black text-[#fce100] w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-xl"><i class="fa-solid fa-flag-checkered"></i></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      destinationMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon }).addTo(map).bindPopup(`Local da Entrega: ${item.deliveryLocation || 'Não especificado'}`);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      transitMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, [item.id]); // Changed from [item] to [item.id] to be more stable

  // Desenhar percurso histórico com base nos logs salvos no Firestore
  useEffect(() => {
    if (!mapRef.current) return;

    // Remover polylines antigos antes de redesenhar
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
        layer.remove();
      }
    });

    if (item.trackingLogs && item.trackingLogs.length > 1) {
      const points = item.trackingLogs.map(log => [log.lat, log.lng] as L.LatLngExpression);
      L.polyline(points, {
        color: isHighValue && frequentLogsActive ? '#d21034' : '#009739',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: isHighValue && frequentLogsActive ? '8, 8' : '10, 10'
      }).addTo(mapRef.current);
    }
  }, [item.trackingLogs, isHighValue, frequentLogsActive]);

  useEffect(() => {
    if (!mapRef.current) return;

    const lat = item.transitLatitude || item.latitude || -25.9692;
    const lng = item.transitLongitude || item.longitude || 32.5732;

    const transitIcon = L.divIcon({
      className: 'transit-icon',
      html: `
        <div class="relative">
          <div class="absolute inset-0 bg-[#009739] rounded-full animate-ping opacity-30"></div>
          <div class="relative bg-[#009739] text-white w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-2xl scale-110">
            <i class="fa-solid fa-motorcycle"></i>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    if (transitMarkerRef.current) {
      transitMarkerRef.current.setLatLng([lat, lng]);
    } else {
      transitMarkerRef.current = L.marker([lat, lng], { icon: transitIcon }).addTo(mapRef.current);
    }

    if (mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.panTo([lat, lng], { animate: true });
    }

  }, [item.transitLatitude, item.transitLongitude, item.latitude, item.longitude]);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex items-center justify-between z-10 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 p-2 hover:text-black transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
          <div>
            <h2 className="font-black text-xs uppercase tracking-widest text-gray-400">Entrega ao Vivo</h2>
            <div className="font-black text-sm uppercase truncate max-w-[200px]">{item.title}</div>
          </div>
        </div>
        <div className="bg-emerald-100 text-[#009739] px-3 py-1 rounded-full flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-[#009739] rounded-full animate-pulse"></div>
           <span className="text-[10px] font-black uppercase">Live</span>
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {/* Banner de Rastreamento Ativo / Logs */}
        {isHighValue && frequentLogsActive ? (
          <div className="absolute top-4 left-4 right-4 bg-[#d21034] text-white rounded-2xl p-3 px-4 shadow-xl flex items-center justify-between z-[500] border border-white/10 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-shield-halved text-[#fce100] animate-bounce text-sm"></i>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase tracking-wider block">Segurança de Alto Valor Ativa</span>
                <span className="text-[7.5px] font-bold text-red-100 uppercase tracking-widest block mt-0.5 animate-pulse">
                  Logs Frequentes Gravados (a cada 3s)
                </span>
              </div>
            </div>
            <div className="text-right bg-white/10 px-2 py-1 rounded-lg">
              <span className="text-[9px] font-black font-mono">
                {item.trackingLogs?.length || 1} PONTOS
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute top-4 left-4 right-4 bg-black text-white rounded-2xl p-3 px-4 shadow-xl flex items-center justify-between z-[500] animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-route text-[#009739] text-sm animate-pulse"></i>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase tracking-wider block">Acompanhamento Standard</span>
                <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">
                  Gravação de percurso a cada 10s
                </span>
              </div>
            </div>
            <div className="text-right bg-white/10 px-2 py-1 rounded-lg">
              <span className="text-[9px] font-black font-mono">
                {item.trackingLogs?.length || 1} PONTOS
              </span>
            </div>
          </div>
        )}

        {/* Info Card Overlay */}
        <div className="absolute bottom-6 left-6 right-6 bg-white rounded-[2rem] p-6 shadow-2xl border-2 border-gray-50 flex items-center gap-5 z-[500] animate-in slide-in-from-bottom duration-500">
           <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden shadow-sm shrink-0">
             <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
           </div>
           <div className="flex-1 min-w-0">
              <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Status da Entrega</div>
              <div className="font-black text-sm uppercase text-[#009739] truncate">
                {isHighValue && frequentLogsActive ? '🚨 Escolta Ativa / Trânsito' : 'Item em Movimento'}
              </div>
              <div className="text-[10px] font-bold text-gray-500 truncate">
                {isHighValue && frequentLogsActive ? 'Deteção de rota em tempo real por satélite...' : 'Aproximando-se do destino...'}
              </div>
           </div>
           <div className="text-center shrink-0 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
              <div className="text-md font-black text-black leading-none">
                {isHighValue && frequentLogsActive ? 'Est.' : '5'}
              </div>
              <div className="text-[8px] font-black text-gray-400 uppercase mt-0.5">
                {isHighValue && frequentLogsActive ? 'SEGURO' : 'min'}
              </div>
           </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 text-center flex items-center justify-center gap-1.5">
        <i className="fa-solid fa-shield text-[9px] text-[#009739]"></i>
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none">Canal de Entrega Encriptado e Seguro</p>
      </div>
    </div>
  );
};

export default DeliveryTrackingView;
