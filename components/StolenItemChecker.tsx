import React, { useState, useMemo } from 'react';
import { Item, ItemStatus, Category } from '../types';
import { MediaViewer } from './MediaViewer';

interface StolenItemCheckerProps {
  items: Item[];
  onViewItem: (item: Item) => void;
  onReportStolen: () => void;
}

export const StolenItemChecker: React.FC<StolenItemCheckerProps> = ({
  items,
  onViewItem,
  onReportStolen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'STOLEN' | 'LOST'>('ALL');

  // Stolen & lost items pool
  const stolenCount = useMemo(() => items.filter(i => i.status === ItemStatus.STOLEN).length, [items]);
  const lostCount = useMemo(() => items.filter(i => i.status === ItemStatus.LOST).length, [items]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return items.filter(item => {
      // Must match status filter
      if (selectedFilter === 'STOLEN' && item.status !== ItemStatus.STOLEN) return false;
      if (selectedFilter === 'LOST' && item.status !== ItemStatus.LOST) return false;
      if (selectedFilter === 'ALL' && item.status !== ItemStatus.STOLEN && item.status !== ItemStatus.LOST) return false;

      const title = (item.title || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const prov = (item.province || '').toLowerCase();

      // Check for exact IMEI or serial number matches in text
      const cleanQuery = query.replace(/[^a-z0-9]/gi, '');
      const cleanDesc = desc.replace(/[^a-z0-9]/gi, '');
      const cleanTitle = title.replace(/[^a-z0-9]/gi, '');

      return (
        title.includes(query) ||
        desc.includes(query) ||
        loc.includes(query) ||
        prov.includes(query) ||
        (cleanQuery.length >= 4 && (cleanDesc.includes(cleanQuery) || cleanTitle.includes(cleanQuery)))
      );
    });
  }, [items, searchQuery, selectedFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setHasSearched(false);
  };

  const handleQuickSearch = (sample: string) => {
    setSearchQuery(sample);
    setHasSearched(true);
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-[#f8fafc] overflow-y-auto pb-24 font-sans text-left">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white px-4 py-6 sm:py-8 border-b border-slate-800">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1.5 tracking-wider">
              <i className="fa-solid fa-shield-halved text-xs"></i>
              Base de Dados Anti-Roubo
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              {stolenCount} Artigos Roubados Registados
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            Verificador de Artigos Roubados & Furtados
          </h1>

          <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-2xl">
            Vai comprar um telemóvel, computador, mota ou eletrónico em segunda mão? Pesquise o 
            <span className="text-[#fce100] font-bold"> IMEI, Número de Série ou Matrícula</span> antes de pagar para garantir que não se trata de um bem roubado.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="pt-2">
            <div className="relative flex items-center bg-white rounded-2xl p-1.5 shadow-lg border border-slate-200">
              <div className="pl-3 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-sm"></i>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Introduza IMEI (15 dígitos), Nº de Série, Matrícula ou Marca..."
                className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 outline-none placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Limpar"
                >
                  <i className="fa-solid fa-circle-xmark text-sm"></i>
                </button>
              )}
              <button
                type="submit"
                className="bg-gradient-to-r from-[#008fe2] to-[#153268] hover:opacity-95 active:scale-95 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <span>Verificar</span>
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          </form>

          {/* Quick Suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
            <span className="text-slate-400 font-bold">Exemplos:</span>
            {['iPhone', 'Samsung Galaxy', 'MacBook', 'HP', 'Honda', 'Toyota'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQuickSearch(tag)}
                className="bg-white/10 hover:bg-white/20 text-slate-200 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-3xl mx-auto w-full p-4 space-y-5">
        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer ${
                selectedFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({stolenCount + lostCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('STOLEN')}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                selectedFilter === 'STOLEN' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              <i className="fa-solid fa-shield-halved text-[9px]"></i>
              <span>Roubados ({stolenCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('LOST')}
              className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                selectedFilter === 'LOST' ? 'bg-[#d21034] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <i className="fa-solid fa-magnifying-glass text-[9px]"></i>
              <span>Perdidos ({lostCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onReportStolen}
            className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <i className="fa-solid fa-circle-plus text-xs"></i>
            <span>Registar Roubo</span>
          </button>
        </div>

        {/* Results Area */}
        {hasSearched ? (
          <div className="space-y-4">
            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {/* Warning Alert Banner */}
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 text-lg shadow-sm">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-900 uppercase">
                      Alerta: Artigo com Registo Encontrado! ({searchResults.length})
                    </h3>
                    <p className="text-xs text-rose-700 font-medium leading-relaxed mt-0.5">
                      Foi encontrado um registo ativo correspondente à sua pesquisa. A compra ou posse de 
                      bens roubados constitui crime de receptação punível pelo Código Penal Moçambicano. 
                      Não adquira este artigo sem verificar a procedência legítima!
                    </p>
                  </div>
                </div>

                {/* Match Cards */}
                <div className="space-y-2.5">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onViewItem(item)}
                      className="bg-white rounded-2xl p-3.5 border-2 border-rose-200 hover:border-rose-400 transition-all shadow-xs flex items-center gap-3.5 cursor-pointer active:scale-[0.99]"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 relative">
                        <MediaViewer
                          src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''}
                          category={item.category}
                          className="w-full h-full object-cover"
                        />
                        <span className={`absolute top-0.5 left-0.5 text-[7px] font-black uppercase px-1 py-0.2 rounded ${
                          item.status === ItemStatus.STOLEN ? 'bg-rose-600 text-white' : 'bg-[#d21034] text-white'
                        }`}>
                          {item.status === ItemStatus.STOLEN ? 'ROUBADO' : 'PERDIDO'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                            {item.category}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold">
                            {item.date}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate uppercase">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span className="truncate">
                            <i className="fa-solid fa-location-dot text-[9px] mr-1"></i>
                            {item.province || item.location}
                          </span>
                          <span className="text-[#008fe2] font-black uppercase text-[9.5px]">
                            Ver Registo Completo &rarr;
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Clear / Clean Result */
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-lg shadow-sm">
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-900 uppercase">
                      Nenhum Registo de Roubo ou Perda Encontrado
                    </h3>
                    <p className="text-xs text-emerald-700 font-medium leading-relaxed mt-0.5">
                      O termo "<span className="font-bold">{searchQuery}</span>" não consta na base de dados de bens roubados ou furtados da ComeBack Moçambique.
                    </p>
                  </div>
                </div>

                <div className="bg-white/80 rounded-xl p-3 border border-emerald-200 text-xs text-slate-700 space-y-1.5">
                  <span className="font-black text-[10px] uppercase text-emerald-800 block">
                    Dicas de Segurança para Compra Segura:
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                    <li>Em telemóveis, marque <strong>*#06#</strong> no teclado e confirme se o IMEI bate certo com a gaveta de SIM ou embalagem.</li>
                    <li>Solicite a fatura ou recibo de compra original ao vendedor.</li>
                    <li>Confirme se as contas iCloud, Google ou Samsung foram totalmente desvinculadas.</li>
                    <li>Nunca realize encontros em locais isolados ou pagamentos antecipados.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Idle View - Educational Guide & Latest Stolen Posts */
          <div className="space-y-4">
            {/* Promo Card: Was your item stolen? */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">
                    Foi vítima de Furto ou Assalto?
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Registe o IMEI ou Nº de Série do seu bem
                </h3>
                <p className="text-xs text-slate-500 max-w-md">
                  Ao registar o seu equipamento roubado, impede que os assaltantes o vendam no mercado informal e facilita a recuperação pelas autoridades policiais.
                </p>
              </div>

              <button
                type="button"
                onClick={onReportStolen}
                className="bg-slate-950 hover:bg-slate-850 active:scale-95 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-bullhorn text-amber-400"></i>
                <span>Registar Artigo Roubado</span>
              </button>
            </div>

            {/* Latest Stolen Items Carousel / List */}
            {stolenCount > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-shield-halved text-rose-600 text-xs"></i>
                    <span>Artigos Roubados Recentemente</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    Base Pública de Alerta
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {items
                    .filter(i => i.status === ItemStatus.STOLEN)
                    .slice(0, 6)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onViewItem(item)}
                        className="bg-white rounded-2xl p-3 border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex items-center gap-3 cursor-pointer active:scale-[0.99]"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                          <MediaViewer
                            src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''}
                            category={item.category}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-black uppercase text-rose-600">
                              {item.category}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold">
                              {item.date}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-xs truncate uppercase">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.province || item.location}
                          </p>
                          {item.reward && item.reward > 0 && (
                            <span className="text-[9px] font-black text-[#008fe2]">
                              Recompensa: {item.reward.toLocaleString('pt-MZ')} MT
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
