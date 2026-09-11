
import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Item, ItemStatus } from '../types';
import { POLICE_STATIONS, PoliceStation } from '../constants';

export type PoliceIconTheme = 'classic-prm' | 'tactical-dark' | 'gold-badge' | 'siren-alert';
export type MapTileStyle = 'google_streets' | 'google_hybrid' | 'google_terrain' | 'osm';

export interface SelectedClusterState {
  items: Item[];
  count: number;
  latlng: L.LatLng;
  clusterLayer?: any;
  clusterLabel?: string;
}

export const MAP_TILE_CONFIG: Record<MapTileStyle, { url: string; subdomains?: string[]; attribution: string; maxZoom: number; label: string; icon: string }> = {
  google_streets: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=pt-MZ',
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>',
    maxZoom: 20,
    label: 'Google Mapas (Ruas)',
    icon: 'fa-map'
  },
  google_hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=pt-MZ',
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Satélite & Vias</a>',
    maxZoom: 20,
    label: 'Google Satélite (Híbrido)',
    icon: 'fa-earth-africa'
  },
  google_terrain: {
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=pt-MZ',
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps Relevo</a>',
    maxZoom: 20,
    label: 'Google Relevo',
    icon: 'fa-mountain-sun'
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    maxZoom: 19,
    label: 'OpenStreetMap',
    icon: 'fa-layer-group'
  }
};

interface MapViewProps {
  items: Item[];
  onViewDetails: (item: Item) => void;
  onAction?: (item: Item) => void;
  focusLocation?: { lat: number; lng: number } | null;
  dangerReports?: any[];
  onDeleteDangerReport?: (reportId: string) => void;
  onAddPinClick?: () => void;
  tileStyle?: MapTileStyle;
  onTileStyleChange?: (style: MapTileStyle) => void;
  showPoliceStations?: boolean;
  onTogglePoliceStations?: (show: boolean) => void;
}

// Haversine formula to calculate distance in km
function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type TrafficStatus = 'fluid' | 'moderate' | 'heavy';

export interface TrafficConditionInfo {
  status: TrafficStatus;
  label: 'Fluido' | 'Moderado' | 'Intenso';
  color: string;
  glowColor: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  badgeBg: string;
  delayMultiplier: number;
  icon: string;
  description: string;
}

/**
 * Avalia as condições de tráfego em tempo real entre dois pontos (Item e Esquadra)
 * com base na hora do dia (horários de ponta em Moçambique), distância e proximidade a zonas de perigo reportadas.
 */
export function getRealtimeTrafficCondition(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  dangerReports: any[] = []
): TrafficConditionInfo {
  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  // Verifica se há relatos de perigo / alerta ao longo do trajeto (raio de 1.5km)
  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;
  const hasDangerOnPath = dangerReports.some(report => {
    if (typeof report.latitude !== 'number' || typeof report.longitude !== 'number') return false;
    const dMid = calculateDistanceInKm(midLat, midLng, report.latitude, report.longitude);
    const dOrigin = calculateDistanceInKm(originLat, originLng, report.latitude, report.longitude);
    const dDest = calculateDistanceInKm(destLat, destLng, report.latitude, report.longitude);
    return dMid <= 1.5 || dOrigin <= 1.0 || dDest <= 1.0;
  });

  // Horários de pico / trânsito intenso em centros urbanos (07h00-09h00, 12h00-14h00, 16h30-19h30 nos dias úteis)
  const isPeakHour = !isWeekend && (
    (currentHour >= 7 && currentHour < 9) ||
    (currentHour >= 12 && currentHour < 14) ||
    (currentHour >= 16 && currentHour < 20)
  );

  // Horários de tráfego moderado
  const isModerateHour = !isWeekend && (
    (currentHour >= 9 && currentHour < 12) ||
    (currentHour >= 14 && currentHour < 16) ||
    (currentHour >= 20 && currentHour < 22)
  );

  if (hasDangerOnPath || isPeakHour) {
    return {
      status: 'heavy',
      label: 'Intenso',
      color: '#ef4444', // Vermelho
      glowColor: '#f87171',
      bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/60',
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500',
      ringClass: 'ring-rose-500/30',
      badgeBg: 'bg-rose-950/90 text-rose-300 border-rose-500/70',
      delayMultiplier: 2.1,
      icon: 'fa-traffic-light',
      description: hasDangerOnPath ? 'Alerta na via / Congestionamento' : 'Pico de trânsito em tempo real'
    };
  }

  if (isModerateHour || (isWeekend && currentHour >= 10 && currentHour <= 19)) {
    return {
      status: 'moderate',
      label: 'Moderado',
      color: '#eab308', // Amarelo
      glowColor: '#facc15',
      bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/60',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500',
      ringClass: 'ring-amber-500/30',
      badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-500/70',
      delayMultiplier: 1.45,
      icon: 'fa-traffic-light',
      description: 'Fluxo regular com ligeira retenção'
    };
  }

  return {
    status: 'fluid',
    label: 'Fluido',
    color: '#22c55e', // Verde
    glowColor: '#4ade80',
    bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500',
    ringClass: 'ring-emerald-500/30',
    badgeBg: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70',
    delayMultiplier: 1.0,
    icon: 'fa-traffic-light',
    description: 'Tráfego livre e desimpedido'
  };
}

/**
 * Função de personalização visual dos marcadores de Esquadras de Polícia (POLICE_STATIONS)
 * Renderiza um escudo azul elegante com ícone de escudo (fa-shield-halved / fa-building-shield) e indicador PRM
 */
