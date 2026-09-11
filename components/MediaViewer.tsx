
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Smartphone, 
  Shirt, 
  PawPrint, 
  Briefcase, 
  CreditCard, 
  Key, 
  Gem, 
  User, 
  Image, 
  Video 
} from 'lucide-react';
import { Category } from '../types';
import { getCachedImage, getMemoryCachedImage, fetchAndCacheImage } from '../services/imageLocalCache';

export const isVideo = (src?: string) => {
  if (!src) return false;
  return src.startsWith('data:video') || 
         src.toLowerCase().endsWith('.mp4') || 
         src.toLowerCase().endsWith('.mov') || 
         src.toLowerCase().endsWith('.webm') ||
         src.toLowerCase().endsWith('.m4v');
};

interface MediaViewerProps {
  src: string;
  className?: string;
  category?: Category;
  alt?: string;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ src, className, category, alt = '' }) => {
  const [hasError, setHasError] = useState(false);
  
  // Try synchronous L1 memory cache first to prevent any visual flicker
  const [displaySrc, setDisplaySrc] = useState<string>(() => {
    if (!src) return '';
    if (src.startsWith('data:') || isVideo(src)) return src;
    return getMemoryCachedImage(src) || src;
  });

  const lastQueriedSrc = useRef<string>('');

  useEffect(() => {
    let isMounted = true;

    if (!src) {
      setDisplaySrc('');
      setHasError(false);
      return;
    }

    // Direct Data URLs or Videos do not need IndexedDB resolution
    if (isVideo(src) || src.startsWith('data:')) {
      setDisplaySrc(src);
      setHasError(false);
      return;
    }

    // Check synchronous memory cache
    const memCached = getMemoryCachedImage(src);
    if (memCached) {
      setDisplaySrc(memCached);
      setHasError(false);
      return;
    }

    lastQueriedSrc.current = src;

    // Check persistent IndexedDB cache (L2)
    getCachedImage(src)
      .then((cached) => {
        if (!isMounted) return;
        if (cached) {
          setDisplaySrc(cached);
          setHasError(false);
        } else {
          // Use original URL and, if online, prefetch and persist into IndexedDB for future offline access
          setDisplaySrc(src);
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            fetchAndCacheImage(src).then((newlyCached) => {
              if (isMounted && newlyCached && lastQueriedSrc.current === src) {
                setDisplaySrc(newlyCached);
              }
            }).catch(() => {
              // Ignore background prefetch errors
            });
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setDisplaySrc(src);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleImageError = async () => {
    // If the network image failed (e.g. offline browsing), check IndexedDB before falling back to placeholder
    if (src && !src.startsWith('data:') && !isVideo(src)) {
      try {
        const cached = await getCachedImage(src);
        if (cached && cached !== displaySrc) {
          setDisplaySrc(cached);
          setHasError(false);
          return;
        }
      } catch {
        // Fallback to placeholder below
      }
    }
    setHasError(true);
  };

  if (isVideo(src)) {
    return (
      <video 
        src={src} 
        className={className} 
        controls 
        playsInline
      />
    );
  }

  const renderPlaceholder = () => {
    let IconComponent = Image;
    let bgColor = 'bg-slate-50 dark:bg-slate-900';
    let textColor = 'text-slate-400 dark:text-slate-600';
    let label = category || 'Sem imagem';

    if (category) {
      switch (category) {
        case Category.DOCUMENTS:
          IconComponent = FileText;
          bgColor = 'bg-blue-50/50 dark:bg-blue-950/20';
          textColor = 'text-blue-500 dark:text-blue-400';
          break;
        case Category.ELECTRONICS:
          IconComponent = Smartphone;
          bgColor = 'bg-amber-50/50 dark:bg-amber-950/20';
          textColor = 'text-amber-500 dark:text-amber-400';
          break;
        case Category.CLOTHING:
          IconComponent = Shirt;
          bgColor = 'bg-purple-50/50 dark:bg-purple-950/20';
          textColor = 'text-purple-500 dark:text-purple-400';
          break;
        case Category.PETS:
          IconComponent = PawPrint;
          bgColor = 'bg-emerald-50/50 dark:bg-emerald-950/20';
          textColor = 'text-emerald-500 dark:text-emerald-400';
          break;
        case Category.BAGS:
          IconComponent = Briefcase;
          bgColor = 'bg-indigo-50/50 dark:bg-indigo-950/20';
          textColor = 'text-indigo-500 dark:text-indigo-400';
          break;
        case Category.WALLETS:
          IconComponent = CreditCard;
          bgColor = 'bg-teal-50/50 dark:bg-teal-950/20';
          textColor = 'text-teal-500 dark:text-teal-400';
          break;
        case Category.KEYS:
          IconComponent = Key;
          bgColor = 'bg-amber-50/50 dark:bg-amber-950/20';
          textColor = 'text-amber-500 dark:text-amber-400';
          break;
        case Category.JEWELRY:
          IconComponent = Gem;
          bgColor = 'bg-rose-50/50 dark:bg-rose-950/20';
          textColor = 'text-rose-500 dark:text-rose-400';
          break;
        case Category.PEOPLE:
          IconComponent = User;
          bgColor = 'bg-red-50/50 dark:bg-red-950/20';
          textColor = 'text-red-500 dark:text-red-400';
          break;
        default:
          IconComponent = Image;
          bgColor = 'bg-slate-50 dark:bg-slate-900';
          textColor = 'text-slate-400 dark:text-slate-600';
          break;
      }
    }

    return (
      <div className={`w-full h-full flex flex-col items-center justify-center p-6 ${bgColor} ${textColor} transition-colors duration-300`}>
        <IconComponent className="w-12 h-12 mb-2 opacity-80 stroke-[1.5]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-center">{label}</span>
      </div>
    );
  };

  if (hasError || !displaySrc) {
    return renderPlaceholder();
  }

  return (
    <img 
      src={displaySrc} 
      className={className} 
      alt={alt} 
      referrerPolicy="no-referrer" 
      onError={handleImageError}
    />
  );
};
