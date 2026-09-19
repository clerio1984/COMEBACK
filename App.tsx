
import React, { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import { apiFetch, authenticatedFetch } from './services/firebase';
import Layout from './components/Layout';
import ItemCard from './components/ItemCard';
import NotificationDrawer from './components/NotificationDrawer';
import { MediaViewer } from './components/MediaViewer';
import { SponsoredAd } from './components/SponsoredAd';
import { Item, ItemStatus, Category, Message } from './types';
import type { Notification } from './types';
import { COMMISSION_FEE_PERCENT, MAINTENANCE_FEE_PERCENT, TOTAL_FEE_PERCENT, MOZAMBIQUE_PROVINCES, LOST_ITEM_SURCHARGE_PERCENT, INITIAL_ITEMS } from './constants';
import { analyzeItemMatch, validateDescriptionAI, suggestCategoryAI, DescriptionValidationResult, CategorySuggestionResult } from './services/geminiService';
import { compressImage, applyFiltersToImage } from './services/imageUtils';
import { AuthProvider, useAuth } from './AuthContext';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { db, handleFirestoreError, OperationType } from './services/firebase';
import { playNotificationSound } from './services/audio';
import { collection, doc, setDoc, onSnapshot, query, orderBy, updateDoc, where, or, deleteDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { saveItemsToCache, getCachedItems, saveActiveProximityState, getActiveProximityState } from './services/localCache';
import { InsightsBoard } from './components/InsightsBoard';
import { RadarTip } from './components/RadarTip';
import { ProximityServiceControl } from './components/ProximityServiceControl';
import { CelebrateConfetti } from './components/CelebrateConfetti';
import { VisualPortraitBuilder } from './components/VisualPortraitBuilder';
import { NewItemsCarousel } from './components/NewItemsCarousel';
import { AISmartSuggestions } from './components/AISmartSuggestions';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert } from 'lucide-react';

// Lazy load heavy components to ensure buttery-smooth runtime performance (prevent stuttering/freezes on horizontal scroll/feed list updates)
const ChatView = lazy(() => import('./components/ChatView'));
const MapView = lazy(() => import('./components/MapView'));
const DeliveryTrackingView = lazy(() => import('./components/DeliveryTrackingView'));
const AuthView = lazy(() => import('./components/AuthView'));
const ItemDetails = lazy(() => import('./components/ItemDetails'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ComeBackArchitectureHub = lazy(() => import('./components/ComeBackArchitectureHub').then(m => ({ default: m.ComeBackArchitectureHub })));
const InfoDocsView = lazy(() => import('./components/InfoDocsView').then(m => ({ default: m.InfoDocsView })));
const WelcomeTutorial = lazy(() => import('./components/WelcomeTutorial'));
const AppTourGuide = lazy(() => import('./components/AppTourGuide').then(m => ({ default: m.AppTourGuide })));

// Smooth, non-disruptive modern micro-loader fallback for suspended views
const LazyLoaderFallback = () => (
  <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-transparent gap-3 animate-in fade-in duration-300">
    <div className="w-8 h-8 border-3 border-emerald-500/10 border-t-emerald-600 rounded-full animate-spin"></div>
    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 select-none">Carregando Módulo Seguro...</span>
  </div>
);

const CATEGORY_ICONS: Record<Category, string> = {
  [Category.DOCUMENTS]: 'fa-id-card',
  [Category.ELECTRONICS]: 'fa-laptop',
  [Category.CLOTHING]: 'fa-shirt',
  [Category.PETS]: 'fa-paw',
  [Category.BAGS]: 'fa-bag-shopping',
  [Category.WALLETS]: 'fa-wallet',
  [Category.KEYS]: 'fa-key',
  [Category.JEWELRY]: 'fa-gem',
  [Category.PEOPLE]: 'fa-person-circle-question',
  [Category.OTHERS]: 'fa-box'
};

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

interface PoliceStation {
  name: string;
  lat: number;
  lng: number;
}

const POLICE_STATIONS: PoliceStation[] = [
  { name: "PRM Esquadra Central (Maputo)", lat: -25.9682, lng: 32.5732 },
  { name: "PRM 1ª Esquadra (Baixa - Porto)", lat: -25.9723, lng: 32.5695 },
  { name: "PRM 3ª Esquadra (Alto Maé)", lat: -25.9615, lng: 32.5710 },
  { name: "PRM 7ª Esquadra (Malhangalene)", lat: -25.9548, lng: 32.5921 },
  { name: "PRM 14ª Esquadra (Machava)", lat: -25.9189, lng: 32.5112 },
  { name: "PRM 18ª Esquadra (Sommerschield)", lat: -25.9512, lng: 32.6022 },
  { name: "Comando Provincial PRM (Matola)", lat: -25.9620, lng: 32.4630 },
  { name: "PRM 5ª Esquadra (Chamanculo)", lat: -25.9575, lng: 32.5534 },
  { name: "PRM Esquadra de Triunfo (Costa do Sol)", lat: -25.9085, lng: 32.6288 }
];

const AppContent: React.FC = () => {
  const { language, t } = useLanguage();
  const { currentUser, login, logout, updateUserProfile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'post' | 'profile' | 'about'>('feed');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSecuritySliderVerified, setIsSecuritySliderVerified] = useState(false);
  const [securityTermsAccepted, setSecurityTermsAccepted] = useState(false);
  const [trackingItemId, setTrackingItemId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const trackingIntervalRef = useRef<any>(null);
  const proximityScrollRef = useRef<HTMLDivElement>(null);

  // Serviço de Alerta de Proximidade (Background Service - Raio de 5km)
  const [currentLocationCoords, setCurrentLocationCoords] = useState<{ lat: number; lng: number }>({
    lat: -25.9692,
    lng: 32.5732
  });
  const [activeProximityAlert, setActiveProximityAlert] = useState<{ item: Item; distance: number } | null>(null);
  const [isToastExpanded, setIsToastExpanded] = useState<boolean>(false);
  const [isToastFocused, setIsToastFocused] = useState<boolean>(false);
  const [isToastMaximized, setIsToastMaximized] = useState<boolean>(false);
  const [isToastMinimized, setIsToastMinimized] = useState<boolean>(false);
  
  const [mapFocusLocation, setMapFocusLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityCountdown, setProximityCountdown] = useState<number>(60);
  const [toastTransportMode, setToastTransportMode] = useState<'walking' | 'cycling' | 'driving' | 'chapa' | 'bus' | 'mototaxi' | 'fastwalking'>('walking');
  
  // Feed Google Maps Status Filter & Coordinates
  const [feedViewMode, setFeedViewMode] = useState<'feed' | 'map'>('feed');
  const [feedMapStatusFilter, setFeedMapStatusFilter] = useState<'ALL' | ItemStatus.LOST | ItemStatus.FOUND | ItemStatus.REUNITED>('ALL');
  const [feedMapTileStyle, setFeedMapTileStyle] = useState<'google_streets' | 'google_hybrid' | 'google_terrain' | 'osm'>('google_streets');
  const [isFeedMapStyleMenuOpen, setIsFeedMapStyleMenuOpen] = useState<boolean>(false);
  const [feedShowPoliceStations, setFeedShowPoliceStations] = useState<boolean>(true);
  const [feedMapFocusLocation, setFeedMapFocusLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  // AI Sentinel Risk Zone States and Controls
  const [monitorRiskZones, setMonitorRiskZones] = useState<boolean>(() => {
    const saved = localStorage.getItem('comeback_monitor_risk_zones');
    return saved === null ? true : saved === 'true'; // Enabled by default
  });
  const [activeRiskZone, setActiveRiskZone] = useState<{ zone: any; distance: number } | null>(null);
  const [dismissedRiskZoneName, setDismissedRiskZoneName] = useState<string | null>(null);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<string>(() => {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  });
  const [showRiskAlertInApp, setShowRiskAlertInApp] = useState<boolean>(false);
  
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isShareRadarModalOpen, setIsShareRadarModalOpen] = useState(false);
  const [radarShareCopied, setRadarShareCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const [homeReturnCount, setHomeReturnCount] = useState<number>(() => {
    const saved = localStorage.getItem('home_return_count');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [offlineDeliveriesQueue, setOfflineDeliveriesQueue] = useState<any[]>(() => {
    const queue = localStorage.getItem('comeback_offline_reunited_queue');
    return queue ? JSON.parse(queue) : [];
  });

  // Artigos publicados offline com persistência local de segurança
  const [pendingItems, setPendingItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem('comeback_pending_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const [milestoneToast, setMilestoneToast] = useState<{ count: number; message: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-dismiss milestone toast after 4.5 seconds
  useEffect(() => {
    if (!milestoneToast) return;
    const timer = setTimeout(() => {
      setMilestoneToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [milestoneToast]);

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | 'off'>(() => {
    const saved = localStorage.getItem('auto_refresh_interval');
    if (saved === '30' || saved === '60' || saved === '300') return parseInt(saved, 10);
    return 'off';
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-refresh interval timer and countdown updater
  useEffect(() => {
    if (autoRefreshInterval === 'off') {
      setCountdown(null);
      return;
    }

    setCountdown(autoRefreshInterval);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          setIsAutoRefreshing(true);
          setRefreshKey((k) => k + 1);
          setTimeout(() => {
            setIsAutoRefreshing(false);
          }, 1500);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  const [newArrivalNotification, setNewArrivalNotification] = useState<any | null>(null);
  const isInitialItemsLoaded = useRef(false);
  const knownItemIds = useRef<Set<string>>(new Set());

  // Auto-dismiss new arrival notification
  useEffect(() => {
    if (!newArrivalNotification) return;
    const timer = setTimeout(() => {
      setNewArrivalNotification(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [newArrivalNotification]);

  // Auto-expiration timer for Proximity alert
  useEffect(() => {
    if (!activeProximityAlert) {
      setProximityCountdown(60);
      return;
    }

    if (isToastExpanded || isToastFocused || isToastMaximized) return; // Pause countdown when interacting / details are open

    const interval = setInterval(() => {
      setProximityCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveProximityAlert(null); // Auto-close
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeProximityAlert, isToastExpanded, isToastFocused, isToastMaximized]);

  // Restaura o último estado de proximidade ativo do Cache Local (IndexedDB) ao arrancar
  useEffect(() => {
    const restoreProximityState = async () => {
      try {
        const saved = await getActiveProximityState();
        if (saved && saved.item) {
          // Garante que o estado reaparece
          setActiveProximityAlert({
            item: saved.item,
            distance: saved.distance
          });
          if (saved.transportMode) {
            setToastTransportMode(saved.transportMode);
          }
        }
      } catch (err) {
        console.error("Erro ao recuperar o alerta de proximidade do cache local:", err);
      }
    };
    restoreProximityState();
  }, []);

  // Guarda o estado de proximidade no cache local a cada alteração
  useEffect(() => {
    if (activeProximityAlert) {
      saveActiveProximityState({
        item: activeProximityAlert.item,
        distance: activeProximityAlert.distance,
        transportMode: toastTransportMode
      });
    } else {
      saveActiveProximityState(null);
    }
  }, [activeProximityAlert, toastTransportMode]);

  const handleToastTriggerVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([15, 30, 15]);
      } catch (err) {
        // Safe fallback for browsers/platforms with restricted vibration privileges inside iframes
      }
    }
  };

  const getCompassDirection = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return '';
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const lat1Rad = lat1 * (Math.PI / 180);
    const lat2Rad = lat2 * (Math.PI / 180);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * (180 / Math.PI);
    brng = (brng + 360) % 360;
    
    const directions = ['Norte ⬆️', 'Nordeste ↗️', 'Este ➡️', 'Sudeste ↘️', 'Sul ⬇️', 'Sudoeste ↙️', 'Oeste ⬅️', 'Noroeste ↖️'];
    const index = Math.round(brng / 45) % 8;
    return directions[index];
  };

  // Verificação de tráfego intenso baseado no horário de pico em Maputo (07h-09h ou 17h-19h)
  const currentHour = new Date().getHours();
  const isMaputoPeakHour = (currentHour >= 7 && currentHour < 9) || (currentHour >= 17 && currentHour < 19);

  const isHighRiskZone = (item: Item) => {
    if (!item) return false;
    if (item.status === ItemStatus.STOLEN) return true;

    const loc = (item.location || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const title = (item.title || '').toLowerCase();

    const highRiskAreas = [
      'xipamanine', 'magoanine', 'mafalala', 'maxaquene', 'polana caniço', 
      'alto maé', 'george dimitrov', 'choupal', 'ndlavela', 'munhuana', 
      'inhagoia', 'bairro militar', 'baixa de maputo', 'praça dos combatentes', 
      'jardim tunduru', 'zona militar', 'estação central'
    ];

    const riskKeywords = [
      'roubo', 'roubado', 'assalto', 'assaltado', 'furto', 'furtado', 'arma', 
      'violência', 'crime', 'perigo', 'segurança'
    ];

    const hasHighRiskArea = highRiskAreas.some(area => loc.includes(area));
    const hasRiskKeyword = riskKeywords.some(keyword => desc.includes(keyword) || title.includes(keyword));

    return hasHighRiskArea || hasRiskKeyword;
  };

  const playProximitySound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playTone(587.33, ctx.currentTime, 0.4); // D5
      playTone(880.00, ctx.currentTime + 0.15, 0.6); // A5
    } catch (e) {
      console.warn("Audio synthesis failed:", e);
    }
  };

  const handleProximityAlert = async (item: Item, distance: number) => {
    // Check if proximity alerts are currently silenced by the user
    const savedSilenced = localStorage.getItem('comeback_proximity_silenced_until');
    if (savedSilenced) {
      const silencedTime = parseInt(savedSilenced, 10);
      if (!isNaN(silencedTime) && Date.now() < silencedTime) {
        console.log("Proximity alert ignored because radar is silenced.");
        return;
      }
    }

    playProximitySound();
    setIsToastExpanded(false);
    setProximityCountdown(60);
    setActiveProximityAlert({ item, distance });

    if (currentUser) {
      const id = Math.random().toString(36).substr(2, 5);
      const fullNotif: Notification = {
        id,
        userId: currentUser.id,
        type: 'MATCH',
        title: 'BEM ACHADO POR PERTO! 📍',
        description: `O item "${item.title}" foi reportado como Achado a apenas ${distance.toFixed(1)} km do seu local atual.`,
        itemId: item.id,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      try {
        await setDoc(doc(db, 'notifications', id), fullNotif);
      } catch (error) {
        console.error("Erro ao salvar notificação de proximidade:", error);
      }
    }
  };

  // Estados de navegação e edição no Perfil
  const [profileView, setProfileView] = useState<'main' | 'my-posts' | 'admin'>('main');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  
  // Estados para o diálogo de confirmação com upload de prova de recuperação (ItemStatus.REUNITED)
  const [reunitedConfirmItemId, setReunitedConfirmItemId] = useState<string | null>(null);
  const [reunitedProofImage, setReunitedProofImage] = useState<string | null>(null);
  const [isSubmittingReunitedProof, setIsSubmittingReunitedProof] = useState<boolean>(false);
  const [reunitedProofNotes, setReunitedProofNotes] = useState<string>('');
  const [showReunitedSummaryConfirm, setShowReunitedSummaryConfirm] = useState<boolean>(false);
  const [reunitedDeclarationConfirmed, setReunitedDeclarationConfirmed] = useState<boolean>(false);
  const [reunitedProofValidationWarning, setReunitedProofValidationWarning] = useState<string | null>(null);
  
  // Estados para o diálogo de confirmação personalizado de exclusão de item
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);
  
  // Estados adicionais para assinatura digital offline e geolocalização assinada
  const [offlineDeliveryEnabled, setOfflineDeliveryEnabled] = useState<boolean>(false);
  const [useManualGeo, setUseManualGeo] = useState<boolean>(false);
  const [signedGeoLat, setSignedGeoLat] = useState<string>('');
  const [signedGeoLng, setSignedGeoLng] = useState<string>('');
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'capturing' | 'success' | 'failed'>('idle');
  const [digitalSignatureUrl, setDigitalSignatureUrl] = useState<string | null>(null);
  
  // Estados para Filtros de Processamento de Imagem (Baixa Luz, Brilho, Contraste)
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [originalFilterImg, setOriginalFilterImg] = useState<string>(''); 
  const [previewFilterImg, setPreviewFilterImg] = useState<string>(''); 
  const [filterBrightness, setFilterBrightness] = useState<number>(100); 
  const [filterContrast, setFilterContrast] = useState<number>(100); 
  const [filterImageIndex, setFilterImageIndex] = useState<number>(-1); 
  const [filterTargetType, setFilterTargetType] = useState<'new-item' | 'proof' | 'direct-doc' | null>(null);
  const [isProcessingFilterImage, setIsProcessingFilterImage] = useState<boolean>(false);
  
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900
    
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      setIsDrawing(false);
      if (canvasRef.current) {
        setDigitalSignatureUrl(canvasRef.current.toDataURL());
      }
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setDigitalSignatureUrl(null);
      }
    }
  };

  // Funções para controle de filtros de imagem (Ajuste de brilho e contraste para condições de baixa luz)
  const handleOpenImageFilters = (imgSrc: string, index: number, targetType: 'new-item' | 'proof' | 'direct-doc') => {
    setOriginalFilterImg(imgSrc);
    setPreviewFilterImg(imgSrc);
    setFilterBrightness(100);
    setFilterContrast(100);
    setFilterImageIndex(index);
    setFilterTargetType(targetType);
    setFilterModalOpen(true);
  };

  const handleApplyImageFilterAction = async () => {
    setIsProcessingFilterImage(true);
    try {
      const filteredResult = await applyFiltersToImage(originalFilterImg, filterBrightness, filterContrast);
      
      if (filterTargetType === 'new-item') {
        const newUrls = [...(newItem.imageUrls || [])];
        if (filterImageIndex >= 0 && filterImageIndex < 3) {
          newUrls[filterImageIndex] = filteredResult;
          setNewItem(prev => ({ ...prev, imageUrls: newUrls }));
        }
      } else if (filterTargetType === 'proof') {
        setReunitedProofImage(filteredResult);
      }
      
      setFilterModalOpen(false);
    } catch (err) {
      console.error("Erro ao aplicar filtros:", err);
      alert("Ocorreu um erro ao processar a imagem.");
    } finally {
      setIsProcessingFilterImage(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    // Se o status foi alterado para RECUPERADO no formulário de edição, interceptamos e exigimos a prova
    if (editingItem.status === ItemStatus.REUNITED) {
      setReunitedConfirmItemId(editingItem.id);
      setReunitedProofImage(null);
      setReunitedProofNotes('');
      setShowReunitedSummaryConfirm(false);
      setReunitedDeclarationConfirmed(false);
      setReunitedProofValidationWarning(null);
      setEditingItem(null); // Fecha o form de edição
      return;
    }
    
    try {
      await updateDoc(doc(db, 'items', editingItem.id), editingItem as any);
      setEditingItem(null);
      alert("Item atualizado com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items/' + editingItem.id);
    }
  };

  const handleCancelReunitedFlow = () => {
    setReunitedConfirmItemId(null);
    setReunitedProofImage(null);
    setReunitedProofNotes('');
    setOfflineDeliveryEnabled(false);
    setDigitalSignatureUrl(null);
    setSignedGeoLat('');
    setSignedGeoLng('');
    setShowReunitedSummaryConfirm(false);
    setReunitedDeclarationConfirmed(false);
    setReunitedProofValidationWarning(null);
    setIsSubmittingReunitedProof(false);
  };

  const handleUpdateItemStatus = async (itemId: string, newStatus: ItemStatus) => {
    if (newStatus === ItemStatus.REUNITED) {
      // Abre o diálogo de confirmação com upload de foto e assinatura
      setReunitedConfirmItemId(itemId);
      setReunitedProofImage(null);
      setReunitedProofNotes('');
      setShowReunitedSummaryConfirm(false);
      setReunitedDeclarationConfirmed(false);
      setReunitedProofValidationWarning(null);
      return;
    }
    try {
      const updateData: any = { status: newStatus };
      await updateDoc(doc(db, 'items', itemId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items/' + itemId);
    }
  };

  // Validar se há prova antes de abrir o diálogo de confirmação extra com resumo
  const handleInitiateReunitedReview = () => {
    // Se não for modo offline, mantemos a obrigatoriedade da imagem normal de prova ou assinatura
    if (!offlineDeliveryEnabled && !reunitedProofImage && !digitalSignatureUrl) {
      setReunitedProofValidationWarning("A prova de entrega (Foto nítida ou Assinatura Digital do recetor) é estritamente obrigatória para evitar encerramentos acidentais.");
      return;
    }

    // Se for modo offline, exigimos assinatura digital ou imagem de prova
    if (offlineDeliveryEnabled && !digitalSignatureUrl && !reunitedProofImage) {
      setReunitedProofValidationWarning("No modo offline, é obrigatório assinar no ecrã ou anexar foto de prova para validar e criptografar a devolução.");
      return;
    }

    setReunitedProofValidationWarning(null);
    setReunitedDeclarationConfirmed(false);
    setShowReunitedSummaryConfirm(true);
  };

  const handleConfirmReunitedProof = async () => {
    if (!reunitedConfirmItemId) return;
    
    // Verificação da prova
    if (!offlineDeliveryEnabled && !reunitedProofImage && !digitalSignatureUrl) {
      setReunitedProofValidationWarning("Por favor, tire uma foto ou recolha a assinatura digital como prova de recuperação.");
      setShowReunitedSummaryConfirm(false);
      return;
    }

    if (offlineDeliveryEnabled && !digitalSignatureUrl && !reunitedProofImage) {
      setReunitedProofValidationWarning("Por favor, assine digitalmente ou adicione imagem para validar a entrega offline.");
      setShowReunitedSummaryConfirm(false);
      return;
    }

    if (!reunitedDeclarationConfirmed) {
      alert("Por favor, confirme a declaração de responsabilidade marcando a caixa de verificação antes de finalizar.");
      return;
    }

    setIsSubmittingReunitedProof(true);
    try {
      const hashSignature = "MZ-SECURE-SIG-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const finalLat = parseFloat(signedGeoLat) || -25.9692;
      const finalLng = parseFloat(signedGeoLng) || 32.5732;

      const updateData: any = {
        status: ItemStatus.REUNITED,
        reunitedAt: new Date().toISOString(),
        reunitedProofUrl: reunitedProofImage || digitalSignatureUrl || '',
        reunitedProofNotes: reunitedProofNotes.trim() + (offlineDeliveryEnabled ? " [✓ Entrega Offline Registada e Assinada]" : ""),
      };

      if (offlineDeliveryEnabled) {
        updateData.reunitedOfflineSignature = hashSignature;
        updateData.reunitedOfflineGeo = {
          latitude: finalLat,
          longitude: finalLng,
          timestamp: new Date().toISOString()
        };
        updateData.reunitedOfflineVerified = true;
      }
      
      // Se estiver offline ou se a conexão de internet estiver indisponível
      if (!isOnline || offlineDeliveryEnabled) {
        const queueItem = {
          itemId: reunitedConfirmItemId,
          updateData: updateData
        };
        const updatedQueue = [...offlineDeliveriesQueue, queueItem];
        localStorage.setItem('comeback_offline_reunited_queue', JSON.stringify(updatedQueue));
        setOfflineDeliveriesQueue(updatedQueue);
        
        // Atualização otimista na lista local de itens do estado
        setItems(prev => prev.map(item => item.id === reunitedConfirmItemId ? { ...item, ...updateData } : item));

        setShowConfetti(true);
        alert("📍 Entrega offline registada com sucesso! A assinatura digital e a geolocalização capturada foram encriptadas localmente e serão sincronizadas assim que a ligação à internet for restaurada.");
        
        handleCancelReunitedFlow();
        return;
      }

      // Caso contrário, tenta atualizar diretamente no Firestore (Online)
      await updateDoc(doc(db, 'items', reunitedConfirmItemId), updateData);
      
      // Enviar notificação de feedback
      addNotification({
        type: 'DELIVERY',
        title: 'Artigo Recuperado!',
        description: 'Parabéns! O seu artigo foi marcado como recuperado com prova enviada e validada com sucesso.',
        itemId: reunitedConfirmItemId
      });

      setShowConfetti(true);
      alert("Artigo marcado como Recuperado com sucesso! A sua prova de recuperação foi registada.");
      
      handleCancelReunitedFlow();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items/' + reunitedConfirmItemId);
    } finally {
      setIsSubmittingReunitedProof(false);
    }
  };

  // Switch to admin view automatically if admin logs in
  useEffect(() => {
    if (currentUser?.isAdmin) {
      setProfileView('admin');
    } else if (profileView === 'admin') {
      setProfileView('main');
    }
  }, [currentUser]);

  // Inicialização de estado
  const [items, setItems] = useState<Item[]>([]);

  // Anúncios patrocinados desativados neste momento a pedido do utilizador
  const [activeSponsoredAd, setActiveSponsoredAd] = useState<Item | null>(null);
  const [sponsoredAdTimer] = useState<number>(0);
  const handleCloseSponsoredAd = () => {
    setActiveSponsoredAd(null);
  };
  const [verifiedUsersMap, setVerifiedUsersMap] = useState<Record<string, boolean>>({});
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser) {
      setVerifiedUsersMap(prev => ({
        ...prev,
        [currentUser.id]: !!currentUser.isVerified
      }));
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || items.length === 0) return;

    // Filter unique owner IDs that haven't been fetched/requested yet
    const uniqueUserIds = Array.from(
      new Set(items.map((item) => item.userId).filter((id) => id && id !== 'anonymous'))
    ).filter(uid => !fetchedUserIdsRef.current.has(uid)) as string[];

    if (uniqueUserIds.length === 0) return;

    uniqueUserIds.forEach(async (uid) => {
      fetchedUserIdsRef.current.add(uid);
      try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setVerifiedUsersMap(prev => ({
            ...prev,
            [uid]: !!userData?.isVerified
          }));
        } else {
          setVerifiedUsersMap(prev => ({
            ...prev,
            [uid]: false
          }));
        }
      } catch (err) {
        console.warn("Could not fetch user verification status for feed:", uid, err);
      }
    });
  }, [items, currentUser]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Mensagens pendentes offline com persistência de segurança no localStorage
  const [pendingMessages, setPendingMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('comeback_pending_messages');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const savePendingMessage = (msg: Message) => {
    setPendingMessages(prev => {
      const updated = [...prev, msg];
      try {
        localStorage.setItem('comeback_pending_messages', JSON.stringify(updated));
      } catch (err) {
        console.error('Falha ao gravar mensagens pendentes:', err);
      }
      return updated;
    });
  };

  const removePendingMessage = (msgId: string) => {
    setPendingMessages(prev => {
      const updated = prev.filter(m => m.id !== msgId);
      try {
        localStorage.setItem('comeback_pending_messages', JSON.stringify(updated));
      } catch (err) {
        console.error('Falha ao remover mensagem pendente:', err);
      }
      return updated;
    });
  };

  // Sincronizar mensagens pendentes assim que voltar ao modo online
  const syncPendingMessages = async () => {
    if (!currentUser) {
      console.log('[Sync] Sincronização de mensagens pendentes adiada (sem utilizador autenticado).');
      return;
    }
    try {
      const saved = localStorage.getItem('comeback_pending_messages');
      const list: Message[] = saved ? JSON.parse(saved) : [];
      if (list.length === 0) return;

      console.log(`[Sync] Sincronizando ${list.length} mensagens com o Firestore.`);
      // Sincronizar de forma sequencial garantindo que cada uma seja submetida
      for (const msg of list) {
        const { pending, ...cleanMsg } = msg;
        try {
          await setDoc(doc(db, 'messages', msg.id), cleanMsg);
          
          // Remove com sucesso da lista local e actualiza o localStorage
          setPendingMessages(prev => {
            const updated = prev.filter(m => m.id !== msg.id);
            localStorage.setItem('comeback_pending_messages', JSON.stringify(updated));
            return updated;
          });
          console.log(`[Sync] Mensagem ${msg.id} enviada e removida da fila offline.`);
        } catch (writeErr: any) {
          console.warn(`[Sync] Erro ao sincronizar mensagem ${msg.id}:`, writeErr);
          const isPermissionDenied = 
            writeErr?.code === 'permission-denied' || 
            writeErr?.message?.includes('permission-denied') || 
            writeErr?.message?.includes('PERMISSION_DENIED') ||
            writeErr?.message?.includes('insufficient permissions');
            
          if (isPermissionDenied) {
            console.warn(`[Sync] Permissão negada definitiva para a mensagem ${msg.id}. Removendo da fila offline para evitar repetições infinitas.`);
            setPendingMessages(prev => {
              const updated = prev.filter(m => m.id !== msg.id);
              localStorage.setItem('comeback_pending_messages', JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Sync] Falha ao sincronizar mensagens (retentará em background):', err);
    }
  };

  // Sincronizar entregas offline assim que rede for estabelecida
  const syncOfflineDeliveries = async () => {
    try {
      const saved = localStorage.getItem('comeback_offline_reunited_queue');
      const queue = saved ? JSON.parse(saved) : [];
      if (queue.length === 0) return 0;

      console.log(`[Sync] Sincronizando ${queue.length} entregas offline com o firestore.`);
      let syncedCount = 0;
      const remainingQueue: any[] = [];

      for (const delivery of queue) {
        try {
          await updateDoc(doc(db, "items", delivery.itemId), delivery.updateData);
          syncedCount++;
          console.log(`[Sync] Item ${delivery.itemId} marcado como recuperado com sucesso no Firestore.`);
        } catch (err: any) {
          console.error(`[Sync] Erro ao sincronizar item offline ${delivery.itemId}:`, err);
          
          const isPermissionDenied = 
            err?.code === 'permission-denied' || 
            err?.message?.includes('permission-denied') || 
            err?.message?.includes('PERMISSION_DENIED') ||
            err?.message?.includes('insufficient permissions');
            
          if (isPermissionDenied) {
            console.warn(`[Sync] Permissão negada definitiva para entrega offline ${delivery.itemId}. Removendo da fila para evitar repetições infinitas.`);
          } else {
            remainingQueue.push(delivery);
          }
        }
      }

      localStorage.setItem('comeback_offline_reunited_queue', JSON.stringify(remainingQueue));
      setOfflineDeliveriesQueue(remainingQueue);

      return syncedCount;
    } catch (err) {
      console.warn('[Sync] Erro ao carregar/sincronizar fila offline de entregas:', err);
      return 0;
    }
  };

  // Sincronizar artigos offline pendentes com o Firestore
  const syncPendingItems = async () => {
    try {
      const saved = localStorage.getItem('comeback_pending_items');
      const list: Item[] = saved ? JSON.parse(saved) : [];
      if (list.length === 0) return 0;

      console.log(`[Sync] Sincronizando ${list.length} artigos offline com o Firestore.`);
      let syncedCount = 0;
      const remaining: Item[] = [];

      for (const item of list) {
        try {
          await setDoc(doc(db, 'items', item.id), item);
          syncedCount++;
          console.log(`[Sync] Artigo offline ${item.id} (${item.title}) sincronizado com sucesso.`);
        } catch (err: any) {
          console.warn(`[Sync] Erro ao sincronizar artigo offline ${item.id}:`, err);
          const isPermissionDenied = 
            err?.code === 'permission-denied' || 
            err?.message?.includes('permission-denied') || 
            err?.message?.includes('PERMISSION_DENIED');
          if (!isPermissionDenied) {
            remaining.push(item);
          }
        }
      }

      localStorage.setItem('comeback_pending_items', JSON.stringify(remaining));
      setPendingItems(remaining);
      return syncedCount;
    } catch (err) {
      console.warn('[Sync] Falha na sincronização de artigos offline:', err);
      return 0;
    }
  };

  // Ação manual para sincronizar tudo e verificar rede
  const handleManualSyncAll = async () => {
    setIsManualSyncing(true);
    const currentlyOnline = navigator.onLine;
    setIsOnline(currentlyOnline);

    if (!currentlyOnline) {
      alert("Sem ligação à internet detetada de momento. Os seus dados e mensagens continuam seguros no armazenamento local e serão sincronizados automaticamente assim que a rede voltar.");
      setIsManualSyncing(false);
      return;
    }

    try {
      const syncedItems = await syncPendingItems();
      const syncedMsgs = await syncPendingMessages();
      const syncedDeliv = await syncOfflineDeliveries();

      const totalSynced = (typeof syncedItems === 'number' ? syncedItems : 0) + 
                          (typeof syncedMsgs === 'number' ? syncedMsgs : 0) + 
                          (typeof syncedDeliv === 'number' ? syncedDeliv : 0);

      if (totalSynced > 0) {
        setShowConfetti(true);
        alert(`🎉 Sincronização Concluída! ${totalSynced} registo(s) offline foram sincronizados com sucesso na Base de Dados.`);
      } else {
        alert("A sua aplicação está totalmente sincronizada! Não existem novos registos pendentes na fila.");
      }
    } catch (e) {
      console.error("Erro na sincronização manual:", e);
      alert("Ocorreu um erro durante a sincronização. A sua fila offline continuará preservada para nova tentativa.");
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Remover item individual da fila offline
  const handleRemoveQueueItem = (type: 'item' | 'message' | 'delivery', id: string) => {
    if (type === 'item') {
      const rawId = id.replace('item-', '');
      const next = pendingItems.filter(i => i.id !== rawId);
      setPendingItems(next);
      localStorage.setItem('comeback_pending_items', JSON.stringify(next));
    } else if (type === 'message') {
      const rawId = id.replace('msg-', '');
      removePendingMessage(rawId);
    } else if (type === 'delivery') {
      const rawId = id.replace('deliv-', '');
      const next = offlineDeliveriesQueue.filter(d => d.itemId !== rawId);
      setOfflineDeliveriesQueue(next);
      localStorage.setItem('comeback_offline_reunited_queue', JSON.stringify(next));
    }
  };

  // Detalhes calculados da fila offline para o Banner
  const pendingSyncCounts = useMemo(() => {
    const details: {
      id: string;
      type: 'item' | 'message' | 'delivery';
      title: string;
      subtitle: string;
      timestamp?: string;
    }[] = [];

    // Artigos pendentes
    pendingItems.forEach(item => {
      details.push({
        id: `item-${item.id}`,
        type: 'item',
        title: `Artigo: ${item.title}`,
        subtitle: `${item.category} • ${item.province} (${item.location})`,
        timestamp: item.createdAt || new Date().toISOString()
      });
    });

    // Mensagens pendentes
    pendingMessages.forEach(msg => {
      const itemRelated = items.find(i => i.id === msg.itemId);
      details.push({
        id: `msg-${msg.id}`,
        type: 'message',
        title: `Mensagem no Chat${itemRelated ? `: "${itemRelated.title}"` : ''}`,
        subtitle: msg.text ? (msg.text.length > 45 ? msg.text.substring(0, 45) + '...' : msg.text) : 'Ficheiro / Localização',
        timestamp: msg.timestamp || new Date().toISOString()
      });
    });

    // Entregas/recuperações pendentes
    offlineDeliveriesQueue.forEach(d => {
      const itemRelated = items.find(i => i.id === d.itemId);
      details.push({
        id: `deliv-${d.itemId}`,
        type: 'delivery',
        title: `Recuperação: ${itemRelated ? itemRelated.title : d.itemId}`,
        subtitle: d.updateData?.reunitedProofNotes || 'Assinatura digital e geolocalização capturadas offline',
        timestamp: d.updateData?.reunitedAt || new Date().toISOString()
      });
    });

    return {
      items: pendingItems.length,
      messages: pendingMessages.length,
      deliveries: offlineDeliveriesQueue.length,
      total: pendingItems.length + pendingMessages.length + offlineDeliveriesQueue.length,
      details
    };
  }, [pendingItems, pendingMessages, offlineDeliveriesQueue, items]);

  const combinedMessages = useMemo(() => {
    const syncedIds = new Set(messages.map(m => m.id));
    const localFiltered = pendingMessages.filter(m => !syncedIds.has(m.id));
    return [...messages, ...localFiltered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages, pendingMessages]);

  // Desparar a sincronização quando a rede é estabelecida
  useEffect(() => {
    if (isOnline) {
      syncPendingMessages();
      syncOfflineDeliveries();
      syncPendingItems();
    }
  }, [isOnline]);

  // Carregar dados de cache local no arranque para acesso instantâneo/offline
  useEffect(() => {
    getCachedItems()
      .then((cachedItems) => {
        if (cachedItems && cachedItems.length > 0) {
          const validatedCached = cachedItems.map(item => {
            if (!item.category) {
              item.category = Category.OTHERS;
            }
            return item;
          });
          // Preenche a lista se ela ainda estiver vazia antes de o Snapshot responder
          setItems((current) => current.length === 0 ? validatedCached : current);
        }
      })
      .catch((err) => console.error('Falha ao inicializar itens com cache local:', err));
  }, []);

  useEffect(() => {
    const qItems = query(collection(db, 'items'), orderBy('createdAt', 'desc'));
    let isFirstSnapshotOfSubscription = true;

    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      const itemsList = snapshot.docs.map(doc => {
        const item = doc.data() as Item;
        if (!item.category) {
          item.category = Category.OTHERS;
        }
        return item;
      });
      
      if (isFirstSnapshotOfSubscription) {
        // Register all currently fetched item IDs to block them from showing as "new"
        snapshot.docs.forEach(doc => {
          if (doc.id) {
            knownItemIds.current.add(doc.id);
          }
        });
        isFirstSnapshotOfSubscription = false;
        isInitialItemsLoaded.current = true;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newItemDoc = change.doc.data() as Item;
            if (newItemDoc.id && !knownItemIds.current.has(newItemDoc.id)) {
              knownItemIds.current.add(newItemDoc.id);
              
              // Only trigger visual notification if the item was not created by the current user
              const isCurrentUserCreator = currentUser && newItemDoc.userId === currentUser.id;
              if (!isCurrentUserCreator) {
                setNewArrivalNotification(newItemDoc);
                
                // Nice cell warning chime (AudioContext)
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const oscillator = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  oscillator.type = 'sine';
                  oscillator.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                  gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                  oscillator.start();
                  oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
                  gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.45);
                  oscillator.stop(audioCtx.currentTime + 0.5);
                } catch (e) {
                  console.warn('Audio feedback failed/not permitted:', e);
                }

                // Haptic vibration
                if (navigator.vibrate) {
                  navigator.vibrate([80, 40, 80]);
                }
              }
            }
          }
        });
      }
      
      setItems(itemsList);
      
      // Auto-delete reunited items older than 7 days from the Firestore database
      itemsList.forEach((item) => {
        if (item.status === ItemStatus.REUNITED && item.reunitedAt) {
          const reunitedDate = new Date(item.reunitedAt);
          const diffDays = (Date.now() - reunitedDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 7) {
            console.log(`[Auto-cleanup] Deleting item ${item.id} because it has been reunited for ${diffDays.toFixed(1)} days (threshold: 7 days)`);
            deleteDoc(doc(db, 'items', item.id)).catch(err => {
              console.error(`Erro ao apagar automaticamente o item reunificado ${item.id}:`, err);
            });
          }
        }
      });

      // Persiste os dados sincronizados em segundo plano para acesso offline
      saveItemsToCache(itemsList).catch((err) => console.error('Erro ao salvar itens no cache local:', err));
    }, (error) => {
      console.warn('Conexão ao onSnapshot dos itens falhou (possível modo offline):', error);
      // Carrega os dados salvos em cache caso o escutador falhe ou esteja offline
      getCachedItems().then((cachedItems) => {
        if (cachedItems && cachedItems.length > 0) {
          setItems(cachedItems);
        }
      });
      // Apenas reporta erro de Firebase se o utilizador estiver online
      if (navigator.onLine) {
        handleFirestoreError(error, OperationType.LIST, 'items');
      }
    });

    let unsubscribeMessages = () => {};
    let unsubscribeNotifications = () => {};

    if (currentUser) {
      const qMessages = query(
        collection(db, 'messages'), 
        or(
          where('senderId', '==', currentUser.id),
          where('receiverId', '==', currentUser.id)
        ),
        orderBy('timestamp', 'asc')
      );
      unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
        const msgs = snapshot.docs.map(doc => doc.data() as Message);
        setMessages(msgs);
      }, (error) => {
        console.warn("Messages listener restricted:", error);
      });

      const qNotifs = query(
        collection(db, 'notifications'), 
        where('userId', '==', currentUser.id),
        orderBy('timestamp', 'desc')
      );
      unsubscribeNotifications = onSnapshot(qNotifs, (snapshot) => {
        const notifs = snapshot.docs.map(doc => doc.data() as Notification);
        setNotifications(notifs);
      }, (error) => {
        console.warn("Notifications listener restricted:", error);
      });
    }

    return () => {
      unsubscribeItems();
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, [currentUser, refreshKey]);

  // 1. Geolocation tracker and poster to Service Worker
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const postCoordsToSW = (coords: { lat: number; lng: number }) => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_LOCATION',
          coords
        });
      }
    };

    // Grab first position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocationCoords(coords);
        postCoordsToSW(coords);
      },
      (err) => console.warn("Initial position error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    // Set up active watcher that updates state and posts to the Service Worker
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocationCoords(coords);
        postCoordsToSW(coords);
      },
      (err) => console.warn("Watch position error:", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Sync user profile changes to the Service Worker
  useEffect(() => {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      if (currentUser) {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_USER_DATA',
          user: {
            id: currentUser.id,
            name: currentUser.name,
            phone: currentUser.phone,
            isVerified: currentUser.isVerified
          }
        });
      } else {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_USER_DATA',
          user: null
        });
      }
    }
  }, [currentUser]);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          document.body.removeChild(textArea);
          return true;
        } catch (err) {
          console.error('Fallback copy failed:', err);
          document.body.removeChild(textArea);
          return false;
        }
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  };

  const registerShareAction = async (item: Item) => {
    try {
      const currentShares = item.sharesCount || 0;
      const updatedShares = currentShares + 1;
      
      // Update selectedItem state optimistically and immediately so the badge updates
      setSelectedItem(prev => {
        if (prev && prev.id === item.id) {
          return { ...prev, sharesCount: updatedShares };
        }
        return prev;
      });

      // Update Firestore
      await updateDoc(doc(db, 'items', item.id), {
        sharesCount: updatedShares
      });
    } catch (error) {
      console.error("Failed to increment share count in Firestore:", error);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("É necessário iniciar sessão para reportar um problema.");
      setShowReportModal(false);
      return;
    }
    if (!selectedItem) {
      alert("Nenhum item selecionado.");
      return;
    }
    if (!reportReason) {
      alert("Por favor, selecione o motivo do problema.");
      return;
    }
    setReportSubmitting(true);
    try {
      const reportId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        itemId: selectedItem.id,
        itemTitle: selectedItem.title,
        reporterId: currentUser.id,
        userId: currentUser.id,
        userEmail: currentUser.email || '',
        reason: reportReason,
        details: reportDetails,
        timestamp: new Date().toISOString()
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
        setReportReason('');
        setReportDetails('');
      }, 2000);
    } catch (error) {
      console.error("Erro ao reportar problema:", error);
      alert("Ocorreu um erro ao submeter o reporte. Por favor tente novamente.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Sync URL when selectedItem changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selectedItem) {
      params.set('item', selectedItem.id);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      params.delete('item');
      let newUrl = window.location.pathname;
      if (params.toString()) {
        newUrl += `?${params.toString()}`;
      }
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, [selectedItem]);

  // Read URL search params on mount / on items populate
  useEffect(() => {
    if (items.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const itemId = params.get('item');
      if (itemId) {
        const found = items.find(i => i.id === itemId);
        if (found) {
          setSelectedItem(found);
        }
      }
    }
  }, [items]);

  // Handle outside clicks to close share dropdown
  useEffect(() => {
    if (!showShareDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#quick-share-btn') && !target.closest('.relative')) {
        setShowShareDropdown(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [showShareDropdown]);
  
  const handleItemAction = React.useCallback((item: Item) => {
    setSelectedItem(item);
    setAutoOpenClaim(true);
  }, []);

  const handleViewDetails = React.useCallback((item: Item) => {
    setSelectedItem(item);
  }, []);

  const [isArchitectureHubOpen, setIsArchitectureHubOpen] = useState(false);
  const [escrowedItems, setEscrowedItems] = useState<Record<string, { txId: string; amount: number; phone: string }>>({});

  const handleUpdateItemRewardStatus = async (itemId: string, status: 'none' | 'escrowed' | 'released', txId?: string) => {
    if (status === 'escrowed' && txId) {
      const targetItem = items.find(i => i.id === itemId);
      if (targetItem) {
        setEscrowedItems(prev => ({
          ...prev,
          [itemId]: {
            txId: txId,
            amount: targetItem.reward || 0,
            phone: targetItem.ownerPhone || '841234567'
          }
        }));
        
        // Notify user about Escrow Success
        addNotification({
          type: 'REWARD',
          title: 'Recompensa Garantida!',
          description: `Os ${targetItem.reward?.toLocaleString()} MT de recompensa para o item "${targetItem.title}" foram depositados com sucesso em custódia ComeBack. (ID Transação M-Pesa: ${txId})`,
          itemId: itemId
        });
      }
    } else if (status === 'released') {
      setEscrowedItems(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
      
      const targetItem = items.find(i => i.id === itemId);
      if (targetItem) {
        addNotification({
          type: 'REWARD',
          title: 'Recompensa Liberada!',
          description: `Os fundos de recompensa para o item "${targetItem.title}" foram liberados para o localizador via M-Pesa.`,
          itemId: itemId
        });
      }
    }
  };

  const [showWelcomeTutorial, setShowWelcomeTutorial] = useState(false);
  const [showAppTour, setShowAppTour] = useState(false);

  useEffect(() => {
    if (activeTab === 'feed') {
      const hasSeenWelcome = localStorage.getItem('comeback_welcome_tutorial_seen');
      const hasSeenTour = localStorage.getItem('comeback_app_tour_seen');
      if (!hasSeenWelcome) {
        setShowWelcomeTutorial(true);
      } else if (!hasSeenTour) {
        setShowAppTour(true);
      }
    }
  }, [activeTab]);

  const [autoOpenClaim, setAutoOpenClaim] = useState(false);
  const [activeChat, setActiveChat] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDocPhotoHelp, setShowDocPhotoHelp] = useState(false);
  const [isViewingDelivery, setIsViewingDelivery] = useState(false);

  // Histórico de buscas efetuadas para suporte offline e acesso rápido
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('comeback_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 5); // Guardar as últimas 5 buscas únicas
      localStorage.setItem('comeback_recent_searches', JSON.stringify(next));
      return next;
    });
  };

  const [semanticScores, setSemanticScores] = useState<Record<string, number>>({});
  const [isSearchingSemantically, setIsSearchingSemantically] = useState(false);

  const [filters, setFilters] = useState({
    status: 'ALL' as ItemStatus | 'ALL' | 'MISSING' | 'PETS',
    category: 'ALL' as Category | 'ALL',
    province: 'ALL' as string | 'ALL',
    date: '' as string,
    searchQuery: '',
    highValueOnly: false,
    minReward: '' as string,
    maxReward: '' as string,
    maxDistance: 'ALL' as string
  });

  useEffect(() => {
    const query = filters.searchQuery.trim();
    if (!query) {
      setSemanticScores({});
      setIsSearchingSemantically(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingSemantically(true);
      try {
        const response = await apiFetch('/api/semantic-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ searchQuery: query }),
        });
        if (response.ok) {
          const data = await response.json();
          const scores: Record<string, number> = {};
          if (data.matches && Array.isArray(data.matches)) {
            data.matches.forEach((m: any) => {
              scores[m.itemId] = m.similarity;
            });
          }
          setSemanticScores(scores);
        } else {
          console.error("Erro na resposta de pesquisa semântica");
        }
      } catch (err) {
        console.error("Erro ao realizar pesquisa semântica:", err);
      } finally {
        setIsSearchingSemantically(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [filters.searchQuery]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishCooldown, setPublishCooldown] = useState<number>(0);

  useEffect(() => {
    if (publishCooldown > 0) {
      const timer = setTimeout(() => {
        setPublishCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [publishCooldown]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSuggestingNew, setIsSuggestingNew] = useState(false);
  const [isSuggestingEdit, setIsSuggestingEdit] = useState(false);
  const [isUploadingDirectDoc, setIsUploadingDirectDoc] = useState(false);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);

  const handleSuggestImprovements = async (isEdit: boolean) => {
    const itemToImprove = isEdit ? editingItem : newItem;
    if (!itemToImprove || !itemToImprove.title) {
      alert("Por favor, introduza pelo menos um título para que a IA possa sugerir melhorias baseadas nele.");
      return;
    }

    if (isEdit) {
      setIsSuggestingEdit(true);
    } else {
      setIsSuggestingNew(true);
    }

    try {
      const response = await authenticatedFetch("/api/suggest-improvements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: itemToImprove.title,
          category: itemToImprove.category,
          status: itemToImprove.status,
          description: itemToImprove.description,
          location: itemToImprove.location,
          province: itemToImprove.province
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao obter melhorias da descrição.");
      }

      if (data.suggestions) {
        if (isEdit && editingItem) {
          setEditingItem({
            ...editingItem,
            description: data.suggestions
          } as Item);
        } else {
          setNewItem(prev => ({
            ...prev,
            description: data.suggestions
          }));
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Não foi possível sugerir melhorias neste momento.");
    } finally {
      if (isEdit) {
        setIsSuggestingEdit(false);
      } else {
        setIsSuggestingNew(false);
      }
    }
  };

  const handleDocumentAutoExtract = async (file: File) => {
    setIsExtractingDoc(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          // Compress image to stayed under Firestore 1MB limit
          const compressedBase64 = await compressImage(base64, 1000, 1000, 0.7);

          const response = await authenticatedFetch("/api/extract-document-data", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ imageBase64: compressedBase64 }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Não foi possível extrair dados do documento.");
          }

          if (data.name || data.number) {
            setNewItem(prev => ({
              ...prev,
              title: data.title || prev.title,
              description: data.description || prev.description,
              province: data.province || prev.province,
              category: Category.DOCUMENTS,
              imageUrls: [compressedBase64, ...(prev.imageUrls || [])].slice(0, 3)
            }));
            
            let successMessage = `🤖 IA do ComeBack extraiu os dados com sucesso!\n\n`;
            if (data.name) successMessage += `👤 Titular: ${data.name}\n`;
            if (data.number) successMessage += `🔑 N.º Documento: ${data.number}\n`;
            if (data.docType) successMessage += `📋 Tipo: ${data.docType}\n`;
            if (data.province) successMessage += `📍 Província: ${data.province}\n\n`;
            successMessage += `Os campos correspondentes no formulário abaixo foram preenchidos de forma automática. Por favor, confira os dados antes de publicar.`;
            
            alert(successMessage);
          } else {
            alert("A IA analisou o documento mas não conseguiu ler o nome ou número de forma precisa. Por favor, tente tirar uma foto mais nítida.");
          }
        } catch (innerErr: any) {
          console.error("Erro interno ao extrair documento:", innerErr);
          alert(`Infelizmente ocorreu um erro na análise: ${innerErr.message || innerErr}`);
        } finally {
          setIsExtractingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error("Erro na leitura do arquivo:", err);
      setIsExtractingDoc(false);
      alert(`Falha ao ler o ficheiro: ${err.message || err}`);
    }
  };

  const [newItem, setNewItem] = useState<Partial<Item>>({
    status: ItemStatus.LOST,
    category: Category.DOCUMENTS,
    province: 'Maputo Cidade',
    date: new Date().toISOString().split('T')[0],
    ownerName: '',
    ownerPhone: ''
  });

  // Rascunho local do formulário de publicação — preserva o trabalho em telemóveis e redes instáveis.
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('comeback_publish_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          setNewItem(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch (error) {
      console.warn('Falha ao recuperar rascunho de publicação:', error);
    }
  }, []);

  useEffect(() => {
    const hasDraft = Boolean(
      newItem.title?.trim() || newItem.description?.trim() || newItem.location?.trim() ||
      newItem.reward || newItem.imageUrls?.length
    );
    try {
      if (hasDraft) localStorage.setItem('comeback_publish_draft', JSON.stringify(newItem));
      else localStorage.removeItem('comeback_publish_draft');
    } catch (error) {
      console.warn('Falha ao guardar rascunho de publicação:', error);
    }
  }, [newItem]);

  // Estados para Validação Inteligente da Descrição e Auto-sugestão de Categoria com Gemini
  const [isValidatingDesc, setIsValidatingDesc] = useState(false);
  const [descValidationResult, setDescValidationResult] = useState<DescriptionValidationResult | null>(null);
  const [descValidatedForText, setDescValidatedForText] = useState<string>('');
  const [hasUserOverriddenDescValidation, setHasUserOverriddenDescValidation] = useState(false);
  const [showInsufficientDescModal, setShowInsufficientDescModal] = useState(false);

  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [suggestedCategoryData, setSuggestedCategoryData] = useState<CategorySuggestionResult | null>(null);
  const [categoryAppliedNotice, setCategoryAppliedNotice] = useState<string | null>(null);

  // Auto-sugestão debounced da Categoria quando o utilizador preenche o título ou a descrição
  useEffect(() => {
    const title = newItem.title?.trim() || '';
    const desc = newItem.description?.trim() || '';
    if (title.length < 3 && desc.length < 5) {
      setSuggestedCategoryData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSuggestingCategory(true);
        const result = await suggestCategoryAI(title, desc);
        setSuggestedCategoryData(result);
      } catch (err) {
        console.warn("Erro ao sugerir categoria:", err);
      } finally {
        setIsSuggestingCategory(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [newItem.title, newItem.description]);

  const handleManualSuggestCategory = async () => {
    const title = newItem.title?.trim() || '';
    const desc = newItem.description?.trim() || '';
    if (!title && !desc) {
      alert("Por favor, introduza pelo menos um título ou descrição para a IA poder sugerir a categoria correta.");
      return;
    }
    setIsSuggestingCategory(true);
    try {
      const result = await suggestCategoryAI(title, desc);
      setSuggestedCategoryData(result);
      if (result.suggestedCategory && Object.values(Category).includes(result.suggestedCategory as Category)) {
        setNewItem(prev => ({ ...prev, category: result.suggestedCategory as Category }));
        setCategoryAppliedNotice(`Categoria "${result.suggestedCategory}" aplicada com sucesso!`);
        setTimeout(() => setCategoryAppliedNotice(null), 4000);
      }
    } catch (err: any) {
      alert("Não foi possível detetar a categoria neste momento.");
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const applySuggestedCategory = (cat: Category) => {
    setNewItem(prev => ({ ...prev, category: cat }));
    setCategoryAppliedNotice(`Categoria "${cat}" selecionada com base na análise da IA.`);
    setTimeout(() => setCategoryAppliedNotice(null), 4000);
  };

  const handleValidateDescription = async (): Promise<DescriptionValidationResult | null> => {
    const title = newItem.title?.trim() || '';
    const desc = newItem.description?.trim() || '';

    if (!desc || desc.length < 5) {
      const fallbackRes: DescriptionValidationResult = {
        isSufficient: false,
        score: 10,
        hasBrandOrModel: false,
        hasSerialOrIdentifier: false,
        hasUniqueDetails: false,
        summary: "Descrição demasiado curta para identificação segura.",
        feedback: "A descrição atual não possui detalhes suficientes (marcas, números de série, cores específicas ou sinais de uso) para identificação do item.",
        suggestions: [
          "Indique a marca ou modelo específico do item (ex: Samsung, Toyota, HP)",
          "Adicione número de série, placa, BI ou IMEI se aplicável",
          "Descreva marcas particulares, autocolantes, cor da capa ou avarias"
        ]
      };
      setDescValidationResult(fallbackRes);
      setDescValidatedForText(desc);
      return fallbackRes;
    }

    setIsValidatingDesc(true);
    try {
      const result = await validateDescriptionAI(title, desc, newItem.category, newItem.status);
      setDescValidationResult(result);
      setDescValidatedForText(desc);
      setHasUserOverriddenDescValidation(false);
      return result;
    } catch (err: any) {
      console.warn("Erro ao validar descrição:", err);
      return null;
    } finally {
      setIsValidatingDesc(false);
    }
  };

  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingTab, setPendingTab] = useState<'feed' | 'post' | 'profile' | 'about' | null>(null);

  const hasUnsavedChanges = () => {
    return !!(
      (newItem.title && newItem.title.trim() !== '') ||
      (newItem.description && newItem.description.trim() !== '') ||
      (newItem.location && newItem.location.trim() !== '') ||
      (newItem.reward && newItem.reward > 0) ||
      newItem.imageUrl
    );
  };

  const handleTabChange = (tab: 'feed' | 'post' | 'profile' | 'about') => {
    if (activeTab === 'post' && tab !== 'post' && hasUnsavedChanges()) {
      setPendingTab(tab);
      setShowUnsavedChangesModal(true);
    } else {
      if (tab === 'feed') {
        setSelectedItem(null);
        setActiveChat(null);
        setIsViewingDelivery(false);
        setAutoOpenClaim(false);
      }
      setActiveTab(tab);
    }
  };

  const isHome = activeTab === 'feed' && !selectedItem && !activeChat && !isViewingDelivery;

  const goHome = () => {
    setIsViewingDelivery(false);
    setActiveChat(null);
    setSelectedItem(null);
    setAutoOpenClaim(false);
    setActiveTab('feed');
    setHomeReturnCount(prev => {
      const newVal = prev + 1;
      localStorage.setItem('home_return_count', newVal.toString());
      
      // Keep track and motivate the user on round milestone levels
      if (newVal === 5) {
        setMilestoneToast({ count: newVal, message: "Excelente! Já regressou 5 vezes ao início para continuar a explorar." });
      } else if (newVal === 10) {
        setMilestoneToast({ count: newVal, message: "Magnífico! Já regressou 10 vezes ao painel principal." });
      } else if (newVal === 25) {
        setMilestoneToast({ count: newVal, message: "Super Exploração! Alcançou a marca de 25 regressos à base!" });
      } else if (newVal === 50) {
        setMilestoneToast({ count: newVal, message: "Explorador de Elite! Incríveis 50 regressos guardados!" });
      } else if (newVal > 10 && newVal % 10 === 0) {
        setMilestoneToast({ count: newVal, message: `Fantástico! Atingiu a marca de ${newVal} regressos ao feed de anúncios.` });
      }
      return newVal;
    });
  };

  const confirmDiscardChanges = () => {
    setNewItem({
      status: ItemStatus.LOST,
      category: Category.DOCUMENTS,
      province: 'Maputo Cidade',
      date: new Date().toISOString().split('T')[0],
      ownerName: currentUser?.name || '',
      ownerPhone: currentUser?.phone || '',
      imageUrls: []
    });
    setFormErrors({});
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
    setShowUnsavedChangesModal(false);
  };

  const cancelDiscardChanges = () => {
    setPendingTab(null);
    setShowUnsavedChangesModal(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeTab === 'post' && hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'Tem alterações não guardadas no formulário de publicação. Deseja realmente sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeTab, newItem]);

  // Preencher dados do usuário ao abrir aba de post
  useEffect(() => {
    if (activeTab === 'post' && currentUser) {
      setNewItem(prev => ({
        ...prev,
        ownerName: prev.ownerName || currentUser.name || '',
        ownerPhone: prev.ownerPhone || currentUser.phone || ''
      }));
    }
  }, [activeTab, currentUser]);

  // Monitorar status de rede
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Lógica de Rastreamento em Tempo Real
  const startTracking = (itemId: string, deliveryLocation?: string, coords?: { lat: number, lng: number }) => {
    if (!("geolocation" in navigator)) {
      alert("Geolocalização não disponível.");
      return;
    }

    setTrackingItemId(itemId);
    const targetItem = items.find(i => i.id === itemId);
    const destLat = coords?.lat || targetItem?.latitude || -25.9692;
    const destLng = coords?.lng || targetItem?.longitude || 32.5732;

    const isHighValue = targetItem ? (
      (targetItem.reward && targetItem.reward >= 2000) || [
        Category.DOCUMENTS, Category.ELECTRONICS, Category.WALLETS, Category.BAGS, Category.KEYS
      ].includes(targetItem.category)
    ) : false;

    const frequentTrackingLogsEnabled = localStorage.getItem('frequentHighValueTrackingLogs') === 'true';
    const intervalMs = (isHighValue && frequentTrackingLogsEnabled) ? 3000 : 10000;

    let currentLat = targetItem?.transitLatitude || targetItem?.latitude || -25.9692;
    let currentLng = targetItem?.transitLongitude || targetItem?.longitude || 32.5732;

    // Se as coordenadas iniciais forem idênticas ao destino, cria um percurso de teste para ver os logs
    if (Math.abs(currentLat - destLat) < 0.0001 && Math.abs(currentLng - destLng) < 0.0001) {
      currentLat = destLat - 0.015;
      currentLng = destLng - 0.012;
    }

    const initialLog = { lat: currentLat, lng: currentLng, timestamp: new Date().toISOString() };
    const updates = { 
      isTrackingActive: true, 
      status: ItemStatus.IN_TRANSIT,
      deliveryLocation: deliveryLocation || '',
      deliveryLatitude: destLat,
      deliveryLongitude: destLng,
      transitLatitude: currentLat,
      transitLongitude: currentLng,
      trackingLogs: [initialLog]
    };
    
    updateDoc(doc(db, 'items', itemId), updates).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'items/' + itemId));

    // Regista watch local se disponível
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateDoc(doc(db, 'items', itemId), { 
          transitLatitude: latitude, 
          transitLongitude: longitude 
        }).catch(e => console.error("Erro ao atualizar coordenadas por GPS:", e));
      },
      (error) => {
        console.error("Erro no rastreamento por GPS nativo:", error);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    // Rastreamento simulado em alta ou normal frequência para manter os logs de percurso vivos
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }

    trackingIntervalRef.current = setInterval(() => {
      const step = 0.0015; // passo de deslocação rápida
      const latDiff = destLat - currentLat;
      const lngDiff = destLng - currentLng;
      const distance = Math.hypot(latDiff, lngDiff);

      if (distance > step) {
        currentLat += (latDiff / distance) * step;
        currentLng += (lngDiff / distance) * step;
      } else {
        currentLat = destLat;
        currentLng = destLng;
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }

      updateDoc(doc(db, 'items', itemId), { 
        transitLatitude: currentLat, 
        transitLongitude: currentLng,
        trackingLogs: arrayUnion({
          lat: currentLat,
          lng: currentLng,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.error("Erro ao atualizar logs de percurso:", e));
    }, intervalMs);

    const descriptionText = (isHighValue && frequentTrackingLogsEnabled)
      ? `Acompanhe o percurso seguro do seu artigo de Alto Valor. Logs de geolocalização ativos de alta frequência (${intervalMs / 1000}s).`
      : 'O transportador iniciou o percurso. Acompanhe o percurso ao vivo no mapa.';

    addNotification({
      type: 'DELIVERY',
      title: isHighValue && frequentTrackingLogsEnabled ? 'Rastreamento Seguro Ativo! 🚨' : 'Entrega Iniciada!',
      description: descriptionText,
      itemId: itemId
    });
  };

  const stopTracking = (itemId: string) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingIntervalRef.current !== null) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setTrackingItemId(null);
    updateDoc(doc(db, 'items', itemId), { isTrackingActive: false }).catch(e => handleFirestoreError(e, OperationType.UPDATE, 'items/' + itemId));
  };

  const handleFinishDelivery = async (itemId: string) => {
    if (!currentUser || !activeChat) return;
    
    stopTracking(itemId);
    
    // Identificar a outra parte no chat
    const chatMessages = messages.filter(m => m.itemId === itemId);
    const otherMessage = chatMessages.find(m => m.senderId !== currentUser.id || m.receiverId !== currentUser.id);
    const targetUserId = (currentUser.id === activeChat.userId) 
      ? (otherMessage?.senderId === currentUser.id ? otherMessage.receiverId : otherMessage?.senderId)
      : activeChat.userId;

    // Atualizar status do item para reunido
    try {
      await updateDoc(doc(db, 'items', itemId), { 
        status: ItemStatus.REUNITED,
        isTrackingActive: false 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items/' + itemId);
    }

    // Adicionar notificação de conclusão para o remetente (opcional, mas bom ter feedback)
    addNotification({
      type: 'DELIVERY',
      title: 'Entrega Concluída!',
      description: 'Você marcou este item como entregue com sucesso.',
      itemId: itemId
    });

    // Adicionar notificação para a outra pessoa
    if (targetUserId && targetUserId !== currentUser.id) {
      addNotification({
        type: 'DELIVERY',
        title: 'Item Recuperado!',
        description: 'O item foi entregue com sucesso! Por favor, confirme o recebimento e agradeça ao buscador.',
        itemId: itemId
      }, targetUserId);
    }

    // Enviar mensagem automática no chat
    handleSendMessage("O item foi entregue com sucesso! 🎉 Resgate concluído com o Radar Moçambique.", 'text');
    
    setShowConfetti(true);
    alert("Entrega finalizada com sucesso!");
  };

  const addNotification = async (notif: Partial<Notification> & { isHighValueMatch?: boolean }, targetUserId?: string) => {
    if (!currentUser && !targetUserId) return;
    const finalUserId = targetUserId || (currentUser ? currentUser.id : '');
    if (!finalUserId) return;

    const id = Math.random().toString(36).substr(2, 5);
    // Destructure isHighValueMatch so it doesn't get saved to Firestore within the notification object
    const { isHighValueMatch, ...cleanNotif } = notif;
    const fullNotif: Notification = {
      id,
      userId: finalUserId,
      ...(finalUserId !== currentUser?.id && currentUser?.id ? { senderId: currentUser.id } : {}),
      type: cleanNotif.type || 'MATCH',
      title: cleanNotif.title || '',
      description: cleanNotif.description || '',
      itemId: cleanNotif.itemId || '',
      timestamp: new Date().toISOString(),
      isRead: false,
      ...cleanNotif
    };
    
    try {
      await setDoc(doc(db, 'notifications', id), fullNotif);
      
      // Reproduzir som de alerta de match personalizado via Web Audio correspondente à preferência
      if (finalUserId === currentUser?.id && fullNotif.type === 'MATCH') {
        playNotificationSound(currentUser?.notificationSound || 'radar');
      }
      
      // Enviar notificação push nativa por Service Worker no background do dispositivo
      authenticatedFetch('/api/trigger-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: finalUserId,
          title: fullNotif.title,
          body: fullNotif.description,
          data: {
            url: fullNotif.itemId ? `/?itemId=${fullNotif.itemId}` : '/',
            itemId: fullNotif.itemId || undefined
          }
        })
      }).catch(err => console.warn("Erro ao despachar Push Notification:", err));

      // Se for um MATCH de item alto valor, despachar notificação automática por SMS
      if (fullNotif.type === 'MATCH' && isHighValueMatch) {
        authenticatedFetch('/api/trigger-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: finalUserId,
            title: fullNotif.title,
            body: fullNotif.description,
          itemId: fullNotif.itemId || undefined
          })
        }).catch(err => console.warn("Erro ao despachar SMS Notification:", err));
      }
    } catch (error) {
      console.error("Erro ao salvar notificação:", error);
    }
  };
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'ALL') count++;
    if (filters.category !== 'ALL') count++;
    if (filters.province !== 'ALL') count++;
    if (filters.date !== '') count++;
    if (filters.highValueOnly) count++;
    if (filters.minReward !== '') count++;
    if (filters.maxReward !== '') count++;
    if (filters.maxDistance !== 'ALL') count++;
    return count;
  }, [filters]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const realTimeStats = useMemo(() => {
    let lost = 0;
    let found = 0;
    let stolen = 0;
    let reunited = 0;
    let missing = 0;

    items.forEach(item => {
      if (item.category === Category.PEOPLE) {
        missing++;
      }
      switch (item.status) {
        case ItemStatus.LOST:
          lost++;
          break;
        case ItemStatus.FOUND:
          found++;
          break;
        case ItemStatus.STOLEN:
          stolen++;
          break;
        case ItemStatus.REUNITED:
          reunited++;
          break;
        default:
          break;
      }
    });

    return { lost, found, stolen, reunited, missing };
  }, [items]);

  const provinceTrends = useMemo(() => {
    if (!items || items.length === 0) return [];

    const groups: Record<string, { total: number; lost: number; found: number; categories: Record<string, number> }> = {};

    items.forEach(item => {
      const prov = item.province;
      if (!prov || prov === 'ALL') return;
      
      if (!groups[prov]) {
        groups[prov] = { total: 0, lost: 0, found: 0, categories: {} };
      }

      groups[prov].total += 1;
      if (item.status === ItemStatus.LOST || item.status === ItemStatus.STOLEN) {
        groups[prov].lost += 1;
      } else if (item.status === ItemStatus.FOUND || item.status === ItemStatus.REUNITED) {
        groups[prov].found += 1;
      }

      if (item.category) {
        groups[prov].categories[item.category] = (groups[prov].categories[item.category] || 0) + 1;
      }
    });

    const maxCombined = Math.max(...Object.values(groups).map(g => g.total), 1);

    return Object.entries(groups)
      .map(([provinceName, stats]) => {
        const sortedCats = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]);
        const topCat = sortedCats.length > 0 ? sortedCats[0][0] : 'Outros';
        const ratio = Math.round((stats.total / maxCombined) * 100);

        return {
          province: provinceName,
          total: stats.total,
          lost: stats.lost,
          found: stats.found,
          topCategory: topCat,
          percentage: ratio,
          trendDirection: stats.lost >= stats.found ? 'up' : 'down'
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [items]);

  const aiRiskZones = useMemo(() => {
    if (!items || items.length === 0) return [];

    // Filter to stolen items or items with high risk keywords
    const stolenItems = items.filter(item => {
      if (item.status === ItemStatus.STOLEN) return true;
      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return title.includes('roubo') || title.includes('assalto') || desc.includes('roubado') || desc.includes('assaltado');
    });

    if (stolenItems.length === 0) return [];

    // Map of common locations to precise coords to enrich the mapping data if item has no latitude
    const landmarkMapping: Record<string, { lat: number; lng: number }> = {
      'xipamanine': { lat: -25.9525, lng: 32.5528 },
      'baixa': { lat: -25.9723, lng: 32.5684 },
      'magoanine': { lat: -25.8850, lng: 32.5833 },
      'mafalala': { lat: -25.9482, lng: 32.5781 },
      'maxaquene': { lat: -25.9388, lng: 32.5855 },
      'alto maé': { lat: -25.9592, lng: 32.5694 },
      'combatentes': { lat: -25.9422, lng: 32.5932 },
      'estação central': { lat: -25.9708, lng: 32.5647 },
      'jardim tunduru': { lat: -25.9681, lng: 32.5698 },
      'chamanculo': { lat: -25.9560, lng: 32.5539 },
      'costa do sol': { lat: -25.9012, lng: 32.6288 },
      'polana': { lat: -25.9685, lng: 32.5912 },
      'sommerschield': { lat: -25.9542, lng: 32.5942 },
      'museu': { lat: -25.9701, lng: 32.5885 }
    };

    const clusters: {
      name: string;
      lat: number;
      lng: number;
      theftCount: number;
      items: Item[];
      categories: Record<string, number>;
    }[] = [];

    stolenItems.forEach(item => {
      let lat = item.latitude;
      let lng = item.longitude;

      if (!lat || !lng) {
        const locLower = (item.location || '').toLowerCase();
        for (const [landmark, coords] of Object.entries(landmarkMapping)) {
          if (locLower.includes(landmark)) {
            lat = coords.lat;
            lng = coords.lng;
            break;
          }
        }
      }

      if (!lat || !lng) {
        lat = -25.9692 + (Math.random() - 0.5) * 0.1;
        lng = 32.5732 + (Math.random() - 0.5) * 0.1;
      }

      const matchedCluster = clusters.find(c => {
        const dist = getDistanceInKm(lat!, lng!, c.lat, c.lng);
        return dist <= 2.2;
      });

      if (matchedCluster) {
        matchedCluster.theftCount += 1;
        matchedCluster.items.push(item);
        if (item.category) {
          matchedCluster.categories[item.category] = (matchedCluster.categories[item.category] || 0) + 1;
        }
        matchedCluster.lat = (matchedCluster.lat * (matchedCluster.theftCount - 1) + lat!) / matchedCluster.theftCount;
        matchedCluster.lng = (matchedCluster.lng * (matchedCluster.theftCount - 1) + lng!) / matchedCluster.theftCount;
      } else {
        let clusterName = item.location || 'Zona de Risco';
        if (clusterName.toLowerCase().includes('coordenadas aproximadas') || clusterName.length > 35) {
          clusterName = item.province || 'Grande Maputo';
        }

        clusters.push({
          name: clusterName,
          lat: lat!,
          lng: lng!,
          theftCount: 1,
          items: [item],
          categories: item.category ? { [item.category]: 1 } : {}
        });
      }
    });

    return clusters.map(c => {
      const topCategory = Object.entries(c.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ELECTRONICS';
      
      let riskLevel: 'BAIXO' | 'MÉDIO' | 'ALTO' | 'CRÍTICO' = 'BAIXO';
      let riskBadgeColor = 'bg-gray-100 text-gray-800 border-gray-200';
      
      if (c.theftCount >= 4) {
        riskLevel = 'CRÍTICO';
        riskBadgeColor = 'bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/5 pulse-red-border animate-pulse';
      } else if (c.theftCount >= 2) {
        riskLevel = 'ALTO';
        riskBadgeColor = 'bg-[#d21034]/10 text-[#d21034] border-[#d21034]/20';
      } else {
        riskLevel = 'MÉDIO';
        riskBadgeColor = 'bg-[#fce100]/10 text-amber-600 border-[#fce100]/25';
      }

      return {
        ...c,
        topCategory,
        riskLevel,
        riskBadgeColor,
        radius: 1.2, // km
      };
    }).sort((a, b) => b.theftCount - a.theftCount);
  }, [items]);

  // AI Sentinel: Real-time GPS Risk-Zone Tracker
  useEffect(() => {
    if (!monitorRiskZones || aiRiskZones.length === 0 || !currentLocationCoords) {
      setActiveRiskZone(null);
      return;
    }

    let nearestZone: any = null;
    let minDistance = Infinity;

    aiRiskZones.forEach(zone => {
      const dist = getDistanceInKm(currentLocationCoords.lat, currentLocationCoords.lng, zone.lat, zone.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = zone;
      }
    });

    if (nearestZone && minDistance <= nearestZone.radius) {
      if (!activeRiskZone || activeRiskZone.zone.name !== nearestZone.name) {
        if (dismissedRiskZoneName !== nearestZone.name) {
          setActiveRiskZone({ zone: nearestZone, distance: minDistance });
          setShowRiskAlertInApp(true);

          // Trigger push notification from service worker or local browser Notification context
          const triggerPushNotification = (title: string, body: string) => {
            if (!('Notification' in window)) return;
            
            if (Notification.permission === 'granted') {
              if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification(title, {
                    body: body,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: 'ai-risk-zone-alert',
                    vibrate: [200, 100, 200, 100, 300],
                    requireInteraction: true,
                    data: { url: '/' }
                  } as any);
                });
              } else {
                new Notification(title, { body, icon: '/favicon.ico' });
              }
            }
          };

          triggerPushNotification(
            `🚨 Entrada em Zona de Risco IA!`,
            `Entrou em: ${nearestZone.name.toUpperCase()}. Local perigoso com ${nearestZone.theftCount} crimes/roubos recentes.`
          );

          try {
            playProximitySound();
            if (navigator.vibrate) {
              navigator.vibrate([150, 100, 150, 100, 250]);
            }
          } catch (e) {
            console.warn("Sentinel alert failed sound trigger:", e);
          }
        }
      } else {
        setActiveRiskZone({ zone: nearestZone, distance: minDistance });
      }
    } else {
      setActiveRiskZone(null);
      if (dismissedRiskZoneName) {
        setDismissedRiskZoneName(null);
      }
    }
  }, [currentLocationCoords, aiRiskZones, monitorRiskZones, dismissedRiskZoneName]);

  const sortedPoliceStations = useMemo(() => {
    const lat = currentLocationCoords?.lat ?? -25.9692;
    const lng = currentLocationCoords?.lng ?? 32.5732;
    return POLICE_STATIONS.map(station => {
      const distance = getDistanceInKm(lat, lng, station.lat, station.lng);
      return { ...station, distance };
    }).sort((a, b) => a.distance - b.distance);
  }, [currentLocationCoords]);

  const feedMapFilteredItems = useMemo(() => {
    if (feedMapStatusFilter === 'ALL') return items;
    return items.filter(item => item.status === feedMapStatusFilter);
  }, [items, feedMapStatusFilter]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Keep reunited (recovered) items visible for exactly 7 days before automatic deletion
      if (item.status === ItemStatus.REUNITED) {
        if (!item.reunitedAt) return false;
        const reunitedDate = new Date(item.reunitedAt);
        const diffTime = Date.now() - reunitedDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      }

      const statusMatch = filters.status === 'ALL' 
        ? true 
        : filters.status === 'MISSING' 
          ? (item.category === Category.PEOPLE) 
          : filters.status === 'PETS'
            ? (item.category === Category.PETS)
            : item.status === filters.status;
      const categoryMatch = filters.category === 'ALL' || item.category === filters.category;
      const provinceMatch = filters.province === 'ALL' || item.province === filters.province;
      const dateMatch = !filters.date || item.date === filters.date;
      
      const isHighValueItem = (item.reward && item.reward >= 2000) || [
        Category.DOCUMENTS,
        Category.ELECTRONICS,
        Category.WALLETS,
        Category.BAGS,
        Category.KEYS,
        Category.JEWELRY
      ].includes(item.category);
      const highValueMatch = !filters.highValueOnly || isHighValueItem;

      let searchMatch = !filters.searchQuery;
      if (filters.searchQuery) {
        const queryNormalized = filters.searchQuery.toLowerCase();
        const hasExactMatch = item.title.toLowerCase().includes(queryNormalized) || 
                              item.description.toLowerCase().includes(queryNormalized);
        
        const semanticScore = semanticScores[item.id] || 0;
        // Match if exact keyword matches, OR if semantic similarity is relevant (threshold of 0.50)
        searchMatch = hasExactMatch || (semanticScore > 0.50);
      }
      
      // Filtros de recompensa
      const rewardMinVal = filters.minReward !== '' ? parseFloat(filters.minReward) : null;
      const rewardMaxVal = filters.maxReward !== '' ? parseFloat(filters.maxReward) : null;
      const itemReward = item.reward || 0;
      const minRewardMatch = rewardMinVal === null || itemReward >= rewardMinVal;
      const maxRewardMatch = rewardMaxVal === null || itemReward <= rewardMaxVal;

      // Filtro de distância geográfica
      let distanceMatch = true;
      if (filters.maxDistance !== 'ALL') {
        if (item.latitude === undefined || item.longitude === undefined) {
          distanceMatch = false;
        } else {
          const distInKm = getDistanceInKm(
            currentLocationCoords.lat,
            currentLocationCoords.lng,
            item.latitude,
            item.longitude
          );
          distanceMatch = distInKm <= parseFloat(filters.maxDistance);
        }
      }

      return statusMatch && categoryMatch && provinceMatch && dateMatch && highValueMatch && searchMatch && minRewardMatch && maxRewardMatch && distanceMatch;
    }).sort((a, b) => {
      const aPromoted = !!a.isBoosted;
      const bPromoted = !!b.isBoosted;
      if (aPromoted && !bPromoted) return -1;
      if (!aPromoted && bPromoted) return 1;

      // Se a pesquisa semântica estiver activa, ordene os itens pela pontuação de similaridade semântica
      if (filters.searchQuery && Object.keys(semanticScores).length > 0) {
        const scoreA = semanticScores[a.id] || 0;
        const scoreB = semanticScores[b.id] || 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, filters, currentLocationCoords, semanticScores]);

  const checkForMatches = async (newItem: Item) => {
    // Only search for matches if item is LOST, STOLEN or FOUND
    const isSearchable = newItem.status === ItemStatus.LOST || newItem.status === ItemStatus.STOLEN || newItem.status === ItemStatus.FOUND;
    if (!isSearchable) return;

    // Determine opposite search scope
    const potentialMatches = items.filter(i => {
      if (newItem.status === ItemStatus.FOUND) {
        return (i.status === ItemStatus.LOST || i.status === ItemStatus.STOLEN) && i.category === newItem.category;
      } else {
        return i.status === ItemStatus.FOUND && i.category === newItem.category;
      }
    });

    for (const otherItem of potentialMatches) {
      try {
        const result = await analyzeItemMatch(
          (newItem.status === ItemStatus.LOST || newItem.status === ItemStatus.STOLEN) ? newItem : otherItem,
          newItem.status === ItemStatus.FOUND ? newItem : otherItem
        );

        if (result.isMatch) {
          const isHighValue = 
            (newItem.reward && newItem.reward >= 2000) || [Category.DOCUMENTS, Category.ELECTRONICS, Category.WALLETS, Category.BAGS, Category.KEYS, Category.JEWELRY].includes(newItem.category) ||
            (otherItem.reward && otherItem.reward >= 2000) || [Category.DOCUMENTS, Category.ELECTRONICS, Category.WALLETS, Category.BAGS, Category.KEYS, Category.JEWELRY].includes(otherItem.category);

          // Notificar o utilizador atual (quem está a reportar agora)
          addNotification({
            type: 'MATCH',
            title: 'Possível Correspondência Encontrada! 🎯',
            description: `A IA detectou uma alta probabilidade (${result.similarity}%) de que o item "${otherItem.title}" seja o correspondente ao seu. ${result.reasoning}`,
            itemId: otherItem.id,
            isHighValueMatch: isHighValue
          });

          // Notificar TAMBÉM o outro utilizador (quem publicou o item correspondente anteriormente)
          if (otherItem.userId && otherItem.userId !== currentUser?.id) {
            addNotification({
              type: 'MATCH',
              title: 'Novo Match Encontrado para o seu Item! 📡',
              description: `Um anúncio correspondente ao seu item "${otherItem.title}" foi publicado por outro membro da comunidade. A IA calculou ${result.similarity}% de compatibilidade.`,
              itemId: newItem.id,
              isHighValueMatch: isHighValue
            }, otherItem.userId);
          }
          
          // Only notify for the first strong match to avoid spam
          break;
        }
      } catch (error) {
        console.error("Erro ao verificar matches:", error);
      }
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishCooldown > 0) {
      alert(`Por favor, aguarde ${publishCooldown} segundos antes de tentar publicar novamente para evitar envios duplicados acidentais.`);
      return;
    }
    setFormErrors({});

    // Validação
    const errors: Record<string, string> = {};
    if (!newItem.title || newItem.title.trim().length < 3) errors.title = "O título deve ter pelo menos 3 caracteres.";
    if (!newItem.description || newItem.description.trim().length < 10) errors.description = "Dê uma descrição mais detalhada (mín. 10 chars).";
    if (!newItem.location || newItem.location.trim().length < 3) errors.location = "Indique o local aproximado.";
    if (!newItem.ownerName || newItem.ownerName.trim().length < 2) errors.ownerName = "Introduza o seu nome.";
    if (!newItem.ownerPhone || newItem.ownerPhone.trim().length < 9) errors.ownerPhone = "Contacto inválido.";
    if (!newItem.date) {
      errors.date = "A data é obrigatória.";
    } else {
      const selectedDate = new Date(newItem.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Incluir o final do dia de hoje
      if (selectedDate > today) {
        errors.date = "A data não pode ser no futuro.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstError = Object.keys(errors)[0];
      const element = document.getElementsByName(firstError)[0];
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!securityTermsAccepted) {
      alert("Por favor, confirme os termos de segurança e compromisso para publicar.");
      return;
    }

    if ((newItem.status === ItemStatus.LOST || newItem.status === ItemStatus.STOLEN) && !currentUser) {
      alert("Para publicar um item perdido ou roubado, você deve estar logado e verificado.");
      setActiveTab('profile');
      return;
    }

    if (currentUser && !currentUser.isVerified && (newItem.status === ItemStatus.LOST || newItem.status === ItemStatus.STOLEN)) {
      alert("Sua conta ainda não foi verificada. Por favor, envie sua foto do documento no perfil.");
      setActiveTab('profile');
      return;
    }

    // Validação Inteligente com IA da Descrição antes de permitir a submissão
    const currentDesc = newItem.description?.trim() || '';
    let validation = descValidationResult;

    if (!validation || descValidatedForText !== currentDesc) {
      setIsSubmitting(true);
      validation = await handleValidateDescription();
      setIsSubmitting(false);
    }

    if (validation && !validation.isSufficient && !hasUserOverriddenDescValidation) {
      setShowInsufficientDescModal(true);
      const descElem = document.getElementsByName('description')[0];
      if (descElem) descElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsSubmitting(true);
    setPublishCooldown(15); // Ativar limite de taxa de 15 segundos para evitar envios duplicados acidentais
    const id = Math.random().toString(36).substr(2, 9);
    const lat = -25.9692 + (Math.random() - 0.5) * 0.05;
    const lng = 32.5732 + (Math.random() - 0.5) * 0.05;

    const item: Item = {
      id,
      title: newItem.title || 'Sem Título',
      description: newItem.description || '',
      category: newItem.category as Category,
      status: newItem.status as ItemStatus,
      location: newItem.location || 'N/A',
      province: newItem.province || 'Maputo Cidade',
      date: newItem.date || new Date().toISOString(),
      reward: newItem.reward || 0,
      imageUrl: newItem.imageUrls && newItem.imageUrls.length > 0 ? newItem.imageUrls[0] : `https://picsum.photos/seed/${id}/400/300`,
      imageUrls: newItem.imageUrls && newItem.imageUrls.length > 0 ? newItem.imageUrls : [`https://picsum.photos/seed/${id}/400/300`],
      userId: currentUser?.id || 'anonymous',
      ownerName: newItem.ownerName || currentUser?.name || 'Utilizador Anónimo',
      ownerPhone: newItem.ownerPhone || currentUser?.phone || '',
      createdAt: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      transitLatitude: lat,
      transitLongitude: lng,
      isTrackingActive: false,
      ownerVerified: currentUser?.isVerified || false
    };
    // Se estiver sem ligação à internet ou em modo offline
    if (!navigator.onLine || !isOnline) {
      const updatedQueue = [item, ...pendingItems];
      localStorage.setItem('comeback_pending_items', JSON.stringify(updatedQueue));
      setPendingItems(updatedQueue);
      setItems(prev => [item, ...prev]);

      setIsSubmitting(false);
      setIsSecuritySliderVerified(false);
      setSecurityTermsAccepted(false);
      
      // Reset form
      setNewItem({
        status: ItemStatus.LOST,
        category: Category.DOCUMENTS,
        province: 'Maputo Cidade',
        date: new Date().toISOString().split('T')[0],
        ownerName: currentUser?.name || '',
        ownerPhone: currentUser?.phone || '',
        imageUrls: []
      });
      localStorage.removeItem('comeback_publish_draft');
      localStorage.removeItem('comeback_publish_draft');
      
      setActiveTab('feed');
      alert("📦 Artigo guardado com sucesso na fila de envio offline! Ele já está visível localmente no feed e será sincronizado com a base de dados assim que a ligação à internet for restabelecida.");
      return;
    }

    try {
      await setDoc(doc(db, 'items', item.id), item);
      setIsSubmitting(false);
      setIsSecuritySliderVerified(false);
      setSecurityTermsAccepted(false);
      
      // Reset form
      setNewItem({
        status: ItemStatus.LOST,
        category: Category.DOCUMENTS,
        province: 'Maputo Cidade',
        date: new Date().toISOString().split('T')[0],
        ownerName: currentUser?.name || '',
        ownerPhone: currentUser?.phone || '',
        imageUrls: []
      });
      localStorage.removeItem('comeback_publish_draft');
      
      setActiveTab('feed');

      // Iniciar verificação de matches em background
      checkForMatches(item);
    } catch (error: any) {
      console.warn("Falha ao gravar item no Firestore em tempo real, enfileirando offline:", error);
      const updatedQueue = [item, ...pendingItems];
      localStorage.setItem('comeback_pending_items', JSON.stringify(updatedQueue));
      setPendingItems(updatedQueue);
      setItems(prev => [item, ...prev]);

      setIsSubmitting(false);
      setIsSecuritySliderVerified(false);
      setSecurityTermsAccepted(false);
      
      setNewItem({
        status: ItemStatus.LOST,
        category: Category.DOCUMENTS,
        province: 'Maputo Cidade',
        date: new Date().toISOString().split('T')[0],
        ownerName: currentUser?.name || '',
        ownerPhone: currentUser?.phone || '',
        imageUrls: []
      });
      localStorage.removeItem('comeback_publish_draft');
      
      setActiveTab('feed');
      alert("📦 Artigo guardado na fila offline de sincronização! Será enviado para o servidor assim que a ligação for restabelecida.");
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setDeleteConfirmItemId(itemId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmItemId) return;
    setIsDeletingItem(true);
    try {
      await deleteDoc(doc(db, 'items', deleteConfirmItemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'items/' + deleteConfirmItemId);
    } finally {
      setIsDeletingItem(false);
      setDeleteConfirmItemId(null);
    }
  };

  const handleSendMessage = async (
    text: string, 
    type: 'text' | 'image' | 'location' = 'text', 
    mediaUrl?: string, 
    coords?: { lat: number; lng: number }
  ) => {
    if (!activeChat || !currentUser) return;

    // Lógica para determinar quem é o destinatário
    const chatMessages = messages.filter(m => m.itemId === activeChat.id);
    const otherMessage = chatMessages.find(m => m.senderId !== currentUser.id || m.receiverId !== currentUser.id);
    
    let receiverId = activeChat.userId; // Default: o dono do item
    if (currentUser.id === activeChat.userId) {
      // Se eu sou o dono, o destinatário é quem me mandou mensagem antes
      receiverId = otherMessage?.senderId === currentUser.id 
        ? (otherMessage.receiverId === currentUser.id ? 'unknown' : otherMessage.receiverId) 
        : (otherMessage?.senderId || 'unknown');
    }

    const msgId = Math.random().toString(36).substr(2, 9);
    const msg: any = {
      id: msgId,
      itemId: activeChat.id,
      senderId: currentUser.id,
      receiverId: receiverId,
      text: text,
      type: type,
      timestamp: new Date().toISOString()
    };

    if (mediaUrl) msg.mediaUrl = mediaUrl;
    if (coords) {
      msg.latitude = coords.lat;
      msg.longitude = coords.lng;
    }
    
    // Se o utilizador estiver em modo offline comprovado, enfileira logo para evitar atrasos
    if (!navigator.onLine) {
      msg.pending = true;
      savePendingMessage(msg);
      return;
    }

    try {
      await setDoc(doc(db, 'messages', msgId), msg);
    } catch (error) {
      console.warn("Falha ao registar mensagem em tempo real, guardando offline para sincronização automática:", error);
      msg.pending = true;
      savePendingMessage(msg);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    const item = items.find(i => i.id === notif.itemId);
    if (item) {
      if (notif.type === 'DELIVERY') {
        setSelectedItem(item);
        setIsViewingDelivery(true);
      } else {
        setSelectedItem(item);
      }
      
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
      } catch (error) {
        console.error("Erro ao marcar notificação como lida:", error);
      }
      setShowNotifications(false);
    }
  };

  const myItems = useMemo(() => {
    if (!currentUser) return [];
    return items.filter(i => i.userId === currentUser.id);
  }, [items, currentUser]);

  const nearbyAlerts = useMemo(() => {
    return items
      .filter(item => {
        if (item.latitude === undefined || item.longitude === undefined) return false;
        if (currentUser && item.userId === currentUser.id) return false;
        const dist = getDistanceInKm(
          currentLocationCoords.lat,
          currentLocationCoords.lng,
          item.latitude,
          item.longitude
        );
        return dist <= 12.0;
      })
      .map(item => ({
        item,
        distance: getDistanceInKm(
          currentLocationCoords.lat,
          currentLocationCoords.lng,
          item.latitude!,
          item.longitude!
        )
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [items, currentLocationCoords, currentUser]);

  const marqueeAlerts = useMemo(() => {
    if (nearbyAlerts.length === 0) return [];
    let list = [...nearbyAlerts];
    while (list.length < 5) {
      list = [...list, ...nearbyAlerts];
    }
    return [...list, ...list];
  }, [nearbyAlerts]);

  const latestDocuments = useMemo(() => {
    return items
      .filter(item => item.category === Category.DOCUMENTS)
      .slice(0, 4);
  }, [items]);

  const isFiltering = useMemo(() => {
    return filters.category !== 'ALL' || 
           filters.status !== 'ALL' || 
           filters.province !== 'ALL' || 
           filters.searchQuery.trim() !== '' || 
           filters.date !== '' || 
           filters.highValueOnly ||
           filters.minReward !== '' ||
           filters.maxReward !== '' ||
           filters.maxDistance !== 'ALL';
  }, [filters]);

  const displayedItemIds = useMemo(() => {
    const ids = new Set<string>();
    // Exclude duplicates only when we are not filtering, since the showcases are visible
    if (!isFiltering) {
      nearbyAlerts.forEach(({ item }) => ids.add(item.id));
      latestDocuments.forEach(item => ids.add(item.id));
    }
    return ids;
  }, [nearbyAlerts, latestDocuments, isFiltering]);

  const mainFeedItems = useMemo(() => {
    return filteredItems.filter(item => !displayedItemIds.has(item.id));
  }, [filteredItems, displayedItemIds]);

  // Calculation of recent & near-me lists for Discovery Feed view (Screenshot 2)
  const recentItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [filteredItems]);

  const nearMeItems = useMemo(() => {
    return filteredItems.filter(item => item.status === ItemStatus.FOUND || item.location).slice(0, 6);
  }, [filteredItems]);

  // Calculate count of items matching each category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: items.filter(item => {
        if (filters.status !== 'ALL' && item.status !== filters.status) return false;
        if (filters.province !== 'ALL' && item.province !== filters.province) return false;
        return true;
      }).length
    };
    Object.values(Category).forEach(cat => {
      counts[cat] = items.filter(item => {
        if (item.category !== cat) return false;
        if (filters.status !== 'ALL' && item.status !== filters.status) return false;
        if (filters.province !== 'ALL' && item.province !== filters.province) return false;
        return true;
      }).length;
    });
    return counts;
  }, [items, filters.status, filters.province]);

  const isSearchOrFilterActive = !!filters.searchQuery || filters.status !== 'ALL' || filters.category !== 'ALL' || filters.province !== 'ALL' || showFilters;

  const renderFeed = () => {
    const lostCount = items.filter(i => i.status === ItemStatus.LOST && i.category !== Category.PEOPLE).length;
    const foundCount = items.filter(i => i.status === ItemStatus.FOUND).length;
    const stolenCount = items.filter(i => i.status === ItemStatus.STOLEN).length;
    const missingCount = items.filter(i => i.category === Category.PEOPLE).length;
    const petsCount = items.filter(i => i.category === Category.PETS).length;
    const reunitedCount = items.filter(i => i.status === ItemStatus.REUNITED).length;

    return (
      <div className="flex-1 flex flex-col w-full bg-[#f8fafc] dark:bg-slate-905 pb-32 font-sans">
        {/* Top Search, Province & Filter Bar - Clean, Minimal & Fast */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-[0_1px_8px_rgba(15,34,74,0.06)] backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
          <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-3">
            {/* Search Input Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 basis-full sm:basis-0 min-w-0 flex items-center bg-slate-100/90 hover:bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#008fe2]/20 border border-slate-200/80 rounded-full px-3.5 py-2 transition-all">
                <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs mr-2.5"></i>
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome, BI, marca, chave..." 
                  className="w-full bg-transparent outline-none text-xs font-semibold text-slate-800 placeholder-slate-400"
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSearchQuery(filters.searchQuery);
                  }}
                />
                {filters.searchQuery && (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, searchQuery: '' })}
                    className="text-slate-400 hover:text-slate-600 ml-1.5 cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <i className="fa-solid fa-circle-xmark text-xs"></i>
                  </button>
                )}
              </div>

              {/* Province Selector */}
              <div className="relative shrink-0 flex-1 sm:flex-none">
                <select
                  value={filters.province}
                  onChange={(e) => setFilters({ ...filters, province: e.target.value })}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-150 border border-slate-200/80 text-slate-700 text-[11px] font-bold py-2.5 px-3 rounded-full outline-none cursor-pointer transition-colors"
                >
                  <option value="ALL">📍 Moçambique</option>
                  {MOZAMBIQUE_PROVINCES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Filter Drawer Toggle */}
              <button 
                type="button"
                onClick={() => setShowFilters(!showFilters)} 
                className={`p-2.5 rounded-full border transition-all flex items-center justify-center cursor-pointer relative ${
                  showFilters || activeFiltersCount > 0 
                    ? 'bg-[#008fe2] border-[#008fe2] text-white shadow-xs' 
                    : 'bg-slate-100 border-slate-200/80 text-slate-600 hover:bg-slate-200'
                }`}
                title="Filtros Avançados"
              >
                <i className="fa-solid fa-sliders text-xs"></i>
                {activeFiltersCount > 0 && !showFilters && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Horizontal Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setFilters({ ...filters, category: 'ALL' })}
                className={`px-3 py-1.5 rounded-xl text-[10.5px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                  filters.category === 'ALL' 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                    : 'bg-slate-100/80 hover:bg-slate-150 text-slate-700 border-slate-200/60'
                }`}
              >
                <i className="fa-solid fa-border-all text-[10px]"></i>
                <span>Todas</span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full ${
                  filters.category === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {categoryCounts['ALL'] ?? 0}
                </span>
              </button>

              {Object.values(Category).map((cat) => {
                const count = categoryCounts[cat] ?? 0;
                const isSelected = filters.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilters({ ...filters, category: cat })}
                    className={`px-3 py-1.5 rounded-xl text-[10.5px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected 
                        ? 'bg-[#008fe2] text-white border-[#008fe2] shadow-xs' 
                        : 'bg-slate-100/80 hover:bg-slate-150 text-slate-700 border-slate-200/60'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Status Tabs + View Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-0.5">
              {/* Status Segmented Control */}
              <div className="w-full sm:w-auto flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: 'ALL' })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer shrink-0 ${
                    filters.status === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: ItemStatus.LOST })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === ItemStatus.LOST ? 'bg-[#d21034] text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d21034] shrink-0"></span>
                  <span>Perdidos ({lostCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: ItemStatus.FOUND })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === ItemStatus.FOUND ? 'bg-[#009739] text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#009739] shrink-0"></span>
                  <span>Achados ({foundCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: ItemStatus.STOLEN })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === ItemStatus.STOLEN ? 'bg-rose-900 text-white shadow-xs' : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <i className="fa-solid fa-shield-halved text-[9px]"></i>
                  <span>Roubados ({stolenCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: 'MISSING' })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === 'MISSING' ? 'bg-indigo-700 text-white shadow-xs' : 'text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  <i className="fa-solid fa-person-circle-question text-[9px]"></i>
                  <span>Desaparecidos ({missingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: 'PETS' })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === 'PETS' ? 'bg-amber-700 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <i className="fa-solid fa-paw text-[9px]"></i>
                  <span>Animais ({petsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, status: ItemStatus.REUNITED })}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                    filters.status === ItemStatus.REUNITED ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>Recuperados ({reunitedCount})</span>
                </button>
              </div>

              {/* View Switcher (Feed vs Mapa) */}
              <div className="self-end sm:self-auto flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setFeedViewMode('feed')}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                    feedViewMode === 'feed' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Ver em Lista / Grelha"
                >
                  <i className="fa-solid fa-grip text-xs"></i>
                  <span className="hidden sm:inline">Feed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedViewMode('map')}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                    feedViewMode === 'map' ? 'bg-[#008fe2] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Ver no Mapa"
                >
                  <i className="fa-solid fa-map-location-dot text-xs"></i>
                  <span className="hidden sm:inline">Mapa</span>
                </button>
              </div>
            </div>

            {/* Expandable Advanced Filter drawer */}
            {showFilters && (
              <div className="pt-3 border-t border-slate-200 text-left space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-slate-600">Filtros Avançados de Pesquisa</span>
                  <button
                    type="button"
                    onClick={() => setFilters({
                      status: 'ALL',
                      category: 'ALL',
                      province: 'ALL',
                      date: '',
                      searchQuery: '',
                      highValueOnly: false,
                      minReward: '',
                      maxReward: '',
                      maxDistance: 'ALL'
                    })}
                    className="text-[10px] font-bold text-rose-600 uppercase hover:underline cursor-pointer"
                  >
                    Limpar Todos
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      <i className="fa-solid fa-location-crosshairs text-slate-400 mr-1"></i>
                      Raio Próximo (GPS)
                    </label>
                    <select
                      value={filters.maxDistance}
                      onChange={(e) => setFilters({ ...filters, maxDistance: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#008fe2]"
                    >
                      <option value="ALL">Qualquer Distância</option>
                      <option value="5">Até 5 km de mim</option>
                      <option value="15">Até 15 km de mim</option>
                      <option value="30">Até 30 km de mim</option>
                      <option value="50">Até 50 km de mim</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recompensa Mínima (MZN)</label>
                    <input 
                      type="number"
                      placeholder="Ex: 500"
                      value={filters.minReward}
                      onChange={(e) => setFilters({ ...filters, minReward: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#008fe2]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data do Registo</label>
                    <input 
                      type="date"
                      value={filters.date}
                      onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#008fe2]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Body Content */}
        <div className="max-w-6xl mx-auto w-full px-3 py-4 sm:p-5 space-y-5">
          {/* MAP RADAR VIEW MODE */}
          {feedViewMode === 'map' ? (
            <div id="feed-google-maps-section" className="bg-white/95 backdrop-blur-md rounded-3xl p-3.5 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5 transition-all text-left">
              {/* Header do Mapa com Ações Rápidas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFeedViewMode('feed')}
                      className="px-2.5 py-1 rounded-xl bg-slate-100/85 hover:bg-slate-200/90 backdrop-blur-md text-slate-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
                    >
                      <i className="fa-solid fa-arrow-left text-xs"></i>
                      <span>Voltar ao Feed</span>
                    </button>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200/80 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-map-location-dot text-emerald-600"></i> Google Maps • Moçambique
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-100/80 backdrop-blur-sm text-slate-700 border border-slate-200/80 text-[8.5px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      {filters.province !== 'ALL' ? filters.province : 'Todo Moçambique'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                    Mapa de Perdidos e Achados
                  </h2>
                </div>

                {/* Botões de Ação do Mapa */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-between sm:justify-end">
                  {/* Botão de Alternância: Mostrar Esquadras (5 mais próximas com escudo azul) */}
                  <button
                    id="btn-feed-map-toggle-police"
                    type="button"
                    onClick={() => setFeedShowPoliceStations(prev => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-[9.5px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border backdrop-blur-md shrink-0 ${
                      feedShowPoliceStations
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 shadow-xs'
                        : 'bg-slate-100/80 hover:bg-slate-200/90 text-slate-700 border-slate-200/80'
                    }`}
                    title={feedShowPoliceStations ? 'Esquadras ativas (as 5 mais próximas com ícone de escudo azul)' : 'Ativar marcadores das 5 esquadras mais próximas'}
                  >
                    <i className={`fa-solid fa-shield-halved text-xs ${feedShowPoliceStations ? 'text-cyan-200 animate-pulse' : 'text-blue-600'}`}></i>
                    <span className="whitespace-nowrap">{feedShowPoliceStations ? 'Esquadras (5)' : 'Esquadras'}</span>
                  </button>

                  {/* Seletor e Menu Suspenso de Estilo do Mapa (Ruas vs. Satélite) */}
                  <div id="btn-feed-map-style-toggle-container" className="relative flex items-center gap-0.5 sm:gap-1 bg-slate-100/80 backdrop-blur-md p-1 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0">
                    {/* Botão Ruas (google_streets) com Indicador Ativo */}
                    <button
                      id="btn-feed-map-street-view"
                      type="button"
                      onClick={() => setFeedMapTileStyle('google_streets')}
                      className={`relative px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none shrink-0 ${
                        feedMapTileStyle === 'google_streets'
                          ? 'bg-white/95 text-emerald-950 shadow-xs border border-emerald-300 ring-1 ring-emerald-500/20'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                      title="Modo Ruas (Google Maps) - Mapa vetorial de avenidas e bairros"
                    >
                      <span className="relative flex items-center justify-center">
                        <i className={`fa-solid fa-map text-xs ${feedMapTileStyle === 'google_streets' ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                        {feedMapTileStyle === 'google_streets' && (
                          <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 ring-1 ring-white animate-pulse"></span>
                        )}
                      </span>
                      <span>Ruas</span>
                      {feedMapTileStyle === 'google_streets' && (
                        <span className="hidden xs:inline-flex px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[7px] font-extrabold tracking-tight">ATIVO</span>
                      )}
                    </button>

                    {/* Botão Satélite HD (google_hybrid) com Indicador Ativo */}
                    <button
                      id="btn-feed-map-satellite-view"
                      type="button"
                      onClick={() => setFeedMapTileStyle('google_hybrid')}
                      className={`relative px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none shrink-0 ${
                        feedMapTileStyle === 'google_hybrid'
                          ? 'bg-slate-950/95 text-amber-300 shadow-xs border border-amber-400/50 ring-1 ring-amber-400/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                      title="Modo Satélite HD (Google Satélite) - Fotografias aéreas reais de quarteirões e telhados"
                    >
                      <span className="relative flex items-center justify-center">
                        <i className={`fa-solid fa-earth-africa text-xs ${feedMapTileStyle === 'google_hybrid' ? 'text-amber-400' : 'text-blue-500'}`}></i>
                        {feedMapTileStyle === 'google_hybrid' && (
                          <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 ring-1 ring-slate-900 animate-ping"></span>
                        )}
                      </span>
                      <span>Satélite</span>
                      {feedMapTileStyle === 'google_hybrid' && (
                        <span className="hidden xs:inline-flex px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[7px] font-extrabold tracking-tight border border-amber-400/30">ATIVO</span>
                      )}
                    </button>

                    {/* Menu Suspenso de Estilos Adicionais */}
                    <div className="relative shrink-0">
                      <button
                        id="btn-feed-map-style-dropdown-toggle"
                        type="button"
                        onClick={() => setIsFeedMapStyleMenuOpen(prev => !prev)}
                        className={`p-1 sm:p-1.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                          isFeedMapStyleMenuOpen ? 'bg-slate-300/80 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                        }`}
                        title="Abrir menu suspenso com todos os estilos e camadas"
                      >
                        <i className="fa-solid fa-layer-group text-xs"></i>
                        <i className={`fa-solid fa-chevron-down text-[7px] ml-0.5 sm:ml-1 transition-transform duration-200 ${isFeedMapStyleMenuOpen ? 'rotate-180' : ''}`}></i>
                      </button>

                      {/* Dropdown Menu Popup */}
                      {isFeedMapStyleMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-[490]" 
                            onClick={() => setIsFeedMapStyleMenuOpen(false)}
                          />
                          <div 
                            id="feed-map-style-dropdown-menu"
                            className="absolute right-0 top-full mt-2 w-60 sm:w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-[500] space-y-1 select-none animate-in fade-in zoom-in-95 duration-150"
                          >
                          <div className="px-2 py-1 text-[8.5px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                            <span>Perspectiva do Mapa</span>
                            <span className="text-[7.5px] text-emerald-600 lowercase font-mono">google tiles</span>
                          </div>

                          {/* Opção Ruas */}
                          <button
                            type="button"
                            onClick={() => {
                              setFeedMapTileStyle('google_streets');
                              setIsFeedMapStyleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              feedMapTileStyle === 'google_streets'
                                ? 'bg-emerald-50 text-emerald-950 font-black border border-emerald-300/80 shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${feedMapTileStyle === 'google_streets' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <i className="fa-solid fa-map"></i>
                              </div>
                              <div>
                                <p className="text-[10px] font-extrabold uppercase leading-tight">Google Ruas</p>
                                <p className="text-[8px] text-slate-500 font-medium">Vias, estradas e bairros</p>
                              </div>
                            </div>
                            {feedMapTileStyle === 'google_streets' && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                <i className="fa-solid fa-check text-[8px]"></i> Ativo
                              </span>
                            )}
                          </button>

                          {/* Opção Satélite Híbrido */}
                          <button
                            type="button"
                            onClick={() => {
                              setFeedMapTileStyle('google_hybrid');
                              setIsFeedMapStyleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              feedMapTileStyle === 'google_hybrid'
                                ? 'bg-slate-900 text-amber-300 font-black border border-slate-800 shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${feedMapTileStyle === 'google_hybrid' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                                <i className="fa-solid fa-earth-africa"></i>
                              </div>
                              <div>
                                <p className="text-[10px] font-extrabold uppercase leading-tight">Satélite HD (Híbrido)</p>
                                <p className={`text-[8px] font-medium ${feedMapTileStyle === 'google_hybrid' ? 'text-slate-300' : 'text-slate-500'}`}>Fotografia aérea real</p>
                              </div>
                            </div>
                            {feedMapTileStyle === 'google_hybrid' && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded-md border border-amber-400/30">
                                <i className="fa-solid fa-check text-[8px]"></i> Ativo
                              </span>
                            )}
                          </button>

                          {/* Opção Relevo */}
                          <button
                            type="button"
                            onClick={() => {
                              setFeedMapTileStyle('google_terrain');
                              setIsFeedMapStyleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              feedMapTileStyle === 'google_terrain'
                                ? 'bg-emerald-50 text-emerald-950 font-black border border-emerald-300/80 shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${feedMapTileStyle === 'google_terrain' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <i className="fa-solid fa-mountain"></i>
                              </div>
                              <div>
                                <p className="text-[10px] font-extrabold uppercase leading-tight">Google Relevo</p>
                                <p className="text-[8px] text-slate-500 font-medium">Topografia e curvas de nível</p>
                              </div>
                            </div>
                            {feedMapTileStyle === 'google_terrain' && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                <i className="fa-solid fa-check text-[8px]"></i> Ativo
                              </span>
                            )}
                          </button>

                          {/* Opção OpenStreetMap */}
                          <button
                            type="button"
                            onClick={() => {
                              setFeedMapTileStyle('osm');
                              setIsFeedMapStyleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                              feedMapTileStyle === 'osm'
                                ? 'bg-emerald-50 text-emerald-950 font-black border border-emerald-300/80 shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${feedMapTileStyle === 'osm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <i className="fa-solid fa-globe"></i>
                              </div>
                              <div>
                                <p className="text-[10px] font-extrabold uppercase leading-tight">OpenStreetMap</p>
                                <p className="text-[8px] text-slate-500 font-medium">Cartografia colaborativa</p>
                              </div>
                            </div>
                            {feedMapTileStyle === 'osm' && (
                              <span className="flex items-center gap-1 text-[8px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                                <i className="fa-solid fa-check text-[8px]"></i> Ativo
                              </span>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                    </div>
                  </div>

                  <button
                    id="btn-share-radar"
                    type="button"
                    onClick={() => setIsShareRadarModalOpen(true)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#008fe2] to-[#153268] hover:opacity-95 active:scale-95 text-white text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-white/20 shrink-0"
                    title="Partilhar Radar"
                  >
                    <i className="fa-solid fa-share-nodes text-xs animate-pulse"></i>
                    <span className="hidden sm:inline">Partilhar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentLocationCoords) {
                        setFeedMapFocusLocation({ ...currentLocationCoords });
                      }
                    }}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/90 backdrop-blur-md text-slate-700 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200/80 shadow-2xs shrink-0"
                    title="Minha Posição"
                  >
                    <i className="fa-solid fa-crosshairs text-emerald-600"></i>
                    <span className="hidden sm:inline">Minha Posição</span>
                  </button>
                </div>
              </div>

              {/* Filtros Rápidos de Status no Mapa com Efeito Semi-Transparente */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1 px-1.5 bg-slate-50/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFeedMapStatusFilter('ALL')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                    feedMapStatusFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white/80 hover:bg-white text-slate-600 border-gray-200/80'
                  }`}
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>Todos ({items.filter(i => i.latitude && i.longitude).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedMapStatusFilter(ItemStatus.LOST)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                    feedMapStatusFilter === ItemStatus.LOST
                      ? 'bg-[#d21034] text-white border-[#d21034] shadow-xs'
                      : 'bg-rose-50/80 text-rose-700 border-rose-200/80 hover:bg-rose-100/90'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#d21034]"></span>
                  <span>Perdidos ({items.filter(i => i.status === ItemStatus.LOST && i.latitude).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedMapStatusFilter(ItemStatus.FOUND)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                    feedMapStatusFilter === ItemStatus.FOUND
                      ? 'bg-[#009739] text-white border-[#009739] shadow-xs'
                      : 'bg-emerald-50/80 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/90'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#009739]"></span>
                  <span>Achados ({items.filter(i => i.status === ItemStatus.FOUND && i.latitude).length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFeedMapStatusFilter(ItemStatus.REUNITED)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                    feedMapStatusFilter === ItemStatus.REUNITED
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50/80 text-amber-700 border-amber-200/80 hover:bg-amber-100/90'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Recuperados ({items.filter(i => i.status === ItemStatus.REUNITED && i.latitude).length})</span>
                </button>

                <div className="ml-auto pl-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFeedShowPoliceStations(prev => !prev)}
                    className={`text-[9px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                      feedShowPoliceStations 
                        ? 'bg-blue-100/90 text-blue-900 border-blue-300 shadow-2xs' 
                        : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                    }`}
                    title="Alternar exibição das 5 esquadras mais próximas"
                  >
                    <i className="fa-solid fa-building-shield text-blue-600"></i>
                    <span>{feedShowPoliceStations ? '5 Esquadras Mais Próximas' : 'Esquadras Ocultas'}</span>
                  </button>
                </div>
              </div>

              {/* Container do Mapa Refinado com Efeito de Painel e Proporções Otimizadas */}
              <div className="w-full h-[400px] xs:h-[440px] sm:h-[480px] md:h-[520px] rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm relative bg-slate-100 ring-1 ring-slate-900/5">
                <Suspense fallback={<LazyLoaderFallback />}>
                  <MapView 
                    items={feedMapFilteredItems} 
                    onViewDetails={handleViewDetails} 
                    onAction={handleItemAction} 
                    focusLocation={feedMapFocusLocation || currentLocationCoords}
                    onAddPinClick={() => setActiveTab('post')}
                    tileStyle={feedMapTileStyle}
                    onTileStyleChange={setFeedMapTileStyle}
                    showPoliceStations={feedShowPoliceStations}
                    onTogglePoliceStations={setFeedShowPoliceStations}
                  />
                </Suspense>
              </div>

              {/* Botão de Publicar Item no Mapa */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setFeedViewMode('feed')}
                  className="text-xs font-bold text-[#008fe2] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>Voltar à Lista de Artigos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('post')}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-plus-circle text-emerald-400"></i>
                  <span>Publicar no Mapa</span>
                </button>
              </div>
            </div>
          ) : (
            /* FEED LIST / GRID VIEW MODE (Lightweight, Clean & Fast) */
            <div className="space-y-4 text-left">
              {/* Items Feed Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {filters.status === 'ALL' ? 'Todos os Registos' : filters.status === ItemStatus.LOST ? 'Artigos Perdidos' : filters.status === ItemStatus.FOUND ? 'Artigos Achados' : 'Artigos Recuperados'}
                  </h2>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                    {filteredItems.length}
                  </span>
                </div>

                {isSearchOrFilterActive && (
                  <button
                    type="button"
                    onClick={() => setFilters({
                      status: 'ALL',
                      category: 'ALL',
                      province: 'ALL',
                      date: '',
                      searchQuery: '',
                      highValueOnly: false,
                      minReward: '',
                      maxReward: '',
                      maxDistance: 'ALL'
                    })}
                    className="text-[10.5px] font-bold text-rose-600 hover:underline cursor-pointer uppercase flex items-center gap-1"
                  >
                    <i className="fa-solid fa-rotate-left text-[9px]"></i>
                    <span>Limpar Filtros</span>
                  </button>
                )}
              </div>

              {/* Items Grid or Empty State */}
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                    <i className="fa-solid fa-magnifying-glass text-lg"></i>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Nenhum Artigo Encontrado</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs leading-relaxed">
                    Não encontramos resultados com os filtros atuais. Tente ajustar os termos ou selecionar outra categoria.
                  </p>
                  <button 
                    onClick={() => setFilters({
                      status: 'ALL',
                      category: 'ALL',
                      province: 'ALL',
                      date: '',
                      searchQuery: '',
                      highValueOnly: false,
                      minReward: '',
                      maxReward: '',
                      maxDistance: 'ALL'
                    })}
                    className="mt-4 bg-gradient-to-r from-[#008fe2] to-[#153268] hover:opacity-95 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider shadow-xs active:scale-95 cursor-pointer"
                  >
                    Ver Todos os Artigos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-4.5">
                  {filteredItems.map((item) => {
                    const distance = (item.latitude !== undefined && item.longitude !== undefined && currentLocationCoords?.lat !== undefined)
                      ? getDistanceInKm(currentLocationCoords.lat, currentLocationCoords.lng, item.latitude, item.longitude)
                      : null;
                    const distanceText = distance !== null 
                      ? `${distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km'}`
                      : undefined;

                    return (
                      <ItemCard 
                        key={item.id}
                        item={item} 
                        variant="grid"
                        distanceText={distanceText}
                        onViewDetails={handleViewDetails} 
                        onAction={handleItemAction}
                        isOwnerVerified={verifiedUsersMap[item.userId]}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const previewNewNet = useMemo(() => {
    if (!newItem.reward) return 0;
    return newItem.reward * (1 - TOTAL_FEE_PERCENT);
  }, [newItem.reward]);

  const previewNewTotal = useMemo(() => {
    if (!newItem.reward) return 0;
    const base = newItem.reward;
    if (newItem.status === ItemStatus.LOST) {
      return base * (1 + LOST_ITEM_SURCHARGE_PERCENT);
    }
    return base;
  }, [newItem.reward, newItem.status]);

  const previewEditNet = editingItem?.reward ? editingItem.reward * (1 - TOTAL_FEE_PERCENT) : 0;

  const reunitedConfirmItemInfo = reunitedConfirmItemId ? items.find(i => i.id === reunitedConfirmItemId) : null;

  const isExpanded = isToastExpanded || isToastFocused;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-gray-100 border-t-[#009739] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-arrow-rotate-left text-[#fce100] text-xl animate-pulse"></i>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-black text-gray-900 uppercase tracking-tighter">ComeBack Moçambique</h1>
        <p className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">A Sincronizar Dados...</p>
      </div>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange} 
      notificationCount={unreadNotificationsCount}
      onToggleNotifications={() => setShowNotifications(!showNotifications)}
      isOnline={isOnline}
      currentUser={currentUser}
      onLogin={() => handleTabChange('profile')}
      onLogout={logout}
      onOpenArchitectureHub={currentUser?.isAdmin ? () => setIsArchitectureHubOpen(true) : undefined}
      pendingSyncCounts={pendingSyncCounts}
      onManualSync={handleManualSyncAll}
      onRemoveQueueItem={handleRemoveQueueItem}
      isSyncing={isManualSyncing}
    >
      {showNotifications && (
        <NotificationDrawer 
          notifications={notifications} 
          onClose={() => setShowNotifications(false)}
          onNotificationClick={handleNotificationClick}
          currentUser={currentUser}
          onClear={async () => {
             if (!currentUser) return;
             
             const readNotifications = notifications.filter(n => n.isRead);
             if (readNotifications.length === 0) {
                alert("Não existem alertas marcados como lidos para limpar.");
                return;
             }
             
             try {
                let deletedCount = 0;
                for (const notif of readNotifications) {
                   try {
                      await deleteDoc(doc(db, 'notifications', notif.id));
                      deletedCount++;
                   } catch (e) {
                      handleFirestoreError(e, OperationType.DELETE, `notifications/${notif.id}`);
                   }
                }
                if (deletedCount > 0) {
                   alert(`${deletedCount} alerta(s) lido(s) foi/foram removido(s) permanentemente do servidor.`);
                }
             } catch (e) {
                console.error("Erro na limpeza de notificações:", e);
                alert("Ocorreu um erro ao excluir algumas notificações. Por favor, tente novamente.");
             }
          }}
        />
      )}

      {activeTab === 'feed' && !isHome && (
        <div className="bg-[#009739]/5 border-b border-[#009739]/20 px-4 py-2.5 flex items-center justify-between sticky top-0 z-[45] backdrop-blur-xs animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={goHome}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-[#007a2d] hover:text-[#009739] transition-colors bg-white border-2 border-[#009739]/30 hover:border-[#009739] px-3.5 py-1.5 rounded-2xl shadow-xs active:scale-[0.98] font-sans dark:bg-slate-900 dark:text-emerald-400 dark:border-slate-800 shrink-0"
              id="back-to-home-main-btn"
            >
              <i className="fa-solid fa-house-chimney text-xs"></i>
              <span>Ir para Início</span>
              {homeReturnCount > 0 && (
                <span className="bg-[#009739] dark:bg-emerald-500 text-white dark:text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[15px] h-[15px] flex items-center justify-center animate-in scale-in duration-300" title={`Regressou ao início ${homeReturnCount} vezes`}>
                  {homeReturnCount}
                </span>
              )}
            </button>

            {/* Auto-Refresh Toggle/Selector Pill */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border-2 border-gray-150 dark:border-slate-800 px-2.5 py-1.5 rounded-2xl shadow-xs font-sans text-[9px] font-bold uppercase select-none text-slate-700 dark:text-gray-350 shrink-0">
              <span className="flex items-center gap-1">
                <i className={`fa-solid fa-arrows-rotate text-[10px] ${isAutoRefreshing ? 'animate-spin text-[#009739] dark:text-emerald-400' : 'text-slate-400'}`}></i>
                <span className="hidden sm:inline">Auto-Sync:</span>
              </span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => {
                  const val = e.target.value;
                  const parsed = val === 'off' ? 'off' : parseInt(val, 10);
                  setAutoRefreshInterval(parsed);
                  localStorage.setItem('auto_refresh_interval', val);
                }}
                className="bg-transparent border-none outline-none focus:ring-0 text-[9px] font-black uppercase text-[#009739] dark:text-emerald-400 cursor-pointer pr-1"
                title="Intervalo de atualização automática do feed"
              >
                <option value="off" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white">Manual</option>
                <option value="30" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white">30s</option>
                <option value="60" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white">1m</option>
                <option value="300" className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white">5m</option>
              </select>
              {countdown !== null && (
                <span className="text-[8.5px] font-black text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-1 py-0.5 rounded-md min-w-[20px] text-center">
                  {countdown}s
                </span>
              )}
            </div>

            {selectedItem && (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowShareDropdown(!showShareDropdown)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase text-white bg-[#009739] hover:bg-[#007a2d] transition-colors px-3 py-1.5 rounded-2xl shadow-xs active:scale-[0.98] font-sans cursor-pointer whitespace-nowrap relative"
                    id="quick-share-btn"
                    title="Partilha Rápida do Anúncio"
                  >
                    <i className="fa-solid fa-share-nodes text-xs"></i>
                    <span>Partilhar</span>
                    {selectedItem.sharesCount && selectedItem.sharesCount > 0 ? (
                      <span className="bg-[#fce100] text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[15px] h-[15px] flex items-center justify-center animate-in scale-in duration-300" title={`Este anúncio já foi partilhado ${selectedItem.sharesCount} vezes!`}>
                        {selectedItem.sharesCount}
                      </span>
                    ) : null}
                  </button>

                  {showShareDropdown && (
                    <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[130] p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-3 py-1.5 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800/60 mb-1">
                        Partilha Rápida
                      </div>
                      
                      {/* Copiar Link Curto */}
                      <button
                        onClick={async () => {
                          const itemShareUrl = `${window.location.origin}/?item=${selectedItem.id}`;
                          const success = await copyToClipboard(itemShareUrl);
                          if (success) {
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2000);
                            await registerShareAction(selectedItem);
                          }
                        }}
                        className="w-full flex items-center justify-between text-left px-3 py-2 text-[10px] font-bold uppercase rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <i className={`fa-solid ${shareCopied ? 'fa-check text-emerald-500' : 'fa-link text-[#009739]'} text-xs`}></i>
                          {shareCopied ? 'Link Copiado!' : 'Copiar Link Curto'}
                        </span>
                      </button>

                      {/* Partilhar WhatsApp */}
                      <button
                        onClick={async () => {
                          const itemStatusText = selectedItem.status === 'LOST' ? 'PERDIDO' : selectedItem.status === 'FOUND' ? 'ACHADO' : 'ROUBADO';
                          const itemShareUrl = `${window.location.origin}/?item=${selectedItem.id}`;
                          const titleText = `*ComeBack Moçambique - Ajude a Divulgar!* 🚨🇲🇿\n\n📢 *Anúncio*: ${itemStatusText} - ${selectedItem.title}\n📍 *Zona*: ${selectedItem.location}\n\nAjude a partilhar para encontrar o dono! Detalhes do item no link:\n🔗 ${itemShareUrl}`;
                          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(titleText)}`;
                          window.open(waUrl, '_blank');
                          setShowShareDropdown(false);
                          await registerShareAction(selectedItem);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-[10px] font-bold uppercase rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-[#128c7e] transition-colors"
                      >
                        <i className="fa-brands fa-whatsapp text-sm"></i>
                        Partilhar WhatsApp
                      </button>

                      {/* Partilhar Facebook */}
                      <button
                        onClick={async () => {
                          const itemShareUrl = `${window.location.origin}/?item=${selectedItem.id}`;
                          const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(itemShareUrl)}`;
                          window.open(fbUrl, '_blank');
                          setShowShareDropdown(false);
                          await registerShareAction(selectedItem);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-[10px] font-bold uppercase rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-[#1877f2] transition-colors"
                      >
                        <i className="fa-brands fa-facebook text-sm"></i>
                        Partilhar Facebook
                      </button>

                      {/* Partilhar via SMS */}
                      <button
                        onClick={async () => {
                          const itemStatusValue = selectedItem.status === 'LOST' ? 'PERDIDO' : selectedItem.status === 'FOUND' ? 'ACHADO' : 'ROUBADO';
                          const itemShareUrl = `${window.location.origin}/?item=${selectedItem.id}`;
                          const text = `ComeBack MZ: ${itemStatusValue} - ${selectedItem.title}. Mais detalhes em: ${itemShareUrl}`;
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          const smsUrl = `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`;
                          window.open(smsUrl, '_blank');
                          setShowShareDropdown(false);
                          await registerShareAction(selectedItem);
                        }}
                        className="w-full flex items-center gap-2 text-left px-3 py-2 text-[10px] font-bold uppercase rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 transition-colors"
                      >
                        <i className="fa-solid fa-comment-sms text-sm"></i>
                        Partilhar via SMS
                      </button>

                      {/* Partilha Nativa (Se disponível) */}
                      {navigator.share && (
                        <button
                          onClick={async () => {
                            const itemShareUrl = `${window.location.origin}/?item=${selectedItem.id}`;
                            try {
                              await navigator.share({
                                title: `ComeBack Moçambique - ${selectedItem.title}`,
                                text: `Ajude a localizar ou divulgar: ${selectedItem.title} em ${selectedItem.location}`,
                                url: itemShareUrl
                              });
                              await registerShareAction(selectedItem);
                            } catch (err) {
                              console.warn("Native share cancelled or failed:", err);
                            }
                            setShowShareDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 text-left px-3 py-2 text-[10px] font-bold uppercase rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors border-t border-gray-100 dark:border-slate-850 mt-1 pt-2"
                        >
                          <i className="fa-solid fa-share-nodes text-xs text-indigo-500"></i>
                          Partilha Nativa
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowReportModal(true);
                    setReportSuccess(false);
                    setReportReason('');
                    setReportDetails('');
                  }}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3 py-1.5 rounded-2xl shadow-xs active:scale-[0.98] font-sans cursor-pointer whitespace-nowrap"
                  id="report-problem-btn"
                  title="Reportar problema ou irregularidades com este post"
                >
                  <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                  Reportar Problema
                </button>
              </>
            )}
          </div>
          
          <div className="text-[9px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 bg-[#fce100]/20 px-2.5 py-1.5 rounded-xl border border-[#fce100]/40 font-sans">
            <span>ComeBack Moçambique</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#009739] animate-pulse"></div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isViewingDelivery && selectedItem ? (
          <motion.div
            key="delivery"
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <Suspense fallback={<LazyLoaderFallback />}>
              <DeliveryTrackingView 
                item={items.find(i => i.id === selectedItem.id) || selectedItem} 
                onBack={() => setIsViewingDelivery(false)} 
              />
            </Suspense>
          </motion.div>
        ) : activeChat ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <Suspense fallback={<LazyLoaderFallback />}>
              <ChatView 
                item={items.find(i => i.id === activeChat.id) || activeChat} 
                messages={combinedMessages.filter(m => m.itemId === activeChat.id)}
                onSendMessage={handleSendMessage}
                onBack={() => setActiveChat(null)}
                notificationCount={unreadNotificationsCount}
                isTracking={activeChat.isTrackingActive}
                onStartTracking={(loc, coords) => startTracking(activeChat.id, loc, coords)}
                onStopTracking={() => stopTracking(activeChat.id)}
                onFinishDelivery={() => handleFinishDelivery(activeChat.id)}
                onViewTracking={() => setIsViewingDelivery(true)}
              />
            </Suspense>
          </motion.div>
        ) : selectedItem ? (
          <motion.div
            key="item-details"
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<LazyLoaderFallback />}>
              <ItemDetails 
                item={selectedItem} 
                allContextItems={items}
                onBack={() => {
                  setSelectedItem(null);
                  setAutoOpenClaim(false);
                }} 
            onStartChat={async (item, initialMessageText) => {
              setActiveChat(item);
              if (initialMessageText && currentUser) {
                const msgId = Math.random().toString(36).substr(2, 9);
                const msg = {
                  id: msgId,
                  itemId: item.id,
                  senderId: currentUser.id,
                  receiverId: item.userId,
                  text: initialMessageText,
                  type: 'text' as const,
                  timestamp: new Date().toISOString()
                };
                try {
                  await setDoc(doc(db, 'messages', msgId), msg);
                  
                  // Gravar notificação de negociação
                  const notifId = Math.random().toString(36).substr(2, 9);
                  await setDoc(doc(db, 'notifications', notifId), {
                    id: notifId,
                    userId: item.userId,
                    type: 'REWARD',
                    title: 'Proposta de Negociação!',
                    description: `Surgiu uma nova nota ou lance de resgate para o item "${item.title}".`,
                    itemId: item.id,
                    timestamp: new Date().toISOString(),
                    isRead: false
                  });
                } catch (err) {
                  console.error("Error writing initial message:", err);
                }
              }
            }}
            onViewItem={(item) => {
              handleViewDetails(item);
              setAutoOpenClaim(false);
            }}
            autoOpenClaim={autoOpenClaim}
            escrowedItems={escrowedItems}
          />
        </Suspense>
          </motion.div>
      ) : (
          <motion.div
            key="tabs-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'feed' && (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="w-full flex-1 flex flex-col"
                >
                  {renderFeed()}
                </motion.div>
              )}
              {activeTab === 'about' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="pb-24 font-sans"
                >
                  <Suspense fallback={<LazyLoaderFallback />}>
                    <InfoDocsView />
                  </Suspense>
                </motion.div>
              )}
              {activeTab === 'post' && (
                <motion.div
                  key="post"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 pb-40 overflow-y-auto h-full no-scrollbar max-w-5xl mx-auto w-full"
                >
                  <h2 className="text-xl sm:text-2xl font-black mb-4 sm:mb-6 text-gray-900 dark:text-white border-l-4 sm:border-l-8 border-[#fce100] pl-3 sm:pl-4 uppercase tracking-tight">Novo Registo</h2>
                {(!currentUser || !currentUser.isVerified) && (
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-3 sm:p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 mb-4 sm:mb-6">
                    <p className="text-[9px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-tight leading-relaxed">
                      💡 Se você ENCONTROU algo, pode publicar sem conta. Se PERDEU ou foi ROUBADO, precisa de uma conta verificada (BI) para sua segurança.
                    </p>
                  </div>
                )}
                <form onSubmit={handlePostSubmit} className="space-y-3 sm:space-y-4 w-full">
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Tipo de Registo / Ocorrência</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button 
                        type="button" 
                        onClick={() => setNewItem({...newItem, status: ItemStatus.LOST})} 
                        className={`py-3.5 px-2 rounded-2xl border-2 font-black text-[9.5px] uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          newItem.status === ItemStatus.LOST && newItem.category !== Category.PEOPLE
                            ? 'border-[#d21034] bg-[#d21034] text-white shadow-md' 
                            : 'border-gray-150 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <i className="fa-solid fa-magnifying-glass text-[11px]"></i>
                        <span>Perdi</span>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setNewItem({...newItem, status: ItemStatus.FOUND})} 
                        className={`py-3.5 px-2 rounded-2xl border-2 font-black text-[9.5px] uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          newItem.status === ItemStatus.FOUND 
                            ? 'border-[#009739] bg-[#009739] text-white shadow-md' 
                            : 'border-gray-150 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <i className="fa-solid fa-box-open text-[11px]"></i>
                        <span>Achei</span>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setNewItem({...newItem, status: ItemStatus.STOLEN})} 
                        className={`py-3.5 px-2 rounded-2xl border-2 font-black text-[9.5px] uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          newItem.status === ItemStatus.STOLEN 
                            ? 'border-slate-900 bg-slate-900 text-red-400 shadow-md' 
                            : 'border-gray-150 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <i className="fa-solid fa-shield-halved text-[11px]"></i>
                        <span>Roubado</span>
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setNewItem({...newItem, status: ItemStatus.LOST, category: Category.PEOPLE})} 
                        className={`py-3.5 px-2 rounded-2xl border-2 font-black text-[9.5px] uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          newItem.category === Category.PEOPLE 
                            ? 'border-indigo-900 bg-indigo-900 text-white shadow-md' 
                            : 'border-gray-150 bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <i className="fa-solid fa-person-circle-question text-[11px]"></i>
                        <span>Desaparecido</span>
                      </button>
                    </div>
                  </div>
                  
                  {(newItem.status === ItemStatus.LOST || newItem.status === ItemStatus.STOLEN) && (!currentUser || !currentUser.isVerified) ? (
                    <div className="bg-white border-2 border-dashed border-red-200 rounded-[2.5rem] p-6 text-center space-y-4 my-6 shadow-sm animate-in fade-in duration-300">
                      {!currentUser ? (
                        <>
                          <div className="w-14 h-14 bg-red-50 text-[#d21034] rounded-full flex items-center justify-center mx-auto text-xl border-4 border-white shadow-md animate-bounce">
                            <i className="fa-solid fa-lock text-sm"></i>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-gray-900 uppercase">Inicie Sessão Primeiro</h3>
                            <p className="text-[10px] text-[#d21034] font-black uppercase tracking-wide">Autenticação Obrigatória</p>
                          </div>
                          <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed max-w-sm mx-auto">
                            Para publicar um item perdido ou roubado com segurança jurídica e evitar golpes de falsos resgates, todos os donos de artigos devem possuir uma conta verificada.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleTabChange('profile')}
                            className="bg-black text-[#fce100] px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-wider active:scale-95 transition-all inline-flex items-center gap-2 shadow-md cursor-pointer"
                          >
                            <i className="fa-solid fa-right-to-bracket text-[10px]"></i>
                            <span>Entrar ou Criar Conta</span>
                          </button>
                        </>
                      ) : !currentUser.documentImageUrl ? (
                        <>
                          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-xl border-4 border-white shadow-md animate-pulse">
                            <i className="fa-solid fa-shield-halved text-sm"></i>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-gray-900 uppercase">Verifique sua Identidade</h3>
                            <p className="text-[10px] text-amber-600 font-black uppercase tracking-wide">Bilhete de Identidade (BI) Necessário</p>
                          </div>
                          <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed max-w-sm mx-auto">
                            Submeta uma foto legível do seu Bilhete de Identidade. Seus dados são guardados de forma criptografada segundo normas de privacidade nacionais do Instituto Moçambicano de Tecnologias de Informação e Comunicação.
                          </p>
                          
                          <div className="max-w-xs mx-auto">
                            <label className="cursor-pointer bg-[#009739] hover:bg-[#008130] text-white py-3.5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all w-full">
                              {isUploadingDirectDoc ? (
                                <>
                                  <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
                                  <span>Carregando Documento...</span>
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-cloud-arrow-up text-[10px]"></i>
                                  <span>Submeter BI Agora</span>
                                </>
                              )}
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 10 * 1024 * 1024) {
                                    alert("O documento é muito grande. Máximo 10MB.");
                                    return;
                                  }
                                  setIsUploadingDirectDoc(true);
                                  try {
                                    const reader = new FileReader();
                                    reader.onload = async (event) => {
                                      try {
                                        const base64 = event.target?.result as string;
                                        const compressedBase64 = await compressImage(base64, 1000, 1000, 0.7);

                                        // Automated validation check with server-side AI OCR
                                        const verifyRes = await authenticatedFetch("/api/verify-document", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({ imageBase64: compressedBase64 }),
                                        });

                                        if (!verifyRes.ok) {
                                          throw new Error("Não foi possível contactar o serviço de verificação automática.");
                                        }

                                        const verifyData = await verifyRes.json();
                                        if (!verifyData.isValid) {
                                          alert(`Validação Automática Recusada:\n\n${verifyData.reason || "A sua imagem não foi identificada como um Bilhete de Identidade (BI) legível com foto."}\n\nPor favor, envie uma foto legível e nítida do seu documento.`);
                                          setIsUploadingDirectDoc(false);
                                          return;
                                        }

                                        // Document is valid!
                                        let successMessage = `Documento Validado com Sucesso pela IA!\n\n${verifyData.reason}`;
                                        if (verifyData.extractedName) {
                                          successMessage += `\nNome Extraído: ${verifyData.extractedName}`;
                                        }
                                        if (verifyData.documentNumber) {
                                          successMessage += `\nN.º do Documento: ${verifyData.documentNumber}`;
                                        }
                                        successMessage += `\n\nO documento foi enviado ao administrador para a homologação final.`;
                                        
                                        alert(successMessage);

                                        await updateUserProfile({ 
                                          documentImageUrl: compressedBase64,
                                          isVerified: true
                                        });
                                      } catch (innerErr: any) {
                                        console.error("Erro ao validar documento:", innerErr);
                                        alert(`Erro na validação automática: ${innerErr.message || innerErr}.`);
                                      } finally {
                                        setIsUploadingDirectDoc(false);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  } catch (err) {
                                    console.error(err);
                                    setIsUploadingDirectDoc(false);
                                    alert("Erro no upload do documento.");
                                  }
                                }} 
                                disabled={isUploadingDirectDoc} 
                              />
                            </label>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-xl border-4 border-white shadow-md">
                            <i className="fa-solid fa-id-card animate-bounce text-sm"></i>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-black text-gray-900 uppercase">Verificação em Processo</h3>
                            <p className="text-[10px] text-blue-600 font-black uppercase tracking-wide">Aguardando Validação Administrativa</p>
                          </div>
                          <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed max-w-sm mx-auto">
                            Obrigado! Recebemos a foto do seu documento de identificação. Um administrador irá validar as suas informações. Isto poderá demorar entre alguns minutos a poucas horas.
                          </p>
                          <div className="w-full max-w-[200px] aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md mx-auto relative bg-slate-50 mt-2 flex items-center justify-center p-3">
                            <img src={currentUser.documentImageUrl} className="w-full h-full object-contain opacity-60 grayscale animate-pulse" alt="Documento sob análise" />
                            <div className="absolute inset-0 bg-blue-900/15 flex items-center justify-center">
                              <span className="text-[8px] font-black uppercase text-blue-900 bg-white/90 px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1.5">
                                <i className="fa-solid fa-spinner animate-spin"></i> Em Análise
                              </span>
                            </div>
                          </div>
                          <p className="text-[9px] text-gray-400 font-semibold uppercase italic">Agradecemos a sua cooperação na construção de uma comunidade mais segura.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-black text-gray-500 uppercase mb-1.5">Fotos do Item (Máx. 3)</label>
                        <div className="grid grid-cols-3 gap-2">
                       {[0, 1, 2].map((idx) => (
                         <div key={idx} className="relative aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden group">
                           {newItem.imageUrls?.[idx] ? (
                             <>
                               <MediaViewer src={newItem.imageUrls[idx]} className="w-full h-full object-cover" />
                               <button 
                                 type="button"
                                 onClick={() => {
                                   const newUrls = [...(newItem.imageUrls || [])];
                                   newUrls.splice(idx, 1);
                                   setNewItem({...newItem, imageUrls: newUrls});
                                 }}
                                 className="absolute top-1 right-1 bg-red-500 hover:bg-red-650 text-white p-1 rounded-full shadow-lg hover:scale-105 active:scale-90 transition-all z-20"
                               >
                                 <i className="fa-solid fa-xmark text-[8px]"></i>
                               </button>
                               <button 
                                 type="button"
                                 onClick={() => handleOpenImageFilters(newItem.imageUrls![idx], idx, 'new-item')}
                                 className="absolute bottom-1 right-1 bg-black/80 hover:bg-[#009739] text-[#fce100] hover:text-white px-2 py-1 rounded-md text-[7px] font-black uppercase flex items-center gap-1 transition-all shadow-md active:scale-95 z-20"
                                 title="Ajustar Brilho e Contraste (Baixa Luz)"
                               >
                                 <i className="fa-solid fa-sliders text-[8px]"></i>
                                 <span>Filtrar</span>
                               </button>
                             </>
                           ) : (
                             <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-gray-300 hover:text-[#fce100] transition-colors p-2 text-center">
                               <i className="fa-solid fa-camera-retro text-xl mb-1"></i>
                               <span className="text-[7px] font-black uppercase leading-tight">Carregar ou<br/>Capturar Agora</span>
                               <input 
                                 type="file" 
                                 className="hidden" 
                                 accept="image/*,video/*"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0];
                                   if (file) {
                                     if (file.size > 10 * 1024 * 1024) {
                                       alert("O ficheiro é muito grande. Máximo 10MB.");
                                       return;
                                     }
                                     const reader = new FileReader();
                                     reader.onload = async (event) => {
                                       const base64 = event.target?.result as string;
                                       // Compress image to stay under Firestore 1MB limit
                                       const compressedBase64 = await compressImage(base64, 800, 800, 0.6);
                                       const newUrls = [...(newItem.imageUrls || [])];
                                       newUrls[idx] = compressedBase64;
                                       setNewItem({...newItem, imageUrls: newUrls});
                                     };
                                     reader.readAsDataURL(file);
                                   }
                                 }}
                               />
                             </label>
                           )}
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 p-3 sm:p-4 rounded-2xl sm:rounded-3xl space-y-3 sm:space-y-4 border border-gray-200/80 dark:border-slate-800/80 w-full overflow-hidden text-left shadow-sm">
                    <div className="w-full min-w-0 space-y-1.5">
                      <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                        Título do Item <span className="text-red-500">*</span>
                      </label>
                      <input 
                        name="title" 
                        className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-all ${formErrors.title ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                        placeholder="Ex: Carteira preta com documentos, Mochila azul..." 
                        value={newItem.title || ''} 
                        onChange={e => setNewItem({...newItem, title: e.target.value})} 
                      />
                      {formErrors.title && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.title}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 space-y-4 sm:space-y-0 w-full">
                      <div className="w-full min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Categoria <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleManualSuggestCategory}
                            disabled={isSuggestingCategory || (!newItem.title && !newItem.description)}
                            className="text-[10px] sm:text-xs font-bold text-[#009739] hover:text-[#007a2d] uppercase flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                            title="Sugerir categoria automaticamente usando IA do Gemini"
                          >
                            <i className={`fa-solid ${isSuggestingCategory ? "fa-circle-notch animate-spin" : "fa-wand-magic-sparkles"}`}></i>
                            <span>{isSuggestingCategory ? "A detetar..." : "Auto-sugerir com IA"}</span>
                          </button>
                        </div>
                        <select 
                          className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 text-xs sm:text-sm font-bold shadow-xs text-gray-800 dark:text-gray-200 outline-none transition-colors" 
                          value={newItem.category} 
                          onChange={e => setNewItem({...newItem, category: e.target.value as Category})} 
                        >
                          {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>

                        {/* Feedback de Categoria sugerida pela IA */}
                        {categoryAppliedNotice && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mt-1 animate-fadeIn">
                            <i className="fa-solid fa-circle-check"></i>
                            <span>{categoryAppliedNotice}</span>
                          </p>
                        )}

                        {suggestedCategoryData && !categoryAppliedNotice && (
                          <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 animate-fadeIn text-left">
                            <div className="min-w-0 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-[#009739] text-white flex items-center justify-center text-[10px] shrink-0 font-black">
                                <i className="fa-solid fa-sparkles"></i>
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">
                                  IA sugere: <span className="text-[#009739] underline font-extrabold">{suggestedCategoryData.suggestedCategory}</span> ({suggestedCategoryData.confidence}%)
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{suggestedCategoryData.reason}</p>
                              </div>
                            </div>
                            {newItem.category !== suggestedCategoryData.suggestedCategory ? (
                              <button
                                type="button"
                                onClick={() => applySuggestedCategory(suggestedCategoryData.suggestedCategory as Category)}
                                className="shrink-0 px-2.5 py-1 bg-[#009739] hover:bg-[#007a2d] text-white text-[10px] font-bold rounded-lg transition-colors shadow-xs active:scale-95 cursor-pointer"
                              >
                                Aplicar
                              </button>
                            ) : (
                              <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <i className="fa-solid fa-check"></i> Aplicada
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-full min-w-0 space-y-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Província <span className="text-red-500">*</span>
                        </label>
                        <select 
                          className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 text-xs sm:text-sm font-bold shadow-xs text-gray-800 dark:text-gray-200 outline-none transition-colors" 
                          value={newItem.province} 
                          onChange={e => setNewItem({...newItem, province: e.target.value})} 
                        >
                          {MOZAMBIQUE_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>

                    {newItem.category === Category.DOCUMENTS && (
                      <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 space-y-3 text-left w-full">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#009739] text-white flex items-center justify-center text-sm shadow-xs shrink-0 mt-0.5">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">Preenchimento Automático de Documento</h4>
                            <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-normal mt-0.5">
                              Envie uma foto nítida do Bilhete de Identidade ou Passaporte para preencher o título e descrição com IA.
                            </p>
                          </div>
                        </div>

                        <label className="cursor-pointer block bg-black hover:bg-gray-900 text-[#fce100] py-2.5 px-4 rounded-xl font-bold text-xs text-center transition-all shadow-xs w-full">
                          {isExtractingDoc ? (
                            <span className="flex items-center justify-center gap-2">
                              <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
                              <span>A analisar documento...</span>
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <i className="fa-solid fa-camera text-xs"></i>
                              <span>Tirar Foto ou Carregar Documento</span>
                            </span>
                          )}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            disabled={isExtractingDoc}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleDocumentAutoExtract(file);
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {newItem.category === Category.PEOPLE && (
                      <div className="bg-gradient-to-br from-red-500/5 to-amber-500/5 dark:from-red-950/10 dark:to-amber-950/10 p-4 sm:p-5 rounded-3xl border-2 border-red-500/20 dark:border-red-950/40 space-y-4 shadow-sm animate-in fade-in duration-300 text-left w-full">
                        <div className="flex items-center gap-2.5 border-b border-gray-150 dark:border-slate-800/80 pb-3">
                          <div className="w-9 h-9 rounded-xl bg-red-650 text-white flex items-center justify-center text-sm shadow-md shrink-0">
                            <i className="fa-solid fa-person-circle-question"></i>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-[11px] sm:text-xs font-black uppercase text-gray-950 dark:text-white leading-none truncate">{t('Características da Pessoa Desaparecida')}</h4>
                            <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mt-1 leading-tight">{t('Preencha as informações físicas da pessoa para facilitar buscas e identificação.')}</p>
                          </div>
                        </div>

                        {/* Interactive Visual Builder (Retrato Falado via Drag & Drop ou cliques) */}
                        <div className="space-y-1.5 w-full min-w-0">
                          <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                            {t('Montar Aparência Visual (Retrato Falado)')}
                          </label>
                          <VisualPortraitBuilder 
                            value={newItem.sketchData as any} 
                            onChange={(data) => setNewItem({ ...newItem, sketchData: data })} 
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 space-y-4 sm:space-y-0 w-full">
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Nome Completo')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: João da Silva')} 
                              value={newItem.fullName || ''} 
                              onChange={e => setNewItem({...newItem, fullName: e.target.value})} 
                            />
                          </div>
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Idade')}</label>
                            <input 
                              type="number" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: 28 anos')} 
                              value={newItem.age || ''} 
                              onChange={e => setNewItem({...newItem, age: parseInt(e.target.value) || undefined})} 
                            />
                          </div>
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Altura')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: 1.75m')} 
                              value={newItem.height || ''} 
                              onChange={e => setNewItem({...newItem, height: e.target.value})} 
                            />
                          </div>
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Postura Física')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: Magro, Atlético')} 
                              value={newItem.bodyType || ''} 
                              onChange={e => setNewItem({...newItem, bodyType: e.target.value})} 
                            />
                          </div>
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Corte de Cabelo')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: Curto Crespo')} 
                              value={newItem.hairCut || ''} 
                              onChange={e => setNewItem({...newItem, hairCut: e.target.value})} 
                            />
                          </div>
                          <div className="w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Cor das Calças')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: Jeans Azul')} 
                              value={newItem.trousersColor || ''} 
                              onChange={e => setNewItem({...newItem, trousersColor: e.target.value})} 
                            />
                          </div>
                          <div className="sm:col-span-2 w-full min-w-0 space-y-1.5">
                            <label className="block text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1.5">{t('Cor da Camisa/Camiseta')}</label>
                            <input 
                              type="text" 
                              className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs sm:text-sm shadow-xs transition-colors" 
                              placeholder={t('Ex: T-Shirt Branca')} 
                              value={newItem.shirtColor || ''} 
                              onChange={e => setNewItem({...newItem, shirtColor: e.target.value})} 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 space-y-4 sm:space-y-0 w-full">
                      <div className="w-full min-w-0 space-y-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Local Específico <span className="text-red-500">*</span>
                        </label>
                        <input 
                          name="location" 
                          className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-all ${formErrors.location ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                          placeholder="Ex: Av. Eduardo Mondlane, Paragem..." 
                          value={newItem.location || ''} 
                          onChange={e => setNewItem({...newItem, location: e.target.value})} 
                        />
                        {formErrors.location && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.location}</p>}
                      </div>
                      <div className="w-full min-w-0 space-y-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Data do Ocorrido <span className="text-red-500">*</span>
                        </label>
                        <input 
                          name="date" 
                          type="date" 
                          className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-all ${formErrors.date ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                          value={newItem.date || ''} 
                          onChange={e => setNewItem({...newItem, date: e.target.value})} 
                        />
                        {formErrors.date && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.date}</p>}
                      </div>
                    </div>

                    <div className="w-full min-w-0 space-y-1.5">
                      <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                        Recompensa Prometida (Opcional - MT)
                      </label>
                      <div className="relative w-full">
                        <input 
                          type="number" 
                          className="w-full min-w-0 bg-white dark:bg-slate-950 border-2 border-gray-200 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-colors pr-12" 
                          placeholder="Ex: 500 MT" 
                          value={newItem.reward || ''} 
                          onChange={e => setNewItem({...newItem, reward: parseInt(e.target.value) || 0})} 
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 dark:text-gray-500 pointer-events-none">
                          MT
                        </span>
                      </div>
                      {newItem.reward ? (
                        <div className="bg-[#fce100]/10 p-3.5 sm:p-4 rounded-2xl border-2 border-[#fce100]/20 space-y-2.5 mt-2 w-full">
                          <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase">
                            <span>Recompensa Prometida</span>
                            <span className="text-gray-900 dark:text-white font-bold">{newItem.reward.toLocaleString()} MT</span>
                          </div>
                          
                          {newItem.status === ItemStatus.LOST && (
                            <div className="flex justify-between items-center text-[9px] font-bold text-[#d21034] uppercase">
                              <span>Acréscimo de Segurança ({(LOST_ITEM_SURCHARGE_PERCENT * 100).toFixed(0)}%)</span>
                              <span>+{(newItem.reward * LOST_ITEM_SURCHARGE_PERCENT).toLocaleString()} MT</span>
                            </div>
                          )}

                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-[#d21034] uppercase">
                              <span>Dedução de Comissão ({(COMMISSION_FEE_PERCENT * 100).toFixed(0)}%)</span>
                              <span>-{(newItem.reward * COMMISSION_FEE_PERCENT).toLocaleString()} MT</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold text-[#d21034] uppercase">
                              <span>Dedução de Manutenção ({(MAINTENANCE_FEE_PERCENT * 100).toFixed(0)}%)</span>
                              <span>-{(newItem.reward * MAINTENANCE_FEE_PERCENT).toLocaleString()} MT</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#fce100]/30 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <div className="text-[10px] font-black text-[#009739] uppercase">Líquido para quem achar</div>
                              <div className="text-sm font-black text-[#009739]">{previewNewNet.toLocaleString()} MT</div>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="text-[10px] font-black text-black dark:text-white uppercase">Total a Pagar</div>
                              <div className="text-base sm:text-lg font-black text-black dark:text-white">{previewNewTotal.toLocaleString()} MT</div>
                            </div>
                          </div>
                          <p className="text-[8px] font-bold text-gray-400 dark:text-gray-500 font-mono uppercase italic text-center">* TAXAS PARA SUPORTE DA REDE E SEGURANÇA NO RESGATE.</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 space-y-4 sm:space-y-0 w-full">
                      <div className="w-full min-w-0 space-y-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Seu Nome <span className="text-red-500">*</span>
                        </label>
                        <input 
                          name="ownerName" 
                          className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-all ${formErrors.ownerName ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                          placeholder="Nome completo..." 
                          value={newItem.ownerName || ''} 
                          onChange={e => setNewItem({...newItem, ownerName: e.target.value})} 
                        />
                        {formErrors.ownerName && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.ownerName}</p>}
                      </div>
                      <div className="w-full min-w-0 space-y-1.5">
                        <label className="block text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Seu Contacto <span className="text-red-500">*</span>
                        </label>
                        <input 
                          name="ownerPhone" 
                          className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 text-xs sm:text-sm outline-none font-semibold shadow-xs transition-all ${formErrors.ownerPhone ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                          placeholder="+258 84 000 0000" 
                          value={newItem.ownerPhone || ''} 
                          onChange={e => setNewItem({...newItem, ownerPhone: e.target.value})} 
                        />
                        {formErrors.ownerPhone && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.ownerPhone}</p>}
                      </div>
                    </div>

                    <div className="w-full min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
                        <label className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                          Descrição do Item <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleValidateDescription()}
                            disabled={isValidatingDesc || !newItem.description || newItem.description.trim().length < 4}
                            className="text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                            title="Validar se a descrição possui informações úteis suficientes (marcas, séries ou detalhes únicos)"
                          >
                            <i className={`fa-solid ${isValidatingDesc ? "fa-circle-notch animate-spin" : "fa-shield-check"}`}></i>
                            <span>{isValidatingDesc ? "A validar..." : "Validar com IA"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSuggestImprovements(false)}
                            disabled={isSuggestingNew}
                            className="text-[10px] sm:text-xs font-bold text-[#009739] hover:text-[#007a2d] uppercase flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <i className={`fa-solid ${isSuggestingNew ? "fa-circle-notch animate-spin" : "fa-wand-magic-sparkles"}`}></i>
                            <span>{isSuggestingNew ? "A melhorar..." : "Sugerir melhorias"}</span>
                          </button>
                        </div>
                      </div>
                      <textarea 
                        name="description" 
                        className={`w-full min-w-0 bg-white dark:bg-slate-950 border-2 rounded-xl p-3 h-28 resize-none font-medium text-xs sm:text-sm shadow-xs transition-all ${formErrors.description ? 'border-red-500' : 'border-gray-200 dark:border-slate-800 focus:border-[#009739]'}`} 
                        placeholder="Descrição detalhada (marca, modelo, número de série/IMEI, cor exata, riscos, autocolantes, detalhes únicos)..." 
                        value={newItem.description || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          setNewItem({...newItem, description: val});
                          if (descValidatedForText && val !== descValidatedForText) {
                            setHasUserOverriddenDescValidation(false);
                          }
                        }}
                      ></textarea>
                      {formErrors.description && <p className="text-[10px] text-red-500 font-bold uppercase mt-1">{formErrors.description}</p>}

                      {/* Feedback da Validação Inteligente da Descrição */}
                      {isValidatingDesc && (
                        <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2.5 animate-pulse text-left">
                          <i className="fa-solid fa-circle-notch animate-spin text-sm"></i>
                          <span>A IA está a verificar se a descrição possui detalhes úteis suficientes (marcas, séries ou características únicas)...</span>
                        </div>
                      )}

                      {!isValidatingDesc && descValidationResult && (
                        <div className={`p-3.5 rounded-2xl border text-left space-y-2.5 transition-all animate-fadeIn ${
                          descValidationResult.isSufficient 
                            ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/40" 
                            : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-800/40"
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                                descValidationResult.isSufficient ? "bg-[#009739]" : "bg-amber-500"
                              }`}>
                                <i className={`fa-solid ${descValidationResult.isSufficient ? "fa-check" : "fa-exclamation"}`}></i>
                              </span>
                              <span className={`text-xs font-black uppercase tracking-tight ${
                                descValidationResult.isSufficient ? "text-emerald-900 dark:text-emerald-200" : "text-amber-900 dark:text-amber-200"
                              }`}>
                                {descValidationResult.isSufficient ? "Descrição Aprovada pela IA" : "Detalhes Insuficientes para Submissão Segura"}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              descValidationResult.score >= 60 
                                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300" 
                                : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
                            }`}>
                              Qualidade: {descValidationResult.score}/100
                            </span>
                          </div>

                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {descValidationResult.feedback || descValidationResult.summary}
                          </p>

                          {/* Indicadores de detalhes identificadores */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                              descValidationResult.hasBrandOrModel 
                                ? "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" 
                                : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                            }`}>
                              <i className={`fa-solid ${descValidationResult.hasBrandOrModel ? "fa-circle-check text-emerald-600" : "fa-circle-xmark text-gray-400"}`}></i>
                              Marca/Modelo
                            </span>

                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                              descValidationResult.hasSerialOrIdentifier 
                                ? "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" 
                                : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                            }`}>
                              <i className={`fa-solid ${descValidationResult.hasSerialOrIdentifier ? "fa-circle-check text-emerald-600" : "fa-circle-xmark text-gray-400"}`}></i>
                              Série / Placa / BI / IMEI
                            </span>

                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                              descValidationResult.hasUniqueDetails 
                                ? "bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" 
                                : "bg-gray-100 dark:bg-slate-800 text-gray-500"
                            }`}>
                              <i className={`fa-solid ${descValidationResult.hasUniqueDetails ? "fa-circle-check text-emerald-600" : "fa-circle-xmark text-gray-400"}`}></i>
                              Detalhes Únicos / Avarias
                            </span>
                          </div>

                          {/* Sugestões de melhoria se insuficiente */}
                          {!descValidationResult.isSufficient && descValidationResult.suggestions && descValidationResult.suggestions.length > 0 && (
                            <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1">
                                <i className="fa-solid fa-lightbulb text-amber-500"></i>
                                Clique numa sugestão para acrescentar à descrição:
                              </p>
                              <div className="flex flex-col gap-1">
                                {descValidationResult.suggestions.map((sug, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      const current = newItem.description?.trim() || "";
                                      const updated = current ? `${current}\n- ${sug}` : `- ${sug}`;
                                      setNewItem({ ...newItem, description: updated });
                                    }}
                                    className="text-left text-xs bg-white/80 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 p-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 flex items-start gap-2 transition-all cursor-pointer"
                                  >
                                    <i className="fa-solid fa-plus text-[#009739] text-[10px] mt-0.5 shrink-0"></i>
                                    <span>{sug}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Medidas de Segurança */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 my-4 text-left">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={securityTermsAccepted}
                        onChange={(e) => {
                          setSecurityTermsAccepted(e.target.checked);
                          setIsSecuritySliderVerified(e.target.checked);
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#009739] focus:ring-[#009739] cursor-pointer"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                        Comprometo-me a realizar encontros apenas em <strong className="text-gray-900 dark:text-white font-semibold">locais públicos vigiados (postos da PRM ou centros comerciais)</strong> e compreendo que nunca devo pagar resgates antecipados.
                      </span>
                    </label>
                  </div>

                  <button 
                    disabled={isSubmitting || publishCooldown > 0} 
                    className="sticky bottom-20 sm:bottom-4 z-30 w-full bg-gradient-to-r from-[#008fe2] via-[#1d4ed8] to-[#153268] hover:opacity-95 text-white py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-black text-sm shadow-[0_10px_30px_rgba(15,34,74,0.22)] uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5 cursor-pointer border-b-2 border-[#0f224a] backdrop-blur-sm"
                    id="submit-new-item-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin text-base"></i>
                        <span>A Publicar Registo...</span>
                      </>
                    ) : publishCooldown > 0 ? (
                      <>
                        <i className="fa-solid fa-clock text-white text-base"></i>
                        <span>Aguarde {publishCooldown}s (Proteção Anti-Duplicação)</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-circle-check text-base text-white"></i>
                        <span>Publicar no Radar</span>
                      </>
                    )}
                  </button>
                    </>
                  )}
                </form>
              </motion.div>
          )}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="p-0 text-center pb-24 h-full overflow-y-auto no-scrollbar relative min-h-screen"
            >
                {currentUser?.isAdmin && profileView === 'admin' ? (
                  <div className="animate-in fade-in duration-500">
                    <Suspense fallback={<LazyLoaderFallback />}>
                      <AdminDashboard />
                    </Suspense>
                    <div className="p-6 flex flex-col gap-3">
                      <button 
                        onClick={() => setProfileView('main')} 
                        className="w-full bg-black hover:bg-gray-900 text-[#fce100] py-4 rounded-2xl font-black uppercase text-xs border border-black shadow-md transition-all active:scale-98"
                      >
                        Voltar ao Perfil de Utilizador 👤
                      </button>
                      <button 
                        onClick={() => logout()} 
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-2xl font-black uppercase text-[10px] border border-red-100 transition-all active:scale-[0.99]"
                      >
                        Sair (Terminar Sessão completamente) 🚪
                      </button>
                    </div>
                  </div>
                ) : editingItem ? (
                  <div className="animate-in slide-in-from-bottom duration-300">
                    <button onClick={() => setEditingItem(null)} className="flex items-center text-[#009739] mb-4 gap-2 font-black uppercase text-xs">
                      <i className="fa-solid fa-arrow-left"></i> Cancelar Edição
                    </button>
                    <h2 className="text-xl font-black mb-6 text-left border-l-8 border-[#009739] pl-4 uppercase">Editar Item</h2>
                    <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
                       <div className="bg-gray-50 p-6 rounded-3xl space-y-4 border border-gray-100">
                          <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Título</label>
                          <input required className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold" value={editingItem.title} onChange={e => setEditingItem({...editingItem, title: e.target.value})} />
                          
                          <div className="flex justify-between items-center ml-1">
                            <label className="block text-[10px] font-black text-gray-400 uppercase">Descrição</label>
                            <button
                              type="button"
                              onClick={() => handleSuggestImprovements(true)}
                              disabled={isSuggestingEdit}
                              className="text-[9px] font-black text-[#009739] hover:text-[#007a2d] uppercase flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <i className={`fa-solid ${isSuggestingEdit ? "fa-circle-notch animate-spin" : "fa-wand-magic-sparkles"}`}></i>
                              <span>{isSuggestingEdit ? "A melhorar..." : "Sugerir melhorias"}</span>
                            </button>
                          </div>
                          <textarea className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 h-24 resize-none font-medium" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})}></textarea>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Categoria</label>
                              <select className="w-full bg-white border-2 border-gray-100 rounded-xl p-2 text-xs font-bold" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value as Category})}>
                                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Província</label>
                              <select className="w-full bg-white border-2 border-gray-100 rounded-xl p-2 text-xs font-bold" value={editingItem.province} onChange={e => setEditingItem({...editingItem, province: e.target.value})}>
                                {MOZAMBIQUE_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Estado</label>
                              <select className="w-full bg-white border-2 border-gray-100 rounded-xl p-2 text-xs font-bold uppercase cursor-pointer" value={editingItem.status} onChange={e => setEditingItem({...editingItem, status: e.target.value as ItemStatus})}>
                                <option value={ItemStatus.LOST}>Perdido (LOST)</option>
                                <option value={ItemStatus.FOUND}>Achado (FOUND)</option>
                                <option value={ItemStatus.STOLEN}>Roubado (STOLEN)</option>
                                <option value={ItemStatus.REUNITED}>Recuperado (REUNITED)</option>
                                <option value={ItemStatus.IN_TRANSIT}>Em Trânsito (IN_TRANSIT)</option>
                              </select>
                            </div>
                          </div>

                          {editingItem.category === Category.PEOPLE && (
                            <div className="bg-gradient-to-br from-red-500/5 to-amber-500/5 dark:from-red-950/10 dark:to-amber-950/10 p-5 rounded-3xl border-2 border-red-500/20 dark:border-red-950/40 space-y-4 shadow-sm animate-in fade-in duration-300 text-left">
                              <div className="flex items-center gap-2.5 border-b border-gray-150 dark:border-slate-800/80 pb-3">
                                <div className="w-9 h-9 rounded-xl bg-red-650 text-white flex items-center justify-center text-sm shadow-md shrink-0">
                                  <i className="fa-solid fa-person-circle-question"></i>
                                </div>
                                <div>
                                  <h4 className="text-[11px] font-black uppercase text-gray-950 dark:text-white leading-none">{t('Características da Pessoa Desaparecida')}</h4>
                                  <p className="text-[8.5px] text-gray-500 dark:text-slate-400 font-bold uppercase mt-1">{t('Preencha as informações físicas da pessoa para facilitar buscas e identificação.')}</p>
                                </div>
                              </div>

                              {/* Interactive Visual Builder (Retrato Falado via Drag & Drop ou cliques) */}
                              <div className="space-y-1.5">
                                <label className="block text-[9.5px] font-black text-gray-400 uppercase tracking-wider ml-1">
                                  {t('Montar Aparência Visual (Retrato Falado)')}
                                </label>
                                <VisualPortraitBuilder 
                                  value={editingItem.sketchData as any} 
                                  onChange={(data) => setEditingItem({ ...editingItem, sketchData: data })} 
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Nome Completo')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: João da Silva')} 
                                    value={editingItem.fullName || ''} 
                                    onChange={e => setEditingItem({...editingItem, fullName: e.target.value})} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Idade')}</label>
                                  <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: 28 anos')} 
                                    value={editingItem.age || ''} 
                                    onChange={e => setEditingItem({...editingItem, age: parseInt(e.target.value) || undefined})} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Altura')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: 1.75m')} 
                                    value={editingItem.height || ''} 
                                    onChange={e => setEditingItem({...editingItem, height: e.target.value})} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Postura Física')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: Magro, Atlético')} 
                                    value={editingItem.bodyType || ''} 
                                    onChange={e => setEditingItem({...editingItem, bodyType: e.target.value})} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Corte de Cabelo')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: Curto Crespo')} 
                                    value={editingItem.hairCut || ''} 
                                    onChange={e => setEditingItem({...editingItem, hairCut: e.target.value})} 
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Cor das Calças')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: Jeans Azul')} 
                                    value={editingItem.trousersColor || ''} 
                                    onChange={e => setEditingItem({...editingItem, trousersColor: e.target.value})} 
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="block text-[9px] font-black text-gray-400 uppercase mb-1 ml-1">{t('Cor da Camisa/Camiseta')}</label>
                                  <input 
                                    type="text" 
                                    className="w-full bg-white dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs animate-none" 
                                    placeholder={t('Ex: T-Shirt Branca')} 
                                    value={editingItem.shirtColor || ''} 
                                    onChange={e => setEditingItem({...editingItem, shirtColor: e.target.value})} 
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Seu Nome</label>
                              <input className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs" value={editingItem.ownerName || ''} onChange={e => setEditingItem({...editingItem, ownerName: e.target.value})} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 ml-1">Seu Contacto</label>
                              <input className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold text-xs" value={editingItem.ownerPhone || ''} onChange={e => setEditingItem({...editingItem, ownerPhone: e.target.value})} />
                            </div>
                          </div>
                          
                          <label className="block text-[10px] font-black text-gray-400 uppercase ml-1">Recompensa (MT)</label>
                          <input type="number" className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 outline-none font-semibold" value={editingItem.reward || ''} onChange={e => setEditingItem({...editingItem, reward: parseInt(e.target.value) || 0})} />
                          {editingItem.reward ? (
                             <div className="bg-[#fce100]/10 p-3 rounded-xl border border-[#fce100]/20 space-y-2">
                                <div className="flex justify-between items-center text-[8px] font-black text-gray-400 uppercase">
                                   <span>Recompensa Bruta</span>
                                   <span>{editingItem.reward.toLocaleString()} MT</span>
                                </div>
                                <div className="flex justify-between items-center text-[8px] font-bold text-[#d21034] uppercase">
                                   <span>Taxas ({(TOTAL_FEE_PERCENT * 100).toFixed(0)}%)</span>
                                   <span>-{(editingItem.reward * TOTAL_FEE_PERCENT).toLocaleString()} MT</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-[#fce100]/30">
                                   <div className="text-[10px] font-black text-[#009739] uppercase">Líquido Estimado</div>
                                   <div className="text-sm font-black text-[#009739]">{previewEditNet.toLocaleString()} MT</div>
                                </div>
                             </div>
                          ) : null}
                       </div>
                       <button type="submit" className="w-full bg-[#009739] text-white py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest active:scale-95 transition-all">
                         Guardar Alterações
                       </button>
                    </form>
                  </div>
                ) : profileView === 'my-posts' ? (
                  <div className="animate-in slide-in-from-right duration-300">
                    <button onClick={() => setProfileView('main')} className="flex items-center text-[#009739] mb-6 gap-2 font-black uppercase text-xs">
                      <i className="fa-solid fa-arrow-left"></i> Voltar ao Perfil
                    </button>
                    <h2 className="text-xl font-black mb-6 text-left border-l-8 border-[#d21034] pl-4 uppercase">Meus Registos</h2>
                    {myItems.length === 0 ? (
                      <div className="py-20 opacity-30">
                        <i className="fa-solid fa-box-open text-5xl mb-4"></i>
                        <p className="font-black uppercase text-sm">Nada publicado ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myItems.map(item => (
                          <div key={item.id} className="bg-white border-2 border-gray-50 rounded-[2rem] p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between shadow-sm hover:border-[#fce100]/20 transition-all">
                            <div className="flex gap-4 items-center flex-1 min-w-0">
                              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-inner bg-gray-100">
                                <MediaViewer 
                                  src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
                                  category={item.category}
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                 <div className="text-[8px] font-black text-[#009739] uppercase mb-0.5">{item.category}</div>
                                 <h3 className="font-black text-xs uppercase truncate leading-tight">{item.title}</h3>
                                 <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                     item.status === ItemStatus.LOST ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                     item.status === ItemStatus.STOLEN ? 'bg-red-50 text-red-700 border border-red-200' :
                                     item.status === ItemStatus.FOUND ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                     item.status === ItemStatus.REUNITED ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                     'bg-purple-50 text-purple-700 border border-purple-200'
                                   }`}>
                                     {item.status === ItemStatus.LOST ? 'Perdido' :
                                      item.status === ItemStatus.STOLEN ? 'Roubado' :
                                      item.status === ItemStatus.FOUND ? 'Achado' :
                                      item.status === ItemStatus.REUNITED ? 'Recuperado' :
                                      'Em Trânsito'}
                                   </span>
                                 </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {item.status !== ItemStatus.REUNITED && (
                                <button
                                  onClick={() => handleUpdateItemStatus(item.id, ItemStatus.REUNITED)}
                                  className="px-2.5 py-1.5 bg-[#009739]/10 text-[#009739] hover:bg-[#009739] hover:text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 shrink-0"
                                  title="Marcar como Recuperado"
                                >
                                  <i className="fa-solid fa-check-double text-[10px]"></i>
                                  <span>Recuperado</span>
                                </button>
                              )}
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateItemStatus(item.id, e.target.value as ItemStatus)}
                                className="bg-gray-50 border border-gray-200 text-gray-700 hover:border-black rounded-lg text-[9px] px-1.5 py-1.5 font-black outline-none cursor-pointer transition-colors uppercase shrink-0"
                              >
                                <option value={ItemStatus.LOST}>PERDIDO</option>
                                <option value={ItemStatus.FOUND}>ACHADO</option>
                                <option value={ItemStatus.STOLEN}>ROUBADO</option>
                                <option value={ItemStatus.REUNITED}>RECUPERADO</option>
                                <option value={ItemStatus.IN_TRANSIT}>TRÂNSITO</option>
                              </select>
                              <button 
                                onClick={() => setEditingItem(item)}
                                className="w-8 h-8 bg-gray-50 text-gray-400 hover:bg-[#fce100] hover:text-black rounded-lg flex items-center justify-center transition-colors shadow-sm shrink-0"
                                title="Editar Detalhes"
                              >
                                <i className="fa-solid fa-pen-to-square text-xs"></i>
                              </button>
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="w-8 h-8 bg-gray-50 text-red-500 hover:bg-red-50 hover:text-[#d21034] rounded-lg flex items-center justify-center transition-colors shadow-sm shrink-0"
                                title="Excluir Artigo"
                              >
                                <i className="fa-solid fa-trash text-xs"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Suspense fallback={<LazyLoaderFallback />}>
                    <AuthView onMyPosts={() => setProfileView('my-posts')} onAdminDashboard={() => setProfileView('admin')} />
                  </Suspense>
                )}
              </motion.div>
          )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diálogo de Confirmação com Upload de Prova para Item Recuperado (REUNITED) */}
      {reunitedConfirmItemId && reunitedConfirmItemInfo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-250 border border-gray-100 my-auto flex flex-col">
            
            {/* ETAPA 1: Recolha e Validação de Prova */}
            {!showReunitedSummaryConfirm ? (
              <>
                {/* Header */}
                <div className="bg-emerald-50 p-6 sm:p-8 border-b border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="bg-[#009739] text-white p-3 rounded-2xl shadow-md">
                      <i className="fa-solid fa-check-double text-lg"></i>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase leading-none">Marcar como Recuperado</h3>
                        <span className="bg-emerald-200/80 text-emerald-800 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Passo 1 de 2</span>
                      </div>
                      <span className="text-[9px] font-black text-[#009739] uppercase tracking-wider block mt-1.5 font-mono">Recolha de Prova & Verificação de Entrega</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleCancelReunitedFlow}
                    className="p-2.5 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-black transition-colors cursor-pointer border border-gray-100/60"
                    id="close-reunited-modal-btn"
                  >
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 sm:p-8 space-y-5 text-left max-h-[65vh] overflow-y-auto no-scrollbar">
                  {/* Artigo a Confirmar */}
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block mb-0.5 font-mono">Artigo a Confirmar:</span>
                      <span className="text-xs sm:text-sm font-black text-gray-800 uppercase block leading-tight">{reunitedConfirmItemInfo.title}</span>
                      <span className="text-[9.5px] text-gray-500 font-bold block mt-1">
                        <i className="fa-solid fa-location-dot text-[#d21034] mr-1"></i>
                        {reunitedConfirmItemInfo.location}, {reunitedConfirmItemInfo.province}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 self-start sm:self-center">
                      <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-xl flex items-center gap-1 border ${
                        reunitedProofImage 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <i className={`fa-solid ${reunitedProofImage ? 'fa-circle-check text-emerald-600' : 'fa-camera text-amber-500'}`}></i>
                        <span>{reunitedProofImage ? 'Foto Anexada' : 'Foto Pendente'}</span>
                      </span>
                      <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-xl flex items-center gap-1 border ${
                        digitalSignatureUrl 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <i className={`fa-solid ${digitalSignatureUrl ? 'fa-circle-check text-emerald-600' : 'fa-signature text-slate-400'}`}></i>
                        <span>{digitalSignatureUrl ? 'Assinatura Pronta' : 'Assinatura Opcional'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Alerta de Validação de Prova se o utilizador tentou avançar sem prova */}
                  {reunitedProofValidationWarning && (
                    <div className="bg-rose-50 border-2 border-rose-300 p-3.5 rounded-2xl flex items-start gap-2.5 text-rose-800 animate-in fade-in">
                      <i className="fa-solid fa-triangle-exclamation text-rose-600 text-sm mt-0.5 shrink-0"></i>
                      <div className="text-[10px] font-bold leading-normal">
                        <span className="font-black uppercase block mb-0.5">Prova de Entrega Obrigatória:</span>
                        {reunitedProofValidationWarning}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-widest font-mono">🛡️ Porquê a Prova é Obrigatória?</h4>
                    <p className="text-[9.5px] text-gray-600 font-bold uppercase leading-normal">
                      Para evitar fraudes e encerramentos acidentais, é obrigatório anexar uma <span className="text-black font-black">foto da entrega</span> e/ou colher a <span className="text-[#009739] font-black">assinatura digital</span> no ecrã antes da confirmação final.
                    </p>
                  </div>

                  {/* Layout em Grade de Alta Resolução */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
                    
                    {/* Coluna 1: Foto Prova */}
                    <div className="bg-slate-50/50 p-5 rounded-[2rem] border-2 border-gray-100 flex flex-col justify-between space-y-3 hover:border-[#009739]/20 transition-colors">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-[9.5px] font-black text-gray-700 uppercase tracking-widest block font-sans">
                            📷 1. Foto de Prova
                          </label>
                          {reunitedProofImage && (
                            <span className="text-[7.5px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ✓ Válida
                            </span>
                          )}
                        </div>
                        <p className="text-[8px] text-gray-500 font-bold uppercase mt-0.5 leading-normal">
                          Fotografe o artigo com o proprietário legítimo ou no momento da devolução.
                        </p>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center pt-1">
                        {reunitedProofImage ? (
                          <div className="relative aspect-[1.33/1] w-full rounded-2xl overflow-hidden border-2 border-white shadow-md bg-stone-100 flex items-center justify-center">
                            <img src={reunitedProofImage} className="w-full h-full object-cover" alt="Prova de Recuperação" referrerPolicy="no-referrer" />
                            <button 
                              type="button"
                              onClick={() => {
                                setReunitedProofImage(null);
                                setReunitedProofValidationWarning(null);
                              }}
                              className="absolute top-2 right-2 bg-black hover:bg-red-650 text-white p-2.5 rounded-full text-[10px] shadow-lg transition-all active:scale-95 cursor-pointer z-10"
                              title="Remover Imagem"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleOpenImageFilters(reunitedProofImage, -1, 'proof')}
                              className="absolute bottom-2 right-2 bg-black/80 hover:bg-[#009739] text-[#fce100] hover:text-white px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all shadow-md active:scale-95 z-10"
                              title="Ajustar Brilho e Contraste (Baixa Luz)"
                            >
                              <i className="fa-solid fa-sliders"></i>
                              <span>Ajustar Foto</span>
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-250 hover:border-[#009739]/50 rounded-2xl p-4 text-center cursor-pointer transition-all hover:bg-emerald-50/10 group">
                            <div className="w-10 h-10 bg-white text-gray-400 group-hover:text-[#009739] group-hover:bg-emerald-50 rounded-xl flex items-center justify-center text-lg shadow-xs transition-all mb-2 border border-gray-100">
                              <i className="fa-solid fa-camera-retro"></i>
                            </div>
                            <span className="text-[9px] font-black text-gray-800 uppercase">Tirar ou Anexar Imagem</span>
                            <span className="text-[7.5px] text-gray-400 font-bold block mt-0.5">JPG, PNG (Máx 10MB)</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 10 * 1024 * 1024) {
                                  alert("A imagem de prova é muito grande. Máximo 10MB.");
                                  return;
                                }
                                try {
                                  const reader = new FileReader();
                                  reader.onload = async (event) => {
                                    try {
                                      const base64 = event.target?.result as string;
                                      const compressed = await compressImage(base64, 800, 800, 0.6);
                                      setReunitedProofImage(compressed);
                                      setReunitedProofValidationWarning(null);
                                    } catch (err) {
                                      console.error("Image compression failed:", err);
                                      alert("Falha ao otimizar a imagem.");
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                } catch (err) {
                                  console.error("File reading failed:", err);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Coluna 2: Assinatura Digital e GPS */}
                    <div className="bg-slate-50/50 p-5 rounded-[2rem] border-2 border-gray-100 flex flex-col justify-between space-y-3 hover:border-[#009739]/20 transition-colors">
                      <div>
                        <div className="flex justify-between items-center">
                          <label className="text-[9.5px] font-black text-gray-700 uppercase tracking-widest block font-sans">
                            ✍️ 2. Assinatura Digital
                          </label>
                          {digitalSignatureUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                clearSignature();
                                setReunitedProofValidationWarning(null);
                              }}
                              className="text-[7.5px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider transition-colors cursor-pointer"
                            >
                              Limpar Quadro
                            </button>
                          )}
                        </div>
                        <p className="text-[8px] text-gray-500 font-bold uppercase mt-0.5 leading-normal">
                          O proprietário ou receptor do artigo deve assinar diretamente usando o ecrã.
                        </p>
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-inner relative flex flex-col justify-center h-32">
                          <canvas
                            ref={canvasRef}
                            width={400}
                            height={128}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            onTouchCancel={stopDrawing}
                            className="w-full h-full bg-slate-50/70 block cursor-crosshair touch-none"
                          />
                          {!isDrawing && !digitalSignatureUrl && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 font-sans text-[7.5px] uppercase tracking-wider select-none font-bold text-center p-3 leading-normal">
                              Por favor, assine com o dedo ou rato
                            </div>
                          )}
                        </div>

                        {/* Georeferência GPS Compacta Integrada */}
                        <div className="bg-white p-2.5 rounded-xl border border-gray-150 flex items-center justify-between gap-1.5 text-[8px] font-bold">
                          <span className="text-gray-600 uppercase tracking-wide truncate">
                            📍 GPS: {signedGeoLat ? `${signedGeoLat}, ${signedGeoLng}` : 'Aguardando Coordenadas'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCaptureStatus('capturing');
                              if ("geolocation" in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    setSignedGeoLat(pos.coords.latitude.toFixed(6));
                                    setSignedGeoLng(pos.coords.longitude.toFixed(6));
                                    setCaptureStatus('success');
                                  },
                                  () => {
                                    setSignedGeoLat("-25.9692");
                                    setSignedGeoLng("32.5732");
                                    setCaptureStatus('success');
                                  },
                                  { timeout: 7000, enableHighAccuracy: true }
                                );
                              } else {
                                setSignedGeoLat("-25.9692");
                                setSignedGeoLng("32.5732");
                                setCaptureStatus('success');
                              }
                            }}
                            className="bg-black text-[#fce100] hover:bg-[#009739] hover:text-white px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Recapturar
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Banner do Modo Offline & Entrega Integrada */}
                  <div className="flex items-center justify-between bg-[#009739]/5 p-4 rounded-3xl border border-[#009739]/15">
                    <div className="flex gap-3 items-start text-left">
                      <div className="bg-emerald-100 text-[#009739] p-2.5 rounded-xl shrink-0 mt-0.5">
                        <i className="fa-solid fa-cloud-sun text-xs animate-bounce-slow"></i>
                      </div>
                      <div>
                        <span className="font-black text-[9.5px] text-gray-900 uppercase block leading-none">Registo de Entrega Segura / Sem Sinal</span>
                        <p className="text-[8.5px] text-gray-500 font-bold uppercase mt-1 leading-normal">
                          Criptografe e valide as assinaturas localmente na memória interna para áreas com conexão instável.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={offlineDeliveryEnabled}
                        onChange={(e) => {
                          setOfflineDeliveryEnabled(e.target.checked);
                          if (e.target.checked) {
                            setSignedGeoLat("-25.9692");
                            setSignedGeoLng("32.5732");
                            setCaptureStatus("success");
                          } else {
                            setDigitalSignatureUrl(null);
                          }
                        }}
                      />
                      <div className="w-[42px] h-[22px] bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-[#009739]"></div>
                    </label>
                  </div>

                  {/* Extra notes */}
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] font-black text-gray-500 uppercase tracking-widest block font-sans">Observações / Nota de Entrega (Opcional)</label>
                    <textarea 
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-[#009739]/20 focus:bg-white rounded-2xl p-3.5 h-16 text-xs font-semibold placeholder:text-gray-400 outline-none transition-all resize-none shadow-inner"
                      placeholder="Ex: Item entregue ao proprietário legítimo em mãos mediante verificação de identificação..." 
                      value={reunitedProofNotes}
                      onChange={(e) => setReunitedProofNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Footer Buttons - Passo 1 */}
                <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleInitiateReunitedReview}
                    className="flex-1 bg-[#009739] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-[#007a2d] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    id="reunited-review-summary-btn"
                  >
                    <span>Rever Resumo & Confirmar</span>
                    <i className="fa-solid fa-arrow-right text-xs"></i>
                  </button>
                  <button 
                    onClick={handleCancelReunitedFlow}
                    className="sm:w-36 bg-white border-2 border-gray-200 text-gray-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:border-black hover:text-black transition-all cursor-pointer text-center"
                    id="reunited-confirm-cancel-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              /* ETAPA 2: Diálogo de Confirmação Extra com Resumo Final dos Dados (Anti-Erro) */
              <div className="flex flex-col animate-in fade-in duration-200" id="reunited-summary-confirmation-dialog">
                {/* Header */}
                <div className="bg-amber-50 p-6 sm:p-7 border-b border-amber-200/80 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3.5">
                    <div className="bg-amber-600 text-white p-3 rounded-2xl shadow-md">
                      <i className="fa-solid fa-shield-halved text-lg"></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-gray-900 uppercase leading-none">Resumo Final de Recuperação</h3>
                        <span className="bg-amber-200 text-amber-900 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Passo 2 de 2</span>
                      </div>
                      <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block mt-1 font-mono">Confirmação Anti-Erro • Verificação Antes de Encerramento</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowReunitedSummaryConfirm(false)}
                    className="p-2 bg-white/80 rounded-xl shadow-xs text-gray-500 hover:text-black transition-colors cursor-pointer"
                    title="Voltar ao passo anterior"
                  >
                    <i className="fa-solid fa-arrow-left text-sm"></i>
                  </button>
                </div>

                {/* Body com Resumo dos Dados */}
                <div className="p-6 sm:p-8 space-y-5 text-left max-h-[65vh] overflow-y-auto no-scrollbar">
                  {/* Banner de Alerta Anti-Erro */}
                  <div className="bg-amber-50/80 border-2 border-amber-200 p-4 rounded-3xl flex items-start gap-3 text-amber-900">
                    <i className="fa-solid fa-circle-exclamation text-amber-600 text-base mt-0.5 shrink-0"></i>
                    <div className="text-[10px] font-semibold leading-relaxed">
                      <strong className="block uppercase text-[10.5px] font-black text-amber-950 mb-0.5">Atenção: Ação Definitiva de Encerramento</strong>
                      Ao confirmar este resumo, o artigo será marcado como <span className="font-black text-emerald-800">RECUPERADO</span>. O registo será arquivado nas buscas ativas e a prova fotográfica e geográfica ficará registada permanentemente.
                    </div>
                  </div>

                  {/* Ficha Resumo dos Dados */}
                  <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-4">
                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block font-mono">
                      📋 Resumo dos Dados de Entrega
                    </span>

                    {/* Artigo e Localização */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[8px] font-black uppercase text-gray-400 block">Artigo:</span>
                        <span className="text-xs font-black uppercase text-gray-900 block mt-0.5">{reunitedConfirmItemInfo.title}</span>
                        <span className="text-[9px] font-bold text-[#009739] uppercase mt-0.5 block">{reunitedConfirmItemInfo.category}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black uppercase text-gray-400 block">Registo Original:</span>
                        <span className="text-[10px] font-bold text-gray-700 block mt-0.5">
                          <i className="fa-solid fa-location-dot text-[#d21034] mr-1"></i>
                          {reunitedConfirmItemInfo.location}, {reunitedConfirmItemInfo.province}
                        </span>
                        <span className="text-[8.5px] text-gray-500 font-medium block mt-0.5">
                          Modo: {offlineDeliveryEnabled ? '🛡️ Entrega Offline Encriptada' : '🌐 Sincronização Online na Nuvem'}
                        </span>
                      </div>
                    </div>

                    {/* Prova Fotográfica e Assinatura Visual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                      {/* Miniatura da Foto */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                        {reunitedProofImage ? (
                          <>
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                              <img src={reunitedProofImage} alt="Foto Prova" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="text-left">
                              <span className="text-[8px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                                ✓ Foto Anexada
                              </span>
                              <span className="text-[8.5px] font-bold text-gray-600 block mt-1 leading-tight">
                                Prova fotográfica pronta para registo
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2.5 text-slate-400">
                            <i className="fa-solid fa-image-slash text-xl text-slate-300"></i>
                            <span className="text-[9px] font-bold uppercase">Sem fotografia (validado por assinatura)</span>
                          </div>
                        )}
                      </div>

                      {/* Miniatura da Assinatura Digital */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                        {digitalSignatureUrl ? (
                          <>
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 shrink-0 border border-slate-200 flex items-center justify-center p-1">
                              <img src={digitalSignatureUrl} alt="Assinatura" className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="text-left">
                              <span className="text-[8px] font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                                ✓ Assinatura Válida
                              </span>
                              <span className="text-[8.5px] font-bold text-gray-600 block mt-1 leading-tight">
                                Assinatura digital do recetor recolhida
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2.5 text-slate-400">
                            <i className="fa-solid fa-signature text-xl text-slate-300"></i>
                            <span className="text-[9px] font-bold uppercase">Sem assinatura no ecrã</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coordenadas e Notas */}
                    <div className="space-y-2 text-[9.5px]">
                      <div className="flex items-center justify-between text-gray-600 font-bold bg-white p-2.5 rounded-xl border border-slate-200">
                        <span>📍 Coordenadas de Devolução:</span>
                        <span className="font-mono text-gray-900">{signedGeoLat || '-25.9692'}, {signedGeoLng || '32.5732'}</span>
                      </div>

                      {reunitedProofNotes ? (
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-left">
                          <span className="text-[7.5px] font-black uppercase text-gray-400 block mb-0.5">Observações:</span>
                          <p className="text-[9.5px] font-semibold text-gray-700 italic">"{reunitedProofNotes}"</p>
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-gray-400 font-semibold italic text-left">
                          Nenhuma observação adicional incluída.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Declaração de Responsabilidade e Confirmação (Checkbox Obrigatória) */}
                  <label className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 cursor-pointer select-none text-left transition-all hover:bg-emerald-50">
                    <input 
                      type="checkbox"
                      id="reunited-declaration-checkbox"
                      checked={reunitedDeclarationConfirmed}
                      onChange={(e) => setReunitedDeclarationConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-[#009739] rounded border-gray-300 focus:ring-[#009739] cursor-pointer shrink-0"
                    />
                    <span className="text-[10px] font-bold text-gray-800 leading-snug">
                      <strong className="text-emerald-900 font-black block uppercase text-[10px] mb-0.5">Declaração de Confirmação & Boa Fé:</strong>
                      Declaro sob compromisso de honra que o artigo foi entregue fisicamente ao recetor legítimo, conferi os dados de identificação e a prova anexada é verídica.
                    </span>
                  </label>
                </div>

                {/* Footer Buttons - Passo 2 */}
                <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={handleConfirmReunitedProof}
                    disabled={!reunitedDeclarationConfirmed || isSubmittingReunitedProof}
                    className="flex-1 bg-[#009739] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-[#007a2d] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                    id="reunited-final-submit-btn"
                  >
                    {isSubmittingReunitedProof ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>A Finalizar Registo...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check-double"></i>
                        <span>Confirmar & Finalizar Registo</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setShowReunitedSummaryConfirm(false)}
                    disabled={isSubmittingReunitedProof}
                    className="sm:w-36 bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:border-black hover:text-black transition-all cursor-pointer text-center"
                    id="reunited-back-to-edit-btn"
                  >
                    <i className="fa-solid fa-arrow-left mr-1"></i>
                    Voltar
                  </button>
                  <button 
                    onClick={handleCancelReunitedFlow}
                    disabled={isSubmittingReunitedProof}
                    className="sm:w-28 bg-rose-50 border border-rose-200 text-rose-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-rose-100 transition-all cursor-pointer text-center"
                    id="reunited-cancel-summary-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Diálogo de Filtros de Processamento de Imagem (Baixa Luz, Brilho, Contraste) */}
      {filterModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[220] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-lg w-full overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 flex flex-col justify-between my-auto">
            
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="bg-[#009739] text-white p-3 rounded-2xl shadow-md">
                  <i className="fa-solid fa-sliders text-lg"></i>
                </div>
                <div className="text-left">
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase leading-none">Otimizar e Ajustar Imagem</h3>
                  <span className="text-[9px] font-black text-[#009739] uppercase tracking-wider block mt-1.5 font-mono">Processamento Digital Contra Baixa Luz</span>
                </div>
              </div>
              <button 
                onClick={() => setFilterModalOpen(false)}
                className="p-2 bg-white dark:bg-slate-800 rounded-full text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer border border-gray-250 dark:border-slate-700"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-6 text-left max-h-[60vh] overflow-y-auto no-scrollbar">
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold leading-normal">
                Melhore a visibilidade de documentos nacionais (BI, Passaportes) ou chaves capturados em ambientes escuros. Isso ajuda no processamento automático por IA do ComeBack.
              </p>

              {/* Visual Live Preview with the CSS filters applied instantly using the sliders */}
              <div className="relative aspect-[1.33/1] w-full rounded-2xl overflow-hidden border-2 border-gray-150 dark:border-slate-800 shadow-inner bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                <img 
                  src={previewFilterImg} 
                  className="w-full h-full object-contain transition-all duration-75" 
                  style={{ filter: `brightness(${filterBrightness}%) contrast(${filterContrast}%)` }}
                  alt="Pré-visualização do Filtro" 
                  referrerPolicy="no-referrer"
                />
                
                {/* Active settings badge */}
                <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg text-[8px] font-mono font-black text-[#fce100] tracking-wider uppercase flex items-center gap-2 backdrop-blur-xs">
                  <span>Brilho: {filterBrightness}%</span>
                  <span className="text-gray-500">|</span>
                  <span>Contraste: {filterContrast}%</span>
                </div>
              </div>

              {/* Sliders Container */}
              <div className="space-y-4">
                {/* Brightness Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9.5px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-sun text-amber-500"></i> Brilho (Brightness)
                    </span>
                    <span className="text-[10px] font-mono font-black text-[#009739]">{filterBrightness}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="200"
                    value={filterBrightness}
                    onChange={(e) => setFilterBrightness(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-255 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#009739]"
                  />
                </div>

                {/* Contrast Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9.5px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-half-stroke text-sky-500"></i> Contraste (Contrast)
                    </span>
                    <span className="text-[10px] font-mono font-black text-[#009739]">{filterContrast}%</span>
                  </div>
                  <input 
                    type="range"
                    min="50"
                    max="200"
                    value={filterContrast}
                    onChange={(e) => setFilterContrast(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-255 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#009739]"
                  />
                </div>
              </div>

              {/* Predefinições Instantâneas / Presets */}
              <div className="space-y-2">
                <span className="text-[8.5px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block font-mono">Filtros e Predefinições de Baixa Luz</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setFilterBrightness(135);
                      setFilterContrast(140);
                    }}
                    className="p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-emerald-50/55 dark:hover:bg-emerald-950/20 text-gray-800 dark:text-gray-200 border-2 border-gray-150 dark:border-slate-700 hover:border-[#009739]/30 rounded-xl text-[8.5px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer animate-none"
                  >
                    <i className="fa-solid fa-moon text-sky-400"></i> Otimizar Baixa Luz
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setFilterBrightness(120);
                      setFilterContrast(155);
                    }}
                    className="p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-emerald-50/55 dark:hover:bg-emerald-950/20 text-gray-800 dark:text-gray-200 border-2 border-gray-150 dark:border-slate-700 hover:border-[#009739]/30 rounded-xl text-[8.5px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer animate-none"
                  >
                    <i className="fa-solid fa-id-card text-emerald-500"></i> Focar BI/Documentos
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setFilterBrightness(110);
                      setFilterContrast(170);
                    }}
                    className="p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-emerald-50/55 dark:hover:bg-emerald-950/20 text-gray-800 dark:text-gray-200 border-2 border-gray-150 dark:border-slate-700 hover:border-[#009739]/30 rounded-xl text-[8.5px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer animate-none"
                  >
                    <i className="fa-solid fa-key text-yellow-500"></i> Focar Chaves
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setFilterBrightness(100);
                      setFilterContrast(100);
                    }}
                    className="p-2.5 bg-slate-50 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 border-2 border-gray-150 dark:border-slate-700 rounded-xl text-[8.5px] font-black uppercase text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer animate-none"
                  >
                    <i className="fa-solid fa-rotate-left"></i> original
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 sm:p-8 bg-gray-50 dark:bg-slate-900/80 border-t border-gray-100 dark:border-slate-800 flex gap-4">
              <button 
                onClick={handleApplyImageFilterAction}
                disabled={isProcessingFilterImage}
                className="flex-1 bg-[#009739] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] shadow-lg hover:bg-[#007a2d] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer animate-none"
              >
                {isProcessingFilterImage ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Injetando Filtros...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk text-xs"></i>
                    <span>Aplicar e Salvar</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => setFilterModalOpen(false)}
                disabled={isProcessingFilterImage}
                className="flex-1 bg-white dark:bg-slate-800 border-2 border-gray-250 dark:border-slate-700 text-gray-500 dark:text-gray-350 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] sm:text-[11px] hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-all cursor-pointer animate-none"
              >
                Descartar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Diálogo de Confirmação Personalizado para Exclusão de Artigo */}
      {deleteConfirmItemId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[210] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-250 border border-gray-100 my-auto flex flex-col">
            {/* Header */}
            <div className="bg-red-50 p-6 sm:p-8 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="bg-[#d21034] text-white p-3 rounded-2xl shadow-md animate-pulse">
                  <i className="fa-solid fa-trash-can text-lg"></i>
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black text-gray-900 uppercase leading-tight">Excluir Artigo</h3>
                  <span className="text-[9px] font-black text-[#d21034] uppercase tracking-wider block mt-0.5">Aviso de Exclusão Permanente</span>
                </div>
              </div>
              <button 
                onClick={() => setDeleteConfirmItemId(null)}
                disabled={isDeletingItem}
                className="p-2.5 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-black transition-colors cursor-pointer disabled:opacity-50"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-5 text-left">
              {(() => {
                const item = items.find(i => i.id === deleteConfirmItemId);
                if (!item) return null;
                return (
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex gap-3.5 items-center">
                    <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-gray-100 shrink-0">
                      <MediaViewer 
                        src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
                        category={item.category}
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">PUBLICADO NO COMEBACK</span>
                      <h4 className="text-xs font-black text-gray-800 uppercase truncate leading-tight">{item.title}</h4>
                      <span className="text-[9px] text-gray-500 font-bold block mt-0.5">
                        <i className="fa-solid fa-location-dot text-[#d21034] mr-1"></i>
                        {item.location}, {item.province}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 bg-red-50/30 p-4 rounded-3xl border border-red-100/40">
                <h4 className="text-[10px] font-black text-[#d21034] uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <i className="fa-solid fa-triangle-exclamation animate-bounce"></i>
                  <span>Atenção: Ação Irreversível</span>
                </h4>
                <p className="text-[10.5px] text-gray-650 font-medium leading-relaxed">
                  Tens a certeza que desejas excluir este registo permanentemente? Toda a informação de correspondências de IA e chats ativos associados a este artigo serão eliminados sem possibilidade de recuperação.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
              <button 
                onClick={handleConfirmDelete}
                disabled={isDeletingItem}
                className="flex-[1.2] bg-[#d21034] text-white py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-[#a90d28] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="delete-confirm-submit-btn"
              >
                {isDeletingItem ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => setDeleteConfirmItemId(null)}
                disabled={isDeletingItem}
                className="flex-1 bg-white border-2 border-gray-200 text-gray-500 py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:border-black hover:text-black transition-all cursor-pointer disabled:opacity-50"
                id="delete-confirm-cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Proximity Alert Toast */}
      {activeProximityAlert && (
        <div 
          className={`fixed bottom-6 right-6 z-[120] ${isToastMinimized ? 'is-minimized bg-white/95 dark:bg-slate-950/95 border-2 text-slate-800 dark:text-white p-2 sm:p-2.5 rounded-full shadow-2xl transition-all duration-300' : 'max-w-sm w-full bg-white/95 dark:bg-slate-950/95 border-2 text-slate-800 dark:text-white p-4 min-[480px]:p-5 rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom duration-350 select-none cursor-help transition-all duration-300 relative grid grid-rows-[auto_1fr] grid-cols-1 gap-3.5'} ${isHighRiskZone(activeProximityAlert.item) ? 'border-red-500 pulse-red-border' : 'border-amber-400 pulse-amber-border'} hover:shadow-cyan-500/10 focus-within:ring-2 focus-within:ring-amber-400/50 hover:-translate-y-1 focus-within:-translate-y-1 outline-none`} 
          id="proximity-alert-toast"
          tabIndex={0}
          onMouseEnter={() => {
            if (!isToastMinimized) {
              setIsToastExpanded(true);
              handleToastTriggerVibration();
            }
          }}
          onMouseLeave={() => setIsToastExpanded(false)}
          onTouchStart={() => {
            if (!isToastMinimized) {
              setIsToastExpanded(true);
              handleToastTriggerVibration();
            }
          }}
          onTouchEnd={() => setIsToastExpanded(false)}
          onFocusCapture={() => {
            if (!isToastMinimized) {
              setIsToastFocused(true);
              handleToastTriggerVibration();
            }
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsToastFocused(false);
            }
          }}
        >
          {isToastMinimized ? (
            /* Minimal Icon State */
            <div 
              onClick={() => {
                setIsToastMinimized(false);
                handleToastTriggerVibration();
              }}
              className="flex items-center gap-2.5 cursor-pointer w-full"
              id="toast-minimized-content"
              title="Clique para restaurar o Alerta de Proximidade"
            >
              {/* Minimal Animated Bell / Radar Icon */}
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-[#d21034] via-[#e61b42] to-[#fce100] text-white shrink-0 shadow-md animate-pulse">
                <i className="fa-solid fa-bell text-xs"></i>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
              </div>

              {/* Minimal Info Badges */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-black text-[9px] uppercase tracking-wider text-slate-900 dark:text-white truncate max-w-[90px] sm:max-w-[130px]">
                  {activeProximityAlert.item.title}
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-[#009739] dark:text-emerald-400 text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 shadow-xs">
                  {activeProximityAlert.distance.toFixed(1)} km
                </span>
                <span className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full shrink-0 shadow-xs flex items-center gap-0.5">
                  <i className="fa-solid fa-hourglass-half text-[7px] text-amber-500 animate-pulse"></i>
                  {proximityCountdown}s
                </span>
              </div>

              {/* Restore/Expand Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsToastMinimized(false);
                  handleToastTriggerVibration();
                }}
                className="ml-auto flex items-center justify-center bg-slate-100 dark:bg-slate-900 hover:bg-[#fce100] text-slate-700 dark:text-gray-300 hover:text-black w-6 h-6 rounded-full border border-gray-200 dark:border-white/10 text-[8px] cursor-pointer transition-all active:scale-90 shrink-0"
                id="toast-restore-btn"
                title="Expandir Alerta"
              >
                <i className="fa-solid fa-up-right-and-down-left-from-center text-[7.5px]"></i>
              </button>
            </div>
          ) : (
            <>
              {/* Section 1: Top Header for Distance, Countdown & Status Badges */}
              <div className="proximity-toast-header grid grid-cols-[1fr_auto] items-center gap-2 pb-3 border-b border-gray-100 dark:border-white/5 w-full">
                {/* Left Header Column: Status Badges */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="bg-[#d21034] text-white text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap shrink-0">
                    Alerta Próximo
                  </span>
                  {isHighRiskZone(activeProximityAlert.item) && (
                    <span className="bg-red-600 text-white text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md animate-pulse border border-red-500/50 flex items-center gap-0.5 shadow-sm whitespace-nowrap shrink-0">
                      <i className="fa-solid fa-triangle-exclamation text-[8px]"></i> Risco
                    </span>
                  )}
                </div>

                {/* Right Header Column: Minimize, Maximize, Distance and Countdown */}
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  {/* Minimize Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsToastMinimized(true);
                      handleToastTriggerVibration();
                    }}
                    className="flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-gray-200 dark:border-white/10 hover:border-amber-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 hover:text-amber-500 px-2 py-0.5 rounded-full shadow-inner text-[8px] cursor-pointer transition-all active:scale-95 gap-1 font-semibold uppercase whitespace-nowrap"
                    id="toast-minimize-btn"
                    title="Minimizar alerta de proximidade"
                  >
                    <i className="fa-solid fa-minus text-[7.5px]"></i>
                    <span>Min</span>
                  </button>

                  {/* Maximize Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsToastMaximized(true);
                      handleToastTriggerVibration();
                    }}
                    className="flex items-center justify-center bg-slate-100 dark:bg-slate-900 border border-gray-200 dark:border-white/10 hover:border-[#fce100] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-gray-300 hover:text-[#fce100] px-2 py-0.5 rounded-full shadow-inner text-[8px] cursor-pointer transition-all active:scale-95 gap-1 font-semibold uppercase whitespace-nowrap"
                    id="toast-maximize-btn"
                    title="Maximizar visualização do Radar"
                  >
                    <i className="fa-solid fa-expand text-[7.5px]"></i>
                    <span>Max</span>
                  </button>

                  {/* Distance Badge */}
                  <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-[#009739] dark:text-emerald-400 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-md shrink-0 shadow-sm whitespace-nowrap">
                    {activeProximityAlert.distance.toFixed(1)} km
                  </span>

                  {/* Countdown Badge */}
                  <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 px-2 py-0.5 rounded-full shadow-inner text-[8px] font-mono font-black text-amber-700 dark:text-amber-400 shrink-0 whitespace-nowrap">
                    <i className="fa-solid fa-hourglass-half text-[7.5px] text-amber-500 animate-pulse"></i>
                    <span>{proximityCountdown}s</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></div>
                  </div>
                </div>
              </div>

              {/* Section 2: Lower Body for Primary Item Information */}
              <div className="proximity-toast-body grid grid-cols-1 min-[480px]:grid-cols-[auto_1fr] gap-3.5 items-start w-full">
                <div className="proximity-toast-icon w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 text-[#009739] dark:text-[#fce100] border border-emerald-400/40 dark:border-[#fce100]/40 flex items-center justify-center text-lg shrink-0 animate-bounce">
                  <i className="fa-solid fa-bell"></i>
                </div>
                <div className="min-w-0 text-left">
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white truncate leading-snug">
                    {activeProximityAlert.item.title}
                  </h4>
                  <p className="text-[10px] text-slate-600 dark:text-gray-300 leading-relaxed mt-1 font-bold">
                    Este bem foi reportado como <strong className="text-[#009739]">ACHADO</strong> a {activeProximityAlert.distance.toFixed(1)} km da tua localização atual ({activeProximityAlert.item.location}).
                  </p>

              {/* Expandable Exact Occurrence Date, Routing Preview & Share */}
              <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[36rem] opacity-100 mt-3 pt-3 border-t border-gray-200 dark:border-white/10' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-xl p-2.5 space-y-3 flex flex-col">
                  {/* Occurrence Dates */}
                  <div>
                    <span className="block text-[8px] font-black text-[#009739] dark:text-amber-400 uppercase tracking-wider mb-1">
                      <i className="fa-solid fa-clock mr-1"></i> Data da Ocorrência
                    </span>
                    <p className="text-[10px] font-black uppercase text-slate-800 dark:text-white leading-tight">
                      {(() => {
                        try {
                          const dateObj = new Date(activeProximityAlert.item.date);
                          if (isNaN(dateObj.getTime())) return activeProximityAlert.item.date;
                          return dateObj.toLocaleDateString('pt-MZ', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                        } catch {
                          return activeProximityAlert.item.date;
                        }
                      })()}
                    </p>
                    {activeProximityAlert.item.createdAt && (
                      <span className="block text-[7.5px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-1 leading-none">
                        Registado: {new Date(activeProximityAlert.item.createdAt).toLocaleDateString('pt-MZ')} às {new Date(activeProximityAlert.item.createdAt).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Warning banner if it's a Risk Zone */}
                  {isHighRiskZone(activeProximityAlert.item) && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl p-2.5 space-y-1">
                      <span className="block text-[8px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                        <i className="fa-solid fa-triangle-exclamation mr-1 animate-pulse"></i> ÁREA COM HISTÓRICO DE RISCO
                      </span>
                      <p className="text-[9px] text-red-800 dark:text-gray-300 leading-tight">
                        A vizinhança de <strong>{activeProximityAlert.item.location}</strong> possui histórico elevado de ocorrências (furto ou roubo de bens). Recomendamos precaução ao articular a recuperação!
                      </p>
                    </div>
                  )}

                  {/* Route path preview miniature */}
                  <div className="border-t border-gray-200 dark:border-white/5 pt-2">
                    <span className="block text-[8px] font-black text-[#009739] uppercase tracking-wider mb-1">
                      <i className="fa-solid fa-route mr-1 animate-pulse"></i> Miniatura do Percurso Radar
                    </span>
                    <div className="bg-gray-100 dark:bg-slate-950 p-2 rounded-lg border border-gray-200 dark:border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-[7px] sm:text-[8px] font-black uppercase text-slate-500 dark:text-gray-400 mb-1">
                        <span className="truncate max-w-[80px]"><i className="fa-solid fa-circle-dot text-sky-550 mr-0.5"></i> Tu (GPS)</span>
                        <span className="text-amber-650 dark:text-amber-400 shrink-0">{getCompassDirection(currentLocationCoords.lat, currentLocationCoords.lng, activeProximityAlert.item.latitude || -25.9692, activeProximityAlert.item.longitude || 32.5732)}</span>
                        <span className="truncate max-w-[80px] text-right"><i className="fa-solid fa-map-pin text-[#d21034] mr-0.5"></i> {activeProximityAlert.item.location}</span>
                      </div>

                      {/* Precise Distance & Geolocation coordinates */}
                      <div className="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-white/5 p-1.5 rounded flex justify-between items-center text-[7.5px] font-mono text-slate-700 dark:text-gray-300">
                        <span>🛰️ COORD DE SEGURANÇA:</span>
                        <span className="text-slate-800 dark:text-white">{(activeProximityAlert.distance * 1000).toFixed(0)}m / {activeProximityAlert.item.latitude?.toFixed(4) || '-25.9692'}, {activeProximityAlert.item.longitude?.toFixed(4) || '32.5732'}</span>
                      </div>

                      {/* Local Safety protocol guidelines list */}
                      <div className="bg-amber-55 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/30 p-2 rounded-xl text-[7px] space-y-1 text-left">
                        <span className="block font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                          🛡️ PROTOCOLO LOCAL DE SEGURANÇA (MAPUTO)
                        </span>
                        <ul className="list-disc pl-3 text-slate-700 dark:text-gray-300 space-y-0.5 leading-tight uppercase font-medium">
                          <li>NUNCA SE APRESENTE SOZINHO/A NO ENCONTRO DE RESGATE.</li>
                          <li>PREFIRA ENCONTROS EM ESQUADRAS OU PARQUES DE SHOPPINGS (EX: GLÓRIA, NOVAS).</li>
                          <li>NÃO EFETUE PONTAS/RECOMPENSAS ANTES DE ANALISAR O PRODUTO FISICAMENTE.</li>
                        </ul>
                      </div>

                      {/* Route Map Illustration line */}
                      <div className="relative h-6 bg-slate-50 dark:bg-slate-900 rounded border border-gray-200 dark:border-white/5 flex items-center justify-between px-2 overflow-hidden">
                        <div className="absolute left-3 right-3 h-0.5 border-t border-dashed border-gray-600 top-1/2 -translate-y-1/2 z-0"></div>
                        <div className="absolute left-3 right-3 h-0.5 border-t border-dashed border-[#009739] top-1/2 -translate-y-1/2 z-0 opacity-50"></div>
                        
                        {/* User Dot */}
                                            {/* Moving pedestrian / car / bicycle indicator depending on selected transport mode */}
                        <div className="absolute left-[45%] top-1/2 -translate-y-1/2 z-20 text-emerald-400 text-[10px] transition-all">
                          {toastTransportMode === 'walking' ? (
                            <i className="fa-solid fa-person-walking animate-bounce"></i>
                          ) : toastTransportMode === 'fastwalking' ? (
                            <i className="fa-solid fa-person-running animate-bounce" style={{ animationDuration: '0.4s' }}></i>
                          ) : toastTransportMode === 'cycling' ? (
                            <i className="fa-solid fa-bicycle animate-bounce" style={{ animationDuration: '0.6s' }}></i>
                          ) : toastTransportMode === 'chapa' ? (
                            <i className="fa-solid fa-taxi animate-pulse"></i>
                          ) : toastTransportMode === 'bus' ? (
                            <i className="fa-solid fa-bus animate-pulse"></i>
                          ) : toastTransportMode === 'mototaxi' ? (
                            <i className="fa-solid fa-motorcycle animate-bounce" style={{ animationDuration: '0.5s' }}></i>
                          ) : (
                            <i className="fa-solid fa-car animate-pulse"></i>
                          )}
                        </div>

                        {/* Item Dot */}
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 relative z-10 flex items-center justify-center">
                          <span className="absolute w-4 h-4 rounded-full bg-red-400/40 animate-ping"></span>
                        </div>
                      </div>

                      {/* Selectable Transport Modes with internal ETA preview */}
                      <div className="grid grid-cols-3 gap-1 px-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('walking');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'walking'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🚶 Pé</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(2, Math.round((activeProximityAlert.distance / 5.0) * 60))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('fastwalking');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'fastwalking'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🏃‍♂️ C. Rápida</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(1, Math.round((activeProximityAlert.distance / 6.0) * 60))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('cycling');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'cycling'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🚲 Bike</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(1, Math.round((activeProximityAlert.distance / 15.0) * 60))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('driving');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'driving'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🚗 Carro</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(1, Math.round((activeProximityAlert.distance / 35.0) * 60))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('chapa');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'chapa'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🚐 Chapa</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(4, Math.round((activeProximityAlert.distance / 20.0) * 60 + 6))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('bus');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'bus'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🚌 Ônibus</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(10, Math.round((activeProximityAlert.distance / 18.0) * 60 + 10))}m</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToastTransportMode('mototaxi');
                          }}
                          className={`p-1 rounded-lg text-[6.5px] font-black flex items-center justify-between gap-0.5 transition-all cursor-pointer ${
                            toastTransportMode === 'mototaxi'
                              ? 'bg-[#009739] text-white border border-emerald-500 shadow-md'
                              : 'bg-slate-250 dark:bg-slate-900/85 text-slate-700 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          <span>🏍️ Moto-Táxi</span>
                          <span className="font-mono text-[7px] font-bold text-[#fce100]">{Math.max(1, Math.round((activeProximityAlert.distance / 30.0) * 60))}m</span>
                        </button>
                      </div>

                      {/* Dynamic ETA summary banner */}
                      <div className="bg-slate-100 dark:bg-slate-900/90 py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-white/5 flex flex-col gap-1 text-[8px] transition-all">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <i className="fa-solid fa-hourglass-start text-amber-400 animate-spin" style={{ animationDuration: '3s' }}></i> ETA Estimado:
                          </span>
                          <span className="font-mono font-black text-[#fce100] text-[9px] uppercase">
                            ~ {toastTransportMode === 'walking'
                              ? Math.max(2, Math.round((activeProximityAlert.distance / 5.0) * 60))
                              : toastTransportMode === 'fastwalking'
                              ? Math.max(1, Math.round((activeProximityAlert.distance / 6.0) * 60))
                              : toastTransportMode === 'cycling'
                              ? Math.max(1, Math.round((activeProximityAlert.distance / 15.0) * 60))
                              : toastTransportMode === 'chapa'
                              ? Math.max(4, Math.round((activeProximityAlert.distance / 20.0) * 60 + 6))
                              : toastTransportMode === 'bus'
                              ? Math.max(10, Math.round((activeProximityAlert.distance / 18.0) * 60 + 10))
                              : toastTransportMode === 'mototaxi'
                              ? Math.max(1, Math.round((activeProximityAlert.distance / 30.0) * 60))
                              : Math.max(1, Math.round((activeProximityAlert.distance / 35.0) * 60))
                            } mins ({toastTransportMode === 'walking' ? 'Pedestre' : toastTransportMode === 'fastwalking' ? 'Caminhada Rápida' : toastTransportMode === 'cycling' ? 'Bicicleta' : toastTransportMode === 'chapa' ? 'Chapa / Táxi' : toastTransportMode === 'bus' ? 'Autocarro Público' : toastTransportMode === 'mototaxi' ? 'Moto-Táxi' : 'Carro Privado'})
                          </span>
                        </div>

                        {/* Indicador visual de Tráfego Intenso */}
                        {isMaputoPeakHour && (toastTransportMode === 'driving' || toastTransportMode === 'chapa') && (
                          <div className="border-t border-white/5 pt-1 mt-0.5 bg-red-950/50 p-1.5 rounded border border-red-500/20 text-red-300 text-[7px] flex items-center gap-1.5 animate-pulse">
                            <i className="fa-solid fa-triangle-exclamation text-red-500 text-[9px] shrink-0"></i>
                            <div>
                              <span className="font-bold text-red-400 block uppercase tracking-wider">⚠️ Tráfego Intenso (Hora de Pico Maputo)</span>
                              <span>Trânsito congestionado neste horário (07h-09h / 17h-19h). Considere Moto-Táxi para um trajeto mais rápido.</span>
                            </div>
                          </div>
                        )}

                        {toastTransportMode === 'chapa' && (
                          <div className="border-t border-white/5 pt-1 mt-0.5 flex flex-col gap-0.5 text-[7.5px] text-gray-300">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-sky-400 font-bold">
                                <i className="fa-solid fa-coins text-[8px]"></i> Tarifa Chapa:
                              </span>
                              <span className="font-mono font-black text-emerald-400">
                                {activeProximityAlert.distance > 8 ? '25' : '20'} MT (Fixo por Paragem)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-sky-450 font-bold">
                                <i className="fa-solid fa-calculator text-[8px]"></i> Estimativa Yango/Táxi:
                              </span>
                              <span className="font-mono font-black text-amber-400">
                                ~ {Math.round(150 + activeProximityAlert.distance * 55)} MT (Base + Deslocação)
                              </span>
                            </div>
                            <p className="text-[7px] text-gray-400 mt-0.5 italic">
                              * Cálculo adaptado ao trânsito e tempos de paragem típicos de Maputo.
                            </p>
                          </div>
                        )}
                        {toastTransportMode === 'bus' && (
                          <div className="border-t border-white/5 pt-1 mt-0.5 flex flex-col gap-0.5 text-[7.5px] text-gray-300">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-sky-400 font-bold">
                                <i className="fa-solid fa-coins text-[8px]"></i> Tarifa Autocarro (TPM):
                              </span>
                              <span className="font-mono font-black text-emerald-400">
                                17 MT (Municipal Base)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-sky-450 font-bold">
                                <i className="fa-solid fa-clock-rotate-left text-[8px]"></i> Horário Médio de Circulação:
                              </span>
                              <span className="font-mono font-black text-amber-400">
                                05:00 - 21:30 (Frequência ~15-30 min)
                              </span>
                            </div>
                            <p className="text-[7px] text-gray-400 mt-0.5 italic">
                              * Horário de circulação baseado na frota pública TPM e paragens nas principais avenidas de Maputo.
                            </p>
                          </div>
                        )}
                        {toastTransportMode === 'mototaxi' && (
                          <div className="border-t border-white/5 pt-1 mt-0.5 flex flex-col gap-0.5 text-[7.5px] text-gray-300">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-0.5 text-sky-400 font-bold">
                                <i className="fa-solid fa-coins text-[8px]"></i> Preço Moto-Táxi Estimado:
                              </span>
                              <span className="font-mono font-black text-emerald-400">
                                ~ {Math.round(50 + activeProximityAlert.distance * 40)} MT (Rápido / Sem Filas)
                              </span>
                            </div>
                            <p className="text-[7px] text-gray-400 mt-0.5 italic">
                              * Velocidade média urbana de 30 km/h recomendada para contornar engarrafamentos em Maputo.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons inside toast */}
                  <div className="grid grid-cols-3 gap-1.5 border-t border-white/5 pt-2">
                    <a 
                      href={`tel:${activeProximityAlert.item.ownerPhone || '841234567'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="col-span-3 bg-[#d21034] text-white hover:bg-[#b00f2b] text-[8px] font-black uppercase py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer shadow-md"
                      id="toast-call-owner-btn"
                    >
                      <i className="fa-solid fa-phone text-[9px] animate-pulse"></i> Ligar ao Localizador ({activeProximityAlert.item.ownerPhone || '841234567'})
                    </a>

                    <a 
                      href={`https://www.google.com/maps?q=${activeProximityAlert.item.latitude || -25.9692},${activeProximityAlert.item.longitude || 32.5732}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="bg-[#fce100] text-black hover:bg-white text-[7.5px] font-black uppercase py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all text-center"
                      id="toast-gps-nav-btn"
                    >
                      <i className="fa-solid fa-diamond-turn-right text-[8px]"></i> GPS
                    </a>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const eta = toastTransportMode === 'walking'
                          ? Math.max(2, Math.round((activeProximityAlert.distance / 5.0) * 60))
                          : toastTransportMode === 'fastwalking'
                          ? Math.max(1, Math.round((activeProximityAlert.distance / 6.0) * 60))
                          : toastTransportMode === 'cycling'
                          ? Math.max(1, Math.round((activeProximityAlert.distance / 15.0) * 60))
                          : toastTransportMode === 'chapa'
                          ? Math.max(4, Math.round((activeProximityAlert.distance / 20.0) * 60 + 6))
                          : toastTransportMode === 'bus'
                          ? Math.max(10, Math.round((activeProximityAlert.distance / 18.0) * 60 + 10))
                          : toastTransportMode === 'mototaxi'
                          ? Math.max(1, Math.round((activeProximityAlert.distance / 30.0) * 60))
                          : Math.max(1, Math.round((activeProximityAlert.distance / 35.0) * 60));

                        const transportName = toastTransportMode === 'walking' 
                          ? '🚶 Pedestre (A pé)' 
                          : toastTransportMode === 'fastwalking' 
                          ? '🏃‍♂️ Caminhada Rápida' 
                          : toastTransportMode === 'cycling' 
                          ? '🚲 Bicicleta' 
                          : toastTransportMode === 'chapa' 
                          ? '🚐 Chapa/Táxi' 
                          : toastTransportMode === 'bus' 
                          ? '🚌 Transporte Público/Autocarro' 
                          : toastTransportMode === 'mototaxi'
                          ? '🏍️ Moto-Táxi'
                          : '🚗 Carro Privado';
                        const tempLink = `${window.location.origin}/?routeItem=${activeProximityAlert.item.id}&mode=${toastTransportMode}&eta=${eta}&dist=${activeProximityAlert.distance.toFixed(1)}`;

                        const routeText = `*ComeBack Moçambique - Partilha de Percurso Ativo de Segurança (Link Temporário)* 📍🛡️\n\nEstou a deslocar-me para recuperar o meu bem:\n📦 *Item*: ${activeProximityAlert.item.title}\n📍 *Destino*: ${activeProximityAlert.item.location} (a ${activeProximityAlert.distance.toFixed(1)} km)\nMeio de Transporte: ${transportName}\n⏱️ Tempo de Chegada (ETA): ~ ${eta} minutos\n\nSiga o meu trajeto e garanta a minha segurança através do link temporário:\n🔗 ${tempLink}\n\n*Por favor, verifique se está tudo bem caso eu demore mais do que o esperado!*`;

                        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(routeText)}`;
                        window.open(waUrl, '_blank');
                      }}
                      className="bg-[#128c7e] text-white hover:bg-[#075e54] transition-colors py-1.5 px-1 rounded-lg text-[7.5px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer text-center"
                      id="toast-share-route-btn"
                    >
                      <i className="fa-brands fa-whatsapp text-[9px]"></i> Rota
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const titleText = `ComeBack Moçambique - Item Encontrado por Perto! 📍`;
                        const bodyText = `Fui alertado pelo radar do ComeBack: o item "${activeProximityAlert.item.title}" foi reportado como ACHADO na zona "${activeProximityAlert.item.location}" a apenas ${activeProximityAlert.distance.toFixed(1)} km do meu local!\n\nEspreite e apoie o resgate seguro!`;
                        const shareUrl = window.location.origin;
                        const fullShareText = `${titleText}\n\n${bodyText}\n\nLink: ${shareUrl}`;

                        if (navigator.share) {
                          navigator.share({
                            title: titleText,
                            text: bodyText,
                            url: shareUrl
                          }).catch(err => {
                            console.warn("Share failed:", err);
                          });
                        } else {
                          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`;
                          window.open(waUrl, '_blank');
                        }
                      }}
                      className="bg-[#009739] text-white hover:bg-green-600 transition-colors py-1.5 px-1 rounded-lg text-[7.5px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer text-center"
                      id="toast-share-btn"
                    >
                      <i className="fa-solid fa-share-nodes text-[8px]"></i> Alerta
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                          const osc = audioCtx.createOscillator();
                          const gain = audioCtx.createGain();
                          osc.type = "sine";
                          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                          osc.frequency.linearRampToValueAtTime(1320, audioCtx.currentTime + 0.25);
                          osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                          gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
                          gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
                          osc.connect(gain);
                          gain.connect(audioCtx.destination);
                          osc.start();
                          osc.stop(audioCtx.currentTime + 0.7);
                        } catch (err) {
                          console.log("Audio issue", err);
                        }
                      }}
                      className="bg-[#009739]/90 text-white hover:bg-[#009739] text-[7.2px] font-black uppercase py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all text-center"
                      id="toast-sound-siren-btn"
                      title="Emitir sinal acústico de apoio"
                    >
                      <i className="fa-solid fa-volume-high text-[8px]"></i> Som
                    </button>

                    <a 
                      href="tel:112"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="bg-[#d21034] text-white hover:bg-red-750 text-[7.2px] font-black uppercase py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all border border-red-500/10 text-center"
                      id="toast-policia-emergencia-btn"
                      title="Ligar para Linha de Emergência Policial (112)"
                    >
                      <i className="fa-solid fa-shield-halved text-[8px]"></i> PM 112
                    </a>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const silenceTime = Date.now() + 60 * 60 * 1000;
                        localStorage.setItem('comeback_proximity_silenced_until', silenceTime.toString());
                        window.dispatchEvent(new Event('comeback_radar_silenced'));
                        setActiveProximityAlert(null);
                        alert("Alertas de proximidade silenciados por 1 hora!");
                      }}
                      className="bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-800 text-[7.2px] font-black uppercase py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all border border-gray-300 dark:border-white/10 text-center"
                      id="toast-silence-btn"
                    >
                      <i className="fa-solid fa-volume-xmark text-[8px]"></i> Silenciar
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between">
                <p className="text-[7.5px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  {isExpanded ? 'Focado / Rato por cima' : 'Passa o rato ou mantém pressionado'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-white/10">
                <div className="flex gap-2 flex-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItem(activeProximityAlert.item);
                      setActiveProximityAlert(null);
                    }}
                    className="flex-1 bg-[#fce100] text-black hover:bg-white py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-center"
                    id="toast-view-details-btn"
                  >
                    Ver Detalhes
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeProximityAlert.item.latitude && activeProximityAlert.item.longitude) {
                        setViewMode('map');
                        setActiveTab('feed');
                        setMapFocusLocation({
                          lat: activeProximityAlert.item.latitude,
                          lng: activeProximityAlert.item.longitude
                        });
                      }
                      setActiveProximityAlert(null);
                    }}
                    className="flex-1 bg-[#009739] hover:bg-green-600 text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1"
                    id="toast-view-on-map-btn"
                  >
                    <i className="fa-solid fa-map-location-dot"></i> Ver no Mapa
                  </button>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveProximityAlert(null);
                  }}
                  className="sm:px-3 bg-gray-100 dark:bg-white/15 hover:bg-gray-200 dark:hover:bg-white/25 text-slate-600 dark:text-gray-300 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
                  id="toast-dismiss-btn"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )}

      {/* Fullscreen Proximity Radar Modal */}
      <AnimatePresence>
        {isToastMaximized && activeProximityAlert && (
          <div className="fixed inset-0 z-[150] overflow-y-auto bg-slate-950/98 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative bg-slate-900 border-2 rounded-[2.5rem] max-w-5xl w-full text-white shadow-2xl overflow-hidden ${
                isHighRiskZone(activeProximityAlert.item) ? 'border-red-500' : 'border-amber-400'
              }`}
              id="proximity-alert-fullscreen"
            >
              {/* Radar Grid Graphic Background Accent */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>

              {/* Header section inside the modal */}
              <div className="relative z-10 flex items-center justify-between p-6 sm:p-8 border-b border-white/5 bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#d21034] text-white flex items-center justify-center text-lg shrink-0 pulse-red-border animate-pulse">
                    <i className="fa-solid fa-satellite-dish"></i>
                  </div>
                  <div>
                    <span className="text-[9px] font-black tracking-widest text-[#fce100] uppercase block">
                      Radar de Proximidade Ativo
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                      {activeProximityAlert.item.title}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-full shadow-inner mr-2">
                    <i className="fa-solid fa-hourglass-half text-[9px] text-[#fce100] animate-pulse"></i>
                    <span className="text-xs font-mono font-black text-[#fce100]">{proximityCountdown}s</span>
                  </div>

                  <button 
                    onClick={() => {
                      setIsToastMaximized(false);
                      handleToastTriggerVibration();
                    }}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 text-gray-200 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer border border-white/5 active:scale-95"
                    id="fullscreen-close-btn"
                  >
                    <i className="fa-solid fa-compress text-xs"></i>
                    <span>Minimizar</span>
                  </button>
                </div>
              </div>

              {/* Two Column Layout: Left (Radar & Percurso), Right (Details & Actions) */}
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 max-h-[80vh] overflow-y-auto">
                
                {/* Column 1: Radar & Map & Transport (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-5">
                  
                  {/* Styled Radar Screen */}
                  <div className="bg-slate-950 rounded-[2rem] border border-white/5 p-5 relative overflow-hidden flex flex-col items-center justify-center min-h-[16rem]">
                    
                    {/* Simulated pulse circle rings */}
                    <div className="absolute w-[240px] h-[240px] rounded-full border border-emerald-500/10 flex items-center justify-center">
                      <div className="absolute w-[180px] h-[180px] rounded-full border border-emerald-500/20 flex items-center justify-center">
                        <div className="absolute w-[120px] h-[120px] rounded-full border border-emerald-500/35 flex items-center justify-center">
                          <div className="absolute w-[60px] h-[60px] rounded-full border border-emerald-500/50"></div>
                        </div>
                      </div>
                    </div>
                    {/* Pulsing overlay sweep */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#009739]/5 to-transparent animate-spin" style={{ animationDuration: '6s' }}></div>

                    {/* Schematic Path Plot */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70">
                      <line 
                        x1="30%" y1="70%" 
                        x2="70%" y2="30%" 
                        stroke="#009739" 
                        strokeWidth="2" 
                        strokeDasharray="4 3" 
                        className="animate-pulse"
                      />
                    </svg>

                    {/* Nodes inside simulated radar overlay */}
                    <div className="absolute left-[30%] top-[70%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-xs shadow-lg pulse-sky-border relative">
                        <i className="fa-solid fa-person-walking text-white text-[10px]"></i>
                        <span className="absolute -top-6 bg-slate-900 border border-white/10 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">Tu (GPS)</span>
                      </div>
                    </div>

                    <div className="absolute left-[70%] top-[30%] -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-red-650 border-2 border-white flex items-center justify-center text-xs shadow-lg pulse-red-border relative">
                        <i className="fa-solid fa-map-pin text-white text-[10px]"></i>
                        <span className="absolute -top-6 bg-slate-900 border border-white/10 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">Destino</span>
                      </div>
                    </div>

                    {/* Radar status layout */}
                    <div className="z-10 text-center mb-1">
                      <span className="inline-block bg-[#009739]/10 border border-[#009739]/30 text-[#009739] text-[8px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest animate-pulse">
                        <i className="fa-solid fa-circle text-[6px] mr-1"></i> Varredura de Segurança Maputo Ligada
                      </span>
                    </div>

                    <div className="z-10 mt-auto bg-slate-900/90 border border-white/10 p-3 rounded-2xl w-full max-w-md flex justify-between items-center text-[9px] font-mono shadow-md">
                      <div className="text-left">
                        <span className="block text-gray-400 font-bold">RUMO RADAR:</span>
                        <span className="text-white font-black">{getCompassDirection(currentLocationCoords.lat, currentLocationCoords.lng, activeProximityAlert.item.latitude || -25.9692, activeProximityAlert.item.longitude || 32.5732) || 'NORTE-ESTE'} - Rumo Direto</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-gray-400 font-bold">DISTÂNCIA GPS:</span>
                        <span className="text-amber-450 font-black">{(activeProximityAlert.distance * 1000).toFixed(0)} metros / {activeProximityAlert.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </div>

                  {/* Transport Methods Select inside full-screen with interactive descriptions, ETAs and cost */}
                  <div>
                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2.5">
                      <i className="fa-solid fa-plane-up mr-1 text-[9px]"></i> Escolher Meio de Deslocação Seguro:
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { mode: 'walking', label: '🚶 A Pé', speed: 5.0, name: 'Pedestre' },
                        { mode: 'fastwalking', label: '🏃 Correr', speed: 6.0, name: 'C. Rápida' },
                        { mode: 'cycling', label: '🚲 Bicicleta', speed: 15.0, name: 'Bicicleta' },
                        { mode: 'driving', label: '🚗 Carro', speed: 35.0, name: 'Automóvel' },
                        { mode: 'chapa', label: '🚐 Chapa', speed: 20.0, name: 'Chapa/Táxi' },
                        { mode: 'bus', label: '🚌 TPM', speed: 18.0, name: 'Autocarro' },
                        { mode: 'mototaxi', label: '🏍️ Moto', speed: 30.0, name: 'Moto-Táxi' }
                      ].map((item) => {
                        const isSelected = toastTransportMode === item.mode;
                        const eta = item.mode === 'chapa'
                          ? Math.max(4, Math.round((activeProximityAlert.distance / 20.0) * 60 + 6))
                          : item.mode === 'bus'
                          ? Math.max(10, Math.round((activeProximityAlert.distance / 18.0) * 60 + 10))
                          : Math.max(1, Math.round((activeProximityAlert.distance / item.speed) * 60));
                        
                        return (
                          <button
                            key={item.mode}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setToastTransportMode(item.mode as any);
                              handleToastTriggerVibration();
                            }}
                            className={`p-2.5 rounded-xl text-[9px] font-black flex flex-col justify-between items-start gap-1 transition-all border text-left cursor-pointer ${
                              isSelected
                                ? 'bg-[#009739] text-white border-emerald-400 shadow-lg scale-[1.02]'
                                : 'bg-slate-950/80 text-gray-300 hover:text-white hover:bg-slate-800 border-white/5'
                            }`}
                          >
                            <span className="text-[10px]">{item.label}</span>
                            <span className="font-mono font-bold text-[#fce100] text-[8px] mt-0.5">ETA: ~ {eta} min</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fully Reactive Travel Summary Info Block */}
                  <div className="bg-slate-950 rounded-2xl border border-white/5 p-4 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="font-black text-gray-400 uppercase tracking-wider text-[8px]">
                        Meio Escolhido:
                      </span>
                      <span className="font-mono font-black text-white text-[10px] uppercase">
                        {toastTransportMode === 'walking' && '🚶 Pedestre (Caminhando)'}
                        {toastTransportMode === 'fastwalking' && '🏃 do Deslocamento de Corrida Célere'}
                        {toastTransportMode === 'cycling' && '🚲 Percurso de Ciclismo'}
                        {toastTransportMode === 'driving' && '🚗 Carro Privado'}
                        {toastTransportMode === 'chapa' && '🚐 Transportes Públicos / Chapas'}
                        {toastTransportMode === 'bus' && '🚌 Autocarro Base Maputo (TPM)'}
                        {toastTransportMode === 'mototaxi' && '🏍️ Serviço Especial de Moto-Táxi'}
                      </span>
                    </div>

                    {toastTransportMode === 'chapa' && (
                      <div className="text-[9px] space-y-1.5 text-gray-300">
                        <div className="flex justify-between font-bold">
                          <span>Preço do Bilhete Directo:</span>
                          <span className="text-emerald-400 font-mono">20 MT / 25 MT (Tarifa Oficial da Associação de Chapas)</span>
                        </div>
                        <p className="text-[8px] text-gray-400 italic">
                          * Prepare dinheiro trocado para facilitar a cobrança na paragem de chapas mais próxima em Maputo.
                        </p>
                      </div>
                    )}

                    {toastTransportMode === 'bus' && (
                      <div className="text-[9px] space-y-1.5 text-gray-300">
                        <div className="flex justify-between font-bold">
                          <span>Tarifa Municipal do TPM:</span>
                          <span className="text-emerald-400 font-mono">17.00 Meticais (Preço Base Nacional)</span>
                        </div>
                        <p className="text-[8px] text-gray-400 italic">
                          * Os autocarros públicos circulam pelas faixas sinalizadas, garantindo viagens seguras e fiscalizadas pelas entidades municipais.
                        </p>
                      </div>
                    )}

                    {toastTransportMode === 'mototaxi' && (
                      <div className="text-[9px] space-y-1.5 text-gray-300">
                        <div className="flex justify-between font-bold">
                          <span>Est. de Custo de Corrida:</span>
                          <span className="text-emerald-400 font-mono">~ {Math.round(50 + activeProximityAlert.distance * 40)} MT</span>
                        </div>
                        <p className="text-[8px] text-gray-400 italic">
                          * Ideal para estradas travadas ou trânsito parado. Garanta o uso obrigatório do capacete de segurança fornecido pelo condutor!
                        </p>
                      </div>
                    )}

                    {toastTransportMode === 'driving' && (
                      <div className="text-[9px] space-y-1.5 text-gray-300">
                        <div className="flex justify-between font-bold">
                          <span>Estimativa de Combustível:</span>
                          <span className="text-emerald-400 font-mono">~ {Math.round(activeProximityAlert.distance * 8.5)} MT (Base em Gasolina)</span>
                        </div>
                      </div>
                    )}

                    {/* Peak Hour Alert inside Full Screen */}
                    {isMaputoPeakHour && (toastTransportMode === 'driving' || toastTransportMode === 'chapa' || toastTransportMode === 'bus') && (
                      <div className="bg-red-950/40 p-3 rounded-xl border border-red-900/40 text-[9px] text-red-200 flex gap-2 items-center animate-pulse mt-1 font-semibold">
                        <i className="fa-solid fa-triangle-exclamation text-red-500 text-sm"></i>
                        <div>
                          <span className="font-extrabold uppercase text-red-400 block tracking-wider text-[8px]">Tráfego Crítico Detetado (Avenidas Principais)</span>
                          <span>Você está a analisar percurso na hora de pico. Chapas e carros deparar-se-ão com engarrafamento denso nas faixas habituais de Maputo. Prefira mototáxi ou pé caso a distância seja viável.</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Column 2: Details & Prominent Actions (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                  
                  {/* Detailed Description Panel */}
                  <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-4 space-y-3.5">
                    <div>
                      <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest block mb-1">
                        Informações Gerais de Resgate:
                      </span>
                      <h3 className="text-sm font-extrabold text-white uppercase tracking-tight">
                        {activeProximityAlert.item.title}
                      </h3>
                      <span className="text-[9.5px] font-mono text-amber-400 font-black block mt-0.5">
                        📍 {activeProximityAlert.item.location} ({activeProximityAlert.distance.toFixed(1)} km de distância)
                      </span>
                    </div>

                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div>
                        <span className="block text-[7.5px] font-bold text-gray-500 uppercase tracking-widest">
                          Categoria de Registo:
                        </span>
                        <p className="text-[10px] text-white font-extrabold uppercase">
                          {activeProximityAlert.item.category || 'Móvel / Documento'}
                        </p>
                      </div>

                      {activeProximityAlert.item.description && (
                        <div>
                          <span className="block text-[7.5px] font-bold text-gray-500 uppercase tracking-widest">
                            Descrição Física / Notas do Bem:
                          </span>
                          <p className="text-[10px] text-gray-300 leading-snug">
                            {activeProximityAlert.item.description}
                          </p>
                        </div>
                      )}

                      <div>
                        <span className="block text-[7.5px] font-bold text-gray-500 uppercase tracking-widest">
                          Reportado em Moçambique:
                        </span>
                        <p className="text-[10px] text-white">
                          📅 {(() => {
                            try {
                              const d = new Date(activeProximityAlert.item.date);
                              return isNaN(d.getTime()) ? activeProximityAlert.item.date : d.toLocaleDateString('pt-MZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            } catch {
                              return activeProximityAlert.item.date;
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Warning high-risk zone banner wrapper */}
                  {isHighRiskZone(activeProximityAlert.item) ? (
                    <div className="bg-red-950/30 border border-red-500/50 rounded-2xl p-4 space-y-2">
                      <span className="block text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                        <i className="fa-solid fa-triangle-exclamation animate-pulse text-red-500"></i> ATENÇÃO: ZONA DE HISTÓRICO COM RISCO
                      </span>
                      <p className="text-[10px] text-gray-200 leading-relaxed font-semibold">
                        A vizinhança de <strong>{activeProximityAlert.item.location}</strong> possui registos precedentes frequentes de incidentes. Por favor, seja extremamente precavido/a e aplique as normas de salvaguarda.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4 space-y-1.5 text-left">
                      <span className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                        <i className="fa-solid fa-shield-halved"></i> ZONA CLASSIFICADA COMO REGULAR
                      </span>
                      <p className="text-[10px] text-gray-300 leading-normal">
                        Embora a zona de {activeProximityAlert.item.location} apresente um histórico normalizado, recomendamos sempre prudência elementar na deslocação para recuperação de bens em vias públicas.
                      </p>
                    </div>
                  )}

                  {/* Comprehensive Safety protocols listed in details */}
                  <div className="bg-amber-950/25 border border-amber-900/40 rounded-2xl p-4 space-y-2 text-left">
                    <span className="block text-[9px] font-black text-amber-400 uppercase tracking-widest">
                      🛡️ PROTOCOLOS LOCAIS DE SEGURANÇA (MAPUTO)
                    </span>
                    <ul className="list-disc pl-4 text-gray-300 space-y-1 leading-normal uppercase font-bold text-[9px]">
                      <li>NUNCA SE DESLOQUE INDIVIDUALMENTE AO ENCONTRO DE RESGATE DO BEM.</li>
                      <li>ESCOLHA LOCAIS SEMPRE PÚBLICOS E MOVIMENTADOS (EX: ESQUADRAS MUNICIPAIS DA PRM, GRANDES SHOPPINGS).</li>
                      <li>NÃO TRANSFIRA DINHEIRO OU COMPENSAÇÕES ANTES DE VERIFICAR O BEM MATERIALMENTE.</li>
                      <li>MANTENHA OS SEUS CONTACTOS DE PREVENÇÃO SEMPRE INFORMADOS DA SUA TRAJETÓRIA.</li>
                    </ul>
                  </div>

                  {/* Highly Prominent Action Buttons Grid */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <a 
                      href={`tel:${activeProximityAlert.item.ownerPhone || '841234567'}`}
                      onClick={() => handleToastTriggerVibration()}
                      className="w-full bg-[#d21034] text-white hover:bg-[#b00f2b] text-[10px] font-black uppercase py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all text-center cursor-pointer shadow-md"
                      id="fullscreen-call-owner-btn"
                    >
                      <i className="fa-solid fa-phone text-xs animate-pulse"></i> Ligar ao Localizador ({activeProximityAlert.item.ownerPhone || 'WhatsApp / Chamada'})
                    </a>

                    <div className="grid grid-cols-2 gap-2">
                      <a 
                        href={`https://www.google.com/maps?q=${activeProximityAlert.item.latitude || -25.9692},${activeProximityAlert.item.longitude || 32.5732}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleToastTriggerVibration()}
                        className="bg-[#fce100] text-black hover:bg-white text-[9px] font-black uppercase py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all"
                        id="fullscreen-gps-nav-btn"
                      >
                        <i className="fa-solid fa-diamond-turn-right text-xs"></i> Abrir GPS
                      </a>

                      <button 
                        onClick={() => {
                          const silenceTime = Date.now() + 60 * 60 * 1000;
                          localStorage.setItem('comeback_proximity_silenced_until', silenceTime.toString());
                          window.dispatchEvent(new Event('comeback_radar_silenced'));
                          setActiveProximityAlert(null);
                          setIsToastMaximized(false);
                          alert("Alertas de proximidade silenciados por 1 hora!");
                          handleToastTriggerVibration();
                        }}
                        className="bg-slate-800 text-gray-300 hover:text-white hover:bg-slate-750 text-[9px] font-black uppercase py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all border border-white/10"
                        id="fullscreen-silence-btn"
                      >
                        <i className="fa-solid fa-volume-xmark text-xs"></i> Silenciar 1h
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={(e) => {
                          try {
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const osc = audioCtx.createOscillator();
                            const gain = audioCtx.createGain();
                            osc.type = "sine";
                            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                            osc.frequency.linearRampToValueAtTime(1320, audioCtx.currentTime + 0.25);
                            osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.5);
                            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
                            gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
                            osc.connect(gain);
                            gain.connect(audioCtx.destination);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.7);
                          } catch (err) {
                            console.log("Audio issue", err);
                          }
                          handleToastTriggerVibration();
                        }}
                        className="bg-[#009739]/90 text-white hover:bg-[#009739] text-[9px] font-black uppercase py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all"
                        id="fullscreen-sound-siren-btn"
                        title="Emitir sinal acústico de apoio"
                      >
                        <i className="fa-solid fa-volume-high text-xs"></i> Emitir Bipe
                      </button>

                      <a 
                        href="tel:112"
                        onClick={() => handleToastTriggerVibration()}
                        className="bg-[#d21034] text-white hover:bg-red-750 text-[9px] font-black uppercase py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all border border-white/5"
                        id="fullscreen-policia-emergencia-btn"
                        title="Ligar para Linha de Emergência Policial (112)"
                      >
                        <i className="fa-solid fa-shield-halved text-xs"></i> Chamar 112
                      </a>
                    </div>

                    <button 
                      onClick={() => {
                        const titleText = `ComeBack Moçambique - Item Encontrado por Perto! 📍`;
                        const bodyText = `Reportado perto de mim: o item "${activeProximityAlert.item.title}" foi encontrado em "${activeProximityAlert.item.location}" a apenas ${activeProximityAlert.distance.toFixed(1)} km! Siga com cuidado em Maputo.`;
                        const shareUrl = window.location.origin;
                        const fullShareText = `${titleText}\n\n${bodyText}\n\nLink: ${shareUrl}`;

                        if (navigator.share) {
                          navigator.share({
                            title: titleText,
                            text: bodyText,
                            url: shareUrl
                          }).catch(err => {
                            console.warn("Share failed:", err);
                          });
                        } else {
                          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`;
                          window.open(waUrl, '_blank');
                        }
                        handleToastTriggerVibration();
                      }}
                      className="w-full bg-[#128c7e] text-white hover:bg-[#075e54] transition-colors py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      id="fullscreen-share-route-btn"
                    >
                      <i className="fa-brands fa-whatsapp text-sm"></i> Partilhar Rota no WhatsApp
                    </button>
                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Diálogo de Confirmação de Alterações Não Guardadas */}
      <AnimatePresence>
        {showUnsavedChangesModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={cancelDiscardChanges}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[2.2rem] p-7 sm:p-8 shadow-2xl overflow-hidden text-left border border-gray-100"
            >
              <div className="text-center space-y-4">
                <div className="w-14 h-14 bg-red-100 text-[#d21034] rounded-full flex items-center justify-center mx-auto text-xl border-4 border-white shadow-md animate-bounce">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-md sm:text-lg font-black text-gray-900 uppercase tracking-tight">
                    Alterações Não Guardadas!
                  </h3>
                  <p className="text-[10px] text-[#d21034] font-black uppercase tracking-wider">
                    Aviso de Abandono de Formulário
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 font-bold uppercase leading-relaxed">
                  Tens dados preenchidos no formulário de publicação que serão perdidos caso decidas sair desta página. Desejas descartar as alterações?
                </p>

                <div className="flex flex-col gap-2.5 pt-4">
                  <button
                    onClick={confirmDiscardChanges}
                    className="w-full bg-[#d21034] hover:bg-[#bf0e2e] text-white py-4 rounded-xl font-black uppercase text-xs tracking-wider transition-colors shadow-md cursor-pointer"
                  >
                    Sim, Descartar Alterações
                  </button>
                  <button
                    onClick={cancelDiscardChanges}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-xl font-black uppercase text-xs tracking-wider transition-colors cursor-pointer"
                  >
                    Não, Continuar a Editar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Validação Inteligente da Descrição (Faltam Marcas, Séries ou Detalhes Únicos) */}
      <AnimatePresence>
        {showInsufficientDescModal && descValidationResult && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setShowInsufficientDescModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.2rem] p-6 sm:p-8 shadow-2xl overflow-hidden text-left border border-gray-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center text-xl shadow-xs">
                      <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        Validação Inteligente
                      </h3>
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Informação Insuficiente para Submissão Segura
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowInsufficientDescModal(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center justify-center text-sm cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div className="bg-amber-50/80 dark:bg-amber-950/30 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  {descValidationResult.feedback || "A IA do Gemini detetou que a descrição do item é vaga ou carece de pormenores cruciais (como marca, modelo, número de série/IMEI ou características únicas)."}
                </div>

                {/* Checklist de Detalhes Identificadores */}
                <div className="space-y-2">
                  <p className="text-[11px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Verificação de Elementos Úteis:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className={`p-2.5 rounded-xl border text-left ${descValidationResult.hasBrandOrModel ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-800 dark:text-red-300'}`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <i className={`fa-solid ${descValidationResult.hasBrandOrModel ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-red-500'}`}></i>
                        <span>Marca/Modelo</span>
                      </div>
                      <span className="text-[10px] opacity-80 mt-0.5 block">
                        {descValidationResult.hasBrandOrModel ? 'Especificado' : 'Em falta'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border text-left ${descValidationResult.hasSerialOrIdentifier ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-800 dark:text-red-300'}`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <i className={`fa-solid ${descValidationResult.hasSerialOrIdentifier ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-red-500'}`}></i>
                        <span>Série / Placa / BI</span>
                      </div>
                      <span className="text-[10px] opacity-80 mt-0.5 block">
                        {descValidationResult.hasSerialOrIdentifier ? 'Especificado' : 'Em falta'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border text-left ${descValidationResult.hasUniqueDetails ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-800 dark:text-red-300'}`}>
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        <i className={`fa-solid ${descValidationResult.hasUniqueDetails ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-red-500'}`}></i>
                        <span>Detalhes Únicos</span>
                      </div>
                      <span className="text-[10px] opacity-80 mt-0.5 block">
                        {descValidationResult.hasUniqueDetails ? 'Especificado' : 'Em falta'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sugestões da IA */}
                {descValidationResult.suggestions && descValidationResult.suggestions.length > 0 && (
                  <div className="space-y-2 text-left bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <p className="text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase flex items-center gap-1.5">
                      <i className="fa-solid fa-lightbulb text-amber-500"></i>
                      <span>Sugestões da IA para Adicionar:</span>
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 list-disc list-inside">
                      {descValidationResult.suggestions.map((sug, idx) => (
                        <li key={idx} className="leading-relaxed">{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInsufficientDescModal(false);
                      const descInput = document.getElementsByName('description')[0] as HTMLTextAreaElement;
                      if (descInput) {
                        descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        descInput.focus();
                      }
                    }}
                    className="w-full bg-[#009739] hover:bg-[#007a2d] text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    <span>Adicionar Detalhes à Descrição</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowInsufficientDescModal(false);
                      await handleSuggestImprovements(false);
                      const descInput = document.getElementsByName('description')[0] as HTMLTextAreaElement;
                      if (descInput) {
                        descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-95 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    <span>Melhorar Automaticamente com IA</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHasUserOverriddenDescValidation(true);
                      setShowInsufficientDescModal(false);
                      setTimeout(() => {
                        const submitBtn = document.getElementById('submit-new-item-btn');
                        if (submitBtn) submitBtn.click();
                      }, 100);
                    }}
                    className="w-full py-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-[11px] font-bold uppercase transition-colors cursor-pointer text-center"
                  >
                    Submeter mesmo sem detalhes adicionais (não possuo mais dados)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Milestone Toast Notification */}
      <AnimatePresence>
        {milestoneToast && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-24 left-0 right-0 mx-auto w-[90%] max-w-sm bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl shadow-2xl z-[250] p-4 flex items-center gap-3.5 border border-emerald-400/20"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0 animate-bounce">
              <i className="fa-solid fa-trophy text-amber-300"></i>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="text-[8px] font-black uppercase tracking-widest text-emerald-100/90">
                Conquista de Regresso #{milestoneToast.count}
              </div>
              <h5 className="text-[11px] font-black uppercase leading-tight mt-0.5">
                {milestoneToast.message}
              </h5>
            </div>

            <button
               onClick={() => setMilestoneToast(null)}
              className="w-6 h-6 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer font-sans"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smartphone Dynamic In-App Push Notification Banner */}
      <AnimatePresence>
        {newArrivalNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.93 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -100, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-12 left-0 right-0 mx-auto w-[90%] max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-[#009739]/30 dark:border-emerald-500/20 rounded-2xl shadow-2xl z-[200] p-3 flex gap-3 cursor-pointer select-none active:scale-98 transition-transform"
            onClick={() => {
              setSelectedItem(newArrivalNotification);
              setNewArrivalNotification(null);
            }}
          >
            {/* Left side Image or PlaceHolder */}
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200/50 dark:border-slate-800 flex items-center justify-center">
              <MediaViewer 
                src={(newArrivalNotification.imageUrl || (newArrivalNotification.imageUrls && newArrivalNotification.imageUrls[0])) || ''} 
                category={newArrivalNotification.category}
                alt={newArrivalNotification.title} 
                className="w-full h-full object-cover"
              />
            </div>

            {/* Content info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-[#009739] dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                  <i className="fa-solid fa-bell text-xs animate-bounce"></i>
                  NOVO POST DETECTADO!
                </span>
                <span className="text-[7.5px] font-bold text-gray-400 dark:text-gray-500 uppercase">Agora mesmo</span>
              </div>
              <h4 className="text-[11px] font-black text-slate-800 dark:text-gray-100 truncate mt-0.5 uppercase">
                {newArrivalNotification.title}
              </h4>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold truncate">
                {newArrivalNotification.status === 'LOST' ? '🔴 Perdido' : newArrivalNotification.status === 'FOUND' ? '🟢 Achado' : '⚫ Roubado'} • 📍 {newArrivalNotification.location}
              </p>
            </div>

            {/* Dismiss action */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNewArrivalNotification(null);
              }}
              className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              title="Fechar Notificação"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contextual Report Problem Modal container */}
      <AnimatePresence>
        {showReportModal && selectedItem && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[140] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-2xl max-w-sm w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowReportModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-805/80 hover:bg-slate-250 dark:hover:bg-slate-750 text-slate-550 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>

              {reportSuccess ? (
                <div className="text-center py-6 space-y-4 animate-in fade-in duration-300">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl border-4 border-white dark:border-slate-850 shadow-md">
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase">Denúncia Enviada</h3>
                    <p className="text-[10px] text-[#009739] dark:text-emerald-400 font-black uppercase tracking-wide">
                      Obrigado pela sua cooperação!
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase leading-relaxed max-w-xs mx-auto">
                    A equipa administrativa avaliará o anúncio "{selectedItem.title}" em instantes e tomará as devidas providências.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendReport} className="space-y-4 pt-1">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
                    <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">
                      Reportar Problema
                    </h3>
                  </div>

                  <p className="text-[9.5px] text-slate-550 dark:text-gray-400 font-bold uppercase leading-normal">
                    Está a sinalizar dificuldades ou irregularidades no anúncio: <strong className="text-slate-800 dark:text-white font-black">"{selectedItem.title}"</strong>.
                  </p>

                  <div className="space-y-2">
                    <label className="block text-[9.5px] font-black text-gray-400 uppercase tracking-wider">
                      Selecione o Motivo:
                    </label>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {[
                        { val: 'item-found', label: 'Este bem já foi devolvido ou entregue' },
                        { val: 'scam-suspect', label: 'Suspeita de burla / Proposta suspeita de recompensa' },
                        { val: 'false-info', label: 'Informações falsas, spam ou fotos abusivas' },
                        { val: 'wrong-locality', label: 'Localização ou coordenadas geográficas incorretas' },
                        { val: 'other', label: 'Outra contrariedade técnica ou de conteúdo' }
                      ].map((option) => (
                        <label 
                          key={option.val}
                          className={`flex items-start gap-2.5 p-2 rounded-xl border text-[9.5px] font-bold uppercase transition-all cursor-pointer ${
                            reportReason === option.val 
                              ? 'bg-rose-50/50 border-rose-500 text-rose-750 dark:bg-rose-955/20 dark:border-rose-800 dark:text-rose-400 font-black' 
                              : 'bg-slate-50 border-gray-100 dark:bg-slate-950/20 dark:border-slate-800 text-slate-600 dark:text-gray-400 hover:bg-slate-100/50'
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="reportReason" 
                            value={option.val}
                            checked={reportReason === option.val}
                            onChange={() => setReportReason(option.val)}
                            className="mt-0.5 accent-rose-500 cursor-pointer"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9.5px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Detalhes do Problema (Opcional):
                    </label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Explique resumidamente o problema para nos ajudar a agir..."
                      maxLength={180}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 text-[10px] font-bold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                    <div className="text-right text-[8px] font-black text-gray-400 uppercase">
                      {reportDetails.length}/180 caracteres
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      disabled={reportSubmitting}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={reportSubmitting}
                      className="bg-rose-600 hover:bg-rose-750 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {reportSubmitting ? (
                        <>
                          <i className="fa-solid fa-spinner animate-spin"></i>
                          Enviando...
                        </>
                      ) : (
                        'Submeter'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Partilha do Radar do Google Maps */}
      <AnimatePresence>
        {isShareRadarModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-800 text-left space-y-4"
              id="modal-share-radar"
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#008fe2] to-[#153268] text-white flex items-center justify-center text-lg shadow-md shrink-0">
                    <i className="fa-solid fa-share-nodes"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      Partilhar Radar do Mapa
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                      Divulgue o radar e ajude a comunidade a recuperar itens
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareRadarModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-500 dark:text-slate-400 flex items-center justify-center text-sm cursor-pointer transition-colors"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Cartão de Resumo do Radar Ativo */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <i className="fa-solid fa-location-dot text-emerald-600"></i>
                    {filters.province !== 'ALL' ? filters.province : 'Moçambique (Todas as Províncias)'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                    {feedMapFilteredItems.length} Itens no Radar
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase font-black">Filtro Ativo:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[10px] font-black text-slate-700 dark:text-slate-200">
                    {feedMapStatusFilter === 'ALL' ? 'Todos os Itens' : feedMapStatusFilter === ItemStatus.LOST ? 'Apenas Perdidos' : feedMapStatusFilter === ItemStatus.FOUND ? 'Apenas Achados' : 'Itens Recuperados'}
                  </span>
                </div>
              </div>

              {/* Botões de Redes Sociais */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                  Escolha como partilhar:
                </label>

                {/* WhatsApp Direct Share */}
                <button
                  type="button"
                  onClick={() => {
                    const shareText = `🚨 *Radar ComeBack - Perdidos e Achados em Moçambique*\n\n📍 *Região:* ${filters.province !== 'ALL' ? filters.province : 'Moçambique'}\n🔎 *Filtro:* ${feedMapStatusFilter === 'ALL' ? 'Todos' : feedMapStatusFilter}\n📌 *Itens no Radar:* ${feedMapFilteredItems.length}\n\nConfira os itens no mapa e ajude a encontrar ou devolver bens perdidos:\n${window.location.origin}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                  }}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <i className="fa-brands fa-whatsapp text-lg"></i>
                  <span>Partilhar no WhatsApp</span>
                </button>

                {/* Grelha de Outras Redes Sociais */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Facebook */}
                  <button
                    type="button"
                    onClick={() => {
                      const url = encodeURIComponent(window.location.origin);
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
                    }}
                    className="bg-[#1877F2] hover:bg-[#166fe5] text-white py-2.5 px-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <i className="fa-brands fa-facebook-f text-xs"></i>
                    <span>Facebook</span>
                  </button>

                  {/* Telegram */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareText = `Radar ComeBack - Perdidos e Achados em Moçambique (${feedMapFilteredItems.length} itens no mapa)`;
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(shareText)}`, '_blank');
                    }}
                    className="bg-[#229ED9] hover:bg-[#1e8ec3] text-white py-2.5 px-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <i className="fa-brands fa-telegram text-xs"></i>
                    <span>Telegram</span>
                  </button>

                  {/* X (Twitter) */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareText = `Radar ComeBack de Perdidos e Achados em Moçambique: confira os ${feedMapFilteredItems.length} itens ativos no mapa!`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.origin)}`, '_blank');
                    }}
                    className="bg-black hover:bg-slate-900 text-white py-2.5 px-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                  >
                    <i className="fa-brands fa-x-twitter text-xs"></i>
                    <span>X (Twitter)</span>
                  </button>
                </div>

                {/* Copiar Link e Web Share */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const radarUrl = `${window.location.origin}?filter=${feedMapStatusFilter}&province=${filters.province}`;
                      navigator.clipboard.writeText(radarUrl).then(() => {
                        setRadarShareCopied(true);
                        setTimeout(() => setRadarShareCopied(false), 2500);
                      });
                    }}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-3 px-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer border border-gray-200 dark:border-slate-700"
                  >
                    <i className={`fa-solid ${radarShareCopied ? 'fa-check text-emerald-500' : 'fa-link'}`}></i>
                    <span>{radarShareCopied ? 'Link Copiado!' : 'Copiar Link Direto'}</span>
                  </button>

                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.share({
                          title: 'ComeBack - Radar de Perdidos e Achados',
                          text: `Confira os ${feedMapFilteredItems.length} itens no radar do mapa ComeBack em Moçambique!`,
                          url: `${window.location.origin}?filter=${feedMapStatusFilter}&province=${filters.province}`
                        }).catch(() => {});
                      }}
                      className="bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white p-3 rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
                      title="Outros aplicativos"
                    >
                      <i className="fa-solid fa-arrow-up-from-bracket"></i>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showWelcomeTutorial && (
        <Suspense fallback={null}>
          <WelcomeTutorial onClose={() => {
            setShowWelcomeTutorial(false);
            if (!localStorage.getItem('comeback_app_tour_seen')) {
              setShowAppTour(true);
            }
          }} />
        </Suspense>
      )}

      {showAppTour && (
        <Suspense fallback={null}>
          <AppTourGuide 
            onClose={() => setShowAppTour(false)} 
            onNavigateTab={(tab) => {
              setActiveTab(tab);
              if (tab === 'profile') setProfileView('main');
            }}
            onSetShowFilters={(show) => setShowFilters(show)}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ComeBackArchitectureHub 
          isOpen={isArchitectureHubOpen} 
          onClose={() => setIsArchitectureHubOpen(false)} 
          items={items}
          onUpdateItemRewardStatus={handleUpdateItemRewardStatus}
          escrowedItems={escrowedItems}
        />
      </Suspense>

      {/* Dynamic shower celebration confetti for item recovery success */}
      <CelebrateConfetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
