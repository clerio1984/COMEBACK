import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

export interface QueueItemDetail {
  id: string;
  type: 'item' | 'message' | 'delivery';
  title: string;
  subtitle: string;
  timestamp?: string;
}

export interface PendingSyncCounts {
  items: number;
  messages: number;
  deliveries: number;
  total: number;
  details?: QueueItemDetail[];
}

export interface OfflineSyncBannerProps {
  isOnline: boolean;
  pendingSyncCounts: PendingSyncCounts;
  onManualSync: () => Promise<void> | void;
  onRemoveQueueItem?: (type: 'item' | 'message' | 'delivery', id: string) => void;
  isSyncing?: boolean;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline,
  pendingSyncCounts,
  onManualSync,
  onRemoveQueueItem,
  isSyncing = false,
}) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const hasPending = pendingSyncCounts.total > 0;

  // O banner é persistente quando o utilizador está offline OU quando existem itens pendentes na fila de sincronização
  if (isOnline && !hasPending && !isSyncing) {
    return null;
  }

  const handleSyncClick = async () => {
    setSyncFeedback(null);
    try {
      await onManualSync();
    } catch {
      setSyncFeedback('Erro ao sincronizar. Verifique a sua ligação.');
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Recentemente';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recentemente';
    }
  };

  return (
    <div 
      className={`border-b-2 shadow-md transition-all duration-300 z-30 select-none ${
        !isOnline 
          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-amber-300 text-white'
          : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-emerald-500 text-white'
      }`}
      id="offline-persistent-sync-banner"
    >
      {/* Barra Principal do Banner */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Lado Esquerdo: Indicador de Estado e Contadores */}
        <div className="flex items-center gap-3 w-full md:w-auto text-left">
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-inner ${
              !isOnline ? 'bg-black/25 text-amber-200' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {!isOnline ? (
                <i className="fa-solid fa-wifi-slash text-base animate-pulse"></i>
              ) : (
                <i className={`fa-solid fa-arrows-rotate text-base ${isSyncing ? 'animate-spin' : ''}`}></i>
              )}
            </div>
            {/* Ponto Pulsante Indicador */}
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                !isOnline ? 'bg-amber-300' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                !isOnline ? 'bg-amber-400 border-2 border-amber-800' : 'bg-emerald-400 border-2 border-emerald-900'
              }`}></span>
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-[11px] sm:text-xs uppercase tracking-wider leading-none">
                {!isOnline ? t('Modo Offline Ativo') : t('A Sincronizar com a Base de Dados')}
              </span>
              
              {/* Badge de Total da Fila */}
              <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-xs ${
                hasPending 
                  ? 'bg-amber-400 text-slate-950 border-amber-200 animate-pulse' 
                  : 'bg-white/15 text-white border-white/20'
              }`}>
                {hasPending 
                  ? `${pendingSyncCounts.total} ${pendingSyncCounts.total === 1 ? 'registo na fila' : 'registos na fila'}`
                  : 'Fila de Envio Vazia (0)'
                }
              </span>
            </div>

            <p className="text-[9px] sm:text-[9.5px] font-semibold text-amber-100/90 dark:text-emerald-200/90 leading-tight mt-1 truncate max-w-xl">
              {!isOnline 
                ? (hasPending 
                    ? 'As alterações estão salvas no dispositivo local e serão enviadas assim que a ligação for restaurada.'
                    : 'Navegação em cache local ativa. As novas publicações e mensagens serão guardadas offline.')
                : 'A enviar dados pendentes da fila para os servidores da nuvem...'}
            </p>
          </div>
        </div>

        {/* Lado Direito: Badges Discriminares e Botões Interativos */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 pt-1 md:pt-0 border-t border-white/10 md:border-t-0">
          
          {/* Discriminação por Tipos na Fila */}
          {hasPending && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
              {pendingSyncCounts.items > 0 && (
                <span className="bg-black/30 text-amber-200 border border-white/15 text-[8.5px] font-black uppercase px-2 py-1 rounded-xl flex items-center gap-1 shrink-0" title="Artigos pendentes de publicação">
                  <i className="fa-solid fa-box-archive text-[9px]"></i>
                  <span>{pendingSyncCounts.items} {pendingSyncCounts.items === 1 ? 'artigo' : 'artigos'}</span>
                </span>
              )}
              {pendingSyncCounts.messages > 0 && (
                <span className="bg-black/30 text-amber-200 border border-white/15 text-[8.5px] font-black uppercase px-2 py-1 rounded-xl flex items-center gap-1 shrink-0" title="Mensagens pendentes de envio">
                  <i className="fa-solid fa-comment-dots text-[9px]"></i>
                  <span>{pendingSyncCounts.messages} {pendingSyncCounts.messages === 1 ? 'msg' : 'msgs'}</span>
                </span>
              )}
              {pendingSyncCounts.deliveries > 0 && (
                <span className="bg-black/30 text-amber-200 border border-white/15 text-[8.5px] font-black uppercase px-2 py-1 rounded-xl flex items-center gap-1 shrink-0" title="Devoluções/Recuperações pendentes">
                  <i className="fa-solid fa-signature text-[9px]"></i>
                  <span>{pendingSyncCounts.deliveries} {pendingSyncCounts.deliveries === 1 ? 'entrega' : 'entregas'}</span>
                </span>
              )}
            </div>
          )}

          {/* Botão Ver Fila (Accordion) */}
          {hasPending && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-black/25 hover:bg-black/40 text-white border border-white/20 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Ver detalhes dos itens na fila"
              id="toggle-offline-queue-btn"
            >
              <i className="fa-solid fa-list-check text-[10px]"></i>
              <span>{isExpanded ? 'Ocultar Fila' : 'Ver Fila'}</span>
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
            </button>
          )}

          {/* Botão Tentar Sincronizar Agora */}
          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="bg-white text-slate-950 hover:bg-amber-100 active:scale-95 transition-all px-3 py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer shrink-0"
            id="manual-sync-now-btn"
            title="Verificar ligação à internet e sincronizar itens pendentes"
          >
            <i className={`fa-solid fa-rotate text-[10px] text-[#009739] ${isSyncing ? 'animate-spin' : ''}`}></i>
            <span>{isSyncing ? 'A Sincronizar...' : 'Sincronizar Agora'}</span>
          </button>
        </div>

      </div>

      {/* Alerta de Feedback de Sincronização */}
      {syncFeedback && (
        <div className="bg-rose-950/90 text-rose-200 text-[9px] font-bold py-1.5 px-4 text-center border-t border-rose-800 animate-in fade-in">
          {syncFeedback}
        </div>
      )}

      {/* Gaveta / Dropdown Detalhada da Fila Offline */}
      {isExpanded && hasPending && pendingSyncCounts.details && pendingSyncCounts.details.length > 0 && (
        <div className="bg-black/35 backdrop-blur-md border-t border-white/15 px-4 py-4 animate-in slide-in-from-top-2 duration-200 text-left">
          <div className="max-w-7xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-amber-200/80 font-mono">
                📋 Itens e Ações Pendentes de Envio ({pendingSyncCounts.details.length}):
              </span>
              <span className="text-[7.5px] font-bold uppercase text-white/60">
                Serão processados sequencialmente assim que a rede estiver ativa
              </span>
            </div>

            {/* Lista dos Itens na Fila */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto no-scrollbar pt-1">
              {pendingSyncCounts.details.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl p-3 flex items-start justify-between gap-2.5 transition-colors shadow-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-black/40 text-amber-300 flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
                      {item.type === 'item' && <i className="fa-solid fa-box-open text-xs"></i>}
                      {item.type === 'message' && <i className="fa-solid fa-comment-dots text-xs"></i>}
                      {item.type === 'delivery' && <i className="fa-solid fa-signature text-xs"></i>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded bg-black/40 text-amber-200">
                          {item.type === 'item' ? 'Artigo' : item.type === 'message' ? 'Mensagem' : 'Recuperação'}
                        </span>
                        <span className="text-[7.5px] text-white/60 font-mono">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                      <h4 className="text-[10px] font-black text-white truncate mt-1">
                        {item.title}
                      </h4>
                      <p className="text-[8.5px] text-amber-100/75 truncate font-medium">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Ação de Remover se fornecida */}
                  {onRemoveQueueItem && (
                    <button
                      onClick={() => {
                        if (confirm(`Pretende cancelar e remover este registo pendente (${item.title}) da fila?`)) {
                          onRemoveQueueItem(item.type, item.id);
                        }
                      }}
                      className="text-white/40 hover:text-rose-300 p-1.5 rounded-lg hover:bg-black/30 transition-colors cursor-pointer shrink-0"
                      title="Remover este item da fila offline"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
