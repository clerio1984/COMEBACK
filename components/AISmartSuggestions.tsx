import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  MapPin, 
  Search, 
  ArrowRight, 
  RefreshCw, 
  Zap, 
  ChevronRight, 
  CheckCircle2, 
  Compass,
  AlertCircle,
  Eye
} from 'lucide-react';
import { Item, ItemStatus, Category } from '../types';
import { MediaViewer } from './MediaViewer';
import { fetchSmartSuggestions, SmartSuggestionMatch } from '../services/geminiService';
import { getDistanceInKm } from '../App';

interface AISmartSuggestionsProps {
  items: Item[];
  recentSearches: string[];
  currentLocationCoords?: { lat: number; lng: number };
  userProvince?: string;
  onViewDetails: (item: Item) => void;
  onAction?: (item: Item) => void;
  onSelectSearchTag?: (query: string) => void;
  isOwnerVerifiedMap?: Record<string, boolean>;
}

export const AISmartSuggestions: React.FC<AISmartSuggestionsProps> = ({
  items,
  recentSearches,
  currentLocationCoords,
  userProvince = 'Maputo Cidade',
  onViewDetails,
  onAction,
  onSelectSearchTag,
  isOwnerVerifiedMap = {}
}) => {
  const [suggestions, setSuggestions] = useState<SmartSuggestionMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const validItems = useMemo(() => {
    return items.filter(i => i.status !== ItemStatus.REUNITED);
  }, [items]);

  const loadSuggestions = useCallback(async () => {
    if (validItems.length === 0) return;
    setIsLoading(true);
    try {
      const results = await fetchSmartSuggestions(
        recentSearches,
        validItems,
        currentLocationCoords,
        userProvince
      );
      setSuggestions(results);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("Erro ao gerar sugestões inteligentes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [recentSearches, validItems, currentLocationCoords, userProvince]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Mapear os 3 itens correspondentes
  const matchedItems = useMemo(() => {
    if (suggestions.length === 0) {
      // Fallback: pegar os 3 primeiros itens ativos mais recentes/próximos
      return validItems.slice(0, 3).map((item, idx) => ({
        item,
        confidenceScore: 92 - idx * 4,
        matchReason: `Item relevante localizado em ${item.location || item.province}`,
        matchedQuery: undefined
      }));
    }

    return suggestions
      .map(s => {
        const found = validItems.find(i => i.id === s.itemId);
        if (!found) return null;
        return {
          item: found,
          confidenceScore: s.confidenceScore,
          matchReason: s.matchReason,
          matchedQuery: s.matchedQuery
        };
      })
      .filter(Boolean) as {
        item: Item;
        confidenceScore: number;
        matchReason: string;
        matchedQuery?: string;
      }[];
  }, [suggestions, validItems]);

  if (matchedItems.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div 
      className="bg-gradient-to-br from-slate-900 via-[#003830] to-slate-950 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-emerald-500/20 relative overflow-hidden mb-6"
      id="ai-smart-suggestions-container"
    >
      {/* Glow de Fundo */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#fce100]/5 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10"></div>

      {/* Top Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#009739] to-[#fce100] p-0.5 flex items-center justify-center shrink-0 shadow-md">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles size={16} className="text-[#fce100] animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <span>Sugestões Inteligentes</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-black uppercase px-1.5 py-0.2 rounded font-mono">
                  IA GEMINI
                </span>
              </h2>
            </div>
            <p className="text-[8.5px] font-semibold text-slate-300 uppercase tracking-wide">
              {recentSearches.length > 0 
                ? `Baseado nas suas ${recentSearches.length} pesquisas recentes & radar GPS` 
                : `Baseado na sua proximidade geográfica em ${userProvince}`}
            </p>
          </div>
        </div>

        {/* Botão de Atualizar */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => loadSuggestions()}
            disabled={isLoading}
            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-lg border border-white/10 transition-all cursor-pointer disabled:opacity-50"
            title="Recalcular Matches com IA"
          >
            <RefreshCw size={10} className={`${isLoading ? 'animate-spin text-[#fce100]' : ''}`} />
            <span>{isLoading ? 'A calcular...' : 'Atualizar IA'}</span>
          </button>
        </div>
      </div>

      {/* Chips de Pesquisas Recentes Utilizadas */}
      {recentSearches.length > 0 && (
        <div className="relative z-10 pt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[7.5px] font-black uppercase tracking-wider text-emerald-400 shrink-0 flex items-center gap-0.5">
            <Search size={8} />
            Radar Ativo:
          </span>
          {recentSearches.slice(0, 4).map((query, idx) => (
            <button
              key={`search-chip-${idx}`}
              type="button"
              onClick={() => onSelectSearchTag && onSelectSearchTag(query)}
              className="bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-1"
            >
              <span>"{query}"</span>
              <ChevronRight size={8} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {/* Grid com exatamente 3 Matches da IA */}
      <div className="relative z-10 mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {isLoading ? (
          /* Skeletons de Carregamento */
          [1, 2, 3].map(i => (
            <div 
              key={`skeleton-${i}`} 
              className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 animate-pulse space-y-2.5"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-16 bg-white/10 rounded"></div>
                <div className="h-4 w-12 bg-white/10 rounded"></div>
              </div>
              <div className="h-24 bg-white/10 rounded-xl"></div>
              <div className="h-3 w-3/4 bg-white/10 rounded"></div>
              <div className="h-2 w-1/2 bg-white/10 rounded"></div>
            </div>
          ))
        ) : (
          matchedItems.slice(0, 3).map(({ item, confidenceScore, matchReason, matchedQuery }, idx) => {
            const isLost = item.status === ItemStatus.LOST;
            const isFound = item.status === ItemStatus.FOUND;
            const isStolen = item.status === ItemStatus.STOLEN;

            // Calcular distância real se tiver coordenadas
            let distText = undefined;
            if (currentLocationCoords && item.latitude && item.longitude) {
              const km = getDistanceInKm(
                currentLocationCoords.lat,
                currentLocationCoords.lng,
                item.latitude,
                item.longitude
              );
              distText = `a ${km < 1 ? '<1' : km.toFixed(1)} km`;
            }

            return (
              <motion.div
                key={`smart-match-${item.id}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                onClick={() => onViewDetails(item)}
                className="bg-slate-950/70 hover:bg-slate-900 border border-white/15 hover:border-emerald-500/50 rounded-2xl p-3 flex flex-col justify-between transition-all group cursor-pointer shadow-md text-left relative overflow-hidden"
              >
                {/* Badge Superior: Score de Confiança IA & Tipo */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[8px] font-black uppercase font-mono">
                      <Zap size={9} className="text-[#fce100] animate-bounce" />
                      <span>{confidenceScore}% MATCH</span>
                    </div>

                    <span
                      className={`text-[7.5px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                        isFound
                          ? 'bg-[#153268] text-white'
                          : isStolen
                          ? 'bg-rose-900 text-rose-200'
                          : 'bg-[#008fe2] text-white'
                      }`}
                    >
                      {isFound ? 'ACHADO' : isStolen ? 'ROUBADO' : 'PERDIDO'}
                    </span>
                  </div>

                  {/* Thumbnail com Zoom */}
                  <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-900 border border-white/10 relative mb-2">
                    <MediaViewer
                      src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''}
                      category={item.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Badge de Distância */}
                    {distText && (
                      <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <MapPin size={8} className="text-[#fce100]" />
                        <span>{distText}</span>
                      </div>
                    )}

                    {item.reward && item.reward > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-[#fce100] text-black text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm">
                        {item.reward.toLocaleString('pt-MZ')} MT
                      </div>
                    )}
                  </div>

                  {/* Categoria & Título */}
                  <span className="text-[7.5px] font-black text-emerald-400 uppercase tracking-widest block">
                    {item.category}
                  </span>
                  <h3 className="text-[11px] font-black text-white uppercase truncate mt-0.5 group-hover:text-[#fce100] transition-colors leading-tight">
                    {item.title}
                  </h3>

                  {/* Razão do Match pela IA */}
                  <div className="mt-2 p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[8px] font-semibold leading-snug flex items-start gap-1">
                    <Sparkles size={9} className="text-[#fce100] shrink-0 mt-0.5" />
                    <span className="truncate-2-lines">{matchReason}</span>
                  </div>
                </div>

                {/* Rodapé do Card */}
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[8px]">
                  <span className="text-gray-400 truncate max-w-[100px] flex items-center gap-0.5">
                    <MapPin size={8} className="text-gray-400" />
                    {item.location || item.province}
                  </span>

                  <span className="text-[#fce100] font-black uppercase tracking-wider flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>Ver Item</span>
                    <ArrowRight size={9} />
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
