
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item, Message, ItemStatus } from '../types';
import { compressImage } from '../services/imageUtils';
import { useAuth } from '../AuthContext';
import { db } from '../services/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { analyzeMessage, SafetyAnalysisResult } from '../services/safetyAnalyzer';
import { MediaViewer } from './MediaViewer';

interface ChatViewProps {
  item: Item;
  messages: Message[];
  onSendMessage: (text: string, type?: 'text' | 'image' | 'location', mediaUrl?: string, coords?: { lat: number; lng: number }) => void;
  onBack: () => void;
  notificationCount: number;
  isTracking?: boolean;
  onStartTracking?: (location: string, coords?: { lat: number, lng: number }) => void;
  onStopTracking?: () => void;
  onFinishDelivery?: () => void;
  onViewTracking?: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ 
  item, 
  messages, 
  onSendMessage, 
  onBack, 
  notificationCount,
  isTracking,
  onStartTracking,
  onStopTracking,
  onFinishDelivery,
  onViewTracking
}) => {
  const { currentUser } = useAuth();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isSettingLocation, setIsSettingLocation] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Real-time conversation message safety analysis
  const analyzedMessages = useMemo(() => {
    return messages.map(msg => ({
      ...msg,
      safety: msg.type === 'text' ? analyzeMessage(msg.text) : { hasDanger: false, isFraud: false, isAggressive: false, detectedTerms: [], explanation: "" }
    }));
  }, [messages]);

  // Overall chat safety summary
  const chatSafetyStatus = useMemo(() => {
    let hasFraud = false;
    let hasAggressive = false;
    let explanation = "";
    const detectedTerms: string[] = [];

    for (const msg of analyzedMessages) {
      if (msg.safety.isFraud) {
        hasFraud = true;
        detectedTerms.push(...msg.safety.detectedTerms);
        if (!explanation) explanation = msg.safety.explanation;
      }
      if (msg.safety.isAggressive) {
        hasAggressive = true;
        detectedTerms.push(...msg.safety.detectedTerms);
        if (!explanation) explanation = msg.safety.explanation;
      }
    }

    return {
      hasDanger: hasFraud || hasAggressive,
      isFraud: hasFraud,
      isAggressive: hasAggressive,
      explanation,
      detectedTerms: Array.from(new Set(detectedTerms))
    };
  }, [analyzedMessages]);

  const [showSafetyDetails, setShowSafetyDetails] = useState(false);
  const [isReported, setIsReported] = useState(false);

  const handleReportChatDanger = async () => {
    if (isReported) return;
    try {
      const reportId = 'safety_report_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'safety_reports', reportId), {
        id: reportId,
        itemId: item.id,
        itemTitle: item.title,
        reporterId: currentUser?.id || 'anonymous',
        reporterName: currentUser?.name || 'Anónimo',
        reportedTerms: chatSafetyStatus.detectedTerms,
        reportedMessagesCount: analyzedMessages.filter(m => m.safety.hasDanger).length,
        timestamp: new Date().toISOString()
      });
      setIsReported(true);
      alert("🚨 Alerta de Segurança reportado aos administradores da ComeBack Moçambique com sucesso! Investigaremos esta conversa de imediato.");
    } catch (err) {
      console.error("Report safety error:", err);
      alert("Erro ao reportar. Por favor, tente novamente.");
    }
  };

  // Estados para agendamento de entrega de item
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const hh = String(tomorrow.getHours()).padStart(2, '0');
    const min = String(tomorrow.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });
  const [scheduleLocation, setScheduleLocation] = useState(item.location || '');

  const formatICSDate = (date: Date) => {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
  };

  const getGoogleCalendarUrl = () => {
    const meetingDate = new Date(scheduleDateTime);
    const start = formatICSDate(meetingDate);
    const end = formatICSDate(new Date(meetingDate.getTime() + 45 * 60 * 1000));
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Entrega: ' + item.title)}&dates=${start}/${end}&details=${encodeURIComponent('Encontro agendado através da plataforma ComeBack Moçambique.')}&location=${encodeURIComponent(scheduleLocation)}`;
  };

  const handleScheduleSubmit = () => {
    if (!scheduleDateTime || !scheduleLocation.trim()) {
      alert("Por favor, preencha a data, hora e o local do encontro.");
      return;
    }

    const meetingDate = new Date(scheduleDateTime);
    const dateFormatted = meetingDate.toLocaleString('pt-MZ', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Mensagem Formatada Automatizada
    const formattedMessage = `📅 ENCONTRO AGENDADO DE ENTREGA!\n\n` +
      `📦 Artigo: ${item.title}\n` +
      `⏰ Data/Hora: ${dateFormatted}\n` +
      `📍 Local: ${scheduleLocation}\n\n` +
      `🛡️ ALERTA DE SEGURANÇA: Recomendamos vivamente encontrar-se em locais públicos movimentados, bem iluminados e vigiados (como esquadras de polícia, postos oficiais da ComeBack, ou portarias de bancos) ao fazer a troca física em Moçambique. Nunca corra riscos desnecessários.`;

    onSendMessage(formattedMessage);

    // Gerar ficheiro .ics
    const gcalStart = formatICSDate(meetingDate);
    const endDateObj = new Date(meetingDate.getTime() + 45 * 60 * 1000);
    const gcalEnd = formatICSDate(endDateObj);

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ComeBack Mocambique//NONSGML Calendar Event//PT",
      "BEGIN:VEVENT",
      `UID:comeback-${item.id}-${Date.now()}`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${gcalStart}`,
      `DTEND:${gcalEnd}`,
      `SUMMARY:${`Entrega: ${item.title}`.replace(/[,;]/g, '\\$&')}`,
      `DESCRIPTION:${`Entrega de artigo: ${item.title} agendada via ComeBack Moçambique.`.replace(/[,;]/g, '\\$&')}`,
      `LOCATION:${scheduleLocation.replace(/[,;]/g, '\\$&')}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    try {
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `entrega_comeback_${item.id}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Falha ao gerar ICS", e);
    }

    setIsScheduleModalOpen(false);
    alert("Encontro agendado! Lembrete enviado ao chat e o ficheiro de evento de calendário (.ics) foi transferido para o seu dispositivo.");
  };

  // Estados para avaliacao do Buscador (quando conclui entrega)
  const [isBuscadorEvalOpen, setIsBuscadorEvalOpen] = useState(false);
  const [ratingOwner, setRatingOwner] = useState(5);
  const [ratingPlatform, setRatingPlatform] = useState(5);
  const [evalComment, setEvalComment] = useState('');

  // Estados para avaliacao do Proprietario (quando aceita recebimento)
  const [isOwnerQuestionnaireOpen, setIsOwnerQuestionnaireOpen] = useState(false);
  const [conditionSame, setConditionSame] = useState<boolean | null>(null);
  const [conditionDetailsText, setConditionDetailsText] = useState('');
  const [ratingFinder, setRatingFinder] = useState(5);
  const [ratingPlatformOwner, setRatingPlatformOwner] = useState(5);
  const [ownerFeedbackText, setOwnerFeedbackText] = useState('');

  const handleStartDelivery = () => {
    if (!deliveryLocation.trim()) {
      setIsSettingLocation(true);
      return;
    }

    if (!("geolocation" in navigator)) {
      alert("Seu navegador não suporta geolocalização.");
      return;
    }

    // Solicitar permissão explicitamente antes de iniciar
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (onStartTracking) {
          onSendMessage(`🚚 Entrega Live Iniciada!\n📍 Destino: ${deliveryLocation}`);
          onStartTracking(deliveryLocation, { 
            lat: position.coords.latitude, 
            lng: position.coords.longitude 
          });
          setIsSettingLocation(false);
          setDeliveryLocation(''); // Reset para o próximo
        }
      },
      (error) => {
        alert("É necessário permitir a geolocalização para usar a Entrega Live.");
        console.error(error);
      },
      { enableHighAccuracy: true }
    );
  };

  const submitBuscadorDeliveryConfirmation = async () => {
    if (onStopTracking) {
      onStopTracking();
    }
    
    try {
      await updateDoc(doc(db, 'items', item.id), {
        deliveryStatus: 'pending_confirmation',
        isTrackingActive: false,
        ratingByFinderForOwner: ratingOwner,
        ratingByFinderForPlatform: ratingPlatform
      });

      // Salvar Review oficial no Firestore
      if (currentUser) {
        const reviewId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'reviews', reviewId), {
          id: reviewId,
          itemId: item.id,
          itemTitle: item.title,
          reviewerId: currentUser.id,
          reviewerName: currentUser.name,
          reviewerPhoto: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
          targetUserId: item.userId || 'anonymous',
          itemRating: ratingPlatform, // Classificacao do processo/item
          userRating: ratingOwner, // Classificacao do outro user
          feedback: evalComment.trim() || "Excelente cooperação durante a entrega.",
          createdAt: new Date().toISOString()
        });
      }

      const notifId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: item.userId,
        type: 'DELIVERY',
        title: 'Artigo Entregue! 📦',
        description: `${currentUser?.name || 'O buscador'} concluiu a entrega do seu artigo "${item.title}". Por favor, confirme o recebimento e avalie!`,
        itemId: item.id,
        timestamp: new Date().toISOString(),
        isRead: false
      });

      onSendMessage(`📦 ENTREGA EFETUADA: O buscador indicou a conclusão da entrega do artigo e avaliou o proprietário e a plataforma. Aguardando confirmação do Proprietário!`);
      setIsBuscadorEvalOpen(false);
      alert("Entrega confirmada! O proprietário foi notificado para confirmar se recebeu o artigo.");
    } catch (error) {
      console.error(error);
      alert("Erro ao confirmar entrega.");
    }
  };

  const handleDenyReceipt = async () => {
    const confirmDeny = window.confirm("Tens a certeza de que ainda não recebeste o teu artigo?");
    if (!confirmDeny) return;

    try {
      await updateDoc(doc(db, 'items', item.id), {
        deliveryStatus: 'denied'
      });

      const finderId = messages.find(m => m.senderId !== item.userId)?.senderId || 'unknown';
      if (finderId !== 'unknown') {
        const notifId = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: finderId,
          type: 'DELIVERY',
          title: 'Entrega Recusada ❌',
          description: `O proprietário de "${item.title}" informou que ainda não recebeu o artigo.`,
          itemId: item.id,
          timestamp: new Date().toISOString(),
          isRead: false
        });
      }

      onSendMessage(`❌ ATENÇÃO: O proprietário de "${item.title}" informou no chat do Radar que NÃO recebeu o artigo ainda. Coordenem a entrega novamente.`);
    } catch (e) {
      console.error(e);
    }
  };

  const submitOwnerConfirmation = async () => {
    if (conditionSame === null) {
      alert("Por favor indique o estado do artigo.");
      return;
    }

    try {
      await updateDoc(doc(db, 'items', item.id), {
        status: ItemStatus.REUNITED,
        deliveryStatus: 'confirmed',
        conditionCheckedByOwner: conditionSame,
        conditionDetails: conditionSame ? '' : conditionDetailsText,
        ratingByOwnerForFinder: ratingFinder,
        ratingByOwnerForPlatform: ratingPlatformOwner
      });

      const finderId = messages.find(m => m.senderId !== item.userId)?.senderId || 'unknown';
      
      // Salvar Review oficial do Proprietário para o Finder no Firestore
      if (currentUser && finderId !== 'unknown') {
        const reviewId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'reviews', reviewId), {
          id: reviewId,
          itemId: item.id,
          itemTitle: item.title,
          reviewerId: currentUser.id,
          reviewerName: currentUser.name,
          reviewerPhoto: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
          targetUserId: finderId,
          itemRating: ratingPlatformOwner,
          userRating: ratingFinder,
          feedback: ownerFeedbackText.trim() || (conditionSame ? "O artigo estava em excelente estado e a devolução correu perfeitamente." : `Danos/alterações: ${conditionDetailsText}`),
          createdAt: new Date().toISOString()
        });
      }

      if (finderId !== 'unknown') {
        const notifId = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: finderId,
          type: 'DELIVERY',
          title: 'Resgate Confirmado! 🇲🇿',
          description: `O proprietário confirmou o recebimento seguro de "${item.title}". Obrigado pelo seu excelente gesto!`,
          itemId: item.id,
          timestamp: new Date().toISOString(),
          isRead: false
        });
      }

      const stateObs = conditionSame 
        ? "em excelente estado (as mesmas condições de antes)" 
        : `com alterações no seu estado (${conditionDetailsText})`;

      onSendMessage(`🎉 RESGATE CONCLUÍDO COM SUCESSO! O proprietário confirmou o recebimento do artigo ${stateObs}, avaliou o buscador com ${ratingFinder} estrelas, a plataforma com ${ratingPlatformOwner} estrelas e encerrou as negociações. Recompensa liquidada! Muito obrigado!`);
      setIsOwnerQuestionnaireOpen(false);
      alert("Recebimento e avaliações confirmadas com sucesso! Obrigado por usar o Radar ComeBack.");
    } catch (e) {
      console.error(e);
      alert("Erro ao confirmar recebimento.");
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = event.target?.result as string;
          // Compress chat image
          const compressedBase64 = await compressImage(base64, 800, 800, 0.6);
          onSendMessage('', 'image', compressedBase64);
        };
        reader.readAsDataURL(file as File);
      });
      setShowAttachments(false);
      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleLocationSend = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        onSendMessage('Minha localização atual', 'location', undefined, {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setShowAttachments(false);
      }, (err) => {
        alert("Não foi possível obter sua localização.");
      });
    } else {
      alert("Geolocalização não suportada.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f9f9f9]">
      {/* Chat Header */}
      <div className="bg-white p-4 border-b flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="text-[#009739] p-2 relative active:scale-90 transition-transform">
          <i className="fa-solid fa-arrow-left"></i>
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 bg-[#d21034] text-white text-[7px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full border border-white shadow-sm animate-bounce">
              {notificationCount}
            </span>
          )}
        </button>
        
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
          <MediaViewer 
            src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
            category={item.category}
            className="w-full h-full object-cover" 
          />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="font-black text-xs uppercase truncate text-gray-900">{item.title}</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isTracking ? 'bg-[#009739] animate-pulse' : 'bg-gray-300'}`}></div>
            <div className="text-[9px] text-gray-400 font-black uppercase tracking-wider">
              {isTracking ? 'Rastreamento Ativo' : 'Chat de Resgate'}
            </div>
          </div>
        </div>
      </div>

      {/* NOVO: Barra de Segurança Ativa e Detecção de Riscos */}
      {!chatSafetyStatus.hasDanger ? (
        <div className="bg-emerald-500/10 border-b border-emerald-500/15 px-4 py-2 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-[9.5px] text-emerald-800 font-extrabold uppercase tracking-wide">
              Conversa Monitorizada • Proteção Anti-Fraude Ativa
            </span>
          </div>
          <span className="text-[8px] text-emerald-600 font-black uppercase tracking-wider hidden sm:inline-block">
            Nenhum Risco Detetado
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border-b-2 border-amber-200/80 p-3 flex flex-col gap-2 animate-in slide-in-from-top duration-300">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 bg-amber-500/10 text-amber-700 rounded-lg flex items-center justify-center shrink-0 border border-amber-500/20">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            </div>
            <div className="flex-1 text-left">
              <div className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex flex-wrap items-center gap-2">
                <span>{chatSafetyStatus.isFraud ? "🚨 Alerta de Segurança: Potencial Fraude Detetada" : "🚨 Alerta de Conduta: Linguagem Imprópria Detetada"}</span>
                {chatSafetyStatus.detectedTerms.length > 0 && (
                  <span className="text-[8px] bg-amber-200/60 text-amber-950 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                    Termos: {chatSafetyStatus.detectedTerms.join(', ')}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-amber-800 font-medium leading-relaxed uppercase tracking-normal mt-0.5">
                {chatSafetyStatus.explanation}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-amber-200/40 pt-2">
            <button 
              onClick={() => setShowSafetyDetails(!showSafetyDetails)}
              className="bg-amber-100/70 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-lg text-[8.5px] font-black uppercase transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-info-circle"></i>
              {showSafetyDetails ? "Fechar Conselhos" : "Dicas de Encontro Seguro"}
            </button>
            <button 
              onClick={handleReportChatDanger}
              disabled={isReported}
              className={`px-3 py-1.5 rounded-lg text-[8.5px] font-black uppercase transition-all flex items-center gap-1.5 ${
                isReported 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-xs active:scale-95'
              }`}
            >
              <i className="fa-solid fa-flag"></i>
              {isReported ? "Denúncia Efetuada" : "Denunciar à Plataforma"}
            </button>
          </div>
          
          {showSafetyDetails && (
            <div className="bg-white p-3 rounded-xl border border-amber-100 mt-1 space-y-2 text-left text-[9.5px] text-gray-650 font-bold uppercase leading-relaxed">
              <div className="font-black text-slate-800 mb-1">🛡️ CONSELHOS CRÍTICOS DE SEGURANÇA PARA ENCONTROS EM MOÇAMBIQUE:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="font-extrabold text-slate-900 mb-0.5">1. LOCALIZAÇÃO VIGIADA</div>
                  Marque o encontro apenas em locais com policiamento ou movimento constante, como postos da Polícia da República de Moçambique (PRM), bombas de combustível concorridas ou recepções de centros comerciais.
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="font-extrabold text-slate-900 mb-0.5">2. ZERO ADIANTAMENTO</div>
                  Nunca envie dinheiro de transporte (frete/chapa/txopela) ou recompensa via M-Pesa/e-Mola adiantado. Se o buscador pedir adiantamento, recuse imediatamente.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Banner de Confirmação para o Proprietário */}
      {currentUser?.id === item.userId && item.deliveryStatus === 'pending_confirmation' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 p-4 animate-in slide-in-from-top duration-300">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-left">
            <div>
              <div className="text-[10px] font-black text-amber-800 uppercase tracking-wide flex items-center gap-1.5 leading-none mb-1">
                <i className="fa-solid fa-bell animate-bounce"></i> Artigo Entregue!
              </div>
              <p className="text-[10px] text-gray-600 font-medium leading-normal">
                O buscador indicou que o artigo **{item.title}** foi entregue. Confirma o recebimento físico com segurança?
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              <button 
                onClick={handleDenyReceipt}
                className="flex-1 sm:flex-none border-2 border-red-200 text-[#d21034] hover:bg-red-50 px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all"
              >
                Não Recebi
              </button>
              <button 
                onClick={() => setIsOwnerQuestionnaireOpen(true)}
                className="flex-1 sm:flex-none bg-[#009739] hover:bg-[#008130] text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-xs transition-all animate-pulse"
              >
                Sim, Recebi!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rastreamento Bar (Se ativo) */}
      {isTracking && (
        <div className="bg-[#009739] text-white px-4 py-3 flex flex-col gap-3 z-10 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
              <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-truck-fast"></i> Entrega em curso Live
              </span>
            </div>
            <div className="flex gap-2">
               <button onClick={onViewTracking} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all active:scale-95">
                 <i className="fa-solid fa-map-location-dot"></i> Ver Mapa
               </button>
               <button onClick={onStopTracking} className="bg-red-500/80 hover:bg-red-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95">
                 <i className="fa-solid fa-stop"></i> Parar
               </button>
            </div>
          </div>
          
          <button 
            onClick={() => setIsBuscadorEvalOpen(true)} 
            className="w-full bg-[#fce100] text-black hover:bg-white p-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-3 shadow-md active:scale-[0.98] border-b-4 border-yellow-600 active:border-b-0 hover:border-b-yellow-200"
          >
            <i className="fa-solid fa-check-double text-xs"></i>
            Concluir Entrega / Item Entregue
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {isSettingLocation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
             <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-[#009739]/10 text-[#009739] rounded-full flex items-center justify-center mb-4 mx-auto">
                   <i className="fa-solid fa-truck-fast text-2xl"></i>
                </div>
                <h3 className="text-lg font-black text-center text-gray-900 uppercase tracking-tighter mb-2">Preparar Entrega</h3>
                <p className="text-[10px] text-gray-500 font-bold text-center uppercase mb-6">Indique o local exato onde o item será entregue.</p>
                
                <div className="space-y-4">
                  <div>
                     <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-2">Local de Entrega / Recolha</label>
                     <input 
                       type="text" 
                       className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 text-xs font-bold outline-none"
                       placeholder="Ex: Praça dos Trabalhadores, Maputo"
                       value={deliveryLocation}
                       onChange={(e) => setDeliveryLocation(e.target.value)}
                     />
                  </div>
                  
                  <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                     <p className="text-[8px] text-yellow-700 font-bold uppercase leading-relaxed">
                       ℹ️ O transporte (Txopela/Taxi) deve ser pago pelo PROPRIETÁRIO do item. O levantamento pessoal no local indicado pelo buscador é GRATUITO.
                     </p>
                  </div>
                  
                  <div className="flex gap-2">
                     <button 
                       onClick={() => setIsSettingLocation(false)}
                       className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all"
                     >
                       Voltar
                     </button>
                     <button 
                       onClick={() => {
                         setDeliveryLocation('Levantamento Pessoal (Grátis)');
                         // We don't trigger handleStartDelivery immediately because we want them to see the field updated or just proceed
                       }}
                       className="px-3 bg-white border-2 border-gray-100 text-gray-400 rounded-xl font-black text-[8px] uppercase hover:border-black hover:text-black transition-all"
                     >
                       RECOLHA GRÁTIS
                     </button>
                     <button 
                       onClick={handleStartDelivery}
                       disabled={!deliveryLocation.trim()}
                       className="flex-1 py-3 bg-[#009739] text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50"
                     >
                       Iniciar
                     </button>
                  </div>
                </div>
             </div>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-16 px-10">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-[#009739]">
               <i className="fa-solid fa-shield-halved text-2xl"></i>
            </div>
            <h3 className="text-[10px] font-black uppercase text-gray-400 mb-1">Conversa Segura</h3>
            <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
              Combine a entrega aqui. Lembre-se: locais públicos são mais seguros.
            </p>
          </div>
        )}
        
        {analyzedMessages.map((msg, index) => {
          const isMe = msg.senderId === currentUser?.id;
          const type = msg.type || 'text';
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] rounded-2xl shadow-sm overflow-hidden ${
                isMe 
                  ? 'bg-black text-[#fce100] rounded-tr-none' 
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}>
                {type === 'text' && (
                  <div className="p-3.5 text-[13px] font-bold leading-snug">
                    {msg.text}
                  </div>
                )}
                
                {type === 'image' && (
                  <div className="p-1">
                    <img src={msg.mediaUrl} className="max-w-full rounded-xl object-cover h-48 w-64 bg-gray-100" alt="Imagem partilhada" />
                  </div>
                )}

                {type === 'location' && (
                  <div className="p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                       <i className="fa-solid fa-location-dot text-[#d21034]"></i>
                       <span className="text-[12px] font-black uppercase">Localização Partilhada</span>
                    </div>
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`, '_blank')}
                      className={`w-full py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border-2 transition-all ${
                        isMe ? 'border-[#fce100] text-[#fce100] hover:bg-[#fce100] hover:text-black' : 'border-black text-black hover:bg-black hover:text-[#fce100]'
                      }`}
                    >
                      <i className="fa-solid fa-map"></i> Ver no Mapa
                    </button>
                  </div>
                )}

                {/* Warning Card inside message bubble if flagged */}
                {msg.safety.hasDanger && (
                  <div className={`mx-3 mb-3 p-2.5 rounded-xl text-[9.5px] uppercase font-black text-left flex items-start gap-1.5 leading-relaxed ${
                    isMe
                      ? 'bg-[#d21034]/20 text-red-250 border border-[#d21034]/30'
                      : 'bg-red-50 text-[#d21034] border border-red-100'
                  }`}>
                    <i className="fa-solid fa-circle-exclamation shrink-0 text-xs mt-0.5 animate-pulse"></i>
                    <div>
                      <span className="block font-black tracking-wider">
                        [🚨 ALERTA: {msg.safety.isFraud ? "RISCO DE FRAUDE" : "LINGUAGEM HOSTIL"}]
                      </span>
                      <span className={`block font-semibold normal-case mt-1 ${isMe ? 'text-red-200/90' : 'text-red-900/90'}`}>
                        {msg.safety.isFraud 
                          ? "Termos como cobranças prévias (M-Pesa/combustível) ou partilha de códigos acionaram este aviso. NUNCA pague taxas antes de receber e verificar o artigo!" 
                          : "Expressões agressivas ou ofensivas foram detetadas. Evite conflitos e mantenha o respeito para a sua segurança física."}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-1 text-[8px] font-bold text-gray-400 uppercase flex items-center gap-1.5 select-none">
                <span>{new Date(msg.timestamp).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.pending && (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-extrabold normal-case bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/40">
                    <i className="fa-solid fa-cloud-arrow-up text-[9px] animate-pulse"></i>
                    A aguardar ligação para sincronizar...
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input & Quick Actions */}
      <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative">
        {!isTracking && (
          <div className="flex flex-col gap-2 mb-3">
             <div className="flex gap-2">
                <button 
                  onClick={handleStartDelivery}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 hover:border-[#009739] text-gray-500 hover:text-[#009739] py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-truck-fast"></i> Iniciar Entrega (Live)
                </button>
                <button 
                  onClick={handleLocationSend}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 text-[#d21034] py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-50 hover:border-[#d21034] transition-all"
                >
                  <i className="fa-solid fa-location-crosshairs"></i> Enviar Localização
                </button>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 hover:border-amber-500 text-gray-400 hover:text-amber-600 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-calendar-days text-amber-500"></i> Agendar Entrega
                </button>
                <button 
                  onClick={() => setIsBuscadorEvalOpen(true)}
                  className="flex-1 bg-gray-50 border-2 border-gray-100 text-gray-550 hover:bg-[#009739]/5 hover:text-[#009739] hover:border-[#009739] py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all"
                >
                  <i className="fa-solid fa-handshake"></i> Concluir Resgate
                </button>
             </div>
          </div>
        )}

        {showAttachments && (
          <div className="absolute bottom-[calc(100%+10px)] left-4 right-4 bg-white border border-gray-100 rounded-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-300 z-50">
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-[#fce100]/20 transition-colors border-2 border-transparent hover:border-[#fce100]"
                >
                  <div className="w-12 h-12 bg-emerald-100 text-[#009739] rounded-full flex items-center justify-center text-xl shadow-inner">
                    <i className="fa-solid fa-camera"></i>
                  </div>
                  <span className="text-[10px] font-black uppercase text-gray-600">Imagem</span>
                </button>
                <button 
                  onClick={handleLocationSend}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-50 hover:bg-[#009739]/10 transition-colors border-2 border-transparent hover:border-[#009739]"
                >
                  <div className="w-12 h-12 bg-red-100 text-[#d21034] rounded-full flex items-center justify-center text-xl shadow-inner">
                    <i className="fa-solid fa-location-arrow"></i>
                  </div>
                  <span className="text-[10px] font-black uppercase text-gray-600">Localização</span>
                </button>
             </div>
          </div>
        )}

        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
        />

        <form onSubmit={handleSend} className="flex gap-2 items-center">
          <button 
            type="button"
            onClick={() => setShowAttachments(!showAttachments)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              showAttachments ? 'bg-black text-[#fce100] rotate-45' : 'bg-gray-100 text-gray-400'
            }`}
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          
          <input 
            type="text"
            placeholder="Escreva sua mensagem..."
            className="w-full bg-gray-50 border-2 border-transparent focus:border-[#009739] rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!inputText.trim()}
            className="bg-[#009739] text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-30"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      </div>

      {/* Modal de Avaliacao do Buscador (Finder Rating Modal) */}
      {isBuscadorEvalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsBuscadorEvalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-7 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-left">
            <button 
              onClick={() => setIsBuscadorEvalOpen(false)}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 text-lg border-2 border-white shadow-sm">
                <i className="fa-solid fa-star animate-pulse"></i>
              </div>
              <h3 className="text-base font-black text-gray-900 uppercase">Avaliar Experiência</h3>
              <p className="text-[8px] font-bold text-gray-400 mt-0.5 uppercase">Concluir Entrega e Classificar Proprietário</p>
            </div>

            <div className="space-y-4">
              {/* Avaliar o Proprietario */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1.5 ml-1">Avaliar o Proprietário ({ratingOwner} ★)</label>
                <div className="flex gap-2 justify-center py-1 bg-gray-50/50 rounded-xl border border-gray-100">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingOwner(star)}
                      className="text-2xl transition-all hover:scale-115 active:scale-90"
                    >
                      <i className={`fa-solid fa-star ${star <= ratingOwner ? 'text-[#fce100]' : 'text-gray-200'}`}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avaliar a Plataforma */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1.5 ml-1">Avaliar Experiência do Sistema ({ratingPlatform} ★)</label>
                <div className="flex gap-2 justify-center py-1 bg-gray-50/50 rounded-xl border border-gray-100">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingPlatform(star)}
                      className="text-2xl transition-all hover:scale-115 active:scale-90"
                    >
                      <i className={`fa-solid fa-star ${star <= ratingPlatform ? 'text-[#fce100]' : 'text-gray-200'}`}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentarios Adicionais */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1.5 ml-1">Comentários (Opcional)</label>
                <textarea
                  placeholder="Conte-nos como correu o resgate e o contacto com o dono..."
                  value={evalComment}
                  onChange={(e) => setEvalComment(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-amber-400 rounded-xl p-3 text-xs font-semibold outline-none no-scrollbar h-20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBuscadorEvalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-[10px] uppercase transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={submitBuscadorDeliveryConfirmation}
                  className="flex-[2] bg-[#009739] text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all"
                >
                  Enviar e Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Questionario do Proprietario (Owner Confirmation & Rating Questionnaire) */}
      {isOwnerQuestionnaireOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOwnerQuestionnaireOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-7 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-left">
            <button 
              onClick={() => setIsOwnerQuestionnaireOpen(false)}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 text-lg border-2 border-white shadow-sm">
                <i className="fa-solid fa-clipboard-question animate-bounce"></i>
              </div>
              <h3 className="text-base font-black text-gray-900 uppercase">Confirmar artigo</h3>
              <p className="text-[8px] font-bold text-gray-400 mt-0.5 uppercase">Questionário de recebimento seguro</p>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
              {/* Pergunta 1: Estado do Artigo */}
              <div className="space-y-2">
                <label className="block text-[8px] font-black text-gray-400 uppercase ml-1">1. O artigo estava no mesmo estado/condições de quando o perdeu?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConditionSame(true);
                      setConditionDetailsText('');
                    }}
                    className={`p-3 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-1.5 ${
                      conditionSame === true 
                        ? 'border-[#009739] bg-emerald-50 text-[#009739]' 
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <i className="fa-solid fa-circle-check text-xs"></i>
                    Sim, idêntico
                  </button>
                  <button
                    type="button"
                    onClick={() => setConditionSame(false)}
                    className={`p-3 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-1.5 ${
                      conditionSame === false 
                        ? 'border-red-500 bg-red-50 text-red-500' 
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                  >
                    <i className="fa-solid fa-circle-xmark text-xs"></i>
                    Não, está diferente
                  </button>
                </div>
              </div>

              {/* Detalhes do estado diferente se aplicavel */}
              {conditionSame === false && (
                <div className="animate-in slide-in-from-top duration-300">
                  <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">Descreva as alterações observadas:</label>
                  <textarea
                    placeholder="Descreva as diferenças ou danos..."
                    value={conditionDetailsText}
                    onChange={(e) => setConditionDetailsText(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-red-100 focus:border-red-500 rounded-xl p-3 text-xs font-semibold outline-none h-16 resize-none"
                  />
                </div>
              )}

              {/* Pergunta 2: Avaliar o Entregador */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">2. Avaliar o Entregador ({ratingFinder} ★)</label>
                <div className="flex gap-2 justify-center py-1 bg-gray-50/50 rounded-xl border border-gray-100">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingFinder(star)}
                      className="text-2xl transition-all hover:scale-115 active:scale-90"
                    >
                      <i className={`fa-solid fa-star ${star <= ratingFinder ? 'text-[#fce100]' : 'text-gray-200'}`}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pergunta 3: Avaliar a Plataforma */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">3. Avaliar sua Experiência com o Sistema ({ratingPlatformOwner} ★)</label>
                <div className="flex gap-2 justify-center py-1 bg-gray-50/50 rounded-xl border border-gray-100">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingPlatformOwner(star)}
                      className="text-2xl transition-all hover:scale-115 active:scale-90"
                    >
                      <i className={`fa-solid fa-star ${star <= ratingPlatformOwner ? 'text-[#fce100]' : 'text-gray-200'}`}></i>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comentarios Adicionais do Proprietario */}
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1.5 ml-1">Comentários (Opcional)</label>
                <textarea
                  placeholder="Conte-nos como correu o contacto de devolução com o buscador..."
                  value={ownerFeedbackText}
                  onChange={(e) => setOwnerFeedbackText(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#009739] rounded-xl p-3 text-xs font-semibold outline-none no-scrollbar h-20 resize-none"
                />
              </div>

              {/* Botoes de Acao */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsOwnerQuestionnaireOpen(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-[10px] uppercase transition-all"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={conditionSame === null || (conditionSame === false && !conditionDetailsText.trim())}
                  onClick={submitOwnerConfirmation}
                  className="flex-[2] bg-[#009739] hover:bg-[#008130] text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all disabled:opacity-40"
                >
                  Confirmar e Avaliar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agendamento de Entrega */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" id="schedule-delivery-modal">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsScheduleModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-6.5 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-left">
            <button 
              onClick={() => setIsScheduleModalOpen(false)}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors"
              id="close-schedule-modal-btn"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 text-lg border-2 border-white shadow-sm">
                <i className="fa-solid fa-calendar-plus animate-pulse"></i>
              </div>
              <h3 className="text-base font-black text-gray-900 uppercase">Agendar Entrega</h3>
              <p className="text-[8px] font-bold text-gray-400 mt-0.5 uppercase">Lembrete automático para o calendário local</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">Data & Hora do Encontro</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 rounded-xl p-3 text-xs font-bold outline-none"
                    id="schedule-datetime-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">Local Sugerido</label>
                <input
                  type="text"
                  placeholder="Ex: Esquadra de Polícia da Praça XML"
                  value={scheduleLocation}
                  onChange={(e) => setScheduleLocation(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-amber-400 rounded-xl p-3 text-xs font-bold outline-none"
                  id="schedule-location-input"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200/50 p-3 rounded-2xl">
                <div className="flex gap-2 items-start">
                  <i className="fa-solid fa-triangle-exclamation text-amber-600 text-xs mt-0.5"></i>
                  <p className="text-[8.5px] text-amber-800 font-bold uppercase leading-normal">
                    Recomendamos postos oficiais no centro da cidade, esquadras ou bancos para uma intermediação com total segurança 🛡️
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleScheduleSubmit}
                  className="w-full bg-black text-[#fce100] hover:text-white py-3.5 rounded-xl font-black text-[9.5px] uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                  id="btn-confirm-schedule-ics"
                >
                  <i className="fa-solid fa-file-invoice text-xs"></i>
                  Agendar & Descarregar .ICS
                </button>

                <a
                  href={getGoogleCalendarUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 rounded-xl font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 border border-blue-200/40"
                  id="btn-google-calendar-link"
                >
                  <i className="fa-solid fa-calendar-days text-xs text-blue-600"></i>
                  Adicionar ao Google Calendar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