export function createBlueShieldPoliceIcon(
  station: PoliceStation,
  rank?: number,
  distText?: string,
  isTargetNearest: boolean = false
): L.DivIcon {
  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-125 select-none ${
      isTargetNearest ? 'scale-115 z-50' : 'z-40'
    }">
      <!-- Pulso azul no escudo -->
      <div class="absolute -inset-2 bg-blue-500 rounded-full opacity-30 animate-pulse"></div>
      ${isTargetNearest ? '<div class="absolute -inset-3 bg-cyan-400 rounded-full opacity-40 animate-ping"></div>' : ''}
      
      <!-- Corpo / Escudo Azul com fa-shield-halved -->
      <div class="relative w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-950 border-2 ${
        isTargetNearest ? 'border-[#fce100] ring-2 ring-blue-400' : 'border-cyan-300'
      } shadow-xl flex flex-col items-center justify-center text-white">
        <!-- Ícone de Escudo Azul com detalhes em ciano/branco -->
        <i class="fa-solid fa-shield-halved text-sm text-cyan-200 drop-shadow-xs"></i>
        
        <!-- Indicador luminoso de posto PRM -->
        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
          isTargetNearest ? 'bg-red-500 animate-pulse border border-white' : 'bg-cyan-400 border border-slate-900'
        } shadow-2xs"></span>
      </div>

      <!-- Badge Distintiva da PRM e Proximidade -->
      <span class="absolute -bottom-3.5 bg-blue-950 text-cyan-200 border border-cyan-400/50 text-[6.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md shadow-md whitespace-nowrap leading-tight">
        PRM ${rank ? `#${rank}` : ''} ${distText ? `• ${distText}` : ''}
      </span>
    </div>
  `;

  return L.divIcon({
    className: 'police-station-blue-shield-marker',
    html: html,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

/**
 * Função de personalização visual dos marcadores de Esquadras de Polícia (POLICE_STATIONS)
 * Distingue as esquadras claramente dos outros marcadores com o ícone fa-building-shield
 */
export function createPoliceStationCustomIcon(
  station: PoliceStation,
  isTargetNearest: boolean,
  theme: PoliceIconTheme = 'classic-prm'
): L.DivIcon {
  return createBlueShieldPoliceIcon(station, undefined, undefined, isTargetNearest);
}

/**
 * Gera ícones visuais personalizados para agrupamento numérico de itens (Clusterização)
 * Agrupa itens próximos na mesma área (como Baixa de Maputo, Alto-Maé, Sommerschield, Zimpeto)
 * em círculos numéricos elegantes, identificando rapidamente a contagem e tipo predominante (Perdidos, Achados ou Misto).
 */
export function createItemClusterCustomIcon(cluster: any): L.DivIcon {
  const childMarkers = cluster.getAllChildMarkers();
  const count = cluster.getChildCount();

  let lostCount = 0;
  let foundCount = 0;
  let reunitedCount = 0;

  childMarkers.forEach((m: any) => {
    const status = m.options?.itemStatus || (m as any).itemStatus;
    if (status === ItemStatus.LOST || status === ItemStatus.STOLEN) {
      lostCount++;
    } else if (status === ItemStatus.FOUND || status === ItemStatus.IN_TRANSIT) {
      foundCount++;
    } else if (status === ItemStatus.REUNITED) {
      reunitedCount++;
    }
  });

  // Determinar esquema de cores e gradiente do cluster
  let bgGradient = 'from-slate-900 via-[#153268] to-slate-950';
  let borderColor = 'border-[#fce100]';
  let glowColor = 'bg-[#008fe2]';
  let badgeLabel = 'Itens';
  let badgeBg = 'bg-slate-900 text-[#fce100] border-amber-400/40';

  if (lostCount > 0 && foundCount === 0 && reunitedCount === 0) {
    // 100% Itens Perdidos / Roubados
    bgGradient = 'from-rose-600 via-red-700 to-red-950';
    borderColor = 'border-rose-300';
    glowColor = 'bg-rose-500';
    badgeLabel = 'Perdidos';
    badgeBg = 'bg-red-950 text-rose-200 border-red-500/50';
  } else if (foundCount > 0 && lostCount === 0 && reunitedCount === 0) {
    // 100% Itens Achados / Localizados
    bgGradient = 'from-emerald-600 via-emerald-700 to-green-950';
    borderColor = 'border-emerald-300';
    glowColor = 'bg-emerald-500';
    badgeLabel = 'Achados';
    badgeBg = 'bg-emerald-950 text-emerald-200 border-emerald-400/50';
  } else if (reunitedCount > 0 && lostCount === 0 && foundCount === 0) {
    // 100% Itens Devolvidos / Recuperados
    bgGradient = 'from-amber-600 via-amber-700 to-amber-950';
    borderColor = 'border-amber-300';
    glowColor = 'bg-amber-500';
    badgeLabel = 'Devolvidos';
    badgeBg = 'bg-amber-950 text-amber-200 border-amber-400/50';
  } else {
    // Agrupamento Misto (Ex: Baixa de Maputo com perdidos e achados)
    bgGradient = 'from-slate-900 via-[#008fe2] to-[#153268]';
    borderColor = 'border-[#fce100]';
    glowColor = 'bg-[#008fe2]';
    badgeLabel = `${lostCount > 0 ? `${lostCount}P ` : ''}${foundCount > 0 ? `${foundCount}A` : ''}`.trim() || 'Itens';
    badgeBg = 'bg-slate-950 text-[#fce100] border-amber-300/60';
  }

  // Dimensionamento do círculo conforme o volume de itens agrupados
  const size = count < 10 ? 38 : count < 50 ? 44 : 52;
  const textSize = count < 10 ? 'text-xs' : count < 50 ? 'text-sm' : 'text-base';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer select-none transition-transform duration-200 hover:scale-115 cluster-marker-container" style="width: ${size}px; height: ${size}px;" title="${count} itens agrupados nesta zona (clique para expandir)">
      <!-- Aura de dispersão/pulso -->
      <div class="absolute -inset-1.5 ${glowColor} rounded-full opacity-35 animate-pulse cluster-aura-glow"></div>
      
      <!-- Círculo Numérico Central -->
      <div class="relative w-full h-full rounded-full bg-gradient-to-br ${bgGradient} border-2 ${borderColor} shadow-xl flex flex-col items-center justify-center text-white cluster-core-circle">
        <span class="font-black ${textSize} tracking-tight leading-none drop-shadow-md">${count}</span>
        
        <!-- Pequena etiqueta inferior -->
        <span class="absolute -bottom-2 ${badgeBg} text-[6.5px] font-black uppercase tracking-wider px-1 py-0.2 rounded-md shadow-sm border leading-tight whitespace-nowrap">
          ${badgeLabel}
        </span>
      </div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-item-cluster-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

const MapView: React.FC<MapViewProps> = ({ 
  items, 
  onViewDetails, 
  onAction, 
  focusLocation, 
  dangerReports = [], 
  onDeleteDangerReport, 
  onAddPinClick,
  tileStyle = 'google_streets',
  onTileStyleChange,
  showPoliceStations = true,
  onTogglePoliceStations
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const dangerLayersRef = useRef<(L.Marker | L.Circle)[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const watchPositionIdRef = useRef<number | null>(null);

  // Estado de Consentimento de Localização Exata e Rastreio GPS
  const [gpsConsentStatus, setGpsConsentStatus] = useState<'prompt' | 'granted' | 'denied'>(() => {
    try {
      const saved = localStorage.getItem('comeback_gps_consent');
      if (saved === 'granted' || saved === 'denied') return saved;
      return 'prompt';
    } catch {
      return 'prompt';
    }
  });
  const [showConsentModal, setShowConsentModal] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('comeback_gps_consent');
    } catch {
      return false;
    }
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);

  // Police Station Routes State & Layers
  const [isPoliceRouteActive, setIsPoliceRouteActive] = useState<boolean>(false);
  const [showPoliceStationsState, setShowPoliceStationsState] = useState<boolean>(showPoliceStations);
  const [selectedItemForRoute, setSelectedItemForRoute] = useState<Item | null>(null);
  const policeMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const policeRoutePolylineRef = useRef<L.Polyline | null>(null);
  const policeRouteGlowRef = useRef<L.Polyline | null>(null);
  const originHighlightRef = useRef<L.CircleMarker | null>(null);
  const policeRouteEtaMarkerRef = useRef<L.Marker | null>(null);

  // Painel de Pré-visualização Lateral (Bottom Sheet) de Itens Agrupados no Cluster
  const [selectedClusterData, setSelectedClusterData] = useState<SelectedClusterState | null>(null);
  const [clusterFilter, setClusterFilter] = useState<'ALL' | 'LOST' | 'FOUND' | 'REUNITED'>('ALL');
  const [clusterSearchQuery, setClusterSearchQuery] = useState<string>('');
  const itemMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const selectedClusterHighlightMarkerRef = useRef<L.Marker | null>(null);
  const selectedClusterHighlightCircleRef = useRef<L.CircleMarker | null>(null);
  const selectedClusterElementRef = useRef<HTMLElement | null>(null);

  // Sincronizar estado de esquadras com prop externa
  useEffect(() => {
    setShowPoliceStationsState(showPoliceStations);
  }, [showPoliceStations]);

  const handleTogglePoliceStations = (val?: boolean) => {
    const nextVal = typeof val === 'boolean' ? val : !showPoliceStationsState;
    setShowPoliceStationsState(nextVal);
    onTogglePoliceStations?.(nextVal);
  };

  // Custom User-to-Clicked-Point Route Tracing State & Layers
  const [isCustomRouteActive, setIsCustomRouteActive] = useState<boolean>(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState<boolean>(false);
  const [customRoutePoint, setCustomRoutePoint] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const customRoutePolylineRef = useRef<L.Polyline | null>(null);
  const customRouteGlowRef = useRef<L.Polyline | null>(null);
  const customRouteTargetMarkerRef = useRef<L.Marker | null>(null);
  const customRouteOriginMarkerRef = useRef<L.CircleMarker | null>(null);
  const customRouteEtaMarkerRef = useRef<L.Marker | null>(null);

  // Google Maps & Map Layer Style State
  const [mapTileStyle, setMapTileStyle] = useState<MapTileStyle>(tileStyle || 'google_streets');
  const [isTileSelectorOpen, setIsTileSelectorOpen] = useState<boolean>(false);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  // Sincronizar com prop tileStyle quando ela mudar externamente
  useEffect(() => {
    if (tileStyle && tileStyle !== mapTileStyle) {
      setMapTileStyle(tileStyle);
    }
  }, [tileStyle]);

  const handleSetMapTileStyle = (style: MapTileStyle) => {
    setMapTileStyle(style);
    onTileStyleChange?.(style);
  };

  // Available valid items with coordinates
  const itemsWithCoords = useMemo(() => {
    return items.filter(item => typeof item.latitude === 'number' && typeof item.longitude === 'number' && item.latitude !== 0);
  }, [items]);

  // Determine active item for route calculation
  const activeRouteItem = useMemo(() => {
    if (selectedItemForRoute) return selectedItemForRoute;
    if (itemsWithCoords.length > 0) return itemsWithCoords[0];
    return null;
  }, [selectedItemForRoute, itemsWithCoords]);

  // Find nearest police station to active item
  const nearestPoliceStation = useMemo(() => {
    if (!activeRouteItem || !activeRouteItem.latitude || !activeRouteItem.longitude) return null;
    
    let closestStation: (PoliceStation & { distance: number }) | null = null;
    let minDistance = Infinity;

    POLICE_STATIONS.forEach((station) => {
      const dist = calculateDistanceInKm(activeRouteItem.latitude!, activeRouteItem.longitude!, station.lat, station.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestStation = { ...station, distance: dist };
      }
    });

    return closestStation;
  }, [activeRouteItem]);

  // Informação de tráfego em tempo real para a rota selecionada
  const activeRouteTrafficInfo = useMemo(() => {
    if (!activeRouteItem || !activeRouteItem.latitude || !activeRouteItem.longitude || !nearestPoliceStation) return null;
    return getRealtimeTrafficCondition(
      activeRouteItem.latitude,
      activeRouteItem.longitude,
      nearestPoliceStation.lat,
      nearestPoliceStation.lng,
      dangerReports
    );
  }, [activeRouteItem, nearestPoliceStation, dangerReports]);

  // Cálculos em tempo real para rota personalizada (Usuário -> Ponto Clicado no Mapa)
  const customRouteCalculations = useMemo(() => {
    if (!customRoutePoint) return null;
    const originCoord: [number, number] = userCoords || [-25.9692, 32.5732];
    const destCoord: [number, number] = [customRoutePoint.lat, customRoutePoint.lng];
    const distKm = calculateDistanceInKm(originCoord[0], originCoord[1], destCoord[0], destCoord[1]);
    const formattedDistance = distKm >= 1 ? `${distKm.toFixed(2)} km` : `${Math.round(distKm * 1000)} m`;
    const trafficInfo = getRealtimeTrafficCondition(originCoord[0], originCoord[1], destCoord[0], destCoord[1], dangerReports);
    const drivingMinutes = Math.max(1, Math.round(distKm * 2.5 * trafficInfo.delayMultiplier));
    const walkingMinutes = Math.max(1, Math.round(distKm * 12));
    const cyclingMinutes = Math.max(1, Math.round(distKm * 4.2));

    return {
      originCoord,
      destCoord,
      distKm,
      formattedDistance,
      trafficInfo,
      drivingMinutes,
      walkingMinutes,
      cyclingMinutes
    };
  }, [customRoutePoint, userCoords, dangerReports]);

  // Contagens por categoria do cluster selecionado
  const clusterCounts = useMemo(() => {
    if (!selectedClusterData) return { total: 0, lost: 0, found: 0, reunited: 0 };
    let lost = 0;
    let found = 0;
    let reunited = 0;
    selectedClusterData.items.forEach(it => {
      if (it.status === ItemStatus.LOST || it.status === ItemStatus.STOLEN) lost++;
      else if (it.status === ItemStatus.FOUND || it.status === ItemStatus.IN_TRANSIT) found++;
      else if (it.status === ItemStatus.REUNITED) reunited++;
    });
    return {
      total: selectedClusterData.items.length,
      lost,
      found,
      reunited
    };
  }, [selectedClusterData]);

  // Itens filtrados do cluster ativo
  const filteredClusterItems = useMemo(() => {
    if (!selectedClusterData) return [];
    return selectedClusterData.items.filter(item => {
      // Filtro por Estado
      if (clusterFilter === 'LOST' && item.status !== ItemStatus.LOST && item.status !== ItemStatus.STOLEN) return false;
      if (clusterFilter === 'FOUND' && item.status !== ItemStatus.FOUND && item.status !== ItemStatus.IN_TRANSIT) return false;
      if (clusterFilter === 'REUNITED' && item.status !== ItemStatus.REUNITED) return false;

      // Filtro por termo de pesquisa
      if (clusterSearchQuery.trim()) {
        const q = clusterSearchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchLoc = (item.location || item.province || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat && !matchLoc) return false;
      }
      return true;
    });
  }, [selectedClusterData, clusterFilter, clusterSearchQuery]);

  // Centrar no mapa num item específico da lista do cluster e abrir o popup
  const handleFocusClusterItemOnMap = (item: Item) => {
    if (!mapRef.current || !item.latitude || !item.longitude) return;
    mapRef.current.setView([item.latitude, item.longitude], 17, { animate: true });

    setTimeout(() => {
      const targetMarker = itemMarkersMapRef.current.get(item.id);
      if (targetMarker) {
        if (clusterGroupRef.current && typeof clusterGroupRef.current.zoomToShowLayer === 'function') {
          clusterGroupRef.current.zoomToShowLayer(targetMarker, () => {
            targetMarker.openPopup();
          });
        } else {
          targetMarker.openPopup();
        }
      }
    }, 280);
  };

  // Centrar visualização no mapa no cluster atualmente selecionado
  const handlePanToCluster = () => {
    if (!mapRef.current || !selectedClusterData?.latlng) return;
    mapRef.current.panTo(selectedClusterData.latlng, { animate: true, duration: 0.6 });
  };

  // Aproximar visualização no mapa para o cluster inteiro
  const handleZoomIntoCluster = () => {
    if (!mapRef.current || !selectedClusterData) return;
    if (selectedClusterData.clusterLayer && typeof selectedClusterData.clusterLayer.getBounds === 'function') {
      mapRef.current.fitBounds(selectedClusterData.clusterLayer.getBounds(), { padding: [40, 40], maxZoom: 18 });
    } else if (selectedClusterData.latlng) {
      mapRef.current.setView(selectedClusterData.latlng, (mapRef.current.getZoom() || 13) + 2, { animate: true });
    }
  };

  // Efeito de feedback visual para destacar o cluster selecionado no mapa (#feed-google-maps-section)
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpar feedback visual anterior
    if (selectedClusterHighlightMarkerRef.current) {
      try {
        mapRef.current.removeLayer(selectedClusterHighlightMarkerRef.current);
      } catch (e) {}
      selectedClusterHighlightMarkerRef.current = null;
    }
    if (selectedClusterHighlightCircleRef.current) {
      try {
        mapRef.current.removeLayer(selectedClusterHighlightCircleRef.current);
      } catch (e) {}
      selectedClusterHighlightCircleRef.current = null;
    }
    if (selectedClusterElementRef.current) {
      selectedClusterElementRef.current.classList.remove('cluster-marker-selected');
      selectedClusterElementRef.current = null;
    }

    if (!selectedClusterData || !selectedClusterData.latlng) return;

    const latlng = selectedClusterData.latlng;

    // 1. Destacar o elemento DOM do cluster (escala, brilho dourado e pulsação no próprio marcador)
    let removeClusterHoverListeners: (() => void) | null = null;
    try {
      if (selectedClusterData.clusterLayer && typeof selectedClusterData.clusterLayer.getElement === 'function') {
        const el = selectedClusterData.clusterLayer.getElement();
        if (el) {
          el.classList.add('cluster-marker-selected');
          selectedClusterElementRef.current = el;

          // Eventos para intensificar dinamicamente o brilho (glow) e opacidade ao passar o rato (hover)
          const onClusterEnter = () => {
            el.classList.add('cluster-marker-hovered');
            if (selectedClusterHighlightMarkerRef.current) {
              const beaconEl = selectedClusterHighlightMarkerRef.current.getElement();
              if (beaconEl) beaconEl.classList.add('cluster-beacon-hovered');
            }
            if (selectedClusterHighlightCircleRef.current) {
              selectedClusterHighlightCircleRef.current.setStyle({
                fillOpacity: 0.36,
                weight: 4,
                color: '#ffffff'
              });
            }
          };

          const onClusterLeave = () => {
            el.classList.remove('cluster-marker-hovered');
            if (selectedClusterHighlightMarkerRef.current) {
              const beaconEl = selectedClusterHighlightMarkerRef.current.getElement();
              if (beaconEl) beaconEl.classList.remove('cluster-beacon-hovered');
            }
            if (selectedClusterHighlightCircleRef.current) {
              selectedClusterHighlightCircleRef.current.setStyle({
                fillOpacity: 0.16,
                weight: 2.5,
                color: '#fce100'
              });
            }
          };

          el.addEventListener('mouseenter', onClusterEnter);
          el.addEventListener('mouseleave', onClusterLeave);

          if (typeof selectedClusterData.clusterLayer.on === 'function') {
            selectedClusterData.clusterLayer.on('mouseover', onClusterEnter);
            selectedClusterData.clusterLayer.on('mouseout', onClusterLeave);
          }

          removeClusterHoverListeners = () => {
            el.removeEventListener('mouseenter', onClusterEnter);
            el.removeEventListener('mouseleave', onClusterLeave);
            if (typeof selectedClusterData.clusterLayer.off === 'function') {
              selectedClusterData.clusterLayer.off('mouseover', onClusterEnter);
              selectedClusterData.clusterLayer.off('mouseout', onClusterLeave);
            }
          };
        }
      }
    } catch (e) {
      console.warn("Aviso ao aplicar classe no cluster selecionado:", e);
    }

    // 2. Baliza Superior de Identificação com indicador do grupo selecionado
    const highlightIcon = L.divIcon({
      className: 'cluster-sonar-beacon',
      html: `
        <div class="relative flex items-center justify-center pointer-events-none select-none" style="width: 130px; height: 130px;">
          <!-- Etiqueta Flutuante de Identificação do Grupo -->
          <div class="absolute -top-3.5 flex flex-col items-center z-30">
            <div class="bg-slate-950/95 text-[#fce100] border-2 border-amber-300 px-2.5 py-0.5 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.65)] flex items-center gap-1.5 whitespace-nowrap text-[8px] font-black uppercase tracking-wider backdrop-blur-md">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Grupo no Painel (${selectedClusterData.count})</span>
            </div>
            <div class="w-2 h-2 bg-slate-950 border-r-2 border-b-2 border-amber-300 rotate-45 -mt-1 shadow-sm"></div>
          </div>
        </div>
      `,
      iconSize: [130, 130],
      iconAnchor: [65, 65]
    });

    const highlightMarker = L.marker(latlng, {
      icon: highlightIcon,
      zIndexOffset: 1200,
      interactive: false
    }).addTo(mapRef.current);
    selectedClusterHighlightMarkerRef.current = highlightMarker;

    // 3. Círculo geográfico de realce suave sobre o terreno
    const highlightCircle = L.circleMarker(latlng, {
      radius: 36,
      color: '#fce100',
      weight: 2.5,
      dashArray: '5, 4',
      fillColor: '#008fe2',
      fillOpacity: 0.16,
      interactive: false
    }).addTo(mapRef.current);
    selectedClusterHighlightCircleRef.current = highlightCircle;

    return () => {
      if (removeClusterHoverListeners) {
        try { removeClusterHoverListeners(); } catch (e) {}
      }
      if (mapRef.current) {
        if (highlightMarker) {
          try { mapRef.current.removeLayer(highlightMarker); } catch (e) {}
        }
        if (highlightCircle) {
          try { mapRef.current.removeLayer(highlightCircle); } catch (e) {}
        }
      }
      if (selectedClusterElementRef.current) {
        selectedClusterElementRef.current.classList.remove('cluster-marker-selected');
        selectedClusterElementRef.current.classList.remove('cluster-marker-hovered');
        selectedClusterElementRef.current = null;
      }
    };
  }, [selectedClusterData]);

  // Função para desenhar e atualizar o marcador e círculo de precisão do usuário
  const updateUserPositionOnMap = (lat: number, lng: number, accuracy: number, shouldFlyTo: boolean = false) => {
    if (!mapRef.current) return;

    const coords: [number, number] = [lat, lng];
    setUserCoords(coords);
    setUserAccuracy(Math.round(accuracy));
    setLocationErrorMessage(null);

    // Marcador com pulsação e precisão
    const userIcon = L.divIcon({
      className: 'user-location-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-9 h-9 bg-emerald-500 rounded-full opacity-40 animate-ping"></div>
          <div class="absolute w-6 h-6 bg-blue-500 rounded-full opacity-30 animate-pulse"></div>
          <div class="relative w-4 h-4 bg-emerald-600 border-2 border-white rounded-full shadow-xl flex items-center justify-center">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(coords);
    } else {
      userMarkerRef.current = L.marker(coords, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(mapRef.current)
        .bindPopup(`
          <div class="p-2.5 text-center font-sans">
            <div class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-200 mb-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Sua Posição Exata
            </div>
            <div class="text-[11px] font-bold text-slate-800">Você está aqui</div>
            <div class="text-[9px] text-slate-500 mt-0.5 font-medium">Margem de precisão: ±${Math.round(accuracy)} metros</div>
          </div>
        `);
    }

    // Círculo de precisão em metros
    if (accuracy > 0) {
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setLatLng(coords);
        userAccuracyCircleRef.current.setRadius(accuracy);
      } else {
        userAccuracyCircleRef.current = L.circle(coords, {
          radius: accuracy,
          color: '#10b981',
          fillColor: '#34d399',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(mapRef.current);
      }
    }

    if (shouldFlyTo && mapRef.current) {
      mapRef.current.flyTo(coords, 16, { animate: true, duration: 1.2 });
    }
  };

  // Solicitar permissão e iniciar rastreio contínuo de alta precisão
  const startHighAccuracyTracking = (shouldFlyTo: boolean = true) => {
    if (!("geolocation" in navigator)) {
      setLocationErrorMessage("O seu dispositivo ou navegador não suporta geolocalização.");
      return;
    }

    setIsLocating(true);
    setLocationErrorMessage(null);

    // 1. Obter posição inicial rápida de alta precisão
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        updateUserPositionOnMap(latitude, longitude, accuracy, shouldFlyTo);

        // 2. Iniciar rastreio contínuo (watchPosition) para precisão constante
        if (watchPositionIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchPositionIdRef.current);
        }
        watchPositionIdRef.current = navigator.geolocation.watchPosition(
          (watchPos) => {
            const { latitude: wLat, longitude: wLng, accuracy: wAcc } = watchPos.coords;
            updateUserPositionOnMap(wLat, wLng, wAcc, false);
          },
          (err) => {
            console.warn("Aviso na atualização contínua de localização:", err.message);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      },
      (err) => {
        setIsLocating(false);
        console.warn("Erro ao obter geolocalização:", err.message);
        if (err.code === 1) {
          setLocationErrorMessage("Permissão de localização não concedida no navegador.");
          setGpsConsentStatus('denied');
          try { localStorage.setItem('comeback_gps_consent', 'denied'); } catch {}
        } else {
          setLocationErrorMessage("Não foi possível obter sinal GPS com precisão suficiente.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Aceitação explícita de consentimento pelo utilizador
  const handleAcceptLocationConsent = () => {
    try {
      localStorage.setItem('comeback_gps_consent', 'granted');
    } catch {}
    setGpsConsentStatus('granted');
    setShowConsentModal(false);
    startHighAccuracyTracking(true);
  };

  // Recusa explícita de consentimento
  const handleDeclineLocationConsent = () => {
    try {
      localStorage.setItem('comeback_gps_consent', 'denied');
    } catch {}
    setGpsConsentStatus('denied');
    setShowConsentModal(false);
  };

  // Botão para recentralizar ou abrir modal de consentimento
  const handleRecenterOrRequestGps = () => {
    if (gpsConsentStatus === 'granted' && userCoords) {
      if (mapRef.current) {
        mapRef.current.flyTo(userCoords, 16, { animate: true, duration: 0.8 });
      }
    } else if (gpsConsentStatus === 'granted' && !userCoords) {
      startHighAccuracyTracking(true);
    } else {
      setShowConsentModal(true);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Coordenadas padrão (Maputo) caso a geolocalização não esteja autorizada
    const defaultCoords: [number, number] = [-25.9692, 32.5732];
    const map = L.map(mapContainerRef.current).setView(defaultCoords, 13);
    
    const tileConfig = MAP_TILE_CONFIG[mapTileStyle] || MAP_TILE_CONFIG.google_streets;
    const initialTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || []
    }).addTo(map);

    currentTileLayerRef.current = initialTileLayer;
    mapRef.current = map;

    // Se o utilizador já deu consentimento anteriormente, ativar rastreio
    if (gpsConsentStatus === 'granted') {
      startHighAccuracyTracking(true);
    }

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
      dangerLayersRef.current = [];
      userMarkerRef.current = null;
      userAccuracyCircleRef.current = null;
      clusterGroupRef.current = null;
      currentTileLayerRef.current = null;
    };
  }, []);

  // Efeito para trocar suavemente a camada de mapa (Google Maps Ruas, Satélite, Relevo, OSM)
  useEffect(() => {
    if (!mapRef.current) return;

    if (currentTileLayerRef.current) {
      try {
        mapRef.current.removeLayer(currentTileLayerRef.current);
      } catch (e) {
        console.warn("Aviso ao alternar camada de azulejos:", e);
      }
    }

    const tileConfig = MAP_TILE_CONFIG[mapTileStyle] || MAP_TILE_CONFIG.google_streets;
    const newTileLayer = L.tileLayer(tileConfig.url, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      subdomains: tileConfig.subdomains || []
    }).addTo(mapRef.current);

    newTileLayer.bringToBack();
    currentTileLayerRef.current = newTileLayer;
  }, [mapTileStyle]);

  useEffect(() => {
    if (mapRef.current && focusLocation) {
      mapRef.current.setView([focusLocation.lat, focusLocation.lng], 16);
    }
  }, [focusLocation]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Limpar marcadores antigos de itens de seu cluster group
    if (clusterGroupRef.current && mapRef.current) {
      try {
        mapRef.current.removeLayer(clusterGroupRef.current);
      } catch (e) {
        console.warn("Erro ao remover clusterGroup antigo:", e);
      }
    }
    markersRef.current = [];

    // Limpar camadas antigas de perigo
    dangerLayersRef.current.forEach(layer => {
      try {
        layer.remove();
      } catch (e) {
        console.warn("Erro ao remover camada de perigo:", e);
      }
    });
    dangerLayersRef.current = [];

    // Criar um novo grupo de clustering para itens com ícones numéricos inteligentes e dispersão em áreas densas de Maputo
    const markerClusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45, // Raio ideal de agregação para evitar sobreposição em zonas de alta densidade (Baixa, Alto-Maé, etc.)
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.5,
      zoomToBoundsOnClick: false, // Desativado para abrir painel lateral de pré-visualização (bottom sheet)
      animate: true,
      animateAddingMarkers: true,
      disableClusteringAtZoom: 18, // No zoom máximo de rua detalhada, mostra marcadores individuais
      iconCreateFunction: createItemClusterCustomIcon
    });

    // Evento de clique no cluster para abrir o painel de pré-visualização lateral (bottom sheet)
    markerClusterGroup.on('clusterclick', (a: any) => {
      try {
        const childMarkers = a.layer.getAllChildMarkers();
        const clusterItems: Item[] = [];

        childMarkers.forEach((m: any) => {
          const item = (m as any).itemData || items.find(it => it.id === m.options?.itemId || it.id === (m as any).itemId);
          if (item && !clusterItems.some(existing => existing.id === item.id)) {
            clusterItems.push(item);
          }
        });

        if (clusterItems.length > 0) {
          // Identificar localização mais frequente para etiquetar o cluster
          const locationCounts: Record<string, number> = {};
          clusterItems.forEach(it => {
            const loc = it.location || it.province || 'Moçambique';
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
          });
          const topLocation = Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Zona do Radar';

          setSelectedClusterData({
            items: clusterItems,
            count: clusterItems.length,
            latlng: a.latlng,
            clusterLayer: a.layer,
            clusterLabel: topLocation
          });
          setClusterFilter('ALL');
          setClusterSearchQuery('');

          // Suave centralização no cluster clicado para destacá-lo claramente em relação ao painel lateral
          mapRef.current?.panTo(a.latlng, { animate: true, duration: 0.5 });
        }
      } catch (e) {
        console.warn("Erro ao processar clique no cluster:", e);
      }
    });

    // Limpar mapa de referências de marcadores
    itemMarkersMapRef.current.clear();

    // RENOVAR MARCADORES DE ITENS
    items.forEach(item => {
      if (item.latitude && item.longitude) {
        const isLost = item.status === ItemStatus.LOST;
        const isStolen = item.status === ItemStatus.STOLEN;
        const isFound = item.status === ItemStatus.FOUND;
        const isReunited = item.status === ItemStatus.REUNITED;
        const isInTransit = item.status === ItemStatus.IN_TRANSIT;

        const color = isLost ? '#d21034' : 
                      isStolen ? '#7f1d1d' : 
                      isReunited ? '#059669' :
                      isInTransit ? '#d97706' :
                      isFound ? '#009739' : '#6b7280';
        
        const markerIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="
              background-color: ${color};
              width: 34px;
              height: 34px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2.5px solid white;
              box-shadow: 0 6px 14px rgba(0,0,0,0.35);
              transition: transform 0.2s ease;
            ">
              <i class="${isLost || isStolen ? 'fa-solid fa-magnifying-glass' : isReunited ? 'fa-solid fa-circle-check' : isInTransit ? 'fa-solid fa-truck-fast' : 'fa-solid fa-hand-holding-heart'}" style="
                color: white;
                transform: rotate(45deg);
                font-size: 13px;
              "></i>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });

        const marker = (L as any).marker([item.latitude, item.longitude], { 
          icon: markerIcon,
          itemStatus: item.status,
          itemId: item.id
        });
        (marker as any).itemStatus = item.status;
        (marker as any).itemId = item.id;
        (marker as any).itemData = item;
        itemMarkersMapRef.current.set(item.id, marker);

        // Calculate Status Progression Bar (Etapa 1: Registado/Perdido -> Etapa 2: Em Processo/Achado/Trânsito -> Etapa 3: Recuperado/Entregue)
        let stepProgress = 33;
        let step1Active = true;
        let step2Active = false;
        let step3Active = false;

        if (isReunited) {
          stepProgress = 100;
          step1Active = true;
          step2Active = true;
          step3Active = true;
        } else if (isFound || isInTransit) {
          stepProgress = 66;
          step1Active = true;
          step2Active = true;
          step3Active = false;
        }

        const fallbackThumb = `https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400&auto=format&fit=crop&q=80`;
        const thumbUrl = item.imageUrl || (item.imageUrls && item.imageUrls[0]) || fallbackThumb;

        const statusLabel = isReunited ? 'Recuperado' :
                            isStolen ? 'Roubado' :
                            isInTransit ? 'Em Trânsito' :
                            isFound ? 'Achado' : 'Perdido';

        const statusBadgeClass = isReunited ? 'bg-emerald-500 text-white' :
                                 isStolen ? 'bg-red-900 text-white' :
                                 isInTransit ? 'bg-amber-500 text-white' :
                                 isFound ? 'bg-[#009739] text-white' : 'bg-[#d21034] text-white';

        const popupContent = document.createElement('div');
        popupContent.className = 'w-full text-left bg-white select-none transition-opacity duration-300';
        popupContent.innerHTML = `
          <div class="relative w-full h-32 bg-slate-900 overflow-hidden group cursor-pointer" id="img-click-${item.id}">
            <img 
              src="${thumbUrl}" 
              alt="${item.title}" 
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onerror="this.src='${fallbackThumb}'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <!-- Badges no Topo da Imagem -->
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
              <span class="text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-md ${statusBadgeClass}">
                ${statusLabel}
              </span>
              <span class="text-[7.5px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white border border-white/20">
                ${item.category}
              </span>
            </div>

            ${item.reward ? `
              <div class="absolute top-2.5 right-2.5 z-10">
                <span class="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-[#fce100] text-slate-900 shadow-md border border-amber-300 flex items-center gap-1">
                  <i class="fa-solid fa-award text-[9px] text-amber-700"></i>
                  ${item.reward.toLocaleString()} MT
                </span>
              </div>
            ` : ''}

            <!-- Título sobre a base da imagem -->
            <div class="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <h4 class="font-black text-xs uppercase leading-tight line-clamp-1 drop-shadow-sm text-white">${item.title}</h4>
              <div class="flex items-center gap-1.5 text-[8px] text-slate-200 font-semibold mt-0.5">
                <i class="fa-solid fa-location-dot text-[#fce100] text-[8px]"></i>
                <span class="truncate">${item.location || item.province || 'Moçambique'}</span>
              </div>
            </div>
          </div>

          <div class="p-3.5 space-y-3">
            <!-- Barra de Progresso do Estado do Item (Perdido / Achado / Recuperado) -->
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-150 space-y-1.5">
              <div class="flex items-center justify-between text-[7px] font-black uppercase tracking-widest text-slate-400">
                <span>Ciclo do Item</span>
                <span class="${isReunited ? 'text-emerald-600 font-extrabold' : 'text-slate-600'}">${stepProgress}% Concluído</span>
              </div>

              <!-- Track de Progresso -->
              <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden relative">
                <div 
                  class="h-full rounded-full transition-all duration-500 ${
                    isReunited ? 'bg-emerald-500' : isFound || isInTransit ? 'bg-[#009739]' : 'bg-[#d21034]'
                  }" 
                  style="width: ${stepProgress}%;"
                ></div>
              </div>

              <!-- Três Pontos de Estado -->
              <div class="grid grid-cols-3 text-[7.5px] font-black uppercase pt-0.5 text-center">
                <div class="flex flex-col items-center">
                  <span class="${step1Active ? (isLost || isStolen ? 'text-red-600 font-black' : 'text-slate-700') : 'text-slate-300'}">1. Perdido</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="${step2Active ? 'text-[#009739] font-black' : 'text-slate-400'}">2. Localizado</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="${step3Active ? 'text-emerald-600 font-black' : 'text-slate-300'}">3. Devolvido</span>
                </div>
              </div>
            </div>

            <!-- Detalhes Rápidos -->
            ${item.description ? `
              <p class="text-[9px] text-slate-600 font-medium line-clamp-2 leading-relaxed italic bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                "${item.description}"
              </p>
            ` : ''}

            <!-- Botão Rota para Esquadra PRM Mais Próxima -->
            <button 
              id="police-route-btn-${item.id}" 
              class="w-full py-2 px-2.5 rounded-xl text-[8.5px] font-black uppercase tracking-wider text-blue-800 bg-blue-50/90 hover:bg-blue-100 border border-blue-200/80 transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 cursor-pointer"
            >
              <i class="fa-solid fa-shield-halved text-blue-600 text-[10px]"></i>
              <span>Traçar Rota p/ Esquadra PRM</span>
            </button>

            <!-- Botões de Ação -->
            <div class="flex items-center gap-2 pt-0.5">
              <button 
                id="view-btn-${item.id}" 
                class="flex-1 bg-slate-900 hover:bg-slate-800 text-[#fce100] py-2.5 px-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <i class="fa-solid fa-eye text-[9px]"></i>
                <span>Ver Detalhes</span>
              </button>

              ${onAction ? `
                <button 
                  id="action-btn-${item.id}" 
                  class="flex-1 py-2.5 px-3 rounded-xl text-[8.5px] font-black uppercase tracking-wider text-white shadow-sm border-b-2 active:scale-95 active:border-b-0 transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isLost || isStolen
                      ? 'bg-[#009739] border-[#007a2d] hover:bg-[#008632]' 
                      : 'bg-[#d21034] border-[#a50d29] hover:bg-[#b80e2d]'
                  }"
                >
                  <i class="fa-solid ${isLost || isStolen ? 'fa-hand-holding-heart' : 'fa-circle-check'} text-[9px]"></i>
                  <span>${isLost || isStolen ? 'EU ACHEI!' : 'É MEU!'}</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 260,
          className: 'custom-item-map-popup'
        });
        
        marker.on('popupopen', () => {
          document.getElementById(`view-btn-${item.id}`)?.addEventListener('click', () => {
            onViewDetails(item);
          });
          document.getElementById(`img-click-${item.id}`)?.addEventListener('click', () => {
            onViewDetails(item);
          });
          document.getElementById(`police-route-btn-${item.id}`)?.addEventListener('click', () => {
            setSelectedItemForRoute(item);
            setIsPoliceRouteActive(true);
            marker.closePopup();
          });
          if (onAction) {
            document.getElementById(`action-btn-${item.id}`)?.addEventListener('click', () => {
              onAction(item);
            });
          }
        });

        markersRef.current.push(marker);
        markerClusterGroup.addLayer(marker);
      }
    });

    if (mapRef.current && markersRef.current.length > 0) {
      mapRef.current.addLayer(markerClusterGroup);
      clusterGroupRef.current = markerClusterGroup;
    }

    // RENOVAR DENÚNCIAS DE PERIGO / ASSALTOS RECORRENTES
    if (dangerReports) {
      dangerReports.forEach(report => {
        if (report.latitude && report.longitude) {
          // 1. Círculo de aviso comunitário (raio de 150 metros)
          const hazardCircle = L.circle([report.latitude, report.longitude], {
            radius: 150,
            color: '#b91c1c',
            fillColor: '#ef4444',
            fillOpacity: 0.35,
            weight: 2,
            dashArray: '5, 5'
          }).addTo(mapRef.current!);

          dangerLayersRef.current.push(hazardCircle);

          // 2. Marcador em forma de placa de atenção / triângulo de perigo
          const dangerIcon = L.divIcon({
            className: 'danger-hazard-icon',
            html: `
              <div class="animate-pulse" style="
                background-color: #7f1d1d;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid #ef4444;
                box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
              ">
                <i class="fa-solid fa-triangle-exclamation" style="color: #f77070; font-size: 11px;"></i>
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const dangerMarker = L.marker([report.latitude, report.longitude], { icon: dangerIcon })
            .addTo(mapRef.current!);

          const popupContent = document.createElement('div');
          popupContent.className = 'p-3 text-left w-64 rounded-xl';
          popupContent.innerHTML = `
            <div class="space-y-2">
              <div class="flex items-center gap-1.5 border-b pb-1.5 border-red-100">
                <i class="fa-solid fa-triangle-exclamation text-red-650 animate-pulse text-xs" style="color: #b91c1c"></i>
                <span class="font-extrabold text-[10px] text-red-700 uppercase tracking-widest leading-none">Zona de Risco Criado</span>
              </div>
              
              <div class="space-y-0.5">
                <div class="text-[8px] uppercase font-bold text-gray-400">Origem do Artigo:</div>
                <div class="font-black text-xs uppercase text-slate-800 leading-tight">${report.itemTitle}</div>
              </div>

              <div class="bg-red-50 p-2.5 rounded-xl text-[10px] border border-red-100 font-medium text-gray-700 leading-relaxed max-h-24 overflow-y-auto">
                "${report.description}"
              </div>

              <div class="text-[9px] font-semibold text-gray-500 space-y-0.5 pt-1">
                <div><span class="font-black uppercase text-[8px] text-gray-450">Local de Risco:</span> ${report.location}</div>
                <div><span class="font-black uppercase text-[8px] text-gray-450">Província:</span> ${report.province}</div>
                <div><span class="font-black uppercase text-[8px] text-gray-450">Inserido por:</span> ${report.reporterName || 'Comunidade'}</div>
                <div><span class="font-black uppercase text-[8px] text-gray-450">Data de Registo:</span> ${new Date(report.createdAt).toLocaleDateString('pt-MZ')}</div>
              </div>

              ${onDeleteDangerReport ? `
                <button id="del-danger-${report.id}" class="w-full mt-2 bg-red-100 hover:bg-red-200 text-red-700 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1">
                  <i class="fa-solid fa-trash-can"></i>
                  <span>Apagar Denúncia</span>
                </button>
              ` : ''}
            </div>
          `;

          dangerMarker.bindPopup(popupContent);

          dangerMarker.on('popupopen', () => {
            if (onDeleteDangerReport) {
              document.getElementById(`del-danger-${report.id}`)?.addEventListener('click', () => {
                dangerMarker.closePopup();
                onDeleteDangerReport(report.id);
              });
            }
          });

          dangerLayersRef.current.push(dangerMarker);
        }
      });
    }

  }, [items, dangerReports, onViewDetails, onAction, onDeleteDangerReport]);

  // EFEITO: Desenhar Rota e Marcadores de Esquadras de Polícia (POLICE_STATIONS)
  // Quando ativado, renderiza as 5 esquadras mais próximas da área visível do mapa com marcadores de escudo azul
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpar camadas de polícia anteriores
    const clearPoliceLayers = () => {
      if (policeMarkersGroupRef.current) {
        policeMarkersGroupRef.current.clearLayers();
        try {
          map.removeLayer(policeMarkersGroupRef.current);
        } catch (e) {}
        policeMarkersGroupRef.current = null;
      }
      if (policeRoutePolylineRef.current) {
        policeRoutePolylineRef.current.remove();
        policeRoutePolylineRef.current = null;
      }
      if (policeRouteGlowRef.current) {
        policeRouteGlowRef.current.remove();
        policeRouteGlowRef.current = null;
      }
      if (originHighlightRef.current) {
        originHighlightRef.current.remove();
        originHighlightRef.current = null;
      }
      if (policeRouteEtaMarkerRef.current) {
        policeRouteEtaMarkerRef.current.remove();
        policeRouteEtaMarkerRef.current = null;
      }
    };

    clearPoliceLayers();

    if (!isPoliceRouteActive && !showPoliceStationsState) return;

    const policeGroup = L.layerGroup().addTo(map);
    policeMarkersGroupRef.current = policeGroup;

    // Função para calcular e renderizar as 5 esquadras mais próximas da área visível (centro do mapa)
    const renderNearestPoliceStations = () => {
      if (!policeMarkersGroupRef.current) return;
      policeMarkersGroupRef.current.clearLayers();

      const center = map.getCenter();
      
      // Calcular a distância de cada esquadra em relação ao centro visível atual
      const stationsWithDistance = POLICE_STATIONS.map((station) => {
        const distFromCenter = calculateDistanceInKm(center.lat, center.lng, station.lat, station.lng);
        return {
          ...station,
          distFromCenter
        };
      });

      // Ordenar por proximidade e selecionar as 5 mais próximas
      stationsWithDistance.sort((a, b) => a.distFromCenter - b.distFromCenter);
      const top5Nearest = stationsWithDistance.slice(0, 5);

      top5Nearest.forEach((station, index) => {
        const rank = index + 1;
        const isTargetNearest = isPoliceRouteActive && !!(nearestPoliceStation && nearestPoliceStation.name === station.name);
        const distStr = `${station.distFromCenter.toFixed(1)} km`;

        // Marcador personalizado com ícone de escudo azul da PRM
        const stationIcon = createBlueShieldPoliceIcon(station, rank, distStr, isTargetNearest);

        const pMarker = L.marker([station.lat, station.lng], { 
          icon: stationIcon, 
          zIndexOffset: isTargetNearest ? 1000 : (600 - index * 20) 
        });

        const pPopup = document.createElement('div');
        pPopup.className = 'p-3.5 text-left w-72 rounded-2xl select-none font-sans';
        pPopup.innerHTML = `
          <div class="space-y-2.5">
            <div class="flex items-center gap-2.5 border-b pb-2 border-blue-100">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-950 text-cyan-200 flex items-center justify-center font-black text-sm shrink-0 shadow-md border border-cyan-300">
                <i class="fa-solid fa-shield-halved"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-900 text-[7px] font-black uppercase">#${rank} Mais Próxima</span>
                  <span class="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider truncate">${station.province || 'Moçambique'}</span>
                </div>
                <h4 class="font-extrabold text-[10.5px] text-blue-950 uppercase tracking-wide block leading-tight truncate">${station.name}</h4>
              </div>
            </div>

            <div class="text-[8.5px] text-gray-600 space-y-1.5">
              <div class="flex items-start gap-1.5">
                <i class="fa-solid fa-location-dot text-blue-600 mt-0.5 shrink-0"></i>
                <span class="leading-tight text-slate-700">${station.address || 'Posto Policial da PRM'}</span>
              </div>
              
              <div class="font-black text-blue-900 bg-blue-50/90 p-2 rounded-xl border border-blue-200/90 flex items-center justify-between">
                <span class="text-[7.5px] uppercase tracking-wider text-blue-700">Distância da Área Visível:</span>
                <span class="font-mono text-[10px] text-blue-950">${distStr}</span>
              </div>

              ${station.phone ? `
                <a href="tel:${station.phone}" class="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl text-center font-black text-[8.5px] uppercase tracking-wider transition-colors shadow-xs">
                  <i class="fa-solid fa-phone"></i>
                  <span>Ligar: ${station.phone}</span>
                </a>
              ` : ''}
            </div>
          </div>
        `;

        pMarker.bindPopup(pPopup);
        policeGroup.addLayer(pMarker);
      });
    };

    // Renderizar inicialmente as 5 mais próximas
    renderNearestPoliceStations();

    // Listener para atualizar dinamicamente as 5 esquadras mais próximas quando o mapa for movido/navegado
    map.on('moveend', renderNearestPoliceStations);

    // Se temos rota ativa, item ativo e uma esquadra mais próxima, traça a rota conectando os dois
    if (isPoliceRouteActive && activeRouteItem && activeRouteItem.latitude && activeRouteItem.longitude && nearestPoliceStation) {
      const originCoord: [number, number] = [activeRouteItem.latitude, activeRouteItem.longitude];
      const destCoord: [number, number] = [nearestPoliceStation.lat, nearestPoliceStation.lng];

      // Highlight de pulso no item de origem
      const originHighlight = L.circleMarker(originCoord, {
        radius: 18,
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        weight: 2,
        dashArray: '3, 3'
      }).addTo(map);
      originHighlightRef.current = originHighlight;

      // Cálculo do ponto médio e estimativas de deslocação (ETA)
      const midLat = (originCoord[0] + destCoord[0]) / 2;
      const midLng = (originCoord[1] + destCoord[1]) / 2;
      const distKm = nearestPoliceStation.distance;

      // Avaliação de condições de tráfego em tempo real (verde / amarelo / vermelho)
      const trafficInfo = getRealtimeTrafficCondition(
        originCoord[0],
        originCoord[1],
        destCoord[0],
        destCoord[1],
        dangerReports
      );

      const drivingMinutes = Math.max(1, Math.round(distKm * 2.5 * trafficInfo.delayMultiplier));
      const walkingMinutes = Math.max(2, Math.round(distKm * 12));

      // Glow polyline (linha luminosa de fundo com tonalidade de tráfego)
      const glowPolyline = L.polyline([originCoord, destCoord], {
        color: trafficInfo.glowColor || '#3b82f6',
        weight: 9,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      policeRouteGlowRef.current = glowPolyline;

      // Polyline nítida tracejada de rota
      const mainPolyline = L.polyline([originCoord, destCoord], {
        color: '#1d4ed8',
        weight: 4,
        opacity: 0.95,
        dashArray: '7, 7',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      policeRoutePolylineRef.current = mainPolyline;

      // Etiqueta informativa visual da rota diretamente no mapa com Indicador Visual de Tráfego
      const etaBadgeIcon = L.divIcon({
        className: 'police-route-eta-badge-container',
        html: `
          <div class="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group" style="width: max-content;">
            <div class="bg-slate-950/95 backdrop-blur-md text-white px-3 py-2.5 rounded-2xl border-2 ${trafficInfo.borderClass} shadow-2xl flex flex-col gap-1.5 ring-4 ${trafficInfo.ringClass} transition-all duration-200 group-hover:scale-105">
              
              <!-- Cabeçalho da Etiqueta de Rota: Destino & Indicador Visual de Tráfego -->
              <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
                <div class="flex items-center gap-1.5 text-blue-400">
                  <i class="fa-solid fa-route text-[10px]"></i>
                  <span class="text-[7.5px] font-black uppercase tracking-wider text-blue-300">Rota PRM</span>
                </div>

                <!-- Indicador Visual (Ícone) de Tráfego em Tempo Real (Verde / Amarelo / Vermelho) -->
                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${trafficInfo.badgeBg} shadow-xs" title="Condições de Tráfego em Tempo Real: ${trafficInfo.label} (${trafficInfo.description})">
                  <!-- Ponto luminoso com pulso na cor do tráfego -->
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background-color: ${trafficInfo.color};"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2" style="background-color: ${trafficInfo.color};"></span>
                  </span>
                  <!-- Ícone semáforo / tráfego com a cor dinâmica -->
                  <i class="fa-solid ${trafficInfo.icon} text-[9px]" style="color: ${trafficInfo.color};"></i>
                  <span class="text-[7.5px] font-black uppercase tracking-wider leading-none" style="color: ${trafficInfo.color};">
                    ${trafficInfo.label}
                  </span>
                </div>
              </div>

              <!-- Identificação da Esquadra -->
              <div class="text-[8px] font-black text-[#fce100] uppercase truncate max-w-[210px] flex items-center gap-1">
                <i class="fa-solid fa-building-shield text-[9px] text-blue-400"></i>
                <span class="truncate">${nearestPoliceStation.name}</span>
              </div>

              <!-- Métricas Principais: Distância Total & Estimativa de Tempo (ETA) -->
              <div class="flex items-center gap-2 pt-0.5">
                <!-- Distância Total -->
                <div class="flex items-center gap-1 bg-blue-900/60 px-2 py-1 rounded-xl border border-blue-600/40">
                  <i class="fa-solid fa-location-arrow text-cyan-300 text-[9px]"></i>
                  <span class="font-mono text-[9px] font-black text-white">${distKm.toFixed(2)} km</span>
                </div>

                <!-- ETA Viatura (com impacto de tráfego) e Pedestre -->
                <div class="flex items-center gap-1.5 px-2 py-1 rounded-xl border ${trafficInfo.bgClass}">
                  <div class="flex items-center gap-1 text-[8.5px] font-bold" style="color: ${trafficInfo.color};">
                    <i class="fa-solid fa-car text-[9px]"></i>
                    <span class="font-black">~${drivingMinutes} min</span>
                  </div>
                  <span class="text-slate-600 text-[8px]">|</span>
                  <div class="flex items-center gap-1 text-[8.5px] font-bold text-slate-300">
                    <i class="fa-solid fa-person-walking text-[9px] text-slate-400"></i>
                    <span>~${walkingMinutes} min</span>
                  </div>
                </div>
              </div>

              <!-- Rodapé da Etiqueta: Descrição do Fluxo -->
              <div class="text-[6.5px] font-semibold text-slate-400 text-center tracking-wider uppercase pt-0.5 flex items-center justify-center gap-1">
                <i class="fa-solid fa-circle-info text-[7px]" style="color: ${trafficInfo.color};"></i>
                <span>${trafficInfo.description}</span>
              </div>
            </div>
            
            <!-- Ponteiro / Seta da Etiqueta -->
            <div class="w-2.5 h-2.5 bg-slate-950 border-r-2 border-b-2 ${trafficInfo.borderClass} rotate-45 mx-auto -mt-1 shadow-md"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const etaMarker = L.marker([midLat, midLng], {
        icon: etaBadgeIcon,
        zIndexOffset: 2500
      }).addTo(map);

      etaMarker.on('click', () => {
        map.fitBounds([originCoord, destCoord], {
          padding: [70, 70],
          maxZoom: 16
        });
      });

      policeRouteEtaMarkerRef.current = etaMarker;

      // Enquadrar rota no mapa
      map.fitBounds([originCoord, destCoord], {
        padding: [60, 60],
        maxZoom: 16
      });
    }

    return () => {
      map.off('moveend', renderNearestPoliceStations);
      clearPoliceLayers();
    };
  }, [isPoliceRouteActive, showPoliceStationsState, activeRouteItem, nearestPoliceStation]);

  // Listener para capturar cliques no mapa e traçar rota a partir da localização do utilizador
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      // Auto-iniciar GPS caso ainda não tenha sido iniciado e o consentimento tenha sido dado
      if (!userCoords && gpsConsentStatus === 'granted') {
        startHighAccuracyTracking(false);
      }

      setCustomRoutePoint({
        lat,
        lng,
        label: `Ponto (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      });
      setIsCustomRouteActive(true);
      setIsSelectingDestination(false);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [userCoords, gpsConsentStatus]);

  // Efeito para desenhar a Rota Personalizada (Usuário -> Ponto Clicado no Mapa)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Limpar camadas antigas da rota personalizada
    if (customRoutePolylineRef.current) {
      try {
        customRoutePolylineRef.current.remove();
      } catch (e) {
        console.warn("Erro ao remover polilinha de rota customizada:", e);
      }
      customRoutePolylineRef.current = null;
    }
    if (customRouteGlowRef.current) {
      try {
        customRouteGlowRef.current.remove();
      } catch (e) {
        console.warn("Erro ao remover brilho de rota customizada:", e);
      }
      customRouteGlowRef.current = null;
    }
    if (customRouteOriginMarkerRef.current) {
      try {
        customRouteOriginMarkerRef.current.remove();
      } catch (e) {
        console.warn("Erro ao remover marcador de origem da rota customizada:", e);
      }
      customRouteOriginMarkerRef.current = null;
    }
    if (customRouteTargetMarkerRef.current) {
      try {
        customRouteTargetMarkerRef.current.remove();
      } catch (e) {
        console.warn("Erro ao remover marcador de destino da rota customizada:", e);
      }
      customRouteTargetMarkerRef.current = null;
    }
    if (customRouteEtaMarkerRef.current) {
      try {
        customRouteEtaMarkerRef.current.remove();
      } catch (e) {
        console.warn("Erro ao remover marcador de ETA da rota customizada:", e);
      }
      customRouteEtaMarkerRef.current = null;
    }

    if (!isCustomRouteActive || !customRoutePoint) return;

    const originCoord: [number, number] = userCoords || [-25.9692, 32.5732];
    const destCoord: [number, number] = [customRoutePoint.lat, customRoutePoint.lng];

    // Destacar ponto de origem do utilizador com anel esmeralda pulsante
    const originHighlight = L.circleMarker(originCoord, {
      radius: 18,
      color: '#059669',
      fillColor: '#10b981',
      fillOpacity: 0.28,
      weight: 2.5,
      dashArray: '3, 3'
    }).addTo(map);
    customRouteOriginMarkerRef.current = originHighlight;

    // Marcador personalizado no ponto clicado (Destino)
    const destIcon = L.divIcon({
      className: 'custom-destination-pin',
      html: `
        <div class="relative flex flex-col items-center group -translate-y-6">
          <div class="w-10 h-10 rounded-2xl bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-base transform transition-transform group-hover:scale-110">
            <i class="fa-solid fa-flag-checkered animate-bounce"></i>
          </div>
          <div class="w-3.5 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 44]
    });

    const destMarker = L.marker(destCoord, {
      icon: destIcon,
      zIndexOffset: 2100
    }).addTo(map);

    const distKm = calculateDistanceInKm(originCoord[0], originCoord[1], destCoord[0], destCoord[1]);
    const formattedDistance = distKm >= 1 ? `${distKm.toFixed(2)} km` : `${Math.round(distKm * 1000)} m`;
    const trafficInfo = getRealtimeTrafficCondition(originCoord[0], originCoord[1], destCoord[0], destCoord[1], dangerReports);
    const drivingMinutes = Math.max(1, Math.round(distKm * 2.5 * trafficInfo.delayMultiplier));
    const walkingMinutes = Math.max(1, Math.round(distKm * 12));

    destMarker.bindPopup(`
      <div class="p-3 text-left font-sans select-none min-w-[210px]">
        <div class="flex items-center gap-2 border-b border-emerald-100 pb-2 mb-2">
          <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-md">
            <i class="fa-solid fa-flag-checkered"></i>
          </div>
          <div>
            <span class="text-[10px] font-black text-slate-800 uppercase block leading-tight">Ponto Clicado</span>
            <span class="text-[8px] text-emerald-700 font-bold font-mono">${destCoord[0].toFixed(4)}, ${destCoord[1].toFixed(4)}</span>
          </div>
        </div>
        <div class="space-y-2 text-[8.5px]">
          <div class="bg-emerald-50 text-emerald-900 font-black p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
            <span>Distância da Sua Posição:</span>
            <span class="font-mono text-[10px] text-emerald-800">${formattedDistance}</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-center">
            <div class="bg-slate-50 p-1.5 rounded-lg border border-slate-200 font-bold text-slate-800">
              <i class="fa-solid fa-car mr-1 text-emerald-600"></i>~${drivingMinutes} min
            </div>
            <div class="bg-slate-50 p-1.5 rounded-lg border border-slate-200 font-bold text-slate-800">
              <i class="fa-solid fa-person-walking mr-1 text-slate-500"></i>~${walkingMinutes} min
            </div>
          </div>
        </div>
      </div>
    `);

    customRouteTargetMarkerRef.current = destMarker;

    // Linha de Trajetória Brilhante (Glow de fundo com a cor do tráfego)
    const glowPolyline = L.polyline([originCoord, destCoord], {
      color: trafficInfo.glowColor || '#34d399',
      weight: 9,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    customRouteGlowRef.current = glowPolyline;

    // Linha de Trajetória Principal Estilizada com Tracejado
    const mainPolyline = L.polyline([originCoord, destCoord], {
      color: '#059669',
      weight: 4.5,
      opacity: 0.95,
      dashArray: '7, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);
    customRoutePolylineRef.current = mainPolyline;

    // Marcador de ETA e Distância Centralizado no Meio da Rota
    const midLat = (originCoord[0] + destCoord[0]) / 2;
    const midLng = (originCoord[1] + destCoord[1]) / 2;

    const etaBadgeIcon = L.divIcon({
      className: 'custom-route-eta-badge-container',
      html: `
        <div class="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer group" style="width: max-content;">
          <div class="bg-slate-950/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl border-2 ${trafficInfo.borderClass} shadow-2xl flex flex-col gap-1.5 ring-4 ${trafficInfo.ringClass} transition-all duration-200 group-hover:scale-105">
            <!-- Cabeçalho do Badge -->
            <div class="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
              <div class="flex items-center gap-1.5 text-emerald-400">
                <i class="fa-solid fa-route text-[10px]"></i>
                <span class="text-[7.5px] font-black uppercase tracking-wider text-emerald-300">Rota ao Ponto</span>
              </div>
              <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${trafficInfo.badgeBg} text-[7px] font-black uppercase">
                <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background-color: ${trafficInfo.color}"></span>
                <span style="color: ${trafficInfo.color}">${trafficInfo.label}</span>
              </div>
            </div>

            <!-- Dados Principais: Distância e Tempos Estimados -->
            <div class="flex items-center gap-2 pt-0.5">
              <div class="flex items-center gap-1 bg-emerald-900/70 px-2.5 py-1 rounded-xl border border-emerald-500/40">
                <i class="fa-solid fa-location-arrow text-emerald-300 text-[9px]"></i>
                <span class="font-mono text-[9px] font-black text-white">${formattedDistance}</span>
              </div>
              <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl border ${trafficInfo.bgClass}">
                <div class="flex items-center gap-1 text-[8.5px] font-bold" style="color: ${trafficInfo.color}">
                  <i class="fa-solid fa-car text-[9px]"></i>
                  <span class="font-black">~${drivingMinutes} min</span>
                </div>
                <span class="text-slate-600 text-[8px]">|</span>
                <div class="flex items-center gap-1 text-[8.5px] font-bold text-slate-300">
                  <i class="fa-solid fa-person-walking text-[9px] text-slate-400"></i>
                  <span>~${walkingMinutes} min</span>
                </div>
              </div>
            </div>

            <!-- Rodapé com Condição de Tráfego -->
            <div class="text-[6.5px] font-semibold text-slate-400 text-center tracking-wider uppercase pt-0.5 flex items-center justify-center gap-1">
              <i class="fa-solid fa-circle-info text-[7px]" style="color: ${trafficInfo.color};"></i>
              <span>${trafficInfo.description}</span>
            </div>
          </div>
          
          <!-- Ponteiro do Badge -->
          <div class="w-2.5 h-2.5 bg-slate-950 border-r-2 border-b-2 ${trafficInfo.borderClass} rotate-45 mx-auto -mt-1 shadow-md"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    const etaMarker = L.marker([midLat, midLng], {
      icon: etaBadgeIcon,
      zIndexOffset: 2600
    }).addTo(map);

    etaMarker.on('click', () => {
      map.fitBounds([originCoord, destCoord], {
        padding: [70, 70],
        maxZoom: 16
      });
    });

    customRouteEtaMarkerRef.current = etaMarker;

    // Enquadrar rota no mapa suavemente
    map.fitBounds([originCoord, destCoord], {
      padding: [60, 60],
      maxZoom: 16
    });

  }, [isCustomRouteActive, customRoutePoint, userCoords, dangerReports]);

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  return (
    <div 
      className="w-full h-full relative z-[50] transition-all duration-300 ease-out shadow-sm hover:shadow-md rounded-2xl overflow-hidden" 
      id="map-view" 
      data-testid="map-view"
    >
      <div ref={mapContainerRef} className={`w-full h-full z-0 ${isSelectingDestination ? 'cursor-crosshair' : ''}`} id="map-container" />
      
      {/* Banner de instrução interativo quando em modo de seleção de ponto no mapa */}
      {isSelectingDestination && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] bg-slate-950/95 backdrop-blur-md text-white border border-emerald-400/80 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in slide-in-from-top-2 duration-200 pointer-events-auto max-w-sm sm:max-w-md">
          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <i className="fa-solid fa-crosshairs animate-spin text-xs"></i>
          </div>
          <div className="text-left flex-1 min-w-0">
            <span className="text-[9.5px] font-black uppercase text-emerald-300 block leading-tight">Clique no Mapa para Traçar Rota</span>
            <span className="text-[7.5px] text-slate-300 font-medium block leading-tight">Selecione qualquer ponto para calcular distância e tempo estimado.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsSelectingDestination(false)}
            className="w-5 h-5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center text-xs shrink-0 cursor-pointer"
            title="Cancelar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}
      
      {/* Controlo de Geolocalização do Utilizador (Canto Superior Esquerdo) */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-[400] flex flex-col gap-1 pointer-events-auto">
        <button
          id="btn-user-gps-location"
          type="button"
          onClick={handleRecenterOrRequestGps}
          disabled={isLocating}
          className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl shadow-md border transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
            gpsConsentStatus === 'granted' && userCoords
              ? 'bg-white/85 backdrop-blur-md text-slate-800 border-white/70 hover:bg-slate-900 hover:text-white ring-1 ring-black/5'
              : gpsConsentStatus === 'denied'
              ? 'bg-white/85 backdrop-blur-md text-slate-700 border-white/70 hover:border-blue-500 ring-1 ring-black/5'
              : 'bg-emerald-600/90 backdrop-blur-md text-white border-emerald-500 animate-pulse hover:bg-emerald-700 shadow-md'
          }`}
          title={
            gpsConsentStatus === 'granted' && userCoords
              ? `Centrar na sua localização (Precisão: ±${userAccuracy || 0}m)`
              : 'Ativar GPS'
          }
        >
          <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
            gpsConsentStatus === 'granted' && userCoords 
              ? 'bg-emerald-100 text-emerald-600' 
              : 'bg-white/20 text-white'
          }`}>
            {isLocating ? (
              <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
            ) : (
              <i className="fa-solid fa-crosshairs text-[10px]"></i>
            )}
          </div>
          <div className="text-left">
            <span className="text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider block leading-none">
              {isLocating 
                ? 'A obter GPS...' 
                : gpsConsentStatus === 'granted' && userCoords
                ? 'Minha Posição'
                : 'Ativar GPS'}
            </span>
            <span className="text-[7px] font-semibold text-slate-400 block mt-0.5 leading-none">
              {userAccuracy ? `±${userAccuracy}m` : 'Localização'}
            </span>
          </div>
          {gpsConsentStatus === 'granted' && userCoords && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5"></span>
          )}
        </button>

        {locationErrorMessage && (
          <div className="bg-rose-50/90 backdrop-blur-sm border border-rose-200 text-rose-700 text-[8px] font-bold px-2 py-1 rounded-lg shadow-xs max-w-xs animate-in fade-in">
            <i className="fa-solid fa-triangle-exclamation mr-1 text-rose-500"></i>
            {locationErrorMessage}
          </div>
        )}
      </div>

      {/* Barra de Ferramentas Superior Direita Limpa e Compacta com Efeito Semi-Transparente e Espaçamento Otimizado */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-[400] flex flex-col items-end gap-1.5 pointer-events-auto max-w-[calc(100%-115px)] sm:max-w-none">
        <div className="flex items-center gap-1 sm:gap-1.5 bg-white/85 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-white/70 ring-1 ring-black/5">
          {/* Botão de Alternância de Esquadras (5 Mais Próximas) */}
          <button
            id="btn-quick-toggle-police"
            type="button"
            onClick={() => handleTogglePoliceStations()}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider shrink-0 ${
              showPoliceStationsState
                ? 'bg-blue-600 text-white shadow-xs border border-blue-500'
                : 'text-slate-700 hover:bg-slate-100/80'
            }`}
            title={showPoliceStationsState ? 'Ocultar marcadores de Esquadras' : 'Mostrar as 5 Esquadras mais próximas'}
          >
            <i className={`fa-solid fa-shield-halved text-[9px] sm:text-[10px] ${showPoliceStationsState ? 'text-cyan-200' : 'text-blue-600'}`}></i>
            <span className="hidden sm:inline">
              {showPoliceStationsState ? 'Esquadras (5)' : 'Esquadras'}
            </span>
          </button>

          <div className="w-px h-3.5 sm:h-4 bg-gray-200/80"></div>

          {/* Botão de Alternância Direta: Satélite vs. Ruas */}
          <button
            id="btn-quick-toggle-satellite"
            type="button"
            onClick={() => {
              const newStyle = mapTileStyle === 'google_hybrid' ? 'google_streets' : 'google_hybrid';
              handleSetMapTileStyle(newStyle);
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider shrink-0 ${
              mapTileStyle === 'google_hybrid'
                ? 'bg-slate-950/90 text-amber-300 shadow-xs border border-amber-400/40 ring-1 ring-amber-400/20'
                : 'text-slate-700 hover:bg-slate-100/80'
            }`}
            title={mapTileStyle === 'google_hybrid' ? 'Mudar para vista de Ruas' : 'Mudar para vista de Satélite HD (útil para bairros de Maputo)'}
          >
            <i className={`fa-solid ${mapTileStyle === 'google_hybrid' ? 'fa-map text-emerald-400' : 'fa-earth-africa text-blue-500'} text-[9px] sm:text-[10px]`}></i>
            <span className="hidden sm:inline">
              {mapTileStyle === 'google_hybrid' ? 'Satélite Ativo' : 'Ver Satélite'}
            </span>
          </button>

          <div className="w-px h-3.5 sm:h-4 bg-gray-200/80"></div>

          {/* Seletor de Camadas Google Maps Expandido */}
          <div className="relative shrink-0">
            <button
              id="btn-map-tile-style"
              type="button"
              onClick={() => setIsTileSelectorOpen(prev => !prev)}
              className="px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-xl text-slate-700 hover:bg-slate-100/80 transition-all flex items-center gap-0.5 sm:gap-1 cursor-pointer text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider"
              title="Mais camadas do mapa (Relevo, OpenStreetMap, etc.)"
            >
              <i className={`fa-solid ${MAP_TILE_CONFIG[mapTileStyle]?.icon || 'fa-layer-group'} text-slate-500 text-[9px] sm:text-[10px]`}></i>
              <i className="fa-solid fa-chevron-down text-[6.5px] sm:text-[7px] text-gray-400"></i>
            </button>

            {/* Menu Dropdown de Camadas */}
            {isTileSelectorOpen && (
              <div className="absolute right-0 top-9 sm:top-10 w-48 sm:w-52 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-white/70 ring-1 ring-black/5 z-50 text-left space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[7.5px] font-black uppercase text-gray-400 px-2 py-0.5">
                  Camada do Mapa
                </div>

                {(['google_streets', 'google_hybrid', 'google_terrain', 'osm'] as MapTileStyle[]).map((styleKey) => {
                  const cfg = MAP_TILE_CONFIG[styleKey];
                  const isSelected = mapTileStyle === styleKey;
                  return (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => {
                        handleSetMapTileStyle(styleKey);
                        setIsTileSelectorOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-1.5 sm:p-2 rounded-xl text-[8px] sm:text-[8.5px] font-black uppercase transition-all cursor-pointer ${
                        isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'hover:bg-emerald-50/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                        <span>{cfg.label}</span>
                      </div>
                      {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-px h-3.5 sm:h-4 bg-gray-200/80"></div>

          {/* Toggle Esquadras PRM */}
          <button 
            id="btn-police-stations-route"
            type="button"
            onClick={() => {
              if (!isPoliceRouteActive && itemsWithCoords.length > 0 && !selectedItemForRoute) {
                setSelectedItemForRoute(itemsWithCoords[0]);
              }
              setIsPoliceRouteActive(prev => !prev);
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 ${
              isPoliceRouteActive 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-700 hover:bg-slate-100/80'
            }`}
            title="Mostrar rota para a esquadra de polícia mais próxima"
          >
            <i className="fa-solid fa-shield-halved text-blue-500 text-[9px] sm:text-[10px]"></i>
            <span className="hidden sm:inline">Esquadras PRM</span>
          </button>

          <div className="w-px h-3.5 sm:h-4 bg-gray-200/80"></div>

          {/* Toggle Traçar Rota Personalizada */}
          <button 
            id="btn-custom-user-route"
            type="button"
            onClick={() => {
              if (!isCustomRouteActive && !isSelectingDestination) {
                setIsSelectingDestination(true);
                if (gpsConsentStatus !== 'granted') {
                  setShowConsentModal(true);
                } else if (!userCoords) {
                  startHighAccuracyTracking(false);
                }
              } else if (isSelectingDestination) {
                setIsSelectingDestination(false);
              } else {
                setIsCustomRouteActive(false);
                setCustomRoutePoint(null);
                setIsSelectingDestination(false);
              }
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 ${
              isCustomRouteActive
                ? 'bg-emerald-600 text-white shadow-xs'
                : isSelectingDestination
                ? 'bg-amber-500 text-white animate-pulse'
                : 'text-slate-700 hover:bg-slate-100/80'
            }`}
            title="Traçar rota a partir da sua posição para qualquer ponto"
          >
            <i className="fa-solid fa-route text-emerald-600 text-[9px] sm:text-[10px]"></i>
            <span className="hidden sm:inline">{isCustomRouteActive ? 'Rota Ativa' : 'Traçar Rota'}</span>
          </button>

          <div className="w-px h-3.5 sm:h-4 bg-gray-200/80"></div>

          {/* Botões de Zoom Integrados */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg hover:bg-slate-100/80 text-slate-700 flex items-center justify-center text-[10px] sm:text-xs font-bold cursor-pointer transition-all"
              title="Aproximar mapa (+)"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg hover:bg-slate-100/80 text-slate-700 flex items-center justify-center text-[10px] sm:text-xs font-bold cursor-pointer transition-all"
              title="Afastar mapa (-)"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
          </div>
        </div>

        {/* Card Informativo Flutuante de Rota Personalizada */}
        {isCustomRouteActive && customRouteCalculations && (
          <div className="bg-white/85 backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl shadow-xl border border-emerald-200/80 ring-1 ring-emerald-500/10 w-64 sm:w-72 text-left animate-in slide-in-from-top-2 duration-200 space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-emerald-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                  <i className="fa-solid fa-flag-checkered"></i>
                </div>
                <div>
                  <h4 className="font-black text-[10px] uppercase text-emerald-950 truncate max-w-[170px] leading-tight">
                    Rota para Destino
                  </h4>
                  <span className="text-[7px] font-bold text-emerald-600 uppercase">Ponto Selecionado</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustomRouteActive(false);
                  setCustomRoutePoint(null);
                }}
                className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-[9px] cursor-pointer"
                title="Fechar rota"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Estatísticas de Rota */}
            <div className="grid grid-cols-3 gap-1 text-center">
              <div className="bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
                <span className="text-[6px] font-black uppercase text-emerald-700 block">Distância</span>
                <span className="text-[10px] font-black text-emerald-950 font-mono">
                  {customRouteCalculations.formattedDistance}
                </span>
              </div>
              <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
                <span className="text-[6px] font-black uppercase text-slate-500 block">Carro</span>
                <span className="text-[10px] font-black text-slate-900 font-mono">
                  ~{customRouteCalculations.drivingMinutes} min
                </span>
              </div>
              <div className="bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/80">
                <span className="text-[6px] font-black uppercase text-slate-500 block">A Pé</span>
                <span className="text-[10px] font-black text-slate-900 font-mono">
                  ~{customRouteCalculations.walkingMinutes} min
                </span>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => setIsSelectingDestination(true)}
                className="flex-1 bg-slate-100/90 hover:bg-slate-200/90 text-slate-800 py-1.5 px-2 rounded-xl text-[7.5px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-crosshairs text-[8px]"></i>
                <span>Mudar Ponto</span>
              </button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${customRouteCalculations.originCoord[0]},${customRouteCalculations.originCoord[1]}&destination=${customRouteCalculations.destCoord[0]},${customRouteCalculations.destCoord[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2 rounded-xl text-[7.5px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
              >
                <i className="fa-solid fa-diamond-turn-right text-[8px]"></i>
                <span>Google Maps</span>
              </a>
            </div>
          </div>
        )}

        {/* Card Informativo Flutuante de Rota da Esquadra */}
        {isPoliceRouteActive && nearestPoliceStation && activeRouteItem && (
          <div className="bg-white/85 backdrop-blur-xl p-2.5 sm:p-3 rounded-2xl shadow-xl border border-blue-200/80 ring-1 ring-blue-500/10 w-64 sm:w-72 text-left animate-in slide-in-from-top-2 duration-200 space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5 border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <h4 className="font-black text-[9.5px] uppercase text-blue-950 truncate max-w-[170px] leading-tight">
                    {nearestPoliceStation.name}
                  </h4>
                  <span className="text-[7px] font-bold text-gray-400 uppercase">Esquadra Mais Próxima</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPoliceRouteActive(false)}
                className="w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-[9px] cursor-pointer"
                title="Fechar rota"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="bg-blue-50/70 p-1.5 rounded-lg border border-blue-100">
                <span className="text-[6px] font-black uppercase text-blue-600 block">Distância</span>
                <span className="text-[10px] font-black text-blue-900 font-mono">
                  {nearestPoliceStation.distance.toFixed(2)} km
                </span>
              </div>
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="text-[6px] font-black uppercase text-slate-500 block">Tempo Estimado</span>
                <span className="text-[10px] font-black text-slate-900 font-mono">
                  ~{Math.max(1, Math.round(nearestPoliceStation.distance * 2.5 * (activeRouteTrafficInfo?.delayMultiplier || 1.0)))} min
                </span>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {nearestPoliceStation.phone && (
                <a
                  href={`tel:${nearestPoliceStation.phone}`}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-[#fce100] py-1.5 px-2 rounded-xl text-[7.5px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-all"
                >
                  <i className="fa-solid fa-phone text-[8px]"></i>
                  <span>Ligar PRM</span>
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${activeRouteItem.latitude},${activeRouteItem.longitude}&destination=${nearestPoliceStation.lat},${nearestPoliceStation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded-xl text-[7.5px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-all"
              >
                <i className="fa-solid fa-diamond-turn-right text-[8px]"></i>
                <span>Navegar</span>
              </a>
            </div>
          </div>
        )}

        {/* Painel de Pré-visualização Lateral (Bottom Sheet) para Itens Agrupados no Cluster */}
        {selectedClusterData && (
          <div 
            id="cluster-preview-bottom-sheet"
            className="absolute bottom-0 left-0 right-0 sm:bottom-3 sm:left-3 sm:right-auto sm:w-[400px] max-h-[82%] sm:max-h-[88%] z-[500] bg-white/95 backdrop-blur-md rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 sm:slide-in-from-left-4 duration-200 pointer-events-auto text-left"
          >
            {/* Barra de arrasto no mobile */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-2 mb-1 sm:hidden"></div>

            {/* Cabeçalho do Agrupamento */}
            <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-gradient-to-r from-[#0f224a] via-[#153268] to-[#008fe2] text-white shrink-0">
              <div 
                className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                onClick={handlePanToCluster}
                title="Clique para centralizar a câmara no grupo destacado no mapa"
              >
                <div className="relative w-8 h-8 rounded-2xl bg-gradient-to-br from-[#008fe2] to-[#153268] border-2 border-white/50 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  {selectedClusterData.count}
                  {/* Ponto indicativo de destaque ativo no mapa */}
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#fce100] border border-slate-950 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-[#fce100]">
                      Agrupamento de Itens
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-amber-400/20 text-[#fce100] border border-amber-400/30 text-[6.5px] font-black tracking-wide uppercase">
                      <i className="fa-solid fa-location-dot text-[6.5px] text-[#fce100]"></i>
                      Destacado no Mapa
                    </span>
                  </div>
                  <h4 className="font-black text-xs uppercase leading-tight truncate text-white group-hover:text-[#fce100] transition-colors">
                    {selectedClusterData.clusterLabel || 'Zona Agrupada'}
                  </h4>
                  <span className="text-[7px] font-bold text-slate-300">
                    {selectedClusterData.items.length} {selectedClusterData.items.length === 1 ? 'artigo agrupado' : 'artigos agrupados nesta zona'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePanToCluster}
                  className="bg-amber-400/20 hover:bg-amber-400/30 text-[#fce100] px-2 py-1 rounded-xl text-[7.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-amber-400/40 shadow-xs"
                  title="Centrar e focar grupo destacado no mapa"
                >
                  <i className="fa-solid fa-bullseye text-[8px] animate-pulse"></i>
                  <span className="hidden xs:inline">Focar Grupo</span>
                </button>

                <button
                  type="button"
                  onClick={handleZoomIntoCluster}
                  className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-xl text-[7.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-white/10"
                  title="Aproximar mapa para esta zona"
                >
                  <i className="fa-solid fa-magnifying-glass-plus text-[8px] text-[#fce100]"></i>
                  <span className="hidden xs:inline">Aproximar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedClusterData(null)}
                  className="w-6 h-6 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer border border-white/10"
                  title="Fechar painel de itens"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Barra de Pesquisa Rápida e Filtros dentro do Cluster */}
            <div className="p-2 bg-slate-50 border-b border-slate-200 space-y-1.5 shrink-0">
              {/* Campo de Busca */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                <input 
                  type="text"
                  value={clusterSearchQuery}
                  onChange={(e) => setClusterSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome, categoria ou local..."
                  className="w-full pl-7 pr-6 py-1 bg-white border border-slate-200 rounded-xl text-[9px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#008fe2]"
                />
                {clusterSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setClusterSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px]"
                  >
                    <i className="fa-solid fa-circle-xmark"></i>
                  </button>
                )}
              </div>

              {/* Chips de Filtro */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setClusterFilter('ALL')}
                  className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                    clusterFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  Todos ({clusterCounts.total})
                </button>

                {clusterCounts.lost > 0 && (
                  <button
                    type="button"
                    onClick={() => setClusterFilter('LOST')}
                    className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                      clusterFilter === 'LOST'
                        ? 'bg-[#d21034] text-white shadow-xs'
                        : 'bg-white text-[#d21034] hover:bg-rose-50 border border-rose-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d21034]"></span>
                    Perdidos ({clusterCounts.lost})
                  </button>
                )}

                {clusterCounts.found > 0 && (
                  <button
                    type="button"
                    onClick={() => setClusterFilter('FOUND')}
                    className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                      clusterFilter === 'FOUND'
                        ? 'bg-[#009739] text-white shadow-xs'
                        : 'bg-white text-[#009739] hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#009739]"></span>
                    Achados ({clusterCounts.found})
                  </button>
                )}

                {clusterCounts.reunited > 0 && (
                  <button
                    type="button"
                    onClick={() => setClusterFilter('REUNITED')}
                    className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                      clusterFilter === 'REUNITED'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Recuperados ({clusterCounts.reunited})
                  </button>
                )}
              </div>
            </div>

            {/* Lista Rolável de Itens do Agrupamento */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-slate-100 max-h-[300px] sm:max-h-[360px]">
              {filteredClusterItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400 space-y-1.5">
                  <i className="fa-solid fa-folder-open text-xl text-slate-300"></i>
                  <p className="text-[10px] font-bold text-slate-600">Nenhum artigo encontrado com este filtro</p>
                  <button
                    type="button"
                    onClick={() => {
                      setClusterFilter('ALL');
                      setClusterSearchQuery('');
                    }}
                    className="text-[8px] font-black uppercase text-[#008fe2] hover:underline cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                </div>
              ) : (
                filteredClusterItems.map((clusterItem) => {
                  const isItemLost = clusterItem.status === ItemStatus.LOST || clusterItem.status === ItemStatus.STOLEN;
                  const isItemReunited = clusterItem.status === ItemStatus.REUNITED;
                  const isItemFound = clusterItem.status === ItemStatus.FOUND || clusterItem.status === ItemStatus.IN_TRANSIT;
                  const fallbackThumb = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400&auto=format&fit=crop&q=80';
                  const thumbUrl = clusterItem.imageUrl || (clusterItem.imageUrls && clusterItem.imageUrls[0]) || fallbackThumb;

                  return (
                    <div 
                      key={clusterItem.id} 
                      className="pt-2 first:pt-0 bg-white hover:bg-slate-50/90 p-2 rounded-xl border border-slate-150 shadow-2xs transition-all space-y-1.5"
                    >
                      <div className="flex items-start gap-2">
                        {/* Imagem Thumbnail */}
                        <div 
                          className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200 cursor-pointer group"
                          onClick={() => onViewDetails(clusterItem)}
                        >
                          <img 
                            src={thumbUrl} 
                            alt={clusterItem.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e: any) => { e.target.src = fallbackThumb; }}
                          />
                          <span className={`absolute bottom-0 inset-x-0 text-[6px] font-black uppercase text-center py-0.2 text-white ${
                            isItemReunited ? 'bg-emerald-600' : isItemFound ? 'bg-[#009739]' : 'bg-[#d21034]'
                          }`}>
                            {isItemReunited ? 'Recuperado' : isItemFound ? 'Achado' : 'Perdido'}
                          </span>
                        </div>

                        {/* Conteúdo do Item */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-start justify-between gap-1">
                            <h5 
                              onClick={() => onViewDetails(clusterItem)}
                              className="font-black text-[11px] text-slate-900 hover:text-[#008fe2] leading-tight line-clamp-1 cursor-pointer"
                              title={clusterItem.title}
                            >
                              {clusterItem.title}
                            </h5>

                            {clusterItem.reward ? (
                              <span className="text-[7px] font-black uppercase bg-[#fce100] text-slate-950 px-1 py-0.2 rounded shadow-2xs shrink-0 border border-amber-300">
                                {clusterItem.reward.toLocaleString()} MT
                              </span>
                            ) : null}
                          </div>

                          {/* Categoria & Localização */}
                          <div className="flex items-center gap-1.5 text-[7.5px] text-slate-500 font-bold">
                            <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded uppercase">
                              {clusterItem.category}
                            </span>
                            <span className="truncate flex items-center gap-0.5 text-slate-600">
                              <i className="fa-solid fa-location-dot text-[#008fe2] text-[6.5px]"></i>
                              {clusterItem.location || clusterItem.province || 'Moçambique'}
                            </span>
                          </div>

                          {/* Descrição resumida */}
                          {clusterItem.description && (
                            <p className="text-[8px] text-slate-500 font-medium line-clamp-1 italic">
                              "{clusterItem.description}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ação do Item */}
                      <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => onViewDetails(clusterItem)}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-[#fce100] py-1 px-1.5 rounded-lg text-[7px] font-black uppercase tracking-wider text-center flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <i className="fa-solid fa-eye text-[7px]"></i>
                          <span>Detalhes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFocusClusterItemOnMap(clusterItem)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 px-1.5 rounded-lg text-[7px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200"
                          title="Centrar e focar este item no mapa"
                        >
                          <i className="fa-solid fa-crosshairs text-[8px] text-[#008fe2]"></i>
                          <span>Centrar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItemForRoute(clusterItem);
                            setIsPoliceRouteActive(true);
                          }}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-1 px-1.5 rounded-lg text-[7px] font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer border border-blue-200"
                          title="Traçar rota até à esquadra mais próxima"
                        >
                          <i className="fa-solid fa-shield-halved text-[8px]"></i>
                          <span>PRM</span>
                        </button>

                        {onAction && (
                          <button
                            type="button"
                            onClick={() => onAction(clusterItem)}
                            className={`py-1 px-1.5 rounded-lg text-[7px] font-black uppercase tracking-wider text-white transition-all flex items-center justify-center gap-0.5 cursor-pointer ${
                              isItemLost
                                ? 'bg-[#009739] hover:bg-[#008632]'
                                : 'bg-[#d21034] hover:bg-[#b80e2d]'
                            }`}
                          >
                            <span>{isItemLost ? 'Achei!' : 'É Meu!'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé Informativo */}
            <div className="p-1.5 bg-slate-50 border-t border-slate-200 text-center shrink-0">
              <span className="text-[7px] font-bold text-slate-400">
                O grupo selecionado está destacado no mapa. Toque em "Focar Grupo" para centrar.
              </span>
            </div>
          </div>
        )}
      </div>
      
      {onAddPinClick && (
        <div className="absolute bottom-3 right-3 z-[400] pointer-events-auto">
          <button 
            onClick={onAddPinClick}
            className="bg-gradient-to-r from-[#008fe2] to-[#153268] hover:opacity-95 text-white px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all border border-white/20 cursor-pointer text-[9px] font-black uppercase tracking-wider"
            title="Publicar item com geolocalização"
          >
            <i className="fa-solid fa-plus-circle text-xs"></i>
            <span>Publicar</span>
          </button>
        </div>
      )}

      {/* Legenda do Mapa Compacta, Unificada e Não-Obstrutiva (Canto Inferior Esquerdo) */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-auto">
        <div className="bg-slate-950/85 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/10 shadow-lg flex items-center gap-3 text-[8.5px] font-bold">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#d21034]"></span>
            <span className="text-slate-200">Perdidos</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#009739]"></span>
            <span className="text-slate-200">Achados</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-200">Recuperados</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-900 border border-blue-400 flex items-center justify-center text-[6px] text-[#fce100]">
              <i className="fa-solid fa-shield-halved"></i>
            </span>
            <span className="text-blue-300">PRM</span>
          </span>
        </div>
      </div>

      {/* Modal de Consentimento de Localização Exata com Intenção Clara */}
      {showConsentModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-150 text-left space-y-4 animate-in zoom-in-95 duration-200">
            {/* Cabeçalho do Modal */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
                <i className="fa-solid fa-location-crosshairs animate-pulse"></i>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">
                  Consentimento e Privacidade
                </span>
                <h3 className="text-base font-black uppercase text-slate-900 leading-tight">
                  Autorização de Localização Exata
                </h3>
              </div>
            </div>

            {/* Texto Explicativo e Garantias */}
            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="font-semibold text-slate-800">
                Para que o mapa posicione com exatidão a sua área e calcule distâncias reais até aos artigos perdidos e achados, necessitamos do seu consentimento expresso.
              </p>
              
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2 text-[11px] text-slate-700">
                  <i className="fa-solid fa-circle-check text-emerald-600 text-xs mt-0.5 shrink-0"></i>
                  <span><strong>Posicionamento Real:</strong> Centralização no mapa e medição de proximidade em metros e quilómetros.</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-700">
                  <i className="fa-solid fa-shield-halved text-blue-600 text-xs mt-0.5 shrink-0"></i>
                  <span><strong>Segurança & PRM:</strong> Traçado de rotas e tempos de percurso até ao Posto Policial mais próximo.</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] text-slate-700">
                  <i className="fa-solid fa-lock text-slate-600 text-xs mt-0.5 shrink-0"></i>
                  <span><strong>Privacidade Local:</strong> O sinal GPS é processado no seu dispositivo e não é partilhado indevidamente.</span>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={handleAcceptLocationConsent}
                className="flex-1 bg-gradient-to-r from-[#008fe2] to-[#153268] hover:opacity-95 active:scale-98 text-white py-3.5 px-4 rounded-2xl font-bold uppercase tracking-wider text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-satellite-dish text-xs"></i>
                <span>Sim, Autorizar Localização</span>
              </button>

              <button
                type="button"
                onClick={handleDeclineLocationConsent}
                className="bg-gray-100 hover:bg-gray-200 active:scale-98 text-slate-700 py-3.5 px-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all cursor-pointer text-center"
              >
                Usar Padrão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;

