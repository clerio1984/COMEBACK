
import React, { useState, useEffect } from 'react';
import { Notification as AppNotification, User } from '../types';
import { requestAndSaveFcmToken } from '../services/firebase';

interface NotificationDrawerProps {
  notifications: AppNotification[];
  onClose: () => void;
  onNotificationClick: (notif: AppNotification) => void;
  onClear: () => void;
  currentUser?: User | null;
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ 
  notifications, 
  onClose, 
  onNotificationClick, 
  onClear,
  currentUser 
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isActivating, setIsActivating] = useState(false);
  const [activationMessage, setActivationMessage] = useState('');
  const [clickedId, setClickedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleItemClick = (notif: AppNotification) => {
    if (clickedId) return; // Prevent double trigger
    
    if (!notif.isRead) {
      setClickedId(notif.id);
      // Brief delay to let the user admire the satisfying blue double-check animation
      setTimeout(() => {
        onNotificationClick(notif);
        setClickedId(null);
      }, 650);
    } else {
      onNotificationClick(notif);
    }
  };

  const handleEnablePush = async () => {
    if (!currentUser) {
      setActivationMessage('⚠️ Inicie sessão primeiro para associar notificações ao seu perfil.');
      return;
    }
    
    setIsActivating(true);
    setActivationMessage('');
    try {
      const token = await requestAndSaveFcmToken(currentUser.id);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
      if (token) {
        setActivationMessage('✅ Alertas em tempo real ativados com sucesso! Mesmo com o app minimizado.');
      } else if (Notification.permission === 'denied') {
        setActivationMessage('❌ Permissão negada. Ative as notificações manualmente nas configurações do seu navegador.');
      } else {
        setActivationMessage('⚠️ Sincronizando notificações do navegador em segundo plano...');
      }
    } catch (err: any) {
      console.error('Erro ao ativar push:', err);
      setActivationMessage(`❌ Erro de ativação: ${err.message || err}`);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-[60] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-gray-400 p-2">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
          <h2 className="font-black text-lg tracking-tighter uppercase">Alertas ComeBack</h2>
        </div>
        {notifications.length > 0 && (
          <button onClick={onClear} className="text-[10px] font-black text-[#d21034] uppercase underline">
            Limpar tudo
          </button>
        )}
      </div>

      {/* Banner de Ativação de Notificações Push */}
      {permission !== 'granted' && (
        <div className="m-4 p-4 bg-[#fce100]/20 border border-[#fce100] rounded-2xl flex flex-col gap-2.5 text-left">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#fce100] text-black flex items-center justify-center shrink-0">
              <i className="fa-solid fa-bell animate-bounce text-sm"></i>
            </div>
            <div>
              <h4 className="text-xs font-black uppercase text-gray-950">Receber Alertas em Tempo Real? 🎯</h4>
              <p className="text-[10.5px] text-gray-600 font-bold leading-tight mt-0.5">
                Receba alertas instantâneos no ecrã do seu telemóvel ou computador sempre que a IA encontrar um "Match" para o seu item perdidos ou achados, mesmo com o app minimizado ou fechado.
              </p>
            </div>
          </div>
          
          {activationMessage && (
            <p className="text-[9.5px] font-black uppercase tracking-tight text-gray-800 leading-tight bg-white/40 p-2 rounded-xl">
              {activationMessage}
            </p>
          )}

          <button
            onClick={handleEnablePush}
            disabled={isActivating}
            className="w-full bg-black hover:bg-gray-900 text-white font-black text-[9.5px] uppercase tracking-wider py-2.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isActivating ? (
              <>
                <i className="fa-solid fa-circle-notch animate-spin"></i>
                <span>A Ativar Notificações no Navegador...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-bell-slash"></i>
                <span>Ativar Alertas por Push</span>
              </>
            )}
          </button>
        </div>
      )}

      {permission === 'granted' && activationMessage && (
        <div className="mx-4 mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[10px] font-black uppercase leading-normal">
          {activationMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center space-y-4 opacity-40">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-3xl">
              <i className="fa-solid fa-bell-slash"></i>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">Sem novas notificações por enquanto.</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-4 flex gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-all duration-200 relative overflow-hidden select-none ${
                  notif.type === 'CLAIM' && !notif.isRead 
                    ? 'bg-red-50/70 border-l-4 border-[#d21034] animate-pulse-subtle' 
                    : !notif.isRead 
                      ? 'bg-amber-50/45 dark:bg-amber-500/5' 
                      : ''
                }`}
              >
                {/* Ripple overlay on active selection */}
                {clickedId === notif.id && (
                  <div className="absolute inset-0 bg-blue-500/10 animate-pulse pointer-events-none"></div>
                )}

                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 ${
                  clickedId === notif.id ? 'scale-105' : ''
                } ${
                  notif.type === 'CLAIM'
                    ? 'bg-[#d21034] text-white animate-bounce border-2 border-[#fce100]'
                    : notif.type === 'MATCH' 
                      ? 'bg-[#fce100] text-black' 
                      : 'bg-[#009739] text-white'
                }`} style={notif.type === 'CLAIM' ? { animationDuration: '3s' } : {}}>
                  <i className={
                    notif.type === 'CLAIM'
                      ? 'fa-solid fa-triangle-exclamation text-xs'
                      : notif.type === 'MATCH' 
                        ? 'fa-solid fa-wand-magic-sparkles' 
                        : 'fa-solid fa-comment'
                  }></i>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className={`font-black text-xs uppercase truncate leading-none ${
                      notif.type === 'CLAIM' ? 'text-[#d21034]' : 'text-gray-950 dark:text-gray-100'
                    }`}>
                      {notif.type === 'CLAIM' && <span className="mr-1">🚨</span>}
                      {notif.title}
                    </h3>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">
                      {new Date(notif.timestamp).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold line-clamp-2 leading-tight">
                    {notif.description}
                  </p>
                </div>
                
                {/* Dynamic and Animated Read/Unread Indicators */}
                <div className="flex items-center justify-center self-center flex-shrink-0 w-6 h-6">
                  {clickedId === notif.id ? (
                    <span className="text-blue-500 dark:text-sky-400 text-sm animate-in zoom-in duration-300">
                      <i className="fa-solid fa-check-double animate-bounce"></i>
                    </span>
                  ) : !notif.isRead ? (
                    <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                      notif.type === 'CLAIM' ? 'bg-[#d21034] animate-ping' : 'bg-[#009739]'
                    }`}></div>
                  ) : (
                    <span className="text-blue-500/70 dark:text-sky-500/70 text-xs transition-all duration-300">
                      <i className="fa-solid fa-check-double"></i>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="p-4 bg-gray-50 text-center">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ComeBack - Moçambique Conectado</p>
      </div>
    </div>
  );
};

export default NotificationDrawer;
