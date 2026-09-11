import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';

export interface SketchData {
  hairStyleId: string;
  bodyStyleId: string;
  skinColorId: string;
  accessoryId: string;
}

interface VisualPortraitBuilderProps {
  value?: SketchData;
  onChange: (data: SketchData) => void;
  readOnly?: boolean;
}

export const SKIN_COLORS = [
  { id: 'skin_light', label: 'Pele Clara', labelEn: 'Light Skin', value: '#ffd1a4', stroke: '#d4a373' },
  { id: 'skin_tan', label: 'Pele Mulata / Médio', labelEn: 'Tan Skin', value: '#d8a070', stroke: '#ac7343' },
  { id: 'skin_brown', label: 'Pele Castanha', labelEn: 'Brown Skin', value: '#8d5c36', stroke: '#613c20' },
  { id: 'skin_deep_black', label: 'Pele Preta', labelEn: 'Deep Dark Skin', value: '#4a2f1b', stroke: '#2e190e' }
];

export const HAIR_STYLES = [
  { id: 'hair_bald', label: 'Careca / Sem Cabelo', labelEn: 'Bald / No Hair', icon: 'fa-user' },
  { id: 'hair_short', label: 'Corte Curto / Crespo', labelEn: 'Short Hair / Buzz', icon: 'fa-grip-lines' },
  { id: 'hair_afro', label: 'Corte Afro Redondo', labelEn: 'Puffy Afro', icon: 'fa-cloud' },
  { id: 'hair_dreads', label: 'Dreadlocks / Tranças', labelEn: 'Dail Dreadlocks', icon: 'fa-bars' },
  { id: 'hair_straight', label: 'Cabelo Comprido', labelEn: 'Long Straight Hair', icon: 'fa-user-tie' },
  { id: 'hair_cap', label: 'Boné de Desporto Estilo', labelEn: 'Sports Cap / Hat', icon: 'fa-hat-cowboy' }
];

export const BODY_STYLES = [
  { id: 'body_tshirt_blue', label: 'T-Shirt Azul', labelEn: 'Blue T-Shirt', color: '#1e40af', type: 'tshirt' },
  { id: 'body_tshirt_red', label: 'T-Shirt Vermelha', labelEn: 'Red T-Shirt', color: '#b91c1c', type: 'tshirt' },
  { id: 'body_tshirt_green', label: 'T-Shirt Verde', labelEn: 'Green T-Shirt', color: '#065f46', type: 'tshirt' },
  { id: 'body_tshirt_yellow', label: 'T-Shirt Amarela', labelEn: 'Yellow T-Shirt', color: '#eab308', type: 'tshirt' },
  { id: 'body_suit', label: 'Fato Formal com Gravata', labelEn: 'Formal Suit & Tie', color: '#0f172a', type: 'suit' }
];

export const ACCESSORIES = [
  { id: 'acc_none', label: 'Sem Acessórios', labelEn: 'No Accessories', icon: 'fa-ban' },
  { id: 'acc_glasses', label: 'Óculos de Vista Pretos', labelEn: 'Reading Glasses', icon: 'fa-glasses' },
  { id: 'acc_beard', label: 'Barba e Bigode', labelEn: 'Beard / Mustache', icon: 'fa-user-tie' },
  { id: 'acc_mask', label: 'Máscara Facial Protetora', labelEn: 'Medical Face Mask', icon: 'fa-mask' }
];

