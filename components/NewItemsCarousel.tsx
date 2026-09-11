import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Item, ItemStatus, Category } from '../types';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Compass, ShieldCheck } from 'lucide-react';
import { MediaViewer } from './MediaViewer';

interface NewItemsCarouselProps {
  items: Item[];
  onViewDetails: (item: Item) => void;
}

const CATEGORY_BG_BADGES: Record<string, string> = {
  [ItemStatus.LOST]: 'bg-red-500/10 text-red-600 border border-red-500/20',
  [ItemStatus.FOUND]: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  [ItemStatus.STOLEN]: 'bg-slate-900 text-slate-100 border border-slate-800'
};

const CATEGORY_STATUS_TEXT: Record<string, string> = {
  [ItemStatus.LOST]: 'Perdido',
  [ItemStatus.FOUND]: 'Achado',
  [ItemStatus.STOLEN]: 'Roubado',
  [ItemStatus.REUNITED]: 'Recuperado'
};

export const NewItemsCarousel: React.FC<NewItemsCarouselProps> = ({ items, onViewDetails }) => {
  // Sort and filter active newly posted items (up to 5 items)
  const newItems = React.useMemo(() => {
    return items
      .filter(item => item.status !== ItemStatus.REUNITED)
      .slice(0, 5);
  }, [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [isHovered, setIsHovered] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoPlay = () => {
    stopAutoPlay();
    autoPlayTimerRef.current = setInterval(() => {
      handleNext();
    }, 5000); // Auto-slide every 5 seconds
  };

  const stopAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (newItems.length > 1 && !isHovered) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }
    return () => stopAutoPlay();
  }, [currentIndex, newItems.length, isHovered]);

  if (newItems.length === 0) return null;

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % newItems.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + newItems.length) % newItems.length);
  };

  const activeItem = newItems[currentIndex];

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 30 },
        opacity: { duration: 0.25 }
      }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  return (
    <div 
      className="col-span-2 relative bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-3xl p-4 md:p-5 font-sans overflow-hidden select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="new-items-carousel-container"
    >
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h3 className="text-[11px] font-black uppercase text-slate-850 tracking-wider">
            Publicações Mais Recentes
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handlePrev}
            className="w-7 h-7 rounded-full bg-white border border-slate-200/55 hover:bg-slate-50 text-slate-600 flex items-center justify-center active:scale-95 transition-all outline-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={handleNext}
            className="w-7 h-7 rounded-full bg-white border border-slate-200/55 hover:bg-slate-50 text-slate-600 flex items-center justify-center active:scale-95 transition-all outline-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative min-h-[140px] flex items-center">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={`slide-${activeItem.id}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full grid grid-cols-12 gap-3.5 items-center cursor-pointer"
            onClick={() => onViewDetails(activeItem)}
          >
            {/* Slide Image */}
            <div className="col-span-4 sm:col-span-3 aspect-square rounded-2xl overflow-hidden bg-slate-200 relative border border-slate-200/40 flex items-center justify-center shadow-xs">
              <MediaViewer 
                src={(activeItem.imageUrls && activeItem.imageUrls.length > 0 ? activeItem.imageUrls[0] : activeItem.imageUrl) || ''} 
                category={activeItem.category}
                className="w-full h-full object-cover" 
                alt={activeItem.title}
              />

              {/* Status Badge */}
              <div className="absolute top-1.5 left-1.5 z-10">
                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-xs ${CATEGORY_BG_BADGES[activeItem.status] || 'bg-slate-500 text-white'}`}>
                  {CATEGORY_STATUS_TEXT[activeItem.status] || 'Item'}
                </span>
              </div>
            </div>

            {/* Slide Content */}
            <div className="col-span-8 sm:col-span-9 space-y-1.5 flex flex-col justify-center text-left">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[7.5px] font-black text-[#009739] bg-[#009739]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                  {activeItem.category}
                </span>
                {activeItem.province && (
                  <span className="text-[7.5px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {activeItem.province}
                  </span>
                )}
                {activeItem.ownerVerified && (
                  <span className="text-[7.5px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5 text-amber-500" />
                    Proprietário Verificado
                  </span>
                )}
              </div>

              <h4 className="text-sm font-black text-slate-850 uppercase leading-snug line-clamp-2 hover:text-[#009739] transition-colors">
                {activeItem.title}
              </h4>

              <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                {activeItem.description}
              </p>

              <div className="flex items-center gap-3 text-[8.5px] font-bold text-slate-400 uppercase mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 stroke-[2] text-slate-400" />
                  {activeItem.date}
                </span>
                <span>•</span>
                <span className="truncate max-w-[120px] sm:max-w-none">
                  {activeItem.location}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide Indicators / Dots */}
      {newItems.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3 md:mt-4">
          {newItems.map((_, idx) => (
            <button
              key={`indicator-${idx}`}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 outline-none ${
                idx === currentIndex 
                  ? 'w-5 bg-[#009739]' 
                  : 'w-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
