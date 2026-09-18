
import React, { useState, useEffect } from 'react';
import logoUrl from '../src/assets/images/comeback_logo_1780817665133.png';
import { useLanguage } from '../LanguageContext';
import { OfflineSyncBanner, PendingSyncCounts } from './OfflineSyncBanner';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'feed' | 'stolen-checker' | 'post' | 'profile' | 'about';
  setActiveTab: (tab: 'feed' | 'stolen-checker' | 'post' | 'profile' | 'about') => void;
  notificationCount: number;
  onToggleNotifications: () => void;
  isOnline?: boolean;
  currentUser: any;
  onLogin: () => void;
  onLogout?: () => void;
  onOpenArchitectureHub?: () => void;
  pendingSyncCounts?: PendingSyncCounts;
  onManualSync?: () => Promise<void> | void;
  onRemoveQueueItem?: (type: 'item' | 'message' | 'delivery', id: string) => void;
  isSyncing?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  notificationCount, 
  onToggleNotifications, 
  isOnline = true, 
  currentUser, 
  onLogin, 
  onLogout,
  onOpenArchitectureHub,
  pendingSyncCounts = { items: 0, messages: 0, deliveries: 0, total: 0 },
  onManualSync = () => {},
  onRemoveQueueItem,
  isSyncing = false
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const theme = 'light';
  const highContrast = false;
  const [showReconnect, setShowReconnect] = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveIsOnline = isOnline && browserOnline;

  useEffect(() => {
    if (isOnline && !prevOnline) {
      setShowReconnect(true);
      const timer = setTimeout(() => setShowReconnect(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.remove('high-contrast');
    window.dispatchEvent(new CustomEvent('comeback_theme_change', { detail: { theme: 'light' } }));
    window.dispatchEvent(new CustomEvent('comeback_high_contrast_change', { detail: { highContrast: false } }));
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('comeback_switch_tab', handleSwitch);
    return () => window.removeEventListener('comeback_switch_tab', handleSwitch);
  }, [setActiveTab]);

  const toggleTheme = () => {};

  const handleFooterLinkClick = (subtab: 'about' | 'terms' | 'privacy' | 'security' | 'contact') => {
    localStorage.setItem('comeback_info_subtab', subtab);
    window.dispatchEvent(new CustomEvent('comeback_info_subtab_change', { detail: subtab }));
    setActiveTab('about');
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#f0f3f8] text-gray-900 relative overflow-x-hidden transition-all duration-300">

      {/* Header com a paleta oficial da Souto Digital Serviços */}
      <header className="relative z-40 bg-gradient-to-r from-[#0f224a] via-[#153268] to-[#008fe2] text-white shadow-lg border-b border-white/10">
        <div className="px-4 py-3 flex justify-between items-center relative">
          
          <div className="flex items-center gap-2.5 relative z-10">
            {/* Hamburger Button */}
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="text-white hover:bg-white/15 active:scale-95 transition-all p-2 rounded-xl flex items-center justify-center cursor-pointer h-10 w-10"
              title="Abrir menu"
              aria-label="Abrir menu principal"
              aria-expanded={isMenuOpen}
              id="hamburger-menu-btn"
            >
              <i className="fa-solid fa-bars text-xl"></i>
            </button>

            <button type="button" aria-label="Ir para o radar ComeBack" className="flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0 text-left" onClick={() => setActiveTab('feed')}>
              <div className="bg-white rounded-xl h-9 w-9 flex items-center justify-center shadow-sm overflow-hidden shrink-0 p-0.5 border border-white/20">
                <img src={logoUrl} alt="ComeBack" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none text-white">ComeBack</h1>
                <span className="text-[10px] font-bold text-sky-200 uppercase tracking-widest leading-none block mt-0.5">Perdidos e Achados</span>
              </div>
            </button>
          </div>
          
          <div className="flex gap-2 items-center relative z-10">
            {/* Indicador Visual Claro de Dispositivo Offline na Barra de Navegação */}
            {!effectiveIsOnline && (
              <div className="relative group">
                <button 
                  type="button"
                  onClick={() => setShowOfflineModal(true)}
                  className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-amber-500/25 to-orange-500/25 hover:from-amber-500/40 hover:to-orange-500/40 active:scale-95 text-amber-200 hover:text-white border border-amber-300/60 hover:border-amber-200 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer shadow-sm backdrop-blur-xs select-none h-10"
                  title="Dispositivo Offline: Os seus dados estão a ser guardados localmente no aparelho"
                  id="navbar-offline-cloud-status"
                >
                  {/* Ícone de nuvem com indicador de erro/alerta */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-cloud text-amber-300 text-sm sm:text-base animate-pulse"></i>
                    <span className="absolute -top-1 -right-1.5 bg-red-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[7px] font-black border border-[#0f224a] shadow-2xs">
                      <i className="fa-solid fa-triangle-exclamation text-[6px]"></i>
                    </span>
                  </div>

                  <div className="flex flex-col text-left leading-none">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-100 flex items-center gap-1">
                        Offline
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                      </span>
                    </div>
                    <span className="hidden sm:inline text-[7.5px] font-bold text-amber-200/90 tracking-tight mt-0.5">
                      Guardado Localmente
                    </span>
                  </div>
                </button>

                {/* Tooltip Informativo Desktop */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl border border-amber-400/40 text-left hidden lg:group-hover:block z-50 pointer-events-none backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-amber-300 font-black uppercase text-[9.5px] tracking-wider mb-1">
                    <i className="fa-solid fa-cloud-slash text-xs"></i>
                    <span>Modo Offline Ativo</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                    Sem ligação à internet. Não se preocupe: os seus dados e publicações estão a ser <span className="text-amber-300 font-bold">guardados com segurança no armazenamento local</span> deste dispositivo e serão sincronizados assim que a ligação for restabelecida.
                  </p>
                </div>
              </div>
            )}

            <button 
              onClick={onToggleNotifications}
              className="text-white hover:bg-white/15 active:scale-95 transition-all p-2 rounded-xl flex items-center justify-center h-10 w-10 cursor-pointer relative"
              title="Notificações"
              aria-label={`Notificações${notificationCount > 0 ? `, ${notificationCount} não lidas` : ""}`}
            >
              <i className="fa-solid fa-bell text-lg"></i>
              {notificationCount > 0 && (
                <span className="absolute 1 top-1.5 right-1.5 bg-[#008fe2] text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-[#153268] shadow-xs">
                  {notificationCount}
                </span>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="w-9 h-9 rounded-full border-2 border-white/60 overflow-hidden bg-white shadow-sm hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  title="Ver Perfil"
                  aria-label="Abrir perfil"
                >
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} alt="User" />
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-white/80 hover:text-white hover:bg-white/15 p-2 rounded-xl transition-all active:scale-95 cursor-pointer h-9 w-9 flex items-center justify-center"
                    title="Terminar Sessão (Sair)"
                    aria-label="Terminar sessão"
                    id="header-logout-btn"
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
                  </button>
                )}
              </div>
            ) : (
              <button 
                onClick={onLogin}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer h-9 shadow-sm"
              >
                <i className="fa-solid fa-right-to-bracket text-xs"></i>
                <span className="hidden sm:inline font-black">{t('Entrar')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Hamburger Sidebar Menu */}
        {isMenuOpen && (
          <div 
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 transition-all duration-300 animate-in fade-in"
            id="menu-overlay"
          />
        )}

        <div 
          className={`fixed top-0 bottom-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-slate-905 shadow-2xl z-[60] flex flex-col border-r border-gray-100 dark:border-white/5 transition-transform duration-300 ease-out transform ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          id="hamburger-drawer"
        >
          {/* Drawer Header with Souto Brand Gradient */}
          <div className="bg-gradient-to-br from-[#0f224a] via-[#153268] to-[#008fe2] text-white p-5 relative overflow-hidden shrink-0 border-b border-white/10">
            {/* Background Geometric Ribbon Accent */}
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-[#008fe2]/20 clip-triangle opacity-40 pointer-events-none"></div>
            
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-2xl h-11 w-11 flex items-center justify-center shadow-md overflow-hidden shrink-0 p-1 border border-white/20">
                  <img src={logoUrl} alt="ComeBack" className="w-full h-full object-cover rounded-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight leading-none text-white">ComeBack</h2>
                  <p className="text-[9px] font-bold text-sky-200 uppercase tracking-widest mt-1">Perdidos e Achados</p>
                </div>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="text-white hover:text-sky-300 hover:scale-110 active:scale-95 transition-all p-1.5 bg-white/10 rounded-lg"
                title="Fechar Menu"
                aria-label="Fechar menu principal"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            {/* User profile card or compact login button */}
            <div className="mt-4 bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 relative z-10">
              {currentUser ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full border-2 border-[#008fe2] overflow-hidden bg-white shrink-0 shadow-sm">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`} alt="User" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[8px] font-black text-sky-200 uppercase tracking-widest leading-none block mb-0.5">Sessão Iniciada</span>
                      <p className="text-xs font-black truncate text-white leading-none">{currentUser.name || currentUser.email}</p>
                    </div>
                  </div>
                  {onLogout && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="bg-rose-500/25 hover:bg-rose-500/40 text-white border border-rose-300/40 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
                      title="Terminar Sessão"
                      id="drawer-header-logout-btn"
                    >
                      <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                      <span>Sair</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight">Olá, Visitante</p>
                    <span className="text-[9px] text-sky-200 block">Aceda à sua conta</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogin();
                    }}
                    className="bg-white hover:bg-sky-50 active:scale-95 text-[#153268] text-[10px] font-black uppercase px-3.5 py-1.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Entrar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Body (Scrollable, Cleaned up) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Main Navigation */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab('feed');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all ${
                  activeTab === 'feed'
                    ? 'bg-[#008fe2]/15 text-[#008fe2] font-black'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-earth-africa text-base w-5 text-center text-[#008fe2]"></i>
                  <span>{t('Explorar Radar')}</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('post');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all ${
                  activeTab === 'post'
                    ? 'bg-gradient-to-r from-[#008fe2] to-[#153268] text-white font-black shadow-sm'
                    : 'bg-[#008fe2]/10 hover:bg-[#008fe2]/20 text-[#008fe2]'
                }`}
                id="drawer-add-item-btn"
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-circle-plus text-base w-5 text-center"></i>
                  <span>{t('Publicar Registo')}</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('stolen-checker');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all ${
                  activeTab === 'stolen-checker'
                    ? 'bg-rose-600 text-white font-black shadow-sm'
                    : 'hover:bg-rose-50 text-rose-700 dark:hover:bg-rose-950/30 dark:text-rose-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-shield-halved text-base w-5 text-center text-rose-500"></i>
                  <span>Verificador Anti-Roubo (IMEI)</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('profile');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all ${
                  activeTab === 'profile'
                    ? 'bg-[#008fe2]/15 text-[#008fe2] font-black'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-user-gear text-base w-5 text-center text-slate-500"></i>
                  <span>{t('O Meu Perfil')}</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveTab('about');
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all ${
                  activeTab === 'about'
                    ? 'bg-[#008fe2]/15 text-[#008fe2] font-black'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-circle-info text-base w-5 text-center text-slate-500"></i>
                  <span>{t('Sobre o Serviço')}</span>
                </div>
              </button>

              {currentUser && onLogout && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide text-left transition-all text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer mt-1 border border-rose-200/50"
                  id="drawer-nav-logout-btn"
                >
                  <div className="flex items-center gap-3">
                    <i className="fa-solid fa-arrow-right-from-bracket text-base w-5 text-center text-rose-500"></i>
                    <span>Terminar Sessão (Sair)</span>
                  </div>
                </button>
              )}
            </div>

            {/* Quick Settings */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Idioma</span>
                <button 
                  onClick={toggleLanguage}
                  className="text-[#008fe2] font-black text-[10px] bg-white dark:bg-slate-800 py-1 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
                >
                  {language.toUpperCase()}
                </button>
              </div>

              {onOpenArchitectureHub && (
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenArchitectureHub();
                  }}
                  className="w-full text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 text-center text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-server text-[9px]"></i>
                  <span>Painel de Administração</span>
                </button>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-white/5 shrink-0 text-center">
            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400">
              ComeBack Moçambique
            </p>
          </div>
        </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-28 bg-[#f8fafc] dark:bg-slate-905 text-gray-900 dark:text-gray-100 relative transition-all duration-300">
        {/* Banner de Sincronização offline Persistente e Detalhado com Contagem da Fila */}
        <OfflineSyncBanner 
          isOnline={isOnline} 
          pendingSyncCounts={pendingSyncCounts} 
          onManualSync={onManualSync} 
          onRemoveQueueItem={onRemoveQueueItem}
          isSyncing={isSyncing}
        />

        {/* Notificação Temporária de Redes de volta (Reestabelecimento) */}
        {showReconnect && (
          <div className="bg-emerald-600 border-b-2 border-emerald-400 text-white p-3 text-center text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 select-none animate-in slide-in-from-top fade-in duration-300">
            <i className="fa-solid fa-cloud-arrow-up text-xs text-[#fce100] animate-bounce"></i>
            <span>{t('Ligação à Rede Restabelecida. Atualizando Dados...')}</span>
          </div>
        )}

        {children}
        
        {/* Rodapé - Páginas de Ajuda, Legalidade e Contacto */}
        <footer className="mt-auto py-10 bg-slate-900 text-slate-300 border-t-4 border-[#009739] text-left">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Coluna 1: Logo e Descrição */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="bg-white rounded-lg h-7 w-7 flex items-center justify-center p-0.5 shadow-sm overflow-hidden shrink-0">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
                <h4 className="text-sm font-black tracking-tight uppercase text-white">ComeBack Moçambique</h4>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                A primeira e mais segura plataforma de utilidade pública para registo e devolução de bens perdidos, roubados e achados em Moçambique.
              </p>
              <div className="flex h-1 w-24">
                <div className="h-full bg-[#009739] flex-1"></div>
                <div className="h-full bg-black w-1/3"></div>
                <div className="h-full bg-[#fce100] w-1/3"></div>
              </div>
            </div>

            {/* Coluna 2: Institucional */}
            <div className="space-y-3">
              <h4 className="text-xs font-black tracking-widest uppercase text-white border-b border-slate-800 pb-1.5">Institucional</h4>
              <ul className="space-y-2 text-[11px] font-bold">
                <li>
                  <button 
                    onClick={() => handleFooterLinkClick('about')}
                    className="hover:text-emerald-400 text-slate-300 transition-colors cursor-pointer text-left uppercase flex items-center gap-1.5 bg-transparent border-0 p-0"
                  >
                    <i className="fa-solid fa-circle-info text-[9px] text-[#009739]"></i>
                    <span>Sobre Nós</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleFooterLinkClick('contact')}
                    className="hover:text-emerald-400 text-slate-300 transition-colors cursor-pointer text-left uppercase flex items-center gap-1.5 bg-transparent border-0 p-0"
                  >
                    <i className="fa-solid fa-envelope text-[9px] text-[#009739]"></i>
                    <span>Contacto e Apoio</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Termos & Segurança */}
            <div className="space-y-3">
              <h4 className="text-xs font-black tracking-widest uppercase text-white border-b border-slate-800 pb-1.5">Termos e Segurança</h4>
              <ul className="space-y-2 text-[11px] font-bold">
                <li>
                  <button 
                    onClick={() => handleFooterLinkClick('terms')}
                    className="hover:text-emerald-400 text-slate-300 transition-colors cursor-pointer text-left uppercase flex items-center gap-1.5 bg-transparent border-0 p-0"
                  >
                    <i className="fa-solid fa-file-contract text-[9px] text-[#009739]"></i>
                    <span>Termos & Condições</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleFooterLinkClick('privacy')}
                    className="hover:text-emerald-400 text-slate-300 transition-colors cursor-pointer text-left uppercase flex items-center gap-1.5 bg-transparent border-0 p-0"
                  >
                    <i className="fa-solid fa-user-shield text-[9px] text-[#009739]"></i>
                    <span>Política de Privacidade</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleFooterLinkClick('security')}
                    className="hover:text-emerald-400 text-slate-300 transition-colors cursor-pointer text-left uppercase flex items-center gap-1.5 bg-transparent border-0 p-0"
                  >
                    <i className="fa-solid fa-shield-halved text-[9px] text-[#009739]"></i>
                    <span>Política de Segurança</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-6 mt-8 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <span>© 2026 Souto Digital Serviços. Todos os direitos reservados.</span>
          </div>
        </footer>
      </main>

      {/* Alerta Compacto Flutuante para Dispositivos Móveis */}
      {!effectiveIsOnline && (
        <div 
          onClick={() => setShowOfflineModal(true)}
          className="fixed bottom-[4.75rem] left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-amber-600/95 via-orange-600/95 to-amber-700/95 text-white px-3.5 py-1.5 rounded-full shadow-lg border border-amber-300/40 backdrop-blur-md flex items-center gap-2 text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all select-none animate-in fade-in"
          id="mobile-bottom-offline-pill"
          title="Dispositivo Offline: Toque para mais informações sobre o armazenamento local"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <i className="fa-solid fa-cloud text-amber-200 text-xs"></i>
            <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center text-[5px] font-black">
              !
            </span>
          </div>
          <span className="truncate max-w-[240px]">Offline • Guardado no Aparelho</span>
        </div>
      )}

      {/* Floating Bottom Nav - Styled with Souto Brand Colors */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex justify-between py-1.5 px-2.5 z-50 shadow-[0_10px_35px_rgba(15,34,74,0.18)] rounded-3xl transition-all duration-300 items-center">
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-2xl transition-all cursor-pointer relative ${
            activeTab === 'feed' 
              ? 'bg-[#008fe2]/15 text-[#008fe2] font-black' 
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <i className="fa-solid fa-earth-africa text-lg"></i>
          <span className="text-[10px] sm:text-xs mt-0.5 uppercase tracking-wider font-black">{t('Explorar')}</span>
        </button>

        <button 
          onClick={() => setActiveTab('stolen-checker')}
          className={`flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-2xl transition-all cursor-pointer relative ${
            activeTab === 'stolen-checker' 
              ? 'bg-rose-100 text-rose-700 font-black' 
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Verificador Anti-Roubo (IMEI/Série)"
        >
          <i className="fa-solid fa-shield-halved text-lg"></i>
          <span className="text-[10px] sm:text-xs mt-0.5 uppercase tracking-wider font-black">Verificador</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('post')}
          className={`flex flex-col items-center justify-center py-2 px-3.5 rounded-2xl transition-all cursor-pointer relative shadow-sm active:scale-95 ${
            activeTab === 'post' 
              ? 'bg-gradient-to-r from-[#008fe2] to-[#153268] text-white font-black ring-2 ring-[#008fe2]/40' 
              : 'bg-gradient-to-r from-[#008fe2] to-[#153268] text-white hover:opacity-95'
          }`}
          id="bottom-nav-add-btn"
          title="Publicar Registo"
        >
          <i className="fa-solid fa-circle-plus text-xl"></i>
          <span className="text-[10px] sm:text-xs mt-0.5 uppercase tracking-wider font-black text-white">{t('Publicar')}</span>
        </button>

        <button 
          onClick={() => setActiveTab('about')}
          className={`flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-2xl transition-all cursor-pointer relative ${
            activeTab === 'about' 
              ? 'bg-[#008fe2]/15 text-[#008fe2] font-black' 
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <i className="fa-solid fa-scale-balanced text-lg"></i>
          <span className="text-[10px] sm:text-xs mt-0.5 uppercase tracking-wider font-black">{t('Sobre')}</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-3 rounded-2xl transition-all cursor-pointer relative ${
            activeTab === 'profile' 
              ? 'bg-[#008fe2]/15 text-[#008fe2] font-black' 
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <i className="fa-solid fa-user-gear text-lg"></i>
          <span className="text-[10px] sm:text-xs mt-0.5 uppercase tracking-wider font-black">{t('Perfil')}</span>
        </button>
      </nav>

      {/* Modal Informativo de Modo Offline & Armazenamento Local Seguro */}
      {showOfflineModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-amber-400/40 space-y-5 text-left relative overflow-hidden"
            id="offline-info-modal"
          >
            {/* Header com ícone de nuvem com alerta */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center shrink-0 relative">
                <i className="fa-solid fa-cloud text-amber-600 dark:text-amber-400 text-xl"></i>
                <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black border-2 border-white dark:border-slate-900">
                  <i className="fa-solid fa-triangle-exclamation text-[7px]"></i>
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                    Dispositivo Offline
                  </span>
                  <button 
                    onClick={() => setShowOfflineModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    title="Fechar"
                    aria-label="Fechar aviso de modo offline"
                  >
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  Dados a Salvar Localmente
                </h3>
              </div>
            </div>

            {/* Explicação clara e tranquilizadora */}
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-start gap-2.5">
                <i className="fa-solid fa-hard-drive text-amber-500 text-sm mt-0.5 shrink-0"></i>
                <p>
                  <strong className="text-slate-900 dark:text-white font-bold">Armazenamento Local Ativo:</strong> Pode continuar a utilizar o ComeBack. As suas publicações, mensagens e alterações estão a ser guardadas com segurança no armazenamento local deste aparelho.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <i className="fa-solid fa-arrows-rotate text-emerald-500 text-sm mt-0.5 shrink-0"></i>
                <p>
                  <strong className="text-slate-900 dark:text-white font-bold">Sincronização Automática:</strong> Assim que recuperar o sinal de internet ou Wi-Fi, todos os dados pendentes serão enviados automaticamente para o sistema sem perdas.
                </p>
              </div>
            </div>

            {/* Estado da Conexão */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
              <span>Estado da Ligação:</span>
              <span className="text-amber-600 dark:text-amber-400 font-black uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                Sem Rede (Armazenamento Local)
              </span>
            </div>

            {/* Botão de confirmação */}
            <button
              type="button"
              onClick={() => setShowOfflineModal(false)}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#0f224a] to-[#008fe2] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-95 active:scale-98 transition-all cursor-pointer shadow-md"
            >
              Compreendi, Continuar a Navegar
            </button>
          </div>
        </div>
      )}



      <style dangerouslySetInnerHTML={{ __html: `
        .clip-triangle {
          clip-path: polygon(0 0, 100% 50%, 0 100%);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Dark Theme overrides for elements, panels, and text lists */
        .dark {
          color-scheme: dark;
        }
        
        body {
          background-color: #f1f5f9;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        
        .dark body {
          background-color: #04060c !important; /* Elegant Obsidian black background surrounding the frame */
          color: #f1f5f9 !important; /* Soft high-contrast text */
        }
        
        /* Replace bright card backgrounds with comfortable dark navy-slate */
        .dark .bg-white {
          background-color: #121826 !important;
          border-color: rgba(255, 255, 255, 0.05) !important;
        }
        
        /* Soften background colors to avoid blinding grey panels - true midnight dark */
        .dark .bg-gray-50, 
        .dark .bg-gray-50\/50, 
        .dark .bg-slate-50,
        .dark .bg-slate-50\/50,
        .dark .bg-slate-900,
        .dark .bg-slate-950 {
          background-color: #0a0f1d !important; /* True premium dark theme background instead of washing gray */
        }
        
        /* Map lists, chips, details fields to soft dark-blue tones */
        .dark .bg-gray-100, 
        .dark .bg-slate-100,
        .dark .bg-gray-150,
        .dark .bg-slate-150,
        .dark .bg-gray-200,
        .dark .bg-slate-200,
        .dark .bg-gray-250,
        .dark .bg-slate-250,
        .dark .bg-slate-800,
        .dark .bg-slate-850,
        .dark .bg-slate-905 {
          background-color: #121826 !important; /* Elevated nested cards and layout blocks */
        }
        
        .dark .bg-gray-300,
        .dark .bg-slate-300 {
          background-color: #1a2235 !important;
        }
 
        /* Make standard light alerts completely dark-theme friendly with rich soft glow colors */
        .dark .bg-red-50,
        .dark .bg-red-50\/50 {
          background-color: rgba(220, 38, 38, 0.12) !important;
          color: #fca5a5 !important;
          border-color: rgba(239, 68, 68, 0.15) !important;
        }
        
        .dark .bg-emerald-50,
        .dark .bg-emerald-50\/50 {
          background-color: rgba(16, 185, 129, 0.12) !important;
          color: #a7f3d0 !important;
          border-color: rgba(16, 185, 129, 0.15) !important;
        }
        
        .dark .bg-amber-50,
        .dark .bg-amber-50\/50 {
          background-color: rgba(245, 158, 11, 0.12) !important;
          color: #fde68a !important;
          border-color: rgba(245, 158, 11, 0.15) !important;
        }
 
        /* Enforce absolute visibility for all dark text elements */
        .dark .text-gray-950,
        .dark .text-slate-950,
        .dark .text-gray-900, 
        .dark .text-slate-900, 
        .dark .text-gray-800, 
        .dark .text-slate-800,
        .dark .text-black,
        .dark h1,
        .dark h2,
        .dark h3,
        .dark h4,
        .dark h5,
        .dark h6 {
          color: #f8fafc !important; /* Soft display white with maximum high-contrast */
        }
        
        .dark .text-gray-750,
        .dark .text-gray-700, 
        .dark .text-slate-700,
        .dark .text-gray-650,
        .dark .text-slate-650 {
          color: #f1f5f9 !important; /* Soft primary white */
        }
        
        .dark .text-gray-600,
        .dark .text-slate-600,
        .dark .text-gray-550,
        .dark .text-slate-550 {
          color: #94a3b8 !important; /* Highly legible medium text */
        }
        
        .dark .text-gray-500, 
        .dark .text-slate-500, 
        .dark .text-gray-400,
        .dark .text-slate-400 {
          color: #94a3b8 !important; /* Contrast helper text */
        }
 
        .dark .text-gray-300,
        .dark .text-slate-300 {
          color: #f8fafc !important;
        }
        
        .dark .border-gray-100, 
        .dark .border-slate-100,
        .dark .border-gray-150,
        .dark .border-slate-150,
        .dark .border-gray-200,
        .dark .border-slate-200,
        .dark .border-gray-350,
        .dark .border-gray-300 {
          border-color: rgba(255, 255, 255, 0.06) !important; /* Clean thin ultra-sleek borders instead of stark gray dividers */
        }
        
        .dark input,
        .dark select,
        .dark textarea {
          background-color: #0a0f1d !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
        }
        
        .dark input::placeholder {
          color: #4b5563 !important;
        }
        
        .dark .shadow-sm {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.45) !important;
        }
        
        .dark .shadow-md {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        
        /* Custom scrollbar to keep it gorgeous in dark mode */
        .dark ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .dark ::-webkit-scrollbar-track {
          background: #0a0f1d;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 999px;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }

        /* HARD-CORE HIGH CONTRAST (SOLAR EXPOSURE SUITE - MOÇAMBIQUE) */
        .high-contrast {
          color-scheme: dark !important;
        }

        .high-contrast body,
        .high-contrast #root,
        .high-contrast main,
        .high-contrast .bg-white,
        .high-contrast .bg-gray-50,
        .high-contrast .bg-gray-50\/50,
        .high-contrast .bg-slate-50,
        .high-contrast .bg-slate-50\/50,
        .high-contrast .bg-slate-900,
        .high-contrast .bg-slate-950,
        .high-contrast .bg-slate-900\/60,
        .high-contrast .bg-slate-950\/40,
        .high-contrast .dark .bg-white,
        .high-contrast .dark .bg-gray-50,
        .high-contrast .dark .bg-slate-900,
        .high-contrast .dark .bg-slate-950 {
          background-color: #000000 !important;
          color: #ffffff !important;
        }

        /* Container elevations inside high contrast */
        .high-contrast .bg-gray-100,
        .high-contrast .bg-slate-100,
        .high-contrast .bg-gray-150,
        .high-contrast .bg-slate-150,
        .high-contrast .bg-gray-200,
        .high-contrast .bg-slate-200,
        .high-contrast .bg-gray-250,
        .high-contrast .bg-slate-250,
        .high-contrast .bg-slate-800,
        .high-contrast .bg-slate-850,
        .high-contrast .bg-slate-905,
        .high-contrast .dark .bg-gray-100,
        .high-contrast .dark .bg-slate-100,
        .high-contrast .dark .bg-gray-150,
        .high-contrast .dark .bg-slate-150,
        .high-contrast .dark .bg-slate-800,
        .high-contrast .dark .bg-slate-850 {
          background-color: #0c0c0c !important;
          border: 2px solid #ffffff !important;
          box-shadow: none !important;
        }

        /* Input fields and selects */
        .high-contrast input,
        .high-contrast select,
        .high-contrast textarea,
        .high-contrast .dark input,
        .high-contrast .dark select,
        .high-contrast .dark textarea {
          background-color: #000000 !important;
          color: #ffffff !important;
          border: 2px solid #fce100 !important;
          font-weight: 800 !important;
          text-shadow: none !important;
        }

        .high-contrast input::placeholder {
          color: #aaaaaa !important;
        }

        /* Extreme visibility text rules for solar glare */
        .high-contrast text,
        .high-contrast p,
        .high-contrast span,
        .high-contrast h1,
        .high-contrast h2,
        .high-contrast h3,
        .high-contrast h4,
        .high-contrast h5,
        .high-contrast h6,
        .high-contrast div,
        .high-contrast a,
        .high-contrast button {
          color: #ffffff !important;
          font-weight: 700 !important;
          letter-spacing: 0.01em !important;
        }

        /* Vibrant Neon Colors for important attributes */
        .high-contrast .text-[#009739],
        .high-contrast .text-emerald-400,
        .high-contrast .text-emerald-500,
        .high-contrast .text-emerald-600,
        .high-contrast .dark .text-[#009739],
        .high-contrast .dark .text-emerald-400 {
          color: #00ff66 !important;
        }

        .high-contrast .text-[#fce100],
        .high-contrast .text-amber-500,
        .high-contrast .text-amber-600,
        .high-contrast .text-orange-500,
        .high-contrast .text-amber-900,
        .high-contrast .text-amber-800,
        .high-contrast .dark .text-amber-300 {
          color: #fce100 !important;
          font-weight: 950 !important;
        }

        .high-contrast .text-[#d21034],
        .high-contrast .text-red-500,
        .high-contrast .text-red-650,
        .high-contrast .text-rose-500,
        .high-contrast .text-rose-600,
        .high-contrast .dark .text-red-400 {
          color: #ff3333 !important;
          font-weight: 950 !important;
        }

        /* Banner & Badge Overrides for Solar Legibility */
        .high-contrast .bg-red-50,
        .high-contrast .bg-red-50\/50,
        .high-contrast .bg-rose-50,
        .high-contrast .bg-rose-50\/50,
        .high-contrast .bg-red-500\/10,
        .high-contrast .dark .bg-red-50 {
          background-color: #270303 !important;
          border: 2px solid #ff3333 !important;
          color: #ffffff !important;
        }

        .high-contrast .bg-emerald-50,
        .high-contrast .bg-emerald-50\/50,
        .high-contrast .bg-emerald-500\/10,
        .high-contrast .dark .bg-emerald-50 {
          background-color: #002209 !important;
          border: 2px solid #00ff66 !important;
          color: #ffffff !important;
        }

        .high-contrast .bg-amber-50,
        .high-contrast .bg-amber-50\/50,
        .high-contrast .bg-amber-500\/10,
        .high-contrast .dark .bg-amber-50 {
          background-color: #292100 !important;
          border: 2px solid #fce100 !important;
          color: #ffffff !important;
        }

        /* Borders across the board */
        .high-contrast .border,
        .high-contrast .border-t,
        .high-contrast .border-b,
        .high-contrast .border-x,
        .high-contrast .border-gray-100,
        .high-contrast .border-slate-100,
        .high-contrast .border-gray-150,
        .high-contrast .border-slate-150,
        .high-contrast .border-gray-200,
        .high-contrast .border-slate-200,
        .high-contrast .border-gray-300,
        .high-contrast .border-[#009739],
        .high-contrast .border-[#fce100]\/40,
        .high-contrast .dark .border-gray-100 {
          border-color: #ffffff !important;
          border-width: 2px !important;
        }

        /* Specific High Visibility Dividers */
        .high-contrast .border-[#fce100] {
          border-color: #fce100 !important;
          border-width: 3px !important;
        }

        .high-contrast .border-[#009739] {
          border-color: #00ff66 !important;
          border-width: 3px !important;
        }

        /* Bottom Nav & Header */
        .high-contrast header {
          border-bottom: 4px solid #fce100 !important;
        }

        .high-contrast nav {
          background-color: #000000 !important;
          border-top: 5px solid #00ff66 !important;
        }

        .high-contrast nav button {
          color: #888888 !important;
        }

        .high-contrast nav button.text-[#009739],
        .high-contrast nav button.text-emerald-500,
        .high-contrast nav button.scale-110 {
          color: #00ff66 !important;
          font-weight: 950 !important;
          transform: scale(1.1) !important;
          border: 1px solid #00ff66 !important;
          border-radius: 12px !important;
          background-color: #0a0a0a !important;
        }

        /* Verified Badges & Radar */
        .high-contrast .item-card-verified-badge {
          background-image: none !important;
          background-color: #000000 !important;
          border: 3px solid #00ff66 !important;
          color: #00ff66 !important;
          font-weight: 950 !important;
        }

        .high-contrast .item-card-verified-badge::before {
          color: #00ff66 !important;
          font-weight: 950 !important;
        }

        .high-contrast .pulse-amber-border {
          animation: none !important;
          border: 3px solid #fce100 !important;
        }

        .high-contrast .pulse-red-border {
          animation: none !important;
          border: 3px solid #ff3333 !important;
        }

        /* Disable transparency completely to prevent glare fading */
        .high-contrast .opacity-20,
        .high-contrast .opacity-40,
        .high-contrast .opacity-60,
        .high-contrast .opacity-50,
        .high-contrast .opacity-80,
        .high-contrast .opacity-90 {
          opacity: 1 !important;
        }

        .high-contrast .bg-white\/10,
        .high-contrast .bg-white\/60,
        .high-contrast .bg-[#fce100]\/20 {
          background-color: #121212 !important;
          border-color: #ffffff !important;
        }
      `}} />
    </div>
  );
};

export default Layout;
