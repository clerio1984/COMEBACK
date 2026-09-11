import React, { useState } from 'react';
import { Item, Category, ItemStatus } from '../types';

interface ComeBackArchitectureHubProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  onUpdateItemRewardStatus?: (itemId: string, status: 'none' | 'escrowed' | 'released', txId?: string) => void;
  escrowedItems: Record<string, { txId: string; amount: number; phone: string }>;
}

export const ComeBackArchitectureHub: React.FC<ComeBackArchitectureHubProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateItemRewardStatus,
  escrowedItems,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'mpesa' | 'marketing' | 'fraud'>('architecture');

  // M-Pesa state
  const [selectedItemId, setSelectedItemId] = useState<string>(items.filter(i => i.reward && i.reward > 0)[0]?.id || '');
  const [mpesaPhone, setMpesaPhone] = useState('841234567');
  const [paymentStep, setPaymentStep] = useState<'idle' | 'sending' | 'ussd_prompt' | 'success'>('idle');
  const [ussdPin, setUssdPin] = useState('');
  const [simulatedTxId, setSimulatedTxId] = useState('');

  // Marketing state
  const [marketingItemId, setMarketingItemId] = useState<string>(items[0]?.id || '');
  const [referralCode, setReferralCode] = useState('CB-MAPUTO-2026');
  const [copiedText, setCopiedText] = useState(false);

  // Fraud protection state
  const [biNumber, setBiNumber] = useState('110203040506M');
  const [biName, setBiName] = useState('Clérito José Tembe');
  const [verificationStep, setVerificationStep] = useState<'idle' | 'uploading' | 'ocr' | 'verified'>('idle');

  const selectedItem = items.find(i => i.id === selectedItemId);
  const marketingItem = items.find(i => i.id === marketingItemId);

  const startMpesaPayment = () => {
    if (!selectedItemId) {
      alert('Selecione um artigo com recompensa ativa para simular o pagamento.');
      return;
    }
    if (!mpesaPhone || mpesaPhone.length < 9) {
      alert('Introduza um número de telemóvel M-Pesa válido (9 dígitos).');
      return;
    }
    setPaymentStep('sending');
    setTimeout(() => {
      setPaymentStep('ussd_prompt');
    }, 2000);
  };

  const submitUssdPin = () => {
    if (ussdPin.length < 4) {
      alert('Introduza um PIN de 4 dígitos para autorizar.');
      return;
    }
    setPaymentStep('sending');
    setTimeout(() => {
      const tx = 'MP' + Math.floor(100000 + Math.random() * 900000);
      setSimulatedTxId(tx);
      setPaymentStep('success');
      if (onUpdateItemRewardStatus && selectedItem) {
        onUpdateItemRewardStatus(selectedItem.id, 'escrowed', tx);
      }
    }, 2000);
  };

  const handleReleaseEscrow = (itemId: string) => {
    const confirmRelease = window.confirm('Tem a certeza que deseja libertar os fundos custodiados para o localizador deste artigo? Esta ação transferirá a recompensa instantaneamente para o telefone do recuperador.');
    if (confirmRelease) {
      if (onUpdateItemRewardStatus) {
        onUpdateItemRewardStatus(itemId, 'released');
        alert('Recompensa enviada com sucesso ao recuperador via M-Pesa! Comissão de 7% retida pela plataforma.');
      }
    }
  };

  const handleCopyLink = () => {
    if (!marketingItem) return;
    const text = `🚨 *ComeBack Moçambique - ARTIGO ${marketingItem.status === ItemStatus.LOST ? 'PERDIDO' : marketingItem.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨

*Artigo:* ${marketingItem.title}
*Província:* ${marketingItem.province}
*Local aproximado:* ${marketingItem.location}
${marketingItem.reward ? `*Recompensa Garantida:* ${marketingItem.reward.toLocaleString()} MT (Em Custódia Segura via M-Pesa 🛡️)\n` : ''}
*Contacto Directo:* ${marketingItem.ownerPhone || 'Através do Chat Interno'}

Apoie a nossa comunidade a recuperar artigos perdidos em Moçambique! 
🔗 _Ver mais detalhes e localização no mapa:_ http://comeback.co.mz/item/${marketingItem.id}?ref=${referralCode}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleBiVerification = () => {
    if (!biNumber || biNumber.length < 13) {
      alert('Insira um número de Bilhete de Identidade válido (13 caracteres).');
      return;
    }
    setVerificationStep('uploading');
    setTimeout(() => {
      setVerificationStep('ocr');
      setTimeout(() => {
        setVerificationStep('verified');
      }, 2000);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-4">
      {/* Background overlay */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Main Container */}
      <div className="relative bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-4xl h-full sm:h-[90vh] sm:rounded-[2rem] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Flag Bar */}
        <div className="flex h-1.5 shrink-0">
          <div className="flex-1 bg-[#009739]"></div>
          <div className="flex-1 bg-black"></div>
          <div className="flex-1 bg-[#fce100]"></div>
        </div>

        {/* Header */}
        <div className="p-6 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#fce100] text-slate-950 rounded-2xl h-12 w-12 flex items-center justify-center font-bold text-2xl shadow-inner shadow-[#a49200]">
              <i className="fa-solid fa-server"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-[#009739] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Arquiteto Sênior SaaS</span>
                <span className="bg-[#d21034] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Moçambique</span>
              </div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">ComeBack SaaS System Design</h1>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Tabs Grid */}
        <div className="bg-slate-950/30 border-b border-slate-800 px-6 py-2 flex gap-1 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'architecture', label: 'Arquitetura & Diagnóstico', icon: 'fa-sitemap' },
            { id: 'mpesa', label: 'Simulador Escrow M-Pesa', icon: 'fa-wallet' },
            { id: 'marketing', label: 'Campanha WhatsApp Viral', icon: 'fa-share-nodes' },
            { id: 'fraud', label: 'Segurança & Anti-Fraude', icon: 'fa-shield-halved' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id 
                  ? 'bg-[#009739] text-white shadow-lg shadow-[#009739]/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          
          {/* TAB 1: ARCHITECTURE REPORT */}
          {activeTab === 'architecture' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Critical Critique Banner */}
              <div className="bg-red-950/40 border border-red-900/40 p-5 rounded-3xl">
                <h3 className="text-sm font-black uppercase tracking-widest text-red-400 flex items-center gap-2 mb-3">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  1. Análise Crítica do Sistema Tradicional / Limitações UX
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-slate-300 leading-relaxed">
                  <div className="space-y-2">
                    <p>
                      <strong className="text-white">Fraudes de Recompensa:</strong> Golpistas entram em contacto com quem perdeu um artigo fingindo terem-no encontrado, exigindo adiantamentos via carteira móvel antes da devolução.
                    </p>
                    <p>
                      <strong className="text-white">Anonimato de Alto Risco:</strong> Publicações directas sem validação de identidade atraem receptadores e anúncios falsos, minando a reputação da rede de localização.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p>
                      <strong className="text-white">Consumo de Dados Crítico:</strong> Apps pesadas com mapas em tempo real falham no interior do país devido ao custo de banda e latências de ligação 2G/3G móvel em África.
                    </p>
                    <p>
                      <strong className="text-white">Falta de Intermediação:</strong> Sem garantias financeiras em custódia segura, tanto o proprietário como o localizador enfrentam desconfiança na hora da entrega física do artigo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Proposed Architecture Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Architecture Bento Card 1 */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#009739]/10 border border-[#009739]/20 flex items-center justify-center text-[#009739] mb-4 text-lg">
                      <i className="fa-solid fa-gears"></i>
                    </div>
                    <h4 className="font-black text-white uppercase text-xs tracking-wider mb-2">Backend Escalável</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Infraestrutura assente em Node.js (Serviço REST/GraphQL) em Cloud Run com cache de Redis distribuído nas províncias moçambicanas para carregamento ultra-rápido.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[9px] font-black uppercase text-slate-500">
                    PostgreSQL + Firestore Hybrid
                  </div>
                </div>

                {/* Architecture Bento Card 2 */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-[#fce100]/10 border border-[#fce100]/20 flex items-center justify-center text-[#fce100] mb-4 text-lg">
                      <i className="fa-solid fa-mobile-notch"></i>
                    </div>
                    <h4 className="font-black text-white uppercase text-xs tracking-wider mb-2">PWA Mobile-First</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Aplicação Progressiva (PWA) leve, pesando menos de 2MB. Suporte offline total utilizando SQLite local IndexedDB para cachear BI e categorias essenciais.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[9px] font-black uppercase text-slate-500">
                    React + Tailwinds + Offline Sync
                  </div>
                </div>

                {/* Architecture Bento Card 3 */}
                <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-3xl flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 text-lg">
                      <i className="fa-solid fa-robot"></i>
                    </div>
                    <h4 className="font-black text-white uppercase text-xs tracking-wider mb-2">Automated Matching</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Serviço autónomo de Inteligência Artificial baseado no Gemini Pro. Sempre que um item é criado, o motor calcula o índice de semelhança semântica de imagem e texto BI.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[9px] font-black uppercase text-slate-500">
                    Gemini AI Vetor-similaridade
                  </div>
                </div>

              </div>

              {/* Complete System Spec Table */}
              <div className="bg-slate-950/20 border border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-cubes"></i>
                  Especificação Técnica e Pilha Tecnológica Integrada
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Linguagens de Serviço</span>
                      <span className="text-white font-black uppercase">TypeScript / Python</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Base de Dados Primária</span>
                      <span className="text-white font-black uppercase">Postgres + Firestore</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Mapas & Geodados</span>
                      <span className="text-white font-black uppercase">Leaflet + Mapbox API</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Mensajaria e OTP</span>
                      <span className="text-white font-black uppercase">Twilio + WhatsApp Cloud</span>
                    </div>
                  </div>
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">API de Pagamentos</span>
                      <span className="text-white font-black uppercase">C2B & B2C M-Pesa Moçambique</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Autenticação Móvel</span>
                      <span className="text-white font-black uppercase">Firebase OTP SMS Auth</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Gestor de Cache local</span>
                      <span className="text-white font-black">Redis Distributed Cache</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/60">
                      <span className="text-slate-400 font-bold">Análise e Similaridades</span>
                      <span className="text-white font-black uppercase">Google Vertex AI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Development Roadmap */}
              <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-3xl space-y-4 text-left">
                <h3 className="text-xs font-black uppercase text-[#fce100] tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-route"></i>
                  Fases do Roadmap de Expansão e Escalonamento
                </h3>
                <div className="relative border-l border-slate-800 pl-6 ml-3 space-y-6 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[30px] top-0 bg-[#009739] text-white font-black rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px]">1</span>
                    <h5 className="font-black text-white uppercase text-[11px] mb-1">Mês 1-2: Validação & MVP em Maputo</h5>
                    <p className="text-slate-400">
                      Estabilização do motor de similaridade de IA com imagens reais de BIs locais e configuração do webhook de pagamentos do sandbox M-Pesa.
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[30px] top-0 bg-[#fce100] text-slate-900 font-black rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px]">2</span>
                    <h5 className="font-black text-white uppercase text-[11px] mb-1">Mês 3-5: Canal Secundário Off-Grid USSD</h5>
                    <p className="text-slate-400">
                      Disponibilização do sistema ComeBack via código USSD móvel (Ex: <strong className="text-[#fce100]">*170#</strong>) para que pessoas sem internet/smartphones possam reportar chaves e documentos encontrados.
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[30px] top-0 bg-slate-700 text-slate-300 font-black rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px]">3</span>
                    <h5 className="font-black text-white uppercase text-[11px] mb-1">Mês 6+: Estratégia de Monetização & Expansão SADC</h5>
                    <p className="text-slate-400">
                      Taxa de comissão fixa de 7% sobre as recompensas libertadas e subscrição SaaS para consulados, seguradoras e empresas de courier parceiras de entrega segura.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: M-PESA SIMULATION PLAYGROUND */}
          {activeTab === 'mpesa' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2 mb-2">
                  <span className="bg-[#e21a22] text-white text-[10px] rounded-full h-6 w-6 flex items-center justify-center font-bold">M</span>
                  Gateway API M-Pesa Moçambique (Modelo Custódia)
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                  Para eliminar roubos e fraudes financeiras na plataforma, a ComeBack utiliza um sistema de <strong className="text-[#fce100]">Custódia Segura (Escrow)</strong>. Quando um proprietário oferece uma recompensa ao localizador, o valor é debitado via M-Pesa no ato de publicação e guardado em carteira institucional segura da ComeBack. O dinheiro só é transferido ao localizador após validação facial ou inserção mútua de códigos secretos.
                </p>

                {/* Simulation Form Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Form inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">1. Selecionar Artigo para Garantir Recompensa</label>
                      <select 
                        className="w-full bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none"
                        value={selectedItemId}
                        onChange={(e) => {
                          setSelectedItemId(e.target.value);
                          setPaymentStep('idle');
                        }}
                      >
                        <option value="">-- Escolha um artigo --</option>
                        {items.filter(i => i.reward && i.reward > 0).map(i => (
                          <option key={i.id} value={i.id}>
                            {i.title} ({i.reward?.toLocaleString()} MT)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">2. Número de Telemóvel M-Pesa do Proprietário</label>
                      <div className="flex gap-2">
                        <span className="bg-slate-800 rounded-2xl flex items-center justify-center px-4 text-xs font-bold text-slate-300 border-2 border-slate-700">+258</span>
                        <input 
                          type="number" 
                          placeholder="Ex: 84XXXXXXX ou 85XXXXXXX"
                          className="flex-1 bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    {selectedItem && selectedItem.reward && (
                      <div className="bg-slate-950/20 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                        <div className="flex justify-between font-bold">
                          <span>Recompensa Anunciada:</span>
                          <span className="text-white">{selectedItem.reward.toLocaleString()} MT</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Comissão Intermediação (7%):</span>
                          <span>- {(selectedItem.reward * 0.07).toLocaleString()} MT</span>
                        </div>
                        <div className="flex justify-between font-black text-[#fce100] pt-2 border-t border-slate-800/60">
                          <span>A Receber pelo Finder:</span>
                          <span>{(selectedItem.reward * 0.93).toLocaleString()} MT</span>
                        </div>
                      </div>
                    )}

                    {paymentStep === 'idle' && (
                      <button 
                        onClick={startMpesaPayment}
                        className="w-full bg-[#009739] hover:bg-[#008230] text-white py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md transition-all flex items-center justify-center gap-2 border-b-4 border-[#006e28]"
                      >
                        <i className="fa-solid fa-circle-play"></i>
                        <span>Iniciar Pagamento M-Pesa</span>
                      </button>
                    )}
                  </div>

                  {/* Phone Mockup Screen */}
                  <div className="bg-slate-950 rounded-[2.5rem] p-6 border-8 border-slate-800 shadow-xl relative min-h-[300px] flex flex-col justify-between overflow-hidden">
                    {/* Speaker and camera */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-full flex justify-around p-1">
                      <div className="w-1.5 h-1.5 bg-slate-900 rounded-full"></div>
                      <div className="w-6 h-1 bg-slate-900 rounded-full"></div>
                    </div>

                    <div className="h-full flex flex-col justify-between pt-6 text-center">
                      <div className="text-[10px] font-black tracking-widest text-[#009739] uppercase">M-PESA CORE EMULATOR</div>
                      
                      {/* State: Idle */}
                      {paymentStep === 'idle' && (
                        <div className="my-auto space-y-2">
                          <i className="fa-solid fa-mobile text-5xl text-slate-700 animate-pulse"></i>
                          <p className="text-xs text-slate-400 font-bold px-4">Aguardando gatilho de transação do app ComeBack...</p>
                        </div>
                      )}

                      {/* State: Sending PUSH API */}
                      {paymentStep === 'sending' && (
                        <div className="my-auto space-y-4">
                          <div className="relative w-14 h-14 border-4 border-slate-800 border-t-[#009739] rounded-full animate-spin mx-auto"></div>
                          <p className="text-xs text-[#009739] font-black uppercase tracking-wider animate-pulse">A enviar PUSH para o telemóvel...</p>
                        </div>
                      )}

                      {/* State: USSD PIN Prompt */}
                      {paymentStep === 'ussd_prompt' && (
                        <div className="my-auto bg-white text-slate-950 p-5 rounded-3xl text-left border-2 border-slate-200 animate-in zoom-in-95 font-sans shadow-md">
                          <h4 className="text-xs font-black text-[#e21a22] uppercase tracking-wide mb-1">M-Pesa Moçambique</h4>
                          <p className="text-xs font-medium text-slate-700 mb-4">
                            Gostarias de autorizar o envio de <strong className="text-black">{selectedItem?.reward?.toLocaleString()} MT</strong> para ComeBack Serviços de Custódia? Introduza o seu PIN:
                          </p>
                          <input 
                            type="password" 
                            placeholder="PIN M-Pesa"
                            maxLength={4}
                            className="w-full border-2 border-slate-300 rounded-xl p-2.5 text-center font-bold outline-none text-slate-900 text-lg mb-4"
                            value={ussdPin}
                            onChange={(e) => setUssdPin(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setPaymentStep('idle')}
                              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-center"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={submitUssdPin}
                              className="flex-1 bg-[#009739] hover:bg-[#008230] text-white p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-center"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* State: Succesful Deposit */}
                      {paymentStep === 'success' && (
                        <div className="my-auto space-y-4 text-center animate-in zoom-in-95">
                          <div className="w-16 h-16 bg-[#009739] text-white rounded-full flex items-center justify-center mx-auto text-3xl border-4 border-slate-800 shadow-lg">
                            <i className="fa-solid fa-circle-check"></i>
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-[#009739] uppercase tracking-widest">DEPÓSITO GARANTIDO</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">ID Transação: {simulatedTxId}</p>
                          </div>
                          <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-left max-w-xs mx-auto">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400 font-bold">Estado:</span>
                              <span className="text-[#009739] font-black uppercase">CUSTODIADO</span>
                            </div>
                            <div className="flex justify-between text-[10px] mt-1">
                              <span className="text-slate-400 font-bold">Saldo sob Escrow:</span>
                              <span className="text-white font-black">{selectedItem?.reward?.toLocaleString()} MT</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="text-[7.5px] text-slate-500 font-semibold px-4 pb-2">Simulação de integração oficial da API C2B Vodacom M-Pesa Moçambique.</div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Verified Escrows list */}
              <div className="bg-slate-950/20 border border-slate-800 p-6 rounded-3xl space-y-4">
                <h3 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-wallet"></i>
                  Valores Atualmente em Custódia de Segurança (Escrow Activos)
                </h3>
                {Object.keys(escrowedItems).length === 0 ? (
                  <div className="text-xs font-bold text-slate-500 py-4 text-center uppercase tracking-wider">
                    Não existem recompensas sob custódia no momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(escrowedItems).map(([id, info]) => {
                      const itemObj = items.find(i => i.id === id);
                      const escrowInfo = info as { txId: string; amount: number; phone: string };
                      return (
                        <div key={id} className="bg-slate-950/50 border border-[#009739]/30 p-4.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-[#009739]/10 rounded-xl">
                              <i className="fa-solid fa-shield text-[#009739]"></i>
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-slate-400 uppercase">Artigo: {itemObj?.title}</div>
                              <div className="text-[11px] font-medium text-slate-300 mt-0.5">Telemóvel Depositante: +258 {escrowInfo.phone}</div>
                              <div className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase">ID Transação: <span className="font-mono">{escrowInfo.txId}</span></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t border-slate-800/60 sm:border-0 pt-3 sm:pt-0">
                            <div className="text-right">
                              <div className="text-[9px] font-black text-slate-400 uppercase">Valores em Custódia</div>
                              <div className="text-sm font-black text-[#009739]">{escrowInfo.amount.toLocaleString()} MT</div>
                            </div>
                            <button
                              onClick={() => handleReleaseEscrow(id)}
                              className="bg-[#009739] hover:bg-[#008f35] text-white p-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                            >
                              Liberar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VIRAL MARKETING */}
          {activeTab === 'marketing' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-[#25d366]/10 text-[#25d366] rounded-xl h-10 w-10 flex items-center justify-center text-xl border border-[#25d366]/20">
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">
                    Gerador de Cartazes de Divulgação WhatsApp & SMS Viral
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                  Para potenciar o crescimento viral da ComeBack Moçambique sem depender de infraestruturas caras de anúncios pagos, os próprios utilizadores são os agentes promotores. Esta ferramenta gera mensagens perfeitamente estruturadas para WhatsApp e grupos locais de bairros do Facebook, contendo emojis de impacto, detalhes cruciais e códigos de indicação para rastreio de referência (referral system) que geram pontos e descontos em entregas futuras.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Selecionar Anúncio de Artigo</label>
                      <select 
                        className="w-full bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none"
                        value={marketingItemId}
                        onChange={(e) => setMarketingItemId(e.target.value)}
                      >
                        {items.map(i => (
                          <option key={i.id} value={i.id}>
                            [{i.status === ItemStatus.LOST ? 'PERDIDO' : i.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}] {i.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 font-bold text-slate-300">Código de Indicação (Referral Code)</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none uppercase"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                      />
                    </div>

                    <button 
                      onClick={handleCopyLink}
                      className="w-full bg-[#25d366] hover:bg-[#20bd5a] text-slate-950 py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md transition-all flex items-center justify-center gap-2 border-b-4 border-[#189b48]"
                    >
                      <i className="fa-solid fa-copy"></i>
                      <span>{copiedText ? 'Copiado para Clipboard!' : 'Gerar e Copiar Texto'}</span>
                    </button>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 relative">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Visualização da Mensagem</span>
                      <span className="text-[8px] bg-[#25d366]/10 text-[#25d366] font-bold px-2 py-0.5 rounded-full uppercase">Pronto a Copiar</span>
                    </div>

                    {marketingItem ? (
                      <div className="space-y-3 text-left">
                        {/* Thumbnail do Artigo de Marketing */}
                        {marketingItem.imageUrls && marketingItem.imageUrls.length > 0 ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow h-28 bg-slate-900/50 flex items-center justify-center group">
                            <img 
                              src={marketingItem.imageUrls[0]} 
                              alt="Marketing Article Thumbnail" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-2 left-2 bg-[#25d366]/90 text-slate-950 text-[7px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                              <i className="fa-solid fa-camera"></i>
                              <span>Thumbnail Encontrada</span>
                            </div>
                          </div>
                        ) : marketingItem.imageUrl ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow h-28 bg-slate-900/50 flex items-center justify-center group">
                            <img 
                              src={marketingItem.imageUrl} 
                              alt="Marketing Article Thumbnail" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-2 left-2 bg-[#25d366]/90 text-slate-950 text-[7px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                              <i className="fa-solid fa-camera"></i>
                              <span>Thumbnail Encontrada</span>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-slate-800 rounded-2xl p-4 text-center text-[10px] text-slate-500 font-bold uppercase">
                            <i className="fa-solid fa-image text-xs mb-1 block text-slate-600"></i>
                            Sem Foto de Thumbnail
                          </div>
                        )}

                        <div className="bg-[#0b141a] text-[#e9edef] rounded-2xl p-4 text-[11px] font-sans whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto no-scrollbar border border-slate-850">
                          🚨 *ComeBack Moçambique - ARTIGO {marketingItem.status === ItemStatus.LOST ? 'PERDIDO' : marketingItem.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨

*Artigo:* {marketingItem.title}
*Província:* {marketingItem.province}
*Local aproximado:* {marketingItem.location}
{marketingItem.reward ? `*Recompensa Garantida:* ${marketingItem.reward.toLocaleString()} MT (Em Custódia Segura via M-Pesa 🛡️)\n` : ''}
*Contacto Directo:* {marketingItem.ownerPhone || 'Através do Chat Interno'}

Apoie a nossa comunidade a recuperar artigos perdidos em Moçambique! 
🔗 _Ver mais detalhes e localização no mapa:_ http://comeback.co.mz/item/{marketingItem.id}?ref={referralCode}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center font-bold text-slate-500 py-12">Por favor, carregue um item acima para testar.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SAFETY AND ANTI-FRAUD */}
          {activeTab === 'fraud' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-slate-950/40 p-6 rounded-3xl border border-slate-800">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2 mb-2">
                  <i className="fa-solid fa-fingerprint text-[#009739]"></i>
                  Verificador de Identidade Moçambicano (DIRE / BI) via AI OCR
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
                  Para banir burladores que criam perfis temporários descartáveis para realizar chantagens financeiras, a ComeBack exige ativação de <strong className="text-white">Identidade Verificada</strong> para utilizadores que declarem recompensas superiores a 2000 MT ou que reportem itens de elevado valor comercial. A AI do sistema realiza análise OCR facial no Bilhete de Identidade (BI) cruzando os dados governamentais automaticamente.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Numeração do BI Moçambicano</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none"
                        value={biNumber}
                        onChange={(e) => setBiNumber(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Nome Completo (Conforme no Documento)</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-850 border-2 border-slate-700 focus:border-[#009739] rounded-2xl p-3.5 text-xs text-white font-bold outline-none"
                        value={biName}
                        onChange={(e) => setBiName(e.target.value)}
                      />
                    </div>

                    {verificationStep === 'idle' && (
                      <button 
                        onClick={handleBiVerification}
                        className="w-full bg-black hover:bg-slate-950 text-[#fce100] border border-[#fce100]/20 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-scan"></i>
                        <span>Iniciar Validação Digital por AI</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[220px]">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Terminal de Validação AI CID</span>
                      <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase ${
                        verificationStep === 'verified' ? 'bg-[#009739]/10 text-[#009739]' : 'bg-amber-500/10 text-amber-500 animate-pulse'
                      }`}>
                        {verificationStep === 'idle' ? 'STANDBY' : verificationStep === 'uploading' ? 'UPLOADING' : verificationStep === 'ocr' ? 'OCR RETRIEVING' : 'VERIFICADO'}
                      </span>
                    </div>

                    {verificationStep === 'idle' && (
                      <div className="my-auto text-center py-6 space-y-2">
                        <i className="fa-solid fa-id-card text-5xl text-slate-700"></i>
                        <p className="text-[11px] text-slate-500 font-bold uppercase">Aguardando dados de identificação...</p>
                      </div>
                    )}

                    {verificationStep === 'uploading' && (
                      <div className="my-auto text-center py-4 space-y-3.5">
                        <div className="relative w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                        <p className="text-[11px] text-indigo-400 font-bold uppercase animate-pulse">A encriptar e enviar imagem do documento...</p>
                      </div>
                    )}

                    {verificationStep === 'ocr' && (
                      <div className="my-auto text-center py-4 space-y-3.5">
                        <div className="relative w-12 h-12 border-4 border-slate-800 border-t-[#fce100] rounded-full animate-spin mx-auto"></div>
                        <p className="text-[11px] text-[#fce100] font-bold uppercase animate-pulse">Cruzando dados com Direcção de Identificação Civil...</p>
                      </div>
                    )}

                    {verificationStep === 'verified' && (
                      <div className="my-auto space-y-3.5 animate-in zoom-in-95 text-center">
                        <div className="w-14 h-14 bg-[#009739] text-white rounded-full flex items-center justify-center mx-auto text-2xl border-4 border-slate-800 shadow-lg">
                          <i className="fa-solid fa-user-check"></i>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#009739] uppercase tracking-wide">ID VERIFICADO COM SUCESSO</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Nome no BI: {biName}</p>
                          <p className="text-[9px] text-[#fce100] font-black uppercase mt-0.5">Rating Conta: ★ 5.0 • Excelente</p>
                        </div>
                      </div>
                    )}

                    <div className="text-[7.5px] text-slate-500 font-semibold text-center border-t border-slate-850 pt-2 shrink-0">Dados de cidadania fiscalizados em conformidade com as diretivas de proteção cibernética de Moçambique.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info showing security status */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center shrink-0 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-3">
          <p className="font-bold uppercase tracking-wider">
            Souto Digital Serviços Lda. • © ComeBack 2026
          </p>
          <div className="flex gap-4 font-black uppercase text-slate-400">
            <span className="flex items-center gap-1"><i className="fa-solid fa-lock text-[#009739]"></i> SSL SECURE</span>
            <span className="flex items-center gap-1"><i className="fa-solid fa-server"></i> AWS AFRICA NODE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
