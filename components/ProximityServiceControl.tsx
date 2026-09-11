import React, { useState, useEffect } from 'react';
import { Item, ItemStatus } from '../types';

interface ProximityServiceControlProps {
  items: Item[];
  currentLocationCoords: { lat: number; lng: number };
  onUpdateCoords: (coords: { lat: number; lng: number }, label: string) => void;
  onAddSystemNotification: (item: Item, distance: number) => void;
  currentUser: any;
}

export const MOZ_LOCATION_PRESETS = [
  { label: 'Maputo Central', lat: -25.9692, lng: 32.5732, description: 'Centro da Cidade, MPT' },
  { label: 'Bairro da Polana', lat: -25.9612, lng: 32.5904, description: 'Área Residencial / Embaixadas' },
  { label: 'Aeroporto Internacional', lat: -25.9221, lng: 32.5714, description: 'Aeroporto de Mavalane' },
  { label: 'Bairro de Maxaquene', lat: -25.9451, lng: 32.5822, description: 'Zona Norte Central' },
  { label: 'Matola Cidade', lat: -25.8335, lng: 32.4332, description: 'Província de Maputo (Fora de Alcance)' }
];

export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const ProximityServiceControl: React.FC<ProximityServiceControlProps> = ({
  items,
  currentLocationCoords,
  onUpdateCoords,
  onAddSystemNotification,
  currentUser
}) => {
  const [isCheckedMode, setIsCheckedMode] = useState<boolean>(true);
  const [locationLabel, setLocationLabel] = useState<string>('Maputo Central');
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);
  const [isSilenced, setIsSilenced] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('comeback_proximity_silenced_until');
      if (saved) {
        const time = parseInt(saved, 10);
        return !isNaN(time) && Date.now() < time;
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const checkSilenced = () => {
      try {
        const saved = localStorage.getItem('comeback_proximity_silenced_until');
        if (saved) {
          const time = parseInt(saved, 10);
          setIsSilenced(!isNaN(time) && Date.now() < time);
        } else {
          setIsSilenced(false);
        }
      } catch {
        setIsSilenced(false);
      }
    };

    window.addEventListener('comeback_radar_silenced', checkSilenced);
    window.addEventListener('storage', checkSilenced);
    const interval = setInterval(checkSilenced, 5000); // Check every 5s

    return () => {
      window.removeEventListener('comeback_radar_silenced', checkSilenced);
      window.removeEventListener('storage', checkSilenced);
      clearInterval(interval);
    };
  }, []);

  const [notifiedItemIds, setNotifiedItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('comeback_proximity_notified_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Keep track of which items are found and within 5km
  const foundNearbyItems = React.useMemo(() => {
    return items.filter(item => {
      if (item.status !== ItemStatus.FOUND) return false;
      // Marked as lost/found by others (not current user)
      if (currentUser && item.userId === currentUser.id) return false;
      
      if (item.latitude !== undefined && item.longitude !== undefined) {
        const dist = getDistanceInKm(
          currentLocationCoords.lat,
          currentLocationCoords.lng,
          item.latitude,
          item.longitude
        );
        return dist <= 5.0; // within 5km
      }
      return false;
    });
  }, [items, currentLocationCoords, currentUser]);

  // Synchronize system notifications for newly found items in the 5km radius
  useEffect(() => {
    if (!isCheckedMode) return;

    foundNearbyItems.forEach(item => {
      if (!notifiedItemIds.includes(item.id)) {
        const distance = getDistanceInKm(
          currentLocationCoords.lat,
          currentLocationCoords.lng,
          item.latitude!,
          item.longitude!
        );

        // Raise notification call and sound alarm in the controller callback!
        onAddSystemNotification(item, distance);

        // Prevent repeat triggers by saving id
        setNotifiedItemIds(prev => {
          const next = [...prev, item.id];
          localStorage.setItem('comeback_proximity_notified_ids', JSON.stringify(next));
          return next;
        });
      }
    });
  }, [foundNearbyItems, isCheckedMode, currentLocationCoords, notifiedItemIds]);

  // Function to request actual GPS coordinates from the device
  const fetchActualGps = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          onUpdateCoords({ lat: latitude, lng: longitude }, 'GPS Atual do Dispositivo');
          setLocationLabel('GPS Atual do Dispositivo');
          alert(`📍 GPS Ativo Sincronizado:\nLat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
        },
        (error) => {
          console.error("Erro ao obter GPS:", error);
          alert("Não foi possível aceder ao GPS real do dispositivo. Por favor, utilize os presets abaixo.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Navegador não suporta geolocalização nativa.");
    }
  };

  const handleSelectPreset = (preset: typeof MOZ_LOCATION_PRESETS[0]) => {
    onUpdateCoords({ lat: preset.lat, lng: preset.lng }, preset.label);
    setLocationLabel(preset.label);
    setShowPresetsMenu(false);
  };

  const clearLoggedAlerts = () => {
    setNotifiedItemIds([]);
    localStorage.removeItem('comeback_proximity_notified_ids');
    alert("Lista de alertas temporários limpa! Caso queira testar novamente novos alertas, já pode acionar os presets.");
  };

  return (
    <div 
      className="bg-slate-900 border-2 border-slate-800 text-white p-5 rounded-[2.25rem] shadow-xl w-full text-left font-sans animate-in slide-in-from-top-4 duration-300 relative overflow-hidden mb-4"
      id="proximity-alert-service-widget"
    >
      <div className="absolute right-0 top-0 w-32 h-32 bg-[#009739]/5 rounded-full blur-2xl pointer-events-none"></div>
      <div className="absolute left-0 bottom-0 w-32 h-32 bg-[#fce100]/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 bg-slate-850 text-[#fce100] rounded-2xl flex items-center justify-center border border-white/10 shadow-sm text-base">
              <i className="fa-solid fa-satellite-dish animate-pulse"></i>
            </div>
            {isCheckedMode && !isSilenced && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#009739] rounded-full border-2 border-slate-900 animate-ping"></span>
            )}
            {isCheckedMode && isSilenced && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-900 animate-ping"></span>
            )}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Serviço de Alertas de Proximidade</h3>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSilenced ? 'bg-amber-450 animate-pulse' : isCheckedMode ? 'bg-[#009739]' : 'bg-red-500'}`}></span>
              Status: {isSilenced ? 'Adormecido (Silenciado por 1h)' : isCheckedMode ? 'Vigilância Ativa (Raio 5km)' : 'Inativo'}
            </p>
          </div>
        </div>

        {isSilenced ? (
          <button 
            onClick={() => {
              localStorage.removeItem('comeback_proximity_silenced_until');
              window.dispatchEvent(new Event('comeback_radar_silenced'));
              alert("Alertas de proximidade reativados!");
            }}
            className="px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all duration-300 border bg-amber-400 text-black border-amber-500 hover:bg-amber-500"
            id="toggle-background-service-btn"
          >
            Reativar Radar
          </button>
        ) : (
          <button 
            onClick={() => {
              setIsCheckedMode(!isCheckedMode);
            }}
            className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all duration-300 border ${
              isCheckedMode 
                ? 'bg-[#009739]/10 text-[#009739] border-[#009739]/30 hover:bg-[#009739]/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
            }`}
            id="toggle-background-service-btn"
          >
            {isCheckedMode ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-slate-850 border border-white/5 rounded-2xl p-3">
            <span className="block text-[8px] font-black text-gray-400 uppercase tracking-wider mb-1">Localização de Referência</span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase text-[#fce100] flex items-center gap-1.5 truncate">
                <i className="fa-solid fa-location-dot text-[#d21034]"></i>
                {locationLabel}
              </span>
              <span className="text-[10px] font-mono text-gray-300 shrink-0 bg-slate-900 border border-white/5 px-2 py-0.5 rounded-md">
                {currentLocationCoords.lat.toFixed(4)}, {currentLocationCoords.lng.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={fetchActualGps}
              className="flex-1 bg-[#d21034] text-white hover:bg-red-700 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-red-600/30"
              id="get-real-gps-btn"
              title="Obter coordenadas GPS nativas da sua posição real do navegador"
            >
              <i className="fa-solid fa-crosshairs text-[10px]"></i>
              Usar GPS Real
            </button>

            <div className="relative flex-1">
              <button 
                onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                className="w-full bg-slate-850 hover:bg-slate-800 border border-white/10 text-gray-300 hover:text-white py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                id="presets-location-menu-btn"
              >
                <i className="fa-solid fa-map-pin"></i>
                Preset Maputo
                <i className="fa-solid fa-chevron-down text-[7px] ml-0.5"></i>
              </button>

              {showPresetsMenu && (
                <div className="absolute top-[calc(100%+5px)] left-0 right-0 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 divide-y divide-white/5 overflow-hidden font-sans uppercase animate-in slide-in-from-top-2 duration-200">
                  {MOZ_LOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleSelectPreset(preset)}
                      className="w-full text-left p-2.5 hover:bg-white/5 rounded-xl transition-all flex flex-col"
                    >
                      <span className="text-[9px] font-black text-white">{preset.label}</span>
                      <span className="text-[7px] text-gray-400 font-bold leading-none mt-0.5">{preset.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-3 bg-slate-950/40 border border-white/5 rounded-2.5xl p-3.5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">
                Achados Próximos (Raio 5km)
              </span>
              <span className="bg-[#009739]/20 text-[#009739] text-[8px] font-black px-2 py-0.5 rounded-full border border-[#009739]/30">
                {foundNearbyItems.length} Encontrado(s)
              </span>
            </div>

            {foundNearbyItems.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-[9px] text-gray-500 font-bold uppercase leading-normal">
                  Sem itens recuperados registrados perto desta localização num raio de 5km 📍
                </p>
                <p className="text-[7px] text-gray-600 font-bold uppercase mt-1">
                  Mude a localização preset ou registre um item achado por perto para testar!
                </p>
              </div>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-2 no-scrollbar pr-1">
                {foundNearbyItems.map(item => {
                  const dist = getDistanceInKm(
                    currentLocationCoords.lat,
                    currentLocationCoords.lng,
                    item.latitude!,
                    item.longitude!
                  );
                  return (
                    <div key={item.id} className="bg-slate-900 border border-white/5 rounded-xl p-2.5 flex items-center justify-between gap-2.5">
                      <div className="truncate">
                        <span className="block text-[10px] font-black text-white uppercase truncate">{item.title}</span>
                        <span className="text-[7px] font-bold text-[#009739] uppercase flex items-center gap-1 mt-0.5">
                          <i className="fa-solid fa-location-dot"></i>
                          {item.location} ({dist.toFixed(1)} km)
                        </span>
                      </div>
                      <span className="bg-[#fce100] text-black font-black text-[7px] px-1.5 py-0.5 rounded-md uppercase">
                        {item.category}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
            <button 
              onClick={clearLoggedAlerts}
              className="text-[7.5px] font-black uppercase text-gray-400 hover:text-white transition-colors"
              id="clear-alerts-history-btn"
            >
              Reset Histórico Alertas
            </button>
            <span className="text-[7px] font-bold text-gray-500 uppercase">COMEBACK MOÇAMBIQUE SAFE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
