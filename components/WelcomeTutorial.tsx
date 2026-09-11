import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, ShieldCheck, Check, ChevronRight, X, Sparkles, MapPin } from 'lucide-react';

interface WelcomeTutorialProps {
  onClose: () => void;
}

export const WelcomeTutorial: React.FC<WelcomeTutorialProps> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if the user has already seen this welcome tutorial
    const hasSeen = localStorage.getItem('comeback_welcome_tutorial_seen');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('comeback_welcome_tutorial_seen', 'true');
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: "Bem-vindo ao ComeBack!",
      subtitle: "A maior rede de achados e perdidos de Moçambique",
      desc: "Lidamos com a recuperação segura de documentos, telemóveis, chaves e bens essenciais, ligando quem perdeu a quem encontrou através de tecnologia inteligente e segura.",
      illustration: (
        <div className="relative w-28 h-28 bg-gradient-to-tr from-yellow-50 to-emerald-100 rounded-full flex items-center justify-center border-4 border-white shadow-md mx-auto">
          <Sparkles className="w-12 h-12 text-emerald-600 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-8 h-8 bg-[#d21034] text-white rounded-full flex items-center justify-center text-xs font-black shadow animate-bounce">
            MZ
          </div>
        </div>
      )
    },
    {
      title: "Radar de Proximidade Inteligente",
      subtitle: "Como funciona a localização?",
      desc: "O nosso sistema localiza os itens registados numa área dinâmica de 5km de raio. Se passares perto de um documento perdido, o Radar do ComeBack avisa-te instantaneamente para que possas ajudar a recuperá-lo.",
      illustration: (
        <div className="relative w-28 h-28 bg-gradient-to-tr from-[#009739]/5 to-emerald-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl mx-auto overflow-hidden">
          {/* Pulsing radar rings */}
          <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full animate-ping pointer-events-none"></div>
          <div className="absolute inset-4 border-2 border-[#009739]/30 rounded-full animate-pulse pointer-events-none"></div>
          <Radar className="w-12 h-12 text-[#009739] z-10" />
          <MapPin className="absolute bottom-5 right-5 w-5 h-5 text-[#d21034] animate-bounce z-10" />
        </div>
      )
    },
    {
      title: "Verificação de Identidade (BI)",
      subtitle: "Porquê e como exigimos?",
      desc: "Para garantir que o ComeBack não seja usado para burlas ou falsas notas de resgate, todos os registos oficiais de perda/roubo e aberturas de chat requerem a submissão prévia da foto do Bilhete de Identidade (BI), validada de forma estrita pela administração.",
      illustration: (
        <div className="relative w-28 h-28 bg-gradient-to-tr from-red-50 to-orange-50 rounded-full flex items-center justify-center border-4 border-white shadow-md mx-auto">
          <ShieldCheck className="w-12 h-12 text-[#d21034]" />
          <div className="absolute -bottom-1 -left-1 px-2.5 py-1 bg-black text-[#fce100] text-[7px] font-black uppercase tracking-widest rounded-lg shadow-sm border border-gray-800">
            Seguro
          </div>
        </div>
      )
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={handleDismiss}
          id="welcome-tutorial-overlay"
        />

        {/* Modal container */}
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative bg-white w-full max-w-md rounded-[2.5rem] p-7 sm:p-9 shadow-2xl overflow-hidden text-center border-2 border-emerald-50"
          id="welcome-tutorial-card"
        >
          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
            title="Ignorar Tutorial"
            id="welcome-tutorial-close-btn"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Current step visual progress indicator bar at the top */}
          <div className="flex justify-center gap-1.5 mb-6">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-350 ${
                  idx === currentStep ? 'w-10 bg-[#009739]' : 'w-2.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Step core content rendering */}
          <div className="space-y-6">
            {/* Step Illustration */}
            <div className="py-2">
              {steps[currentStep].illustration}
            </div>

            {/* Typography items */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-[#009739] uppercase tracking-widest pl-0.5">
                {steps[currentStep].subtitle}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-gray-900 uppercase tracking-tight">
                {steps[currentStep].title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-650 font-medium leading-relaxed px-1 sm:px-3 text-gray-600">
                {steps[currentStep].desc}
              </p>
            </div>
          </div>

          {/* Nav Footer and Action controls */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-100">
            {/* Left Button or Skip indicator */}
            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleDismiss}
                className="text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-600 px-4 py-2 rounded-xl transition-all"
                id="welcome-tutorial-skip-btn"
              >
                Ignorar
              </button>
            ) : (
              <div className="w-16" /> /* Spacing placeholder to keep flex layouts balanced */
            )}

            {/* Right Buttons: Continue step action */}
            <div>
              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="bg-[#009739] hover:bg-[#008130] text-white text-[10px] font-black uppercase tracking-widest px-5 py-3.5 rounded-2xl active:scale-95 transition-all shadow-md flex items-center gap-1.5 border-b-2 border-[#007a2d]"
                  id="welcome-tutorial-next-btn"
                >
                  <span>Seguinte</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleDismiss}
                  className="bg-[#fce100] text-slate-950 hover:bg-slate-900 hover:text-white text-[10.5px] font-black uppercase tracking-widest px-6 py-3.5 rounded-2xl active:scale-95 transition-all shadow-lg flex items-center gap-2 border-b-2 border-yellow-600"
                  id="welcome-tutorial-finish-btn"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Entendido!</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default WelcomeTutorial;
