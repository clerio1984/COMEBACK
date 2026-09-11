import React, { useState, useEffect } from 'react';

export const RadarTip: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if the user is a first-time visitor
    const hasVisited = localStorage.getItem('comeback_radar_tip_seen');
    if (!hasVisited) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('comeback_radar_tip_seen', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: "Como Publicar um Item",
      icon: "fa-circle-plus text-[#009739]",
      desc: "Encontrou ou perdeu um documento, carteira ou telemóvel? Toque em 'Publicar' no menu principal para registar com fotos, localização exacta e adicionar uma recompensa."
    },
    {
      title: "Navegar no ComeBack (Mapa)",
      icon: "fa-map-location-dot text-[#fce100]",
      desc: "Alterne para o modo 'Mapa' no feed para visualizar onde os itens foram perdidos ou achados nas províncias de Moçambique. Toque num pin para ver detalhes."
    },
    {
      title: "Resgate Seguro & M-Pesa",
      icon: "fa-shield-halved text-[#d21034]",
      desc: "Use o Chat Seguro para combinar entregas públicas. Se houver recompensa, o sistema simula o pagamento via carteira móvel M-Pesa de forma totalmente segura."
    }
  ];

  return (
    <div 
      className="col-span-2 bg-gradient-to-br from-gray-900 to-slate-950 text-white rounded-[2rem] p-5 shadow-2xl border-2 border-[#fce100]/35 relative overflow-hidden font-sans animate-in slide-in-from-top duration-500 mb-4"
      id="radar-onboarding-tip"
    >
      {/* Background radial overlay */}
      <div className="absolute right-0 top-0 w-24 h-24 bg-[#009739]/10 rounded-full blur-xl pointer-events-none"></div>
      <div className="absolute left-0 bottom-0 w-24 h-24 bg-[#d21034]/10 rounded-full blur-xl pointer-events-none"></div>

      {/* Dismiss Button */}
      <button 
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
        title="Fechar Dica"
        id="dismiss-radar-tip-btn"
      >
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>

      {/* Active slide content */}
      <div className="text-left pr-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="px-2 py-0.5 bg-[#fce100] text-black text-[7px] font-black uppercase tracking-widest rounded-md">
            Guia Rápido
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[#009739]">Dica do ComeBack</span>
        </div>

        <div className="flex gap-3.5 items-start mt-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
            <i className={`fa-solid ${steps[currentStep].icon}`}></i>
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1.5">
              {steps[currentStep].title}
            </h4>
            <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
              {steps[currentStep].desc}
            </p>
          </div>
        </div>
      </div>

      {/* Footer controls: page indicator + Next / Skip */}
      <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
        <div className="flex gap-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-4 bg-[#fce100]' : 'w-1.5 bg-white/20'
              }`}
              title={`Ver passo ${idx + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <button 
              onClick={() => setCurrentStep(currentStep - 1)}
              className="text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Anterior
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button 
              onClick={() => setCurrentStep(currentStep + 1)}
              className="bg-[#009739] text-white hover:bg-[#009739]/80 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl active:scale-95 transition-all shadow-md"
            >
              Próximo <i className="fa-solid fa-chevron-right ml-1"></i>
            </button>
          ) : (
            <button 
              onClick={handleDismiss}
              className="bg-[#fce100] text-black hover:bg-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl active:scale-95 transition-all shadow-md"
            >
              Entendido!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