export const VisualPortraitBuilder: React.FC<VisualPortraitBuilderProps> = ({
  value = {
    hairStyleId: 'hair_short',
    bodyStyleId: 'body_tshirt_blue',
    skinColorId: 'skin_tan',
    accessoryId: 'acc_none'
  },
  onChange,
  readOnly = false
}) => {
  const { language, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<'skin' | 'hair' | 'body' | 'accessory'>('skin');
  const [isDragOver, setIsDragOver] = useState(false);

  const getSkinObj = () => SKIN_COLORS.find(s => s.id === value.skinColorId) || SKIN_COLORS[1];
  const getHairObj = () => HAIR_STYLES.find(h => h.id === value.hairStyleId) || HAIR_STYLES[1];
  const getBodyObj = () => BODY_STYLES.find(b => b.id === value.bodyStyleId) || BODY_STYLES[0];
  const getAccObj = () => ACCESSORIES.find(a => a.id === value.accessoryId) || ACCESSORIES[0];

  // Drag and Drop handlers for choices
  const handleDragStart = (e: React.DragEvent, type: string, id: string) => {
    if (readOnly) return;
    e.dataTransfer.setData('text/plain', `${type}:${id}`);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    
    const [type, id] = data.split(':');
    if (type && id) {
      updateSketchField(type, id);
    }
  };

  const updateSketchField = (type: string, id: string) => {
    const updated = { ...value };
    if (type === 'skin') updated.skinColorId = id;
    if (type === 'hair') updated.hairStyleId = id;
    if (type === 'body') updated.bodyStyleId = id;
    if (type === 'accessory') updated.accessoryId = id;
    onChange(updated);
  };

  const handleReset = () => {
    onChange({
      hairStyleId: 'hair_short',
      bodyStyleId: 'body_tshirt_blue',
      skinColorId: 'skin_tan',
      accessoryId: 'acc_none'
    });
  };

  const currentSkin = getSkinObj();
  const currentBody = getBodyObj();

  return (
    <div className="flex flex-col gap-5 bg-gray-50/50 dark:bg-slate-900/60 p-4 rounded-3xl border border-gray-150 dark:border-slate-800 transition-all select-none">
      <div className="flex flex-col md:flex-row gap-5 items-stretch">
        
        {/* Renderizador de Retrato Centrado / Dropzone */}
        <div className="flex flex-col items-center justify-center flex-1 min-w-[240px] max-w-sm mx-auto">
          <div 
            id="portrait-dropzone"
            onDragOver={(e) => {
              if (readOnly) return;
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`relative w-48 h-48 sm:w-56 sm:h-56 bg-white dark:bg-slate-950 rounded-3xl overflow-hidden border-3 shadow-md flex items-center justify-center transition-all ${
              isDragOver ? 'border-[#009739] scale-102 bg-emerald-50/10' : 'border-gray-200 dark:border-slate-800'
            }`}
          >
            {/* Visual Portrait SVG Construction */}
            <svg viewBox="0 0 200 200" className="w-full h-full select-none pointer-events-none">
              {/* Background gradient shadow */}
              <defs>
                <radialGradient id="shadowGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="100" cy="180" rx="60" ry="15" fill="url(#shadowGlow)" />

              {/* LAYER 1: Body/Shoulders (Corpo e Roupa) */}
              {currentBody.type === 'suit' ? (
                // Formal Suit
                <g>
                  {/* Suit Base */}
                  <path d="M50 190 C 50 145, 150 145, 150 190 Z" fill={currentBody.color} />
                  {/* Innert White Shirt */}
                  <path d="M85 145 L 115 145 L 100 170 Z" fill="#ffffff" />
                  {/* Red Tie */}
                  <path d="M96 155 L 104 155 L 106 185 L 100 192 L 94 185 Z" fill="#d21034" />
                  {/* Collar details */}
                  <path d="M 85 145 L 97 158 L 97 145 Z" fill="#e2e8f0" />
                  <path d="M 115 145 L 103 158 L 103 145 Z" fill="#e2e8f0" />
                </g>
              ) : (
                // Colored Casual T-Shirt
                <g>
                  {/* Body base (Shoulders) */}
                  <path d="M55 190 C 55 150, 145 150, 145 190 Z" fill={currentBody.color} />
                  {/* Neck Hole */}
                  <path d="M 82 153 C 82 153, 100 168, 118 153 C 118 153, 100 151, 82 153" fill={currentSkin.value} />
                  {/* Collar outline */}
                  <path d="M 82 153 C 90 166, 110 166, 118 153" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              )}

              {/* LAYER 2: Neck (Pescoço) */}
              <rect x="88" y="125" width="24" height="28" rx="5" fill={currentSkin.value} stroke={currentSkin.stroke} strokeWidth="1" />

              {/* LAYER 3: Head representation (Cabeça) */}
              <ellipse cx="100" cy="98" rx="36" ry="43" fill={currentSkin.value} stroke={currentSkin.stroke} strokeWidth="2" />
              {/* Ears */}
              <circle cx="61" cy="98" r="7" fill={currentSkin.value} stroke={currentSkin.stroke} strokeWidth="1" />
              <circle cx="139" cy="98" r="7" fill={currentSkin.value} stroke={currentSkin.stroke} strokeWidth="1" />
              <circle cx="61" cy="98" r="3" fill={currentSkin.stroke} opacity="0.3" />
              <circle cx="139" cy="98" r="3" fill={currentSkin.stroke} opacity="0.3" />

              {/* LAYER 4: Face details (Olhos, Sobrancelhas, Nariz, Boca) */}
              {/* Eyes */}
              <ellipse cx="86" cy="94" rx="4.5" ry="3.5" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" />
              <circle cx="86" cy="94" r="2" fill="#0f172a" />
              <ellipse cx="114" cy="94" rx="4.5" ry="3.5" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" />
              <circle cx="114" cy="94" r="2" fill="#0f172a" />
              {/* Eyebrows */}
              <path d="M 78 87 Q 86 83 93 88" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
              <path d="M 122 87 Q 114 83 107 88" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
              {/* Nose */}
              <path d="M 98 94 Q 100 109 104 108" fill="none" stroke={currentSkin.stroke} strokeWidth="2.5" strokeLinecap="round" />
              {/* Friendly smile */}
              <path d="M 87 118 Q 100 128 113 118" fill="none" stroke="#991b1b" strokeWidth="2.5" strokeLinecap="round" />

              {/* LAYER 5: Hair cuts on top */}
              {value.hairStyleId === 'hair_short' && (
                <path d="M 64 80 Q 100 56 136 80 Q 140 73 131 66 Q 100 48 69 66 Q 60 73 64 80" fill="#1e293b" />
              )}
              {value.hairStyleId === 'hair_afro' && (
                <g fill="#1a1a1a">
                  {/* Fluffy rounded curly cloud */}
                  <circle cx="100" cy="55" r="27" />
                  <circle cx="82" cy="62" r="24" />
                  <circle cx="118" cy="62" r="24" />
                  <circle cx="68" cy="78" r="22" />
                  <circle cx="132" cy="78" r="22" />
                </g>
              )}
              {value.hairStyleId === 'hair_dreads' && (
                <g fill="#241a15" stroke="#100b08" strokeWidth="1">
                  {/* Top knots */}
                  <circle cx="100" cy="52" r="14" />
                  {/* Dread strands laying to the side */}
                  <rect x="62" y="72" width="6" height="55" rx="3" transform="rotate(10 62 72)" />
                  <rect x="54" y="80" width="6" height="45" rx="3" transform="rotate(5 54 80)" />
                  <rect x="132" y="72" width="6" height="55" rx="3" transform="rotate(-10 132 72)" />
                  <rect x="140" y="80" width="6" height="45" rx="3" transform="rotate(-5 140 80)" />
                  <rect x="76" y="58" width="8" height="24" rx="4" />
                  <rect x="116" y="58" width="8" height="24" rx="4" />
                </g>
              )}
              {value.hairStyleId === 'hair_straight' && (
                <g fill="#1a1310">
                  {/* Straight long hair framing face */}
                  <path d="M 64 80 Q 100 48 136 80 L 138 140 L 128 140 L 126 82 L 74 82 L 72 140 L 62 140 Z" />
                </g>
              )}
              {value.hairStyleId === 'hair_cap' && (
                <g>
                  {/* Cap dome */}
                  <path d="M 64 78 Q 100 40 136 78 Z" fill="#d21034" />
                  {/* Visor */}
                  <path d="M 60 78 Q 100 70 140 78 C 145 83, 137 84, 100 84 C 63 84, 55 83, 60 78" fill="#fce100" />
                  {/* Cap button top */}
                  <circle cx="100" cy="42" r="3.5" fill="#fce100" />
                </g>
              )}

              {/* LAYER 6: Accessories Overlay */}
              {value.accessoryId === 'acc_glasses' && (
                <g stroke="#0f172a" strokeWidth="3" fill="none">
                  {/* Left frame */}
                  <rect x="73" y="87" width="22" height="15" rx="3.5" stroke="#000000" strokeWidth="2.5" />
                  {/* Right frame */}
                  <rect x="105" y="87" width="22" height="15" rx="3.5" stroke="#000000" strokeWidth="2.5" />
                  {/* Center bridge */}
                  <path d="M 95 94 L 105 94" stroke="#000000" strokeWidth="3" />
                  {/* Temple arms */}
                  <path d="M 61 93 L 73 91" stroke="#000000" strokeWidth="2" />
                  <path d="M 127 91 L 139 93" stroke="#000000" strokeWidth="2" />
                </g>
              )}
              {value.accessoryId === 'acc_beard' && (
                <g fill="#111827" opacity="0.95">
                  {/* Mustache */}
                  <path d="M 85 110 C 92 108, 97 111, 100 114 C 103 111, 108 108, 115 110 C 110 114, 98 114, 85 110 Z" />
                  {/* Chin Beard */}
                  <path d="M 75 118 Q 100 148 125 118 Q 115 138 100 138 Q 85 138 75 118" />
                </g>
              )}
              {value.accessoryId === 'acc_mask' && (
                <g>
                  {/* Surgical Sanitizing Mask */}
                  <path d="M 74 112 Q 100 102 126 112 L 120 136 Q 100 148 80 136 Z" fill="#bae6fd" stroke="#0284c7" strokeWidth="1" />
                  {/* Mask folds */}
                  <line x1="80" y1="118" x2="120" y2="118" stroke="#38bdf8" strokeWidth="1.5" />
                  <line x1="82" y1="126" x2="118" y2="126" stroke="#38bdf8" strokeWidth="1.5" />
                  {/* Elastic straps */}
                  <path d="M 74 112 L 61 98" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  <path d="M 80 136 L 61 106" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  <path d="M 126 112 L 139 98" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                  <path d="M 120 136 L 139 106" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </g>
              )}
            </svg>

            {/* Hint overlay */}
            {!readOnly && (
              <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 backdrop-blur-xs py-1.5 px-3 text-center text-[8px] font-black uppercase text-[#fce100] tracking-wider select-none">
                <i className="fa-solid fa-hand-holding-hand mr-1 animate-bounce"></i>
                {t('Arraste ou clique')}
              </div>
            )}
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={handleReset}
              className="mt-3.5 bg-gray-200 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-950/40 text-gray-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all hover:shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrow-rotate-left text-[10px]"></i>
              {t('Limpar Retrato')}
            </button>
          )}
        </div>

        {/* Categories Controls and Drag Selection List */}
        {!readOnly && (
          <div className="flex-2 flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-150 dark:border-slate-800/80 pt-4 md:pt-0 md:pl-5">
            {/* Category selection bar */}
            <div className="flex rounded-xl bg-gray-200/60 dark:bg-slate-950/60 p-1 mb-3 justify-between items-center text-[10px]">
              <button
                type="button"
                onClick={() => setActiveCategory('skin')}
                className={`flex-1 py-1 px-1 rounded-lg font-black uppercase text-center transition-all ${
                  activeCategory === 'skin' ? 'bg-[#009739] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {t('Pele')}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('hair')}
                className={`flex-1 py-1 px-1 rounded-lg font-black uppercase text-center transition-all ${
                  activeCategory === 'hair' ? 'bg-[#009739] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {t('Cabelo')}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('body')}
                className={`flex-1 py-1 px-1 rounded-lg font-black uppercase text-center transition-all ${
                  activeCategory === 'body' ? 'bg-[#009739] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {t('Corpo / Postura')}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('accessory')}
                className={`flex-1 py-1 px-1 rounded-lg font-black uppercase text-center transition-all ${
                  activeCategory === 'accessory' ? 'bg-[#009739] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {t('Acessórios')}
              </button>
            </div>

            {/* Dynamic Items Slider / List */}
            <p className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2 select-none">
              <i className="fa-solid fa-circle-info text-[#009739] mr-1.5"></i>
              {t('Arraste ou clique para selecionar as características e montar o retrato falado:')}
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {/* RENDERING SKIN OPTIONS */}
              {activeCategory === 'skin' && SKIN_COLORS.map(option => (
                <div
                  key={option.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'skin', option.id)}
                  onClick={() => updateSketchField('skin', option.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing hover:shadow-xs hover:border-[#009739]/50 ${
                    value.skinColorId === option.id 
                      ? 'border-[#009739] bg-[#009739]/5 dark:bg-[#009739]/10' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/65'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: option.value }} />
                  <span className="text-[10px] font-bold text-gray-800 dark:text-slate-300">
                    {language === 'en' ? option.labelEn : option.label}
                  </span>
                </div>
              ))}

              {/* RENDERING HAIR OPTIONS */}
              {activeCategory === 'hair' && HAIR_STYLES.map(option => (
                <div
                  key={option.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'hair', option.id)}
                  onClick={() => updateSketchField('hair', option.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing hover:shadow-xs hover:border-[#009739]/50 ${
                    value.hairStyleId === option.id 
                      ? 'border-[#009739] bg-[#009739]/5 dark:bg-[#009739]/10' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/65'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-400">
                    <i className={`fa-solid ${option.icon} text-xs`}></i>
                  </div>
                  <span className="text-[10px] font-bold text-gray-800 dark:text-slate-300">
                    {language === 'en' ? option.labelEn : option.label}
                  </span>
                </div>
              ))}

              {/* RENDERING BODY STYLE OPTIONS */}
              {activeCategory === 'body' && BODY_STYLES.map(option => (
                <div
                  key={option.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'body', option.id)}
                  onClick={() => updateSketchField('body', option.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing hover:shadow-xs hover:border-[#009739]/50 ${
                    value.bodyStyleId === option.id 
                      ? 'border-[#009739] bg-[#009739]/5 dark:bg-[#009739]/10' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/65'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0" style={{ backgroundColor: option.color }}>
                    <i className="fa-solid fa-shirt text-[9px] text-white"></i>
                  </div>
                  <span className="text-[10px] font-bold text-gray-800 dark:text-slate-300 truncate">
                    {language === 'en' ? option.labelEn : option.label}
                  </span>
                </div>
              ))}

              {/* RENDERING ACCESSORY OPTIONS */}
              {activeCategory === 'accessory' && ACCESSORIES.map(option => (
                <div
                  key={option.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'accessory', option.id)}
                  onClick={() => updateSketchField('accessory', option.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing hover:shadow-xs hover:border-[#009739]/50 ${
                    value.accessoryId === option.id 
                      ? 'border-[#009739] bg-[#009739]/5 dark:bg-[#009739]/10' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950/65'
                  }`}
                >
                  <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-400">
                    <i className={`fa-solid ${option.icon} text-xs`}></i>
                  </div>
                  <span className="text-[10px] font-bold text-gray-800 dark:text-slate-300">
                    {language === 'en' ? option.labelEn : option.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Presets Row to make it incredibly friendly */}
            <div className="mt-3.5 pt-3 border-t border-gray-150 dark:border-slate-800 flex flex-wrap gap-1.5 items-center">
              <span className="text-[8.5px] font-black uppercase text-gray-400 tracking-wide mr-1 select-none">Presets:</span>
              <button
                type="button"
                onClick={() => onChange({
                  hairStyleId: 'hair_short',
                  bodyStyleId: 'body_tshirt_blue',
                  skinColorId: 'skin_tan',
                  accessoryId: 'acc_none'
                })}
                className="bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[8.5px] font-bold uppercase transition"
              >
                👦 Jovem Pardo
              </button>
              <button
                type="button"
                onClick={() => onChange({
                  hairStyleId: 'hair_afro',
                  bodyStyleId: 'body_tshirt_red',
                  skinColorId: 'skin_deep_black',
                  accessoryId: 'acc_beard'
                })}
                className="bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[8.5px] font-bold uppercase transition"
              >
                🧔 Afro com Barba
              </button>
              <button
                type="button"
                onClick={() => onChange({
                  hairStyleId: 'hair_straight',
                  bodyStyleId: 'body_suit',
                  skinColorId: 'skin_light',
                  accessoryId: 'acc_glasses'
                })}
                className="bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-[8.5px] font-bold uppercase transition"
              >
                👓 Executivo
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
