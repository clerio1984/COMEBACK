import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, SlidersHorizontal, User, Sparkles, Check, ChevronRight, X, Coins, MapPin, Eye, ShieldAlert } from 'lucide-react';

interface AppTourGuideProps {
  onClose: () => void;
  onNavigateTab?: (tab: 'feed' | 'post' | 'profile' | 'about') => void;
  onSetShowFilters?: (show: boolean) => void;
}

export const AppTourGuide: React.FC<AppTourGuideProps> = ({ onClose, onNavigateTab, onSetShowFilters }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Radar de Proximidade 📡",
      subtitle: "Passo 1 de 3 • Monitorização de 12 km",
      desc: "O ComeBack possui um localizador dinâmico de proximidade que analisa anúncios em tempo real num raio de até 12 km! Se detetar um pertence perdido ou achado perto de si, o Radar aciona bipes digitais e envia notificações automáticas no ecrã.",
      icon: <Radar className="w-10 h-10 text-[#009739] animate-pulse" />,
      actionLabel: "Próximo Recurso",
      highlightElement: "radar",
      illustration: (
        <div className="relative w-full h-36 bg-emerald-50/50 dark:bg-slate-900/40 rounded-2xl border border-emerald-100 dark:border-slate-850 flex items-center justify-center overflow-hidden">
          {/* Pulsing ring wave simulation */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full border border-emerald-500/10 animate-ping"></div>
            <div className="w-16 h-16 rounded-full border border-emerald-500/25 animate-pulse"></div>
          </div>
          <div className="z-10 bg-white dark:bg-slate-950 p-4 rounded-full shadow-lg flex items-center justify-center relative border border-emerald-100 dark:border-slate-800">
            <Radar className="w-10 h-10 text-[#009739] animate-spin-slow" />
            <span className="absolute -top-1.5 -right-1.5 bg-[#d21034] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase scale-90 animate-bounce">
              Ativo
            </span>
          </div>
          <div className="absolute bottom-2 left-0 right-0 text-center select-none">
            <p className="text-[7.5px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Mapa de Cobertura • Maputo</p>
          </div>
        </div>
      )
    },
    {
      title: "Botão de SOS Rápido 🚨",
      subtitle: "Passo 2 de 3 • Alerta em 3 Segundos",
      desc: "Perdeu um item por roubo ou assalto? Mantenha o botão SOS RÁPIDO (canto inferior direito) pressionado por 3 segundos para publicar um alerta com geolocalização e notificar imediatamente as patrulhas e postos policiais próximos!",
      icon: <ShieldAlert className="w-10 h-10 text-[#d21034] animate-bounce" />,
      actionLabel: "Prosseguir",
      highlightElement: "sos-floating-fab",
      illustration: (
        <div className="relative w-full h-36 bg-red-55/30 dark:bg-red-950/10 rounded-2xl border border-red-100/40 dark:border-red-900/10 flex flex-col items-center justify-center overflow-hidden p-4">
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d21034] animate-ping"></span>
            <span className="text-[6.5px] font-black text-[#d21034] uppercase tracking-wider">Transmissão Ativa</span>
          </div>
          
          <div className="bg-[#d21034] text-white p-3 rounded-full shadow-lg flex items-center justify-center relative border border-red-400/25 animate-pulse">
            <ShieldAlert className="w-8 h-8 text-[#fce100]" />
          </div>
          
          <div className="mt-2 text-center max-w-xs">
            <p className="text-[8px] font-black text-[#d21034] uppercase tracking-wide">Pressione por 3s para SOS Automático</p>
            <p className="text-[7px] font-bold text-gray-400 mt-0.5">Sincronizado com Postos de Polícia locais</p>
          </div>
        </div>
      )
    },
    {
      title: "Filtros & Ganhos M-Pesa 💰",
      subtitle: "Passo 3 de 3 • Busca Rápida e Levantamento",
      desc: "Use Filtros Avançados para segmentar buscas por BI, Chaves ou Províncias. Quem devolver pertences acumula recompensas em custódia e levanta na hora por M-Pesa, e-Mola ou mKesh com total segurança!",
      icon: <Coins className="w-10 h-10 text-amber-500 animate-pulse" />,
      actionLabel: "Concluir Guia",
      highlightElement: "filters",
      illustration: (
        <div className="relative w-full h-36 bg-[#009739]/5 dark:bg-slate-900/40 rounded-2xl border border-emerald-100/40 flex flex-col items-center justify-center p-3">
          <div className="bg-gradient-to-r from-slate-900 to-black text-white p-3.5 rounded-2xl border border-slate-800 shadow-md w-full max-w-xs text-left flex justify-between items-center relative overflow-hidden select-none">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-[#fce100]/5 pointer-events-none" />
            <div>
              <span className="text-[6.5px] text-gray-400 font-bold uppercase tracking-widest block leading-none mb-1">Carteira ComeBack</span>
              <span className="text-sm font-black text-[#fce100] font-mono leading-none">1.250,00 MT</span>
            </div>
            <div className="bg-[#009739] text-white font-extrabold text-[7.5px] uppercase tracking-widest py-1.5 px-2.5 rounded-lg shadow-sm">
              M-PESA SEGURO
            </div>
          </div>
          <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block font-mono mt-3">★ RECOMPENSAS VOLUNTÁRIAS CUSTODIADAS POR ESCRÓ</span>
        </div>
      )
    }
  ];

  // Acionar ações visuais baseadas no passo do tour para maior imersão
  useEffect(() => {
    if (currentStep === 0) {
      if (onNavigateTab) onNavigateTab('feed');
      if (onSetShowFilters) onSetShowFilters(false);
    } else if (currentStep === 1) {
      if (onNavigateTab) onNavigateTab('feed');
      if (onSetShowFilters) onSetShowFilters(false);
      // Focar ligeiramente o ecrã no SOS FAB se disponível através de um micro destaque de classe
      const fab = document.getElementById('sos-floating-fab');
      if (fab) {
        fab.classList.add('ring-4', 'ring-red-500', 'scale-110');
      }
      return () => {
        if (fab) {
          fab.classList.remove('ring-4', 'ring-red-500', 'scale-110');
        }
      };
    } else if (currentStep === 2) {
      if (onNavigateTab) onNavigateTab('feed');
      if (onSetShowFilters) onSetShowFilters(true);
    }
  }, [currentStep, onNavigateTab, onSetShowFilters]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      localStorage.setItem('comeback_app_tour_seen', 'true');
      onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('comeback_app_tour_seen', 'true');
    if (onSetShowFilters) onSetShowFilters(false);
    if (onNavigateTab) onNavigateTab('feed');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4" id="app-interactive-tour-overlay">
        
        {/* Backdrop de sobreposição flutuante discreta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          onClick={handleSkip}
        />

        {/* Card do Tour */}
        <motion.div
          initial={{ scale: 0.95, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 400 }}
          className="relative bg-white dark:bg-slate-905 w-full max-w-sm rounded-[2.8rem] p-7 sm:p-8 shadow-2xl border-2 border-[#009739]/20 text-center text-slate-800 dark:text-slate-100 overflow-hidden"
          id="app-interactive-tour-card"
        >
          {/* Close Header button */}
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-850"
            title="Sair do Tour"
          >
            <X size={16} />
          </button>

          {/* Progress Indicators */}
          <div className="flex justify-center gap-1.5 mb-5.5 select-none text-center">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-9 bg-[#009739]' : 'w-2.5 bg-gray-200 dark:bg-slate-800'
                }`}
                title={`Passo ${idx + 1}`}
              />
            ))}
          </div>

          {/* Main Visual Core */}
          <div className="space-y-5">
            <div className="py-1 flex justify-center">
              {steps[currentStep].illustration}
            </div>

            <div className="space-y-2">
              <span className="text-[8px] font-black text-[#009739] dark:text-emerald-400 tracking-widest uppercase block">
                {steps[currentStep].subtitle}
              </span>
              <h3 className="text-md sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center justify-center gap-2">
                {steps[currentStep].icon}
                <span>{steps[currentStep].title}</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-650 dark:text-gray-300 leading-relaxed font-bold uppercase hover:text-slate-900 transition-colors">
                {steps[currentStep].desc}
              </p>
            </div>
          </div>

          {/* Action Navigation Bar */}
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-105 dark:border-slate-850/80">
            <button
              onClick={handleSkip}
              className="text-[9px] font-black tracking-widest uppercase text-gray-400 hover:text-gray-600 transition-colors px-4 py-2"
              id="app-tour-skip-button"
            >
              Ignorar
            </button>

            <button
              onClick={handleNext}
              className="bg-[#009739] hover:bg-emerald-600 text-white font-black text-[9.5px] uppercase tracking-widest px-5 py-3.5 rounded-2xl active:scale-95 transition-all shadow-md flex items-center gap-1.5 border-b-2 border-emerald-800"
              id="app-tour-next-button"
            >
              <span>{steps[currentStep].actionLabel}</span>
              {currentStep < steps.length - 1 ? (
                <ChevronRight size={13} className="text-white" />
              ) : (
                <Check size={13} className="text-white stroke-[3]" />
              )}
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
