import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Sun, 
  Maximize, 
  Flame, 
  HelpCircle, 
  Check, 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  Compass, 
  Eye, 
  ShieldCheck,
  Smartphone
} from 'lucide-react';

interface VerificationTutorialProps {
  onClose?: () => void;
  onSelectPhotoClick?: () => void;
}

export const VerificationTutorial: React.FC<VerificationTutorialProps> = ({ onClose, onSelectPhotoClick }) => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [testBlur, setTestBlur] = useState<number>(10); // 0 = sharp, 100 = blur
  const [testGlare, setTestGlare] = useState<number>(15); // 0 = perfect, 100 = glare
  const [testAngle, setTestAngle] = useState<number>(0); // 0 = straight, 45 = bad tilt

  const steps = [
    {
      title: "Iluminação Perfeita ☀️",
      description: "Evite reflexos e sombras sobre o Bilhete de Identidade. Fotografe em ambientes iluminados com luz natural difusa (como próximo a uma janela). Nunca utilize o flash direto se o cartão possuir película plastificada brilhante, pois isso causará clarões brancos que impossibilitam a extração de dados por OCR.",
      badge: "Evite Reflexo",
      icon: Sun,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
      tips: [
        "Prefira luz natural de frente.",
        "Desative o flash do telemóvel.",
        "Evite lâmpadas logo acima do documento que criem luz incidente forte."
      ]
    },
    {
      title: "Foco e Altíssima Nitidez 👁️",
      description: "As letras pequenas do BI devem estar perfeitas para leitura pela IA. Encoste os cotovelos na mesa para estabilizar o aparelho e aguarde o foco automático completar. Imagens desfocadas (tremidas) serão rejeitadas no pré-processamento digital.",
      badge: "Foco Estreito",
      icon: Eye,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/20",
      tips: [
        "Apoie o braço numa superfície firme.",
        "Limpe a lente da câmara traseira antes de fotografar.",
        "Certifique-se de que os números de série e o nome estão visíveis."
      ]
    },
    {
      title: "Enquadramento Reto & Alinhado 📐",
      description: "Posicione o documento plano sobre uma superfície lisa, de preferência escura e contrastante (como uma mesa de madeira ou tecido escuro). O telemóvel deve ser segurado exatamente paralelo ao BI, sem inclinações horizontais (tilt) ou verticais.",
      badge: "Margem Correta",
      icon: Maximize,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
      tips: [
        "Fotografe o BI de cima para baixo (visão de planta).",
        "Mantenha uma margem de segurança de 1cm de fundo ao redor do cartão.",
        "Não corte os cantos ou bordas do Bilhete de Identidade."
      ]
    }
  ];

  // Calcular índice de aceitação por IA baseado nos controlos interativos
  const blurScore = Math.max(0, 100 - (testBlur * 1.5));
  const glareScore = Math.max(0, 100 - (testGlare * 1.3));
  const angleScore = Math.max(0, 100 - (Math.abs(testAngle) * 2.8));
  const totalScore = Math.round((blurScore + glareScore + angleScore) / 3);

  const getApprovalStatus = (score: number) => {
    if (score >= 85) return { text: "Excelente (Pronto a Enviar)", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100", icon: CheckCircle2 };
    if (score >= 60) return { text: "Atenção: Risco de Rejeição", bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-100", icon: AlertTriangle };
    return { text: "Inválido (Não será Aprovado)", bg: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-100", icon: X };
  };

  const currentStatus = getApprovalStatus(totalScore);

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-gray-150 dark:border-slate-800 p-5 rounded-[2.5rem] flex flex-col gap-5 text-left shadow-md" id="ai-verification-tutorial-panel">
      
      {/* Top Banner */}
      <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-[#009739] p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="font-black text-xs text-gray-800 dark:text-gray-100 uppercase block tracking-tight">Tutorial de Verificação</span>
            <span className="text-[7px] font-mono font-black text-gray-400 dark:text-gray-400 uppercase tracking-widest block mt-0.5">Validação Inteligente por IA</span>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-black dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Fechar Tutorial"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold leading-relaxed uppercase">
        Leia o guia visual abaixo para entender como tirar uma fotografia ideal ao seu Bilhete de Identidade (BI). A nossa inteligência artificial utiliza processamento de visão computadorizada para validar dados de forma instantânea.
      </p>

      {/* Passos do Guia Visual */}
      <div className="grid grid-cols-3 gap-1 bg-gray-50 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-gray-100 dark:border-slate-800">
        {steps.map((s, idx) => {
          const SIcon = s.icon;
          return (
            <button
              key={idx}
              onClick={() => setActiveStep(idx)}
              className={`py-2 px-1 rounded-xl text-[8.5px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 select-none ${
                activeStep === idx 
                  ? 'bg-white dark:bg-slate-900 shadow-sm border border-gray-150 dark:border-slate-800 text-[#009739]' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <SIcon size={13} className={activeStep === idx ? 'text-[#009739] scale-110' : 'text-gray-400'} />
              <span>{idx + 1}. {s.badge}</span>
            </button>
          )
        })}
      </div>

      {/* Conteúdo do Passo Ativo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
          className="bg-[#009739]/3 dark:bg-slate-950 border border-[#009739]/10 dark:border-slate-805/50 p-4.5 rounded-[1.8rem] space-y-3.5"
        >
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl border border-white/50 dark:border-slate-800 shadow-xs shrink-0 ${steps[activeStep].color}`}>
              {React.createElement(steps[activeStep].icon, { size: 15 })}
            </div>
            <h4 className="text-[11px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight">
              {steps[activeStep].title}
            </h4>
          </div>

          <p className="text-[9.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-normal">
            {steps[activeStep].description}
          </p>

          <div className="space-y-1.5">
            <span className="text-[7.5px] font-black uppercase text-gray-400 tracking-wider">Super Dicas de Captura:</span>
            <div className="grid grid-cols-1 gap-1">
              {steps[activeStep].tips.map((tip, i) => (
                <div key={i} className="flex gap-1.5 items-start text-[8px] font-bold text-gray-600 dark:text-gray-350">
                  <span className="text-[#009739] inline shadow-xs bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-850 p-0.5 rounded leading-none shrink-0 font-bold">✓</span>
                  <span className="uppercase">{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Simulador Interativo IA Live Score */}
      <div className="bg-slate-950 border-2 border-slate-800 p-4.5 rounded-[2rem] text-white space-y-4 shadow-inner">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-900">
          <span className="text-[8px] font-black uppercase text-[#fce100] tracking-widest flex items-center gap-1.5">
            <Smartphone size={10} className="animate-bounce" /> Live Simulator: Pré-Diagnóstico OCR
          </span>
          <span className="text-[7px] font-mono font-black text-gray-400 uppercase tracking-wide">
            Testadores de Foto do BI
          </span>
        </div>

        {/* Mock representation of the ID Card in screen */}
        <div className="relative w-full aspect-2/1 max-w-[280px] mx-auto bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center p-3">
          
          {/* Real simulated visual effects based on state sliders */}
          <div 
            className="w-full h-full border border-slate-700 rounded bg-slate-850 p-2 text-left relative transition-all"
            style={{
              filter: `blur(${testBlur / 15}px)`,
              transform: `rotate(${testAngle}deg)`,
              opacity: 1 - (testGlare / 150)
            }}
          >
            {/* Holograms, photos, layouts representing a BI in Mozambique */}
            <div className="flex justify-between items-start pb-1.5 border-b border-slate-700 text-[6px] font-black uppercase font-mono text-gray-400">
              <span className="text-[5px]">República de Moçambique</span>
              <span>BI N° 110293849A</span>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="w-8 h-10 bg-slate-800 rounded relative overflow-hidden border border-slate-750 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-slate-700 mt-2" />
                <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#d21034] rounded-full opacity-60" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="h-1 bg-slate-700 rounded w-4/5" />
                <div className="h-1 bg-slate-700 rounded w-3/5" />
                <div className="h-1 bg-slate-700 rounded w-5/6" />
                <div className="h-1.5 flex gap-1 items-center mt-1.5">
                  <div className="h-1.5 bg-emerald-600/30 border border-emerald-500 rounded w-1/3" />
                  <div className="h-1.5 bg-slate-700 rounded w-2/5" />
                </div>
              </div>
            </div>
            
            {/* Glare effect overlay */}
            <div 
              className="absolute pointer-events-none inset-0 bg-radial-gradient from-white to-transparent"
              style={{
                background: `radial-gradient(circle, rgba(255,255,255,${testGlare / 100}) 5%, transparent 70%)`
              }}
            />
          </div>

          {/* AI Focus bounding guide boxes */}
          <div className="absolute inset-4 border-2 border-emerald-500/20 border-dashed rounded pointer-events-none flex items-center justify-center">
            <span className="text-[6.5px] font-mono text-emerald-400/50 uppercase tracking-widest font-black bottom-1.5 absolute">Posicionar BI Aqui</span>
          </div>
        </div>

        {/* Sliders de Controlo Interativo */}
        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-[7px] font-black uppercase text-gray-400 mb-1">
              <span>Desfoque por Tremor: {testBlur}%</span>
              <span className={testBlur > 20 ? 'text-red-500' : 'text-emerald-400'}>{testBlur > 20 ? 'Desfocado' : 'Nítido'}</span>
            </div>
            <input 
              type="range"
              min="0"
              max="50"
              value={testBlur}
              onChange={(e) => setTestBlur(Number(e.target.value))}
              className="w-full accent-[#009739] bg-slate-800 h-1 rounded-full cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[7px] font-black uppercase text-gray-400 mb-1">
              <span>Reflexo de Flash: {testGlare}%</span>
              <span className={testGlare > 30 ? 'text-red-500' : 'text-emerald-400'}>{testGlare > 30 ? 'Muito Brilho' : 'Adequado'}</span>
            </div>
            <input 
              type="range"
              min="0"
              max="60"
              value={testGlare}
              onChange={(e) => setTestGlare(Number(e.target.value))}
              className="w-full accent-[#009739] bg-slate-800 h-1 rounded-full cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[7px] font-black uppercase text-gray-400 mb-1">
              <span>Ângulo de Esfregamento: {testAngle}°</span>
              <span className={Math.abs(testAngle) > 10 ? 'text-red-500' : 'text-emerald-400'}>{Math.abs(testAngle) > 10 ? 'Inclinado' : 'Alinhado'}</span>
            </div>
            <input 
              type="range"
              min="-15"
              max="15"
              value={testAngle}
              onChange={(e) => setTestAngle(Number(e.target.value))}
              className="w-full accent-[#009739] bg-slate-800 h-1 rounded-full cursor-pointer"
            />
          </div>
        </div>

        {/* Live Verdict & Diagnostics Match */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 relative">
          <div className="flex justify-between items-center">
            <span className="text-[7.5px] font-black uppercase text-gray-400">Score IA Estimado:</span>
            <span className={`text-[12px] font-extrabold font-mono tracking-tight ${
              totalScore >= 85 ? 'text-emerald-400' :
              totalScore >= 60 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {totalScore}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                totalScore >= 85 ? 'bg-emerald-500' :
                totalScore >= 60 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${totalScore}%` }}
            />
          </div>

          {/* Verdict Box */}
          <div className={`mt-2 border border-white/5 text-[8.5px] font-bold uppercase p-2.5 rounded-xl flex items-center gap-1.5 leading-none px-3 border-l-4 ${currentStatus.bg}`}>
            {React.createElement(currentStatus.icon, { size: 12, className: "shrink-0" })}
            <span className="leading-none mt-0.5">{currentStatus.text}</span>
          </div>
        </div>
      </div>

      {onSelectPhotoClick && (
        <button
          onClick={onSelectPhotoClick}
          className="w-full bg-gradient-to-r from-[#009739] to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-2xl p-4 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 border-b-4 border-emerald-800 active:border-b-0 active:translate-y-0.5 select-none"
        >
          <Camera size={14} />
          <span>Iniciar Câmara / Anexar BI</span>
        </button>
      )}

    </div>
  );
};
