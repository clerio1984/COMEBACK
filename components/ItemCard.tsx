import React from 'react';
import { MediaViewer } from './MediaViewer';
import { Item, ItemStatus, Category } from '../types';

interface ItemCardProps {
  item: Item;
  onViewDetails: (item: Item) => void;
  onAction?: (item: Item) => void;
  isOwnerVerified?: boolean;
  variant?: 'grid' | 'list';
  distanceText?: string;
}

const ItemCard: React.FC<ItemCardProps> = React.memo(({ 
  item, 
  onViewDetails, 
  onAction, 
  isOwnerVerified,
  variant = 'grid',
  distanceText
}) => {
  const isMissingPerson = item.category === Category.PEOPLE;

  const getStatusLabel = () => {
    if (isMissingPerson && item.status === ItemStatus.LOST) return 'DESAPARECIDO';
    switch (item.status) {
      case ItemStatus.LOST: return 'PERDIDO';
      case ItemStatus.FOUND: return 'ACHADO';
      case ItemStatus.STOLEN: return 'ROUBADO';
      case ItemStatus.REUNITED: return 'RECUPERADO';
      default: return 'REGISTO';
    }
  };

  const getStatusBadgeStyle = () => {
    switch (item.status) {
      case ItemStatus.LOST:
        return 'bg-[#008fe2] text-white';
      case ItemStatus.FOUND:
        return 'bg-[#153268] text-white';
      case ItemStatus.STOLEN:
        return 'bg-rose-900 text-red-200';
      case ItemStatus.REUNITED:
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  const isReunited = item.status === ItemStatus.REUNITED;

  // List View Layout (Screenshot 1 - Advance Search Filter)
  if (variant === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Ver detalhes: ${item.title}`}
        onClick={() => onViewDetails(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onViewDetails(item);
          }
        }}
        className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-sm hover:shadow-sm transition-all duration-200 border border-slate-200/80 flex items-center gap-3 cursor-pointer active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008fe2] focus-visible:ring-offset-2"
        id={`item-card-list-${item.id}`}
      >
        {/* Left Thumbnail */}
        <div className="w-[76px] h-[76px] sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative flex items-center justify-center border border-gray-100">
          <MediaViewer 
            src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
            category={item.category}
            className="w-full h-full object-cover"
          />
          {distanceText && (
            <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs text-white text-[8px] font-bold text-center py-0.5 truncate">
              {distanceText}
            </div>
          )}
        </div>

        {/* Right Info */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-black uppercase text-[#008fe2] tracking-wider truncate">
              {item.category}
            </span>
            <span className={`shrink-0 text-[8px] sm:text-[9px] font-black uppercase px-2 py-1 rounded-full ${getStatusBadgeStyle()}`}>
              {getStatusLabel()}
            </span>
          </div>

          <h3 className="font-bold text-[#153268] text-sm sm:text-[15px] truncate uppercase mt-0.5">
            {item.title}
          </h3>

          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {item.description || 'Sem descrição adicional'}
          </p>

          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-400 mt-1">
            <span className="truncate">{item.province || item.location || 'Moçambique'}</span>
            <span className="truncate">Publicado por {item.ownerName || 'Anónimo'}</span>
          </div>
        </div>
      </div>
    );
  }

  // Grid Card Layout (Screenshot 2 - Discover Nearby Ads!)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes: ${item.title}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails(item);
        }
      }}
      className={`item-card bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 flex flex-col justify-between border border-slate-200/80 hover:shadow-sm hover:border-slate-300 active:scale-[0.99] cursor-pointer ${
        isReunited ? 'opacity-90' : ''
      }`}
      onClick={() => onViewDetails(item)}
      id={`item-card-${item.id}`}
    >
      {/* Media thumbnail container */}
      <div className="relative overflow-hidden aspect-[4/3] sm:aspect-square bg-slate-50 flex items-center justify-center w-full border-b border-gray-100 p-1.5 sm:p-2">
        <div className="w-full h-full rounded-xl overflow-hidden relative flex items-center justify-center">
          <MediaViewer 
            src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
            category={item.category}
            className={`w-full h-full transition-transform duration-300 ${
              item.category === Category.DOCUMENTS 
                ? 'object-contain p-2 bg-slate-50' 
                : 'object-cover'
            }`}
          />
        </div>

        {/* Top-Right Status Badge (PERDIDO/ACHADO) */}
        <div className={`absolute top-2 right-2 sm:top-3.5 sm:right-3.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase shadow-xs tracking-wider z-10 ${getStatusBadgeStyle()}`}>
          {getStatusLabel()}
        </div>

        {/* Distance Banner bar at the bottom of thumbnail if provided */}
        {distanceText && (
          <div className="absolute bottom-2 inset-x-2 bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-bold text-center py-1 rounded-b-lg">
            {distanceText}
          </div>
        )}

        {/* Reunited Overlay */}
        {isReunited && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center overflow-hidden z-10 pointer-events-none">
            <div className="bg-gradient-to-r from-[#008fe2] to-[#153268] text-white text-xs font-black tracking-widest text-center py-2 w-[150%] -rotate-12 border-y border-white/30 uppercase shadow-sm">
              RECUPERADO
            </div>
          </div>
        )}
      </div>
      
      {/* Card Content */}
      <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between text-left">
        <div>
          <h3 className="font-bold text-[#153268] line-clamp-2 text-sm uppercase leading-snug tracking-tight hover:text-[#008fe2] transition-colors">
            {item.title}
          </h3>

          <p className="text-xs text-gray-500 line-clamp-1 font-medium mt-0.5">
            {item.province || item.location || 'Moçambique'}
          </p>

          <p className="text-[11px] text-gray-400 font-medium truncate mt-1">
            Publicado por {item.ownerName || 'Anónimo'}
          </p>
        </div>

        {!!item.reward && item.reward > 0 && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Recompensa</span>
            <span className="font-black text-[#008fe2]">{item.reward.toLocaleString('pt-MZ')} MT</span>
          </div>
        )}
      </div>
    </div>
  );
});

ItemCard.displayName = 'ItemCard';

export default ItemCard;

