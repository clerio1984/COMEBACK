
import React, { useState, useEffect } from 'react';
import { MediaViewer } from './MediaViewer';
import { SponsoredAd } from './SponsoredAd';
import { PoliceReportPDFModal } from './PoliceReportPDFModal';
import { Item, ItemStatus, User, Category, Comment, Review } from '../types';
import { analyzeItemMatch } from '../services/geminiService';
import { COMMISSION_FEE_PERCENT, MAINTENANCE_FEE_PERCENT, TOTAL_FEE_PERCENT } from '../constants';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { VisualPortraitBuilder } from './VisualPortraitBuilder';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where, getCountFromServer, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { compressImage } from '../services/imageUtils';
import { motion, AnimatePresence } from 'motion/react';

const getCategorySafetyTips = (category: Category): string[] => {
  switch (category) {
    case Category.ELECTRONICS:
      return [
        "Nunca partilhe o código PIN, palavra-passe ou número de série completo por mensagens com desconhecidos antes de confirmar ou receber o equipamento.",
        "Recomendamos ligar o aparelho no local de encontro para testar o ecrã, a bateria e confirmar o número de série/IMEI correspondente.",
        "Marque sempre o encontro em zonas de elevada movimentação durante o dia (como esquadras de polícia, pastelarias públicas ou centros comerciais).",
        "Se aplicável, leve consigo um carregador, powerbank ou cabo para efetuar testes rápidos de funcionamento no local."
      ];
    case Category.DOCUMENTS:
      return [
        "Nunca faça pagamentos adiantados a pretexto de taxas de envio, taxas administrativas ou reembolso de transporte para reaver os seus documentos.",
        "Verifique minuciosamente marcas de água, assinaturas, fotografias e textura do papel original antes de conceder qualquer gratificação financeira.",
        "Caso o indivíduo insista em encontrar-se em locais afastados ou desertos, solicite que a entrega seja mediada por uma esquadra de polícia.",
        "Considere digitalizar ou tirar fotocópias dos documentos recuperados imediatamente após reavê-los."
      ];
    case Category.WALLETS:
    case Category.BAGS:
      return [
        "Se cartões de débito/crédito, talões de cheques ou tokens bancários foram expostos, contacte de imediato a sua instituição bancária para os bloquear.",
        "Inspecione com detalhe se os principais documentos ou cartões adicionais continuam lá dentro antes de efetuar qualquer recompensa.",
        "Selecione locais com câmaras de videovigilância ativas para fazer a devolução, como áreas centrais de shoppings ou saguões de bancos.",
        "Evite revelar detalhes adicionais sobre as suas senhas pessoais ou localização íntima da sua habitação durante os diálogos."
      ];
    case Category.PETS:
      return [
        "Peça uma prova visual inequívoca (foto ou vídeo recente do animal de estimação ao lado de um jornal ou papel manuscrito) para garantir que ele está real e seguro.",
        "Use uma caixa de transporte segura, trela forte ou coleira apropriada para evitar fugas motivadas pelo stress do encontro e barulho urbano.",
        "Aproxime-se calmamente para não assustar o animal, uma vez que ele já esteve exposto a uma situação stressante e pode estar arisco.",
        "Recomendamos consultar o seu veterinário assistente nas primeiras 48 horas após a recuperação para verificar o estado físico geral."
      ];
    case Category.KEYS:
      return [
        "Se as chaves foram perdidas com identificações ou agendas que contenham o seu endereço, considere substituir urgentemente as fechaduras dos seus portões ou portas.",
        "Valide se a chave de facto funciona e encaixa perfeitamente no respetivo cadeado ou porta que porventura possa testar no local.",
        "Estipule o ponto de encontro de forma neutra, não permitindo deslocações indesejadas por terceiros até à sua morada."
      ];
    case Category.JEWELRY:
      return [
        "Jóias e relógios finos têm alto valor comercial; pela sua segurança física, faça-se sempre acompanhar por amigos ou familiares adultos ao encontro.",
        "Seja extremamente rigoroso e combine a entrega exclusivamente em zonas públicas centrais seguras ou proximidades de pontos de policiamento ativo.",
        "Examine assinaturas, quilates, ranhuras características ou detalhes únicos descritos para reconfirmar a propriedade original do bem."
      ];
    case Category.CLOTHING:
      return [
        "Verifique com calma se o vestuário/acessório não sofreu rasgos, nódoas permanentes ou avarias severas antes de encerrar o processo.",
        "Para a salvaguarda da higiene pública e pessoal, lave e desinfete adequadamente as peças de vestuário reavidas antes do uso contínuo.",
        "Facilite o encontro marcando um local conhecido e de fácil paragem rodoviária."
      ];
    default:
      return [
        "Reúna-se sempre em espaços de elevada circulação de pessoas (ex: shoppings, recepções de hotéis, praças de alimentação ou esquadras policiais).",
        "Recuse firmemente encontrar-se à noite em locais desertos sob qualquer justificação de conveniência dada pelo remetente.",
        "Valide rigorosamente as propriedades do item e compare com os detalhes originais antes de proceder à entrega de recompensas.",
        "Caso sinta alguma suspeita, intimidação ou receba dados invulgares, interrompa imediatamente o contacto e denuncie o utilizador na nossa plataforma."
      ];
  }
};

const detectHighRiskBairro = (location: string, description: string): string | null => {
  const text = `${location} ${description}`.toLowerCase();
  
  const bairrosMap: Record<string, string> = {
    'xipamanine': 'Xipamanine',
    'hulene': 'Hulene',
    'chamanculo': 'Chamanculo',
    'george dimitrov': 'George Dimitrov / Benfica',
    'benfica': 'Benfica / George Dimitrov',
    'dimitrov': 'George Dimitrov',
    'inhagoia': 'Inhagoia',
    'zimpeto': 'Zimpeto',
    'mafalala': 'Mafalala',
    'aeroporto': 'Aeroporto',
    'maxaquene': 'Maxaquene',
    'baix': 'Baixa',
    'magoanine': 'Magoanine',
    'malhangalene': 'Malhangalene',
    'malanga': 'Malanga',
    'machava': 'Machava (Matola)',
    't-3': 'Bairro T-3 (Matola)',
    'infulene': 'Infulene (Matola)',
    'liberdade': 'Liberdade (Matola)',
    'fomento': 'Fomento (Matola)',
    'munhava': 'Munhava (Beira)',
    'chaimite': 'Chaimite (Beira)',
    'chipangara': 'Chipangara (Beira)',
    'maquinino': 'Maquinino (Beira)',
    'maraza': 'Maraza (Beira)',
    'praia nova': 'Praia Nova (Beira)',
    'namicopo': 'Namicopo (Nampula)',
    'muhala': 'Muhala (Nampula)',
    'carrupeia': 'Carrupeia (Nampula)',
    'napipine': 'Napipine (Nampula)'
  };

  for (const [key, value] of Object.entries(bairrosMap)) {
    if (text.includes(key)) {
      return value;
    }
  }
  return null;
};

interface SafetyTip {
  text: string;
  isHighRisk?: boolean;
}

const getSafetyTips = (item: Item): SafetyTip[] => {
  const baseTips = getCategorySafetyTips(item.category);
  const tips: SafetyTip[] = baseTips.map(text => ({ text }));

  const detectedBairro = detectHighRiskBairro(item.location, item.description);
  
  if (detectedBairro) {
    tips.unshift({
      text: `👮 Protocolo Policial Recomendado: Avise familiares ou amigos sobre o seu trajeto e, se necessário, solicite acompanhamento de uma autoridade local ou uma pessoa de inteira confiança.`,
      isHighRisk: true
    });
    tips.unshift({
      text: `🚨 Alerta de Segurança Bairro (${detectedBairro}): Esta localização tem registo histórico frequente de furtos ou assaltos. NÃO marque encontros solitários de recolha nesta zona. Recomendamos vivamente sugerir encontrar-se diretamente na Esquadra de Polícia mais próxima para mediar a transação de forma 100% segura.`,
      isHighRisk: true
    });
  } else {
    // Check if there are other general risk keywords
    const lowerText = `${item.location} ${item.description}`.toLowerCase();
    if (lowerText.includes('mercado') || lowerText.includes('paragem') || lowerText.includes('terminal') || lowerText.includes('praça') || lowerText.includes('avenida')) {
      tips.unshift({
        text: `📍 Orientação para Zona Movimentada (${item.location}): Mercados, terminais e avenidas principais têm alto fluxo de pessoas. Mantenha os seus pertences (telemóvel, carteira) bem guardados e seguros enquanto aguarda o encontro.`,
        isHighRisk: false
      });
    }
  }

  return tips;
};

// Deterministic stable hash to distribute "Sponsored" tag semi-randomly but stably (roughly 45% of feed posts)
const stableHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

// Computes realistic Facebook-grade views, likes, and shares stats dynamically based on post id and creation date
const getEngagementStats = (item: Item) => {
  let seed = 0;
  const str = item.id || '';
  for (let i = 0; i < str.length; i++) {
    seed += str.charCodeAt(i);
  }
  
  // Calculate age-based growth
  const ageMs = Date.now() - new Date(item.createdAt || item.date).getTime();
  const ageHours = Math.max(1, ageMs / (3600 * 1000));
  
  let baseViews = Math.floor((seed % 170) + 35);
  // Views accumulate over time
  baseViews += Math.floor(Math.min(2200, ageHours * 7.5));
  
  if (item.isPremium || item.isBoosted) {
    baseViews *= 12; // Sponsored reach is much higher!
  } else if (stableHash(item.id || '') % 5 <= 1) {
    baseViews *= 5.5; // Randomly marked sponsored posts also get a boost
  }
  
  baseViews = Math.max(45, Math.floor(baseViews));
  
  // Likes average around 12% of views
  const baseLikes = Math.floor(baseViews * (0.07 + (seed % 11) / 100));
  
  // Shares average around 3% of views
  const baseShares = Math.max(0, Math.floor(baseViews * (0.015 + (seed % 4) / 100)));

  return {
    views: baseViews,
    likes: baseLikes,
    shares: baseShares,
  };
};

interface ItemDetailsProps {
  item: Item;
  allContextItems: Item[];
  onBack: () => void;
  onStartChat: (item: Item, initialMessageText?: string) => void;
  onViewItem: (item: Item) => void;
  autoOpenClaim?: boolean;
  escrowedItems?: Record<string, { txId: string; amount: number; phone: string }>;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ item: initialItem, allContextItems, onBack, onStartChat, onViewItem, autoOpenClaim, escrowedItems }) => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();
  const [item, setItem] = useState<Item>(initialItem);
  useEffect(() => {
    setItem(initialItem);
  }, [initialItem]);

  // Sincronização em tempo real do item para capturar novos pontos de rastreio GPS / status
  useEffect(() => {
    if (!initialItem?.id) return;
    const unsub = onSnapshot(doc(db, 'items', initialItem.id), (docSnap) => {
      if (docSnap.exists()) {
        setItem(prev => ({
          ...prev,
          id: docSnap.id,
          ...docSnap.data()
        } as Item));
      }
    }, () => {});
    return () => unsub();
  }, [initialItem?.id]);

  const [analyzing, setAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState<{item: Item, result: any} | null>(null);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [completedTips, setCompletedTips] = useState<Record<number, boolean>>({});

  // Estados para likes e visualizações estilo Facebook
  const isSponsored = item.isPremium || item.isBoosted || (stableHash(item.id || '') % 5 <= 1);
  const [liked, setLiked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`fb_like_${item.id}`) === 'true';
    } catch {
      return false;
    }
  });
  const [viewsOffset] = useState<number>(() => {
    try {
      const hasViewed = sessionStorage.getItem(`fb_view_${item.id}`);
      if (!hasViewed) {
        sessionStorage.setItem(`fb_view_${item.id}`, 'true');
        return 1;
      }
    } catch {}
    return 0;
  });

  const fbStats = React.useMemo(() => {
    const defaultStats = getEngagementStats(item);
    return {
      views: defaultStats.views + viewsOffset,
      likes: defaultStats.likes + (liked ? 1 : 0),
      shares: defaultStats.shares,
    };
  }, [item, liked, viewsOffset]);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !liked;
    setLiked(nextState);
    try {
      localStorage.setItem(`fb_like_${item.id}`, String(nextState));
    } catch {}
  };

  // Estados para Impulsionamento de Post (Facebook-style Boost Campaign)
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostDays, setBoostDays] = useState<number>(3);
  const [boostDailyBudget, setBoostDailyBudget] = useState<number>(50);
  const [boostTargetProvince, setBoostTargetProvince] = useState<string>(initialItem.province || 'ALL');
  const [boostTargetCategory, setBoostTargetCategory] = useState<string>('ALL');
  const [boostTargetStatus, setBoostTargetStatus] = useState<string>('ALL');
  const [boostPlacement, setBoostPlacement] = useState<'feed_and_modal' | 'feed_only'>('feed_and_modal');
  const [checkoutPhone, setCheckoutPhone] = useState(currentUser?.phone || initialItem.ownerPhone || '');
  const [checkoutWalletType, setCheckoutWalletType] = useState<'mpesa' | 'emola' | 'mkesh'>('mpesa');
  
  const [isProcessingBoost, setIsProcessingBoost] = useState(false);
  const [boostActionMessage, setBoostActionMessage] = useState('');
  const [boostActionSuccess, setBoostActionSuccess] = useState<boolean | null>(null);

  const handleConfirmBoostPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPhone.trim()) {
      alert("Por favor introduza o seu número de carteira móvel!");
      return;
    }

    const valueToPay = boostDays * boostDailyBudget;
    
    setIsProcessingBoost(true);
    setBoostActionSuccess(null);
    setBoostActionMessage(`A iniciar transação de pagamento seguro com ${checkoutWalletType.toUpperCase()} Moçambique...`);

    // Etapa 1: Push USSD
    await new Promise(resolve => setTimeout(resolve, 1500));
    setBoostActionMessage(`A enviar notificação push USSD para o telemóvel ${checkoutPhone}...`);

    // Etapa 2: Espera pelo PIN secreto do utilizador
    await new Promise(resolve => setTimeout(resolve, 2000));
    setBoostActionMessage("Autorização detetada! A processar o pagamento com barramento do Banco de Moçambique...");

    // Etapa 3: Efetivar upgrade na base de dados Firebase Firestore
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const itemRef = doc(db, 'items', item.id);
      const updateData = {
        isPremium: true,
        isBoosted: true,
        boostDays: boostDays,
        boostDailyBudget: boostDailyBudget,
        boostTotalBudget: boostDays * boostDailyBudget,
        boostStartDate: new Date().toISOString(),
        boostEndDate: new Date(Date.now() + boostDays * 24 * 3600 * 1000).toISOString(),
        boostTargetProvince: boostTargetProvince,
        boostTargetCategory: boostTargetCategory,
        boostTargetStatus: boostTargetStatus,
        boostPlacement: boostPlacement,
        boostPaymentMethod: checkoutWalletType,
        boostPaymentPhone: checkoutPhone,
        boostImpressions: 0,
        boostedAt: new Date().toISOString()
      };
      
      await updateDoc(itemRef, updateData);
      
      // Update local item state to show active status instantly
      setItem(prev => ({
        ...prev,
        ...updateData
      }));

      // Salvar transação correspondente no localStorage para consistência com o MonetizationHub
      if (currentUser?.id) {
        const savedTxs = localStorage.getItem(`comeback_txs_${currentUser.id}`);
        const currentTxs = savedTxs ? JSON.parse(savedTxs) : [];
        const newTx = {
          id: 'tx_pay_' + Math.random().toString(36).substring(2),
          type: 'upgrade_premium' as const,
          amount: -valueToPay,
          description: `Impulsionamento de Post Estilo Facebook (${boostDays} dias x ${boostDailyBudget} MT/dia) - Artigo ID: ${item.id.substring(0, 6)}`,
          timestamp: new Date().toISOString(),
          refCode: 'PG_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          status: 'completed' as const
        };
        localStorage.setItem(`comeback_txs_${currentUser.id}`, JSON.stringify([newTx, ...currentTxs]));
      }

      setBoostActionSuccess(true);
      setBoostActionMessage(`Excelente! O seu artigo "${item.title}" foi impulsionado com sucesso! A campanha de marketing está ativa pelas próximas de ${boostDays} dias.`);
      setIsProcessingBoost(false);
    } catch (err) {
      console.error("Erro ao registrar campanha de boost: ", err);
      setBoostActionSuccess(false);
      setBoostActionMessage("Houve um problema de ligação ao registar a campanha de publicidade. Por favor tente novamente.");
      setIsProcessingBoost(false);
    }
  };

  // Reset checklist when item changes
  useEffect(() => {
    setCompletedTips({});
  }, [item.id]);

  // Estados dos Comentarios
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Escutar comentários em tempo real
  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('itemId', '==', item.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Comment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Comment));
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setComments(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    });

    return () => unsubscribe();
  }, [item.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    if (!currentUser) {
      alert("Por favor, faça login para deixar um comentário ou avistamento.");
      return;
    }
    
    setSubmittingComment(true);
    try {
      const commentId = 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const commentPayload: Comment = {
        id: commentId,
        itemId: item.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userPhoto: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
        text: newCommentText.trim(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'comments', commentId), commentPayload);
      setNewCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Tens a certeza que desejas apagar este comentário?")) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'comments/' + commentId);
    }
  };

  // Estados do Botão de Pânico
  const [panicCountdown, setPanicCountdown] = useState(3);
  const [isCountingPanic, setIsCountingPanic] = useState(false);
  const [panicLoading, setPanicLoading] = useState(false);
  const [panicStateMessage, setPanicStateMessage] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCountingPanic && panicCountdown > 0) {
      timer = setTimeout(() => {
        setPanicCountdown(prev => prev - 1);
      }, 1000);
    } else if (isCountingPanic && panicCountdown === 0) {
      setIsCountingPanic(false);
      triggerPanicDispatch();
    }
    return () => clearTimeout(timer);
  }, [isCountingPanic, panicCountdown]);

  const handleActivatePanic = () => {
    if (!currentUser) {
      alert("Por favor, faça login para usar o Botão de Pânico.");
      return;
    }
    setPanicCountdown(3);
    setIsCountingPanic(true);
  };

  const handleAbortPanic = () => {
    setIsCountingPanic(false);
    setPanicLoading(false);
    setPanicCountdown(3);
  };

  const triggerPanicDispatch = () => {
    setPanicLoading(true);
    setPanicStateMessage("Obtendo geolocalização do dispositivo via satélite...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        executePanicActions(latitude, longitude);
      },
      (error) => {
        console.warn("Geolocation failed, using fallback coordinates:", error);
        // Fallback to item coordinates or central Maputo
        const lat = item.latitude || -25.9692;
        const lng = item.longitude || 32.5732;
        executePanicActions(lat, lng);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const executePanicActions = async (latitude: number, longitude: number) => {
    setPanicStateMessage("Emitindo alerta para contactos de segurança...");
    
    const emergencyContacts = currentUser?.emergencyContacts || [];
    let contactsText = "";
    
    if (emergencyContacts.length > 0) {
      contactsText = emergencyContacts.map(c => `- ${c.name} (${c.phone})`).join("\n");
      // Simular delay do envio de SMS em segundo plano
      await new Promise(resolve => setTimeout(resolve, 800));
    } else {
      contactsText = "NENHUM CONTACTO CONFIGURADO (Apenas Suporte Central acionado). Poderá configurar contactos prioritários nos Ajustes de Conta.";
    }

    setPanicStateMessage("Abrindo chat de prioridade máxima com o Suporte Técnico...");
    await new Promise(resolve => setTimeout(resolve, 600));

    // Criar representação virtual de Item de Suporte com todos os campos obrigatórios
    const supportItem: Item = {
      id: "support_chat_" + currentUser!.id,
      title: "Suporte Prioritário ComeBack",
      description: "Canal de apoio para assistência e emergências em tempo real.",
      category: Category.OTHERS,
      status: ItemStatus.STOLEN,
      location: "Central de Ajuda ComeBack, Moçambique",
      province: currentUser!.province || "Maputo Cidade",
      date: new Date().toISOString().split('T')[0],
      userId: "support-admin",
      ownerName: "Suporte Técnico ComeBack",
      ownerPhone: "+258 84 000 0001",
      createdAt: new Date().toISOString(),
      transitLatitude: -25.9692,
      transitLongitude: 32.5732,
      isTrackingActive: false
    };

    const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const initialTextMessage = `🚨 [ALERTA DE PÂNICO - ARTIGO ROUBADO]\n\nUtilizador: ${currentUser!.name}\nContacto: ${currentUser!.phone || 'Não facultado'}\nArtigo Roubado: ${item.title}\nID do Artigo: ${item.id}\n\n📍 Geolocalização de Risco:\nLatitude: ${latitude}\nLongitude: ${longitude}\nLigação Google Maps: ${mapsUrl}\n\n📞 Contactos Notificados por SMS:\n${contactsText}`;

    // Limpar estados antes do redireccionamento
    setIsCountingPanic(false);
    setPanicLoading(false);

    // Iniciar Chat!
    onStartChat(supportItem, initialTextMessage);
  };
  
  // Estados para Modais
  const [requestingRemoval, setRequestingRemoval] = useState(false);

  const handleRequestRemoval = async () => {
    if (!currentUser) return;
    try {
      setRequestingRemoval(true);
      await updateDoc(doc(db, 'items', item.id), {
        removalRequested: true,
        removalRequestedAt: new Date().toISOString()
      });
      alert("Pedido de remoção enviado com sucesso para a equipe de administração do ComeBack!");
      item.removalRequested = true;
      item.removalRequestedAt = new Date().toISOString();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items/' + item.id);
    } finally {
      setRequestingRemoval(false);
    }
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isWhatsappPosterModalOpen, setIsWhatsappPosterModalOpen] = useState(false);
  const [posterCopied, setPosterCopied] = useState(false);
  const [isRescueModalOpen, setIsRescueModalOpen] = useState(false);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [bidValue, setBidValue] = useState<string>('');
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerUser, setOwnerUser] = useState<User | null>(null);
  const [ownerStats, setOwnerStats] = useState({ found: 0, lost: 0 });
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [ownerReviews, setOwnerReviews] = useState<Review[]>([]);
  const [averageOwnerRating, setAverageOwnerRating] = useState<number>(5);
  const [showReviewsTab, setShowReviewsTab] = useState<boolean>(false);
  
  // Estado para partilha nativa do sistema operativo e feedback
  const [isSharingNative, setIsSharingNative] = useState(false);
  const [shareToast, setShareToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isPoliceModalOpen, setIsPoliceModalOpen] = useState(false);
  const [claimExplanations, setClaimExplanations] = useState('');

  // Prova de Propriedade
  const [proofPhoto, setProofPhoto] = useState('');
  const [proofDescription, setProofDescription] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const handleSubmitProof = async () => {
    if (!proofDescription.trim()) {
      alert("Por favor, forneça uma justificação detalhada provando que você é o dono!");
      return;
    }
    if (item.status === ItemStatus.FOUND && !proofPhoto) {
      alert("Por favor, carregue uma foto como prova de propriedade (foto do documento, chave perdida, factura, etc.)!");
      return;
    }

    setIsUploadingProof(true);
    try {
      const senderId = currentUser ? currentUser.id : 'anonymous';
      const senderName = currentUser ? currentUser.name : 'Utilizador Anónimo';

      // 1. Criar o Alerta de Reivindicação Especial para o dono do post (Finder/Achador)
      const notifId = Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: item.userId,
        type: 'CLAIM',
        title: 'Alerta de Reivindicação de Dono!',
        description: `🚨 ALERTA ESPECIAL: ${senderName} clicou em 'É MEU' no seu artigo achado "${item.title}". Esta pessoa afirma ser a dona legítima e enviou uma prova de propriedade. Detalhes no chat!`,
        itemId: item.id,
        timestamp: new Date().toISOString(),
        isRead: false
      });

      // 2. Formatar mensagem inicial e iniciar o chat
      const initialMsg = `🚨 VERIFICAÇÃO DE PROVA DE PROPRIEDADE 🚨\n\nSou o proprietário legítimo deste artigo encontrado e reivindico a posse.\n\n📝 [Detalhes da Prova]:\n"${proofDescription.trim()}"` + (proofPhoto ? `\n\n🖼️ [Foto de Prova]: Anexei uma imagem oficial como prova de propriedade para confirmar.` : '');

      // Iniciar Conversa
      onStartChat(item, initialMsg);

      // 3. Se houver foto de prova, gravar como uma mensagem de imagem no Firestore de imediato
      if (proofPhoto) {
        const imageMsgId = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'messages', imageMsgId), {
          id: imageMsgId,
          itemId: item.id,
          senderId: senderId,
          receiverId: item.userId,
          timestamp: new Date().toISOString(),
          type: 'image',
          mediaUrl: proofPhoto
        });
      }

      // Fechar modais e resetar
      setIsClaimModalOpen(false);
      setProofPhoto('');
      setProofDescription('');
      alert("Prova de propriedade enviada! Alerta especial enviado e conversa segura direta iniciada com o encontrador.");
    } catch (error) {
      console.error("Erro ao enviar prova de propriedade:", error);
      alert("Ocorreu um erro ao enviar a prova de posse. Por favor, tente novamente.");
    } finally {
      setIsUploadingProof(false);
    }
  };

  useEffect(() => {
    if (item.userId && item.userId !== 'anonymous') {
      fetchOwnerDetails();
    }
  }, [item.userId, currentUser?.id]);

  useEffect(() => {
    if (autoOpenClaim) {
      if (item.status === ItemStatus.FOUND) {
        setIsClaimModalOpen(true);
      } else {
        const initialMsg = `🤝 Olá! Eu encontrei o seu artigo "${item.title}" que foi publicado como perdido/roubado. Gostaria de combinar a entrega.`;
        onStartChat(item, initialMsg);
      }
    }
  }, [autoOpenClaim, item.id, item.status]);

  const fetchOwnerDetails = async () => {
    if (!item.userId || item.userId === 'anonymous') return;
    setLoadingOwner(true);

    // Initial local fallback stats computed immediately from available items
    const localFound = (allContextItems || []).filter(i => i.userId === item.userId && i.status === ItemStatus.FOUND).length;
    const localLost = (allContextItems || []).filter(i => i.userId === item.userId && (i.status === ItemStatus.LOST || i.status === ItemStatus.STOLEN)).length;
    setOwnerStats({
      found: localFound,
      lost: localLost
    });

    try {
      // Fetch user profile only if a user is signed in to avoid permission issues for visitors
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', item.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setOwnerUser(userSnap.data() as User);
          }
        } catch {
          // Graceful fallback if user doc is unavailable
        }
      }

      // Fetch stats from Firestore if connected, otherwise keep local stats
      try {
        const foundQuery = query(collection(db, 'items'), where('userId', '==', item.userId), where('status', '==', ItemStatus.FOUND));
        const lostQuery = query(collection(db, 'items'), where('userId', '==', item.userId), where('status', 'in', [ItemStatus.LOST, ItemStatus.STOLEN]));
        
        const [foundSnap, lostSnap] = await Promise.all([
          getDocs(foundQuery),
          getDocs(lostQuery)
        ]);

        setOwnerStats({
          found: foundSnap.size,
          lost: lostSnap.size
        });
      } catch {
        // Fallback to local memory stats on network/connection failure
      }

      // Fetch reviews and average score
      try {
        const reviewsQ = query(collection(db, 'reviews'), where('targetUserId', '==', item.userId));
        const reviewsSnap = await getDocs(reviewsQ);
        const revsList: Review[] = [];
        let totalStars = 0;
        reviewsSnap.forEach((docSnap) => {
          const data = docSnap.data() as Review;
          revsList.push(data);
          totalStars += data.userRating;
        });
        setOwnerReviews(revsList);
        if (revsList.length > 0) {
          setAverageOwnerRating(totalStars / revsList.length);
        } else {
          setAverageOwnerRating(4.8); // default trusted rating
        }
      } catch {
        setAverageOwnerRating(4.8);
      }
    } catch {
      // General error boundary fallback
    } finally {
      setLoadingOwner(false);
    }
  };

  const images = item.imageUrls && item.imageUrls.length > 0 
    ? item.imageUrls 
    : [item.imageUrl || 'https://picsum.photos/seed/placeholder/400/300'];

  const nextImage = () => {
    setCurrentImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleCheckMatch = async () => {
    setAnalyzing(true);
    const candidates = allContextItems.filter(i => 
      i.id !== item.id && 
      i.status !== item.status && 
      i.category === item.category
    );

    if (candidates.length === 0) {
      alert("Nenhum item similar encontrado no sistema ainda.");
      setAnalyzing(false);
      return;
    }

    const isLostSide = item.status === ItemStatus.LOST || item.status === ItemStatus.STOLEN;
    const topCandidate = candidates[0];
    
    // Determine which is lost and which is found for the AI service
    let lostArg = isLostSide ? item : topCandidate;
    let foundArg = !isLostSide ? item : topCandidate;

    const res = await analyzeItemMatch(lostArg, foundArg);
    
    setMatchResult({ item: topCandidate, result: res });
    setAnalyzing(false);
  };

  const handleCall = () => {
    const phoneNumber = item.ownerPhone || ownerUser?.phone;
    if (phoneNumber) {
      const confirmCall = window.confirm(`Deseja iniciar uma chamada para ${item.ownerName || ownerUser?.name || 'o proprietário'} (${phoneNumber})?`);
      if (confirmCall) {
        window.location.href = `tel:${phoneNumber}`;
      }
    } else {
      alert("Número de telefone não disponível para este publicador.");
    }
  };

  const getStatusLabel = () => {
    switch (item.status) {
      case ItemStatus.LOST: return 'Perdido';
      case ItemStatus.FOUND: return 'Achado';
      case ItemStatus.STOLEN: return 'Roubado';
      case ItemStatus.REUNITED: return 'Recuperado';
      case ItemStatus.IN_TRANSIT: return 'Em Trânsito';
      default: return 'Desconhecido';
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case ItemStatus.LOST: return 'bg-[#d21034] text-white';
      case ItemStatus.FOUND: return 'bg-[#009739] text-white';
      case ItemStatus.STOLEN: return 'bg-red-900 text-white';
      case ItemStatus.REUNITED: return 'bg-[#009739] text-white';
      case ItemStatus.IN_TRANSIT: return 'bg-orange-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const handleShare = async () => {
    setIsSharingNative(true);
    const statusLabel = getStatusLabel().toUpperCase();
    const rewardInfo = item.reward ? `\n💰 Recompensa Garantida: ${item.reward.toLocaleString('pt-MZ')} MT` : '';
    const shareData = {
      title: `ComeBack MZ: ${item.title}`,
      text: `🚨 [ARTIGO ${statusLabel}] ${item.title}\n📍 Local: ${item.location}, ${item.province}\n🏷️ Categoria: ${item.category}${rewardInfo}\n\nAjude a partilhar e recuperar! Detalhes em:`,
      url: window.location.href,
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        // Verificar suporte com canShare se disponível
        if (navigator.canShare && !navigator.canShare(shareData)) {
          await navigator.share({
            title: `ComeBack Moçambique: ${item.title}`,
            url: window.location.href,
          });
        } else {
          await navigator.share(shareData);
        }
        setShareToast({ message: "Artigo partilhado com sucesso!", type: 'success' });
        setTimeout(() => setShareToast(null), 3500);
      } else {
        // Fallback: Copiar para área de transferência
        await navigator.clipboard.writeText(`${shareData.text}\n🔗 ${shareData.url}`);
        setShareToast({ message: "Link e detalhes copiados para a área de transferência!", type: 'success' });
        setTimeout(() => setShareToast(null), 3500);
      }
    } catch (err: any) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError' || (err.message && (err.message.includes('canceled') || err.message.includes('cancelled') || err.message.includes('abort'))))) {
        console.log("Partilha nativa cancelada pelo utilizador.");
      } else {
        console.error("Erro ao invocar Web Share API:", err);
        try {
          await navigator.clipboard.writeText(`${shareData.text}\n🔗 ${shareData.url}`);
          setShareToast({ message: "Link copiado para a área de transferência!", type: 'info' });
          setTimeout(() => setShareToast(null), 3500);
        } catch {
          setShareToast({ message: "Não foi possível partilhar automaticamente.", type: 'error' });
          setTimeout(() => setShareToast(null), 3500);
        }
      }
    } finally {
      setIsSharingNative(false);
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) {
      alert("Por favor, selecione um motivo.");
      return;
    }
    setIsSubmittingReport(true);
    
    try {
      await addDoc(collection(db, 'reports'), {
        itemId: item.id,
        itemTitle: item.title,
        reporterId: currentUser?.id || 'anonymous',
        reporterEmail: currentUser?.email || 'anonymous',
        reason: reportReason,
        details: reportDetails,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      
      alert("Denúncia enviada com sucesso! Nossa equipe irá analisar o conteúdo.");
      setIsSubmittingReport(false);
      setIsReportModalOpen(false);
      setReportReason('');
      setReportDetails('');
    } catch (error) {
      console.error("Error sending report:", error);
      handleFirestoreError(error, OperationType.WRITE, 'reports');
      setIsSubmittingReport(false);
    }
  };

  const suggestions = allContextItems
    .filter(i => i.id !== item.id && i.category === item.category)
    .slice(0, 3);

  const netReward = item.reward ? item.reward * (1 - TOTAL_FEE_PERCENT) : 0;
  const isHighValue = (item.reward && item.reward >= 2000) || [Category.DOCUMENTS, Category.ELECTRONICS, Category.WALLETS, Category.BAGS, Category.KEYS].includes(item.category);

  return (
    <div className="bg-[#f0f3f8] min-h-full pb-28 relative font-sans">
      {/* Top Header matching Souto Brand Palette */}
      <div className="bg-gradient-to-r from-[#0f224a] via-[#153268] to-[#008fe2] text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-lg border-b border-white/10">
        <button 
          onClick={onBack} 
          className="text-white hover:bg-white/20 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center h-10 w-10"
          title="Voltar"
        >
          <i className="fa-solid fa-arrow-left text-lg"></i>
        </button>

        <h2 className="text-base font-bold text-white uppercase tracking-tight text-center truncate flex-1 px-2">
          {item.title}
        </h2>

        <button 
          onClick={handleShare}
          className="text-white hover:bg-white/20 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center h-10 w-10"
          title="Partilhar"
        >
          <i className="fa-solid fa-share-nodes text-base"></i>
        </button>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* 1. Main Image Card (Screenshot 4 - Reclaim Your Belongings!) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-150 overflow-hidden">
          <div className="relative aspect-square max-h-[320px] mx-auto flex items-center justify-center rounded-xl overflow-hidden bg-slate-50">
            <MediaViewer 
              src={item.imageUrl || (item.imageUrls && item.imageUrls[0]) || ''} 
              category={item.category}
              className="w-full h-full object-contain p-2"
            />
            {item.status === ItemStatus.REUNITED && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center overflow-hidden z-10">
                <div className="bg-gradient-to-r from-[#008fe2] to-[#153268] text-white text-xs font-black tracking-widest text-center py-2 w-[150%] -rotate-12 uppercase shadow-lg">
                  RECLAIMED
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Item Details Card (Screenshots 3 & 4) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-150 space-y-4 text-left">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {item.title}
          </h1>

          <div className="space-y-3.5 pt-1 text-sm text-gray-700 font-medium">
            {/* Endereço / Localização */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-solid fa-house text-[#008fe2]"></i>
                <span>Endereço</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {item.location}, {item.province}, Moçambique
              </p>
            </div>

            {/* Publicado por */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-solid fa-user text-[#008fe2]"></i>
                <span>Publicado por</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {item.ownerName || 'Stephanie Huelar / Anónimo'}
              </p>
            </div>

            {/* Correio Eletrónico */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-regular fa-envelope text-[#008fe2]"></i>
                <span>Correio Eletrónico</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {item.ownerEmail || 'contacto@comeback.co.mz'}
              </p>
            </div>

            {/* Contacto */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-solid fa-phone text-[#008fe2]"></i>
                <span>Contacto</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {item.ownerPhone || '+258 84 000 0000'}
              </p>
            </div>

            {/* Categoria */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-solid fa-list-check text-[#008fe2]"></i>
                <span>Categoria</span>
              </div>
              <p className="text-gray-900 font-semibold uppercase pl-6">
                {item.category || 'OUTROS'}
              </p>
            </div>

            {/* Recompensa */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-solid fa-dollar-sign text-[#008fe2]"></i>
                <span>Recompensa</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {item.reward ? `${item.reward.toLocaleString('pt-MZ')} MT` : '0 MT'}
              </p>
            </div>

            {/* Data */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-regular fa-calendar text-[#008fe2]"></i>
                <span>Data</span>
              </div>
              <p className="text-gray-900 font-semibold pl-6">
                {new Date(item.date).toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
              </p>
            </div>

            {/* Descrição */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <i className="fa-regular fa-file-lines text-[#008fe2]"></i>
                <span>Descrição</span>
              </div>
              <p className="text-gray-800 font-medium pl-6 leading-relaxed whitespace-pre-line">
                {item.description || 'Sem descrição detalhada.'}
              </p>
            </div>
          </div>

          {/* Botão de Partilha Rápida com Integração Nativa do Sistema Operativo (Web Share API) */}
          <div className="pt-4 border-t border-gray-150 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <i className="fa-solid fa-share-nodes text-[#008fe2]"></i>
                <span>Partilha Rápida</span>
              </div>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                typeof navigator !== 'undefined' && !!navigator.share
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${typeof navigator !== 'undefined' && !!navigator.share ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                {typeof navigator !== 'undefined' && !!navigator.share
                  ? 'Web Share API Nativa'
                  : 'Cópia Rápida'
                }
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Botão Principal de Partilha Nativa OS */}
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharingNative}
                className="w-full bg-gradient-to-r from-[#008fe2] via-[#1d4ed8] to-[#153268] hover:opacity-95 text-white py-3 px-3.5 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-[#0f224a] group"
                id="quick-web-share-native-btn"
                title="Partilhar com as apps nativas do seu dispositivo (WhatsApp, SMS, Telegram, AirDrop, etc.)"
              >
                <i className={`fa-solid ${isSharingNative ? 'fa-spinner animate-spin' : 'fa-arrow-up-from-bracket'} text-xs group-hover:scale-110 transition-transform text-white`}></i>
                <span>{isSharingNative ? 'A Abrir Menu...' : 'Partilhar com o Sistema'}</span>
              </button>

              {/* Botão Secundário Copiar Link Directo */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setShareToast({ message: "Link copiado para a área de transferência!", type: 'success' });
                    setTimeout(() => setShareToast(null), 3000);
                  } catch {
                    setShareToast({ message: "Erro ao copiar link.", type: 'error' });
                    setTimeout(() => setShareToast(null), 3000);
                  }
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border-2 border-slate-200 py-3 px-3.5 rounded-xl font-black uppercase text-[10px] tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                id="quick-copy-link-details-btn"
                title="Copiar link direto para partilhar em qualquer aplicação"
              >
                <i className="fa-regular fa-copy text-xs text-slate-500"></i>
                <span>Copiar Link Rápido</span>
              </button>
            </div>

            <p className="text-[8.5px] text-gray-400 text-center font-medium leading-tight">
              {typeof navigator !== 'undefined' && !!navigator.share
                ? 'Dispara o menu de partilha nativo do sistema operativo (Android / iOS / Windows / macOS).'
                : 'Copie o link direto para colar em qualquer aplicação ou rede social.'}
            </p>
          </div>

          {/* Denunciar esta Publicação link */}
          <div className="pt-3 border-t border-gray-100 flex justify-center">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="text-gray-700 hover:text-red-600 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors cursor-pointer py-1"
            >
              <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
              <span>Denunciar esta Publicação</span>
            </button>
          </div>
        </div>

        {/* Dynamic Safety Checklist Component */}
        <div className="bg-amber-500/5 dark:bg-amber-400/5 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-amber-500/20 dark:border-amber-400/15 text-left space-y-4 shadow-xs">
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-shield-halved text-amber-600 dark:text-amber-400 text-lg"></i>
              </div>
              <div className="min-w-0">
                <h3 className="text-[9px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest leading-none">Radar de Segurança ComeBack</h3>
                <p className="text-[10px] font-black text-amber-750 dark:text-amber-450 mt-1 uppercase">Dicas e verificações para: {item.category}</p>
              </div>
            </div>
            {Object.keys(completedTips).length > 0 && (
              <span className="text-[8.5px] font-black text-amber-800 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-400/20 px-2 py-0.5 rounded-full uppercase animate-pulse self-start sm:self-center shrink-0">
                {Object.keys(completedTips).length} de {getSafetyTips(item).length} confirmados
              </span>
            )}
          </div>

          <p className="text-[11px] font-medium text-slate-600 dark:text-gray-300 leading-relaxed">
            Antes de agendar o encontro de recolha ou transferir quaisquer valores de gratificação para um item da categoria <strong className="text-amber-800 dark:text-amber-400 font-extrabold">{item.category}</strong>, verifique atentamente os seguintes pontos de segurança recomendados:
          </p>

          <div className="space-y-2.5 pt-1">
            {getSafetyTips(item).map((tip, index) => {
              const isChecked = !!completedTips[index];
              const isHighRisk = tip.isHighRisk;
              return (
                <div 
                  key={index} 
                  onClick={() => setCompletedTips(prev => ({ ...prev, [index]: !prev[index] }))}
                  className={`flex gap-3 items-start p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked 
                      ? isHighRisk 
                        ? 'bg-red-500/10 border-red-500/30 dark:bg-red-950/20 dark:border-red-500/30 opacity-85 translate-x-0.5'
                        : 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-400/10 dark:border-amber-400/20 opacity-85 translate-x-0.5' 
                      : isHighRisk
                        ? 'bg-rose-500/10 border-rose-300 dark:bg-rose-950/20 dark:border-rose-900/40 hover:bg-rose-500/15'
                        : 'bg-white/60 dark:bg-slate-900/60 border-gray-150 dark:border-slate-800 hover:border-amber-500/30'
                  }`}
                >
                  <button 
                    type="button"
                    className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 text-[8px] transition-all border mt-0.5 ${
                      isChecked 
                        ? isHighRisk
                          ? 'bg-red-600 border-red-600 text-white font-black'
                          : 'bg-amber-500 dark:bg-amber-400 border-amber-500 dark:border-amber-400 text-white dark:text-slate-950 font-black' 
                        : isHighRisk
                          ? 'border-red-400 dark:border-red-750 bg-white/50 dark:bg-slate-800 text-transparent hover:border-red-600'
                          : 'border-gray-300 dark:border-slate-700 bg-transparent text-transparent hover:border-amber-500'
                    }`}
                  >
                    <i className="fa-solid fa-check"></i>
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[11px] font-semibold leading-relaxed ${
                      isChecked 
                        ? isHighRisk
                          ? 'text-red-450 dark:text-red-500 line-through decoration-red-500/40'
                          : 'text-slate-400 dark:text-gray-500 line-through decoration-amber-550/40' 
                        : isHighRisk
                          ? 'text-red-950 dark:text-red-300 font-extrabold'
                          : 'text-slate-700 dark:text-gray-200'
                    }`}>
                      {tip.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-dashed border-amber-500/20 dark:border-amber-400/10 flex items-center gap-1.5 text-[8px] font-black text-amber-700/90 dark:text-amber-400 uppercase">
            <i className="fa-solid fa-triangle-exclamation text-[9px] text-amber-600 dark:text-amber-400 shrink-0"></i>
            <span>A sua segurança e bem-estar físico estão sempre em primeiro lugar.</span>
          </div>
        </div>

        {!!item.reward && item.reward > 0 && (
          <div className="bg-[#fce100]/10 p-5 sm:p-6 rounded-3xl border-2 border-[#fce100]/60 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[9px] font-black text-[#7a6d00] uppercase mb-1 tracking-widest">Recompensa (Gratificação)</h3>
                <p className="text-xl sm:text-2xl font-black text-black">{item.reward.toLocaleString()} MT</p>
              </div>
              <div className="bg-[#fce100] p-3 rounded-2xl shadow-sm text-black">
                <i className="fa-solid fa-coins text-xl"></i>
              </div>
            </div>

            {escrowedItems && escrowedItems[item.id] && (
              <div className="bg-[#009739]/10 border-2 border-[#009739] p-4 rounded-2xl flex items-center gap-3 text-[#009739] animate-pulse">
                <i className="fa-solid fa-shield-halved text-2xl shrink-0"></i>
                <div>
                  <h4 className="font-black text-[10px] uppercase tracking-wide">Custodiado via M-Pesa 🇲🇿</h4>
                  <p className="text-[9px] font-bold text-slate-700 mt-0.5 leading-relaxed">
                    Os {item.reward.toLocaleString()} MT de gratificação já se encontram salvaguardados e bloqueados em depósito seguro pela ComeBack.
                  </p>
                </div>
              </div>
            )}
            
            <div className="bg-white/80 p-4 rounded-2xl border border-[#fce100]/40 space-y-2.5 shadow-sm">
               <div className="flex justify-between items-center text-[10px] font-black text-gray-500 uppercase">
                 <span>Valor Oferecido</span>
                 <span className="text-gray-950 font-black">{item.reward.toLocaleString()} MT</span>
               </div>
               
               <div className="space-y-1.5 pt-2 border-t border-dashed border-[#fce100]/50">
                 <div className="flex justify-between items-center text-[9px] font-bold text-[#d21034] uppercase">
                   <span>Comissão Operacional ({(COMMISSION_FEE_PERCENT * 100).toFixed(0)}%)</span>
                   <span>-{(item.reward * COMMISSION_FEE_PERCENT).toLocaleString()} MT</span>
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-bold text-[#d21034] uppercase">
                   <span>Manutenção do Radar ({(MAINTENANCE_FEE_PERCENT * 100).toFixed(0)}%)</span>
                   <span>-{(item.reward * MAINTENANCE_FEE_PERCENT).toLocaleString()} MT</span>
                 </div>
               </div>

               <div className="pt-2 border-t border-dashed border-[#fce100]/50">
                  <div className="flex justify-between items-center text-[10px] font-black text-[#009739] uppercase">
                    <span>Líquido Estimado</span>
                    <span className="text-md font-black text-[#009739]">{netReward.toLocaleString()} MT</span>
                  </div>
               </div>
            </div>
            
            <p className="text-[8px] font-bold text-gray-400 leading-tight uppercase italic text-center">
              * A taxa administrativa de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% é deduzida para apoiar a infraestrutura de intermediação segura ComeBack.
            </p>
          </div>
        )}

        <div className="space-y-3.5 pt-2">
          {/* Alerta de Item Recuperado e Pedido de Remoção */}
          {item.status === ItemStatus.REUNITED && (
            <div className="bg-emerald-50 border-2 border-emerald-100 p-5 rounded-[2rem] flex flex-col gap-3 text-left shadow-xs mt-1 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#009739] text-white p-2.5 rounded-xl">
                  <i className="fa-solid fa-circle-check text-xs"></i>
                </div>
                <div>
                  <span className="font-black text-[11px] text-[#009739] uppercase block leading-none mb-0.5">Item Recuperado com Sucesso!</span>
                  <span className="text-[7.5px] font-black text-gray-500 uppercase tracking-wider block">Procedimento de Devolução Concluído</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed">
                  Este artigo foi marcado como <span className="text-[#009739] font-black">RECUPERADO</span>. Pelas políticas do ComeBack Moçambique:
                </p>
                <ul className="text-[9px] text-gray-500 font-bold uppercase space-y-1 list-disc list-inside">
                  <li>Estará visível ao público durante <span className="text-black font-black">7 dias</span> (restantes: <span className="font-mono text-[#009739] font-black">{(() => {
                    if (!item.reunitedAt) return "7 dias";
                    const daysRemaining = 7 - (Date.now() - new Date(item.reunitedAt).getTime()) / (1000 * 60 * 60 * 24);
                    return daysRemaining > 0 ? `${daysRemaining.toFixed(1)} dias` : 'Expirado';
                  })()}</span>).</li>
                  <li>Depois deste período, será removido e deletado permanentemente da base de dados para garantir a privacidade do proprietário.</li>
                </ul>

                {item.reunitedProofUrl && (
                  <div className="mt-3 bg-white p-4 rounded-3xl border border-emerald-100 flex flex-col items-center shadow-xs">
                    <span className="text-[8px] font-black text-[#009739] uppercase tracking-wider block mb-2 text-center select-none">
                      📌 Foto de Prova Registada:
                    </span>
                    <div className="aspect-square w-full max-w-[180px] bg-slate-50 rounded-2xl overflow-hidden border border-gray-150 flex items-center justify-center p-1.5 shadow-inner">
                      <MediaViewer src={item.reunitedProofUrl} className="w-full h-full object-contain rounded-xl" />
                    </div>
                    {item.reunitedProofNotes && (
                      <p className="text-[8.5px] font-black text-gray-550 uppercase mt-2.5 text-center leading-normal max-w-xs">
                        Nota: "{item.reunitedProofNotes}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {currentUser && currentUser.id === item.userId && (
                <div className="pt-2 border-t border-dashed border-emerald-200 flex flex-col gap-2">
                  <p className="text-[9px] text-gray-500 font-bold uppercase">
                    Se já recebeu o item e deseja acelerar o processo, pode solicitar a remoção imediata aos administradores:
                  </p>
                  {item.removalRequested ? (
                    <div className="bg-emerald-100/60 p-3 rounded-xl border border-emerald-200 text-[#009739] font-black text-[9.5px] uppercase tracking-wide text-center flex items-center justify-center gap-1.5">
                      <i className="fa-solid fa-hourglass-half"></i>
                      <span>Remoção Solicitada aos Administradores</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestRemoval}
                      disabled={requestingRemoval}
                      className="w-full bg-black hover:bg-red-650 text-[#fce100] hover:text-white py-3.5 rounded-xl font-black uppercase text-[9.5px] tracking-wider shadow-sm active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                      <span>{requestingRemoval ? 'A processar...' : 'Solicitar Remoção Imediata'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Central de Pânico se Roubado */}
          {item.status === ItemStatus.STOLEN && (
            <div className="bg-red-50 border-2 border-red-100 p-4 rounded-[2rem] flex flex-col gap-2.5 text-left shadow-xs mt-1 animate-in fade-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-2.5">
                <div className="bg-red-600 text-white p-2.5 rounded-xl">
                  <i className="fa-solid fa-triangle-exclamation text-xs animate-bounce"></i>
                </div>
                <div>
                  <span className="font-black text-[11px] text-[#d21034] uppercase block leading-none mb-0.5">Segurança & Pânico Ativo</span>
                  <span className="text-[7.5px] font-black text-gray-450 uppercase tracking-wider block">Artigo Identificado Como Roubado</span>
                </div>
              </div>
              <p className="text-[9.5px] text-gray-550 font-bold uppercase leading-relaxed">
                Se detetou este artigo ou está numa situação de risco ao recuperar, <span className="text-[#d21034] font-black">NÃO CONFRONTE SUSPEITOS</span>. Ative o botão SOS para encaminhar a localização aos seus contactos de emergência e ao suporte especializado ComeBack.
              </p>
              <button 
                onClick={handleActivatePanic}
                className="w-full bg-red-600 hover:bg-red-750 text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md active:scale-[0.97] transition-all flex items-center justify-center gap-2 border-b-4 border-red-800"
              >
                <i className="fa-solid fa-bell-on text-xs animate-ring"></i>
                <span>Ativar Botão de Pânico (SOS)</span>
              </button>
              <button 
                onClick={() => setIsPoliceModalOpen(true)}
                className="w-full bg-[#d21034] hover:bg-red-700 text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md active:scale-[0.97] transition-all flex items-center justify-center gap-2 border-b-4 border-[#a50d29]"
              >
                <i className="fa-solid fa-file-shield text-xs"></i>
                <span>Alertar Autoridades (PRM)</span>
              </button>
            </div>
          )}

          {/* Primary Action Button based on Status */}
          {(item.status === ItemStatus.LOST || item.status === ItemStatus.STOLEN) ? (
            <button 
              onClick={() => {
                const initialMsg = `🤝 Olá! Eu encontrei o seu artigo "${item.title}" que foi publicado como perdido/roubado. Gostaria de combinar o encontro de entrega.`;
                onStartChat(item, initialMsg);
              }}
              className="w-full bg-[#009739] text-white py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-[#008f35] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 border-b-4 border-[#007a2d]"
            >
              <i className="fa-solid fa-hand-holding-heart text-base animate-pulse"></i>
              <span>Eu achei este Artigo!</span>
            </button>
          ) : item.status === ItemStatus.FOUND ? (
            <button 
              onClick={() => setIsClaimModalOpen(true)}
              className="w-full bg-[#d21034] text-white py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-[#bf0e2e] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 border-b-4 border-[#a50d29]"
            >
              <i className="fa-solid fa-user-check text-base animate-pulse"></i>
              <span>É MEU! (Reivindicar Artigo)</span>
            </button>
          ) : null}

          {/* Quick Contacts Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                if (item.status === ItemStatus.LOST || item.status === ItemStatus.STOLEN) {
                  const initialMsg = `🤝 Olá! Eu encontrei o seu artigo "${item.title}" que foi publicado como perdido/roubado. Gostaria de combinar o encontro de entrega.`;
                  onStartChat(item, initialMsg);
                } else {
                  setIsClaimModalOpen(true);
                }
              }}
              className="bg-black text-[#fce100] py-3.5 rounded-xl font-black uppercase tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-2 text-center text-[10px]"
            >
              <i className="fa-solid fa-message text-xs"></i> 
              <span>Chat Integrado</span>
            </button>
            <button 
              onClick={handleCall}
              className="bg-[#fce100] text-black py-3.5 rounded-xl font-black uppercase tracking-wider shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-2 text-center text-[10px]"
              title="Ligar ao Proprietário"
            >
              <i className="fa-solid fa-phone text-xs animate-bounce" style={{ animationDuration: '3s' }}></i> 
              <span>Ligar Agora</span>
            </button>
          </div>

          {/* Secondary Actions Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setIsOwnerModalOpen(true)}
              className="py-3 rounded-xl font-black uppercase tracking-wider border-2 border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] px-2 text-[10px]"
            >
              <i className="fa-solid fa-circle-user text-xs"></i>
              <span>Ver Publicador</span>
            </button>

            <button 
              onClick={handleShare}
              className="py-3 rounded-xl font-black uppercase tracking-wider border-2 border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] px-2 text-[10px]"
            >
              <i className="fa-solid fa-share-nodes text-xs"></i>
              <span>Partilhar Link</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button 
              id="btn-police-report-pdf"
              onClick={() => setIsPoliceModalOpen(true)}
              className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 text-blue-900 py-3 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] px-3 text-[10px] shadow-2xs transition-all cursor-pointer"
              title="Gerar e descarregar relatório formal em PDF para submissão à Polícia (PRM)"
            >
              <i className="fa-solid fa-file-pdf text-sm text-[#d21034]"></i>
              <span>Relatório Policial (PDF)</span>
            </button>

            <button 
              id="btn-whatsapp-poster"
              onClick={() => setIsWhatsappPosterModalOpen(true)}
              className="w-full bg-[#25d366]/20 border-2 border-[#25d366]/40 text-slate-800 hover:bg-[#25d366]/30 py-3 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] px-3 text-[10px] transition-all cursor-pointer"
            >
              <i className="fa-brands fa-whatsapp text-sm text-[#25d366]"></i>
              <span>Cartaz WhatsApp</span>
            </button>
          </div>

          {/* Grupo de Botões de Compartilhar via Rede Social */}
          <div className="bg-slate-50 border-2 border-slate-100 p-4.5 rounded-[1.75rem] space-y-3.5 shadow-inner text-left">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#009739]"></span>
                  <span>Compartilhar nas Redes Sociais</span>
                </h4>
                <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 leading-normal">
                  Dissemine este post para acelerar a busca e ajudar a comunidade local.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {/* WhatsApp */}
              <button 
                onClick={() => {
                  const msgText = `🚨 *ComeBack Moçambique - ARTIGO ${item.status === ItemStatus.LOST ? 'PERDIDO' : item.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨\n\n*Artigo:* ${item.title}\n*Província:* ${item.province}\n*Local aproximado:* ${item.location}\n${item.reward ? `*Gratificação:* ${item.reward.toLocaleString()} MT (Em Custódia Segura) 💰\n` : ''}\nAjude-nos a recuperar! Veja todos os detalhes aqui:\n`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}%20${encodeURIComponent(window.location.href)}`, '_blank');
                }}
                className="bg-[#25D366]/10 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/20 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-[1.03] transition-all duration-200 group active:scale-95 cursor-pointer"
                title="Partilhar no WhatsApp"
              >
                <i className="fa-brands fa-whatsapp text-lg group-hover:scale-110 transition-transform text-[#25D366]"></i>
                <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">WhatsApp</span>
              </button>

              {/* Facebook */}
              <button 
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
                }}
                className="bg-[#1877F2]/10 hover:bg-[#1877F2]/25 text-[#1877F2] border border-[#1877F2]/20 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-[1.03] transition-all duration-200 group active:scale-95 cursor-pointer"
                title="Partilhar no Facebook"
              >
                <i className="fa-brands fa-facebook-f text-base group-hover:scale-110 transition-transform text-[#1877F2]"></i>
                <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">Facebook</span>
              </button>

              {/* Twitter / X */}
              <button 
                onClick={() => {
                  const tweetText = `🚨 @ComeBackMZ - ${item.status === ItemStatus.LOST ? 'Perdido' : 'Achado'}: ${item.title} em ${item.location}. Ajude a recuperar!`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(window.location.href)}`, '_blank');
                }}
                className="bg-black/5 hover:bg-black/10 text-gray-900 border border-black/10 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-[1.03] transition-all duration-200 group active:scale-95 cursor-pointer"
                title="Postar no X (Twitter)"
              >
                <i className="fa-brands fa-x-twitter text-base group-hover:scale-110 transition-transform"></i>
                <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">Twitter</span>
              </button>

              {/* Telegram */}
              <button 
                onClick={() => {
                  const shareText = `ComeBack Moçambique: ${item.status === ItemStatus.LOST ? 'Perdido' : 'Achado'} - ${item.title}`;
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`, '_blank');
                }}
                className="bg-[#26A5E4]/10 hover:bg-[#26A5E4]/25 text-[#26A5E4] border border-[#26A5E4]/20 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-[1.03] transition-all duration-200 group active:scale-95 cursor-pointer"
                title="Partilhar no Telegram"
              >
                <i className="fa-brands fa-telegram text-base group-hover:scale-110 transition-transform text-[#26A5E4]"></i>
                <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">Telegram</span>
              </button>

              {/* SMS */}
              <button 
                onClick={() => {
                  const itemStatusText = item.status === ItemStatus.LOST ? 'PERDIDO' : item.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO';
                  const text = `ComeBack MZ: ${itemStatusText} - ${item.title}. Veja em: ${window.location.href}`;
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const smsUrl = `sms:${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`;
                  window.open(smsUrl, '_blank');
                }}
                className="bg-amber-500/10 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/20 p-2.5 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 hover:scale-[1.03] transition-all duration-200 group active:scale-95 cursor-pointer"
                title="Partilhar por SMS"
              >
                <i className="fa-solid fa-comment-sms text-base group-hover:scale-110 transition-transform text-amber-600 dark:text-amber-400"></i>
                <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">SMS</span>
              </button>
            </div>

            {/* Ação Direta de Partilha com o Sistema */}
            <div className="pt-1 border-t border-slate-200/60">
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharingNative}
                className="w-full bg-slate-900 hover:bg-black text-[#fce100] py-2.5 px-3 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <i className={`fa-solid ${isSharingNative ? 'fa-spinner animate-spin' : 'fa-share-from-square'} text-xs`}></i>
                <span>{isSharingNative ? 'A Abrir Partilha...' : 'Abrir Menu de Partilha do Sistema (Mais Aplicações)'}</span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button 
              onClick={() => setIsReportModalOpen(true)}
              className="py-3.5 rounded-xl font-black uppercase tracking-wider bg-red-50/50 border-2 border-red-100/50 text-[#d21034] hover:bg-red-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-[10px]"
            >
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> 
              <span>Denunciar Artigo</span>
            </button>
            
            <button 
              onClick={handleCheckMatch}
              disabled={analyzing}
              className={`py-3.5 rounded-xl font-black uppercase tracking-wider border-2 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-[10px] ${
                analyzing ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-black text-black hover:bg-gray-50'
              }`}
            >
              {analyzing ? (
                <i className="fa-solid fa-spinner animate-spin text-xs"></i>
              ) : (
                <i className="fa-solid fa-wand-magic-sparkles text-xs text-indigo-500"></i>
              )}
              <span>{analyzing ? 'Analisando...' : 'Verificar Match IA'}</span>
            </button>
          </div>
        </div>

        {matchResult && (
          <div className="bg-gradient-to-br from-indigo-700 to-purple-800 p-5 sm:p-6 rounded-3xl text-white shadow-lg animate-in zoom-in-95 duration-500 text-left">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-white/15 p-2 rounded-xl">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <h3 className="font-black text-[10px] uppercase tracking-widest">Resultado IA</h3>
              </div>
              <div className="bg-[#fce100] text-black px-3 py-1 rounded-full font-black text-[10px] uppercase">
                {matchResult.result.similarity}% de Match
              </div>
            </div>
            
            <p className="text-xs font-semibold mb-5 bg-black/10 p-4 rounded-xl border border-white/5 italic">
              "{matchResult.result.reasoning}"
            </p>
            
            <div 
              className="bg-white rounded-2xl p-3.5 flex items-center gap-3 text-black cursor-pointer hover:bg-gray-50 transition-colors shadow-xs" 
              onClick={() => onViewItem(matchResult.item)}
            >
              <MediaViewer src={matchResult.item.imageUrl || ''} className="w-11 h-11 rounded-xl object-cover shadow-xs shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[8px] font-black text-indigo-600 uppercase mb-0.5">{matchResult.item.category}</div>
                <div className="font-black text-xs truncate uppercase">{matchResult.item.title}</div>
              </div>
              <i className="fa-solid fa-chevron-right text-gray-300"></i>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <button 
                onClick={() => {
                  window.scrollTo(0, 0);
                  onViewItem(matchResult.item);
                }}
                className="bg-white/10 hover:bg-white/20 border border-white/15 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] shadow-sm px-1 text-center"
              >
                <i className="fa-solid fa-eye text-[9px]"></i> Visualizar
              </button>
              <button 
                onClick={() => onStartChat(matchResult.item)}
                className="bg-[#fce100] hover:bg-[#edce00] text-black py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5 px-1 text-center"
              >
                <i className="fa-solid fa-message text-[9px]"></i> Conversar
              </button>
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3 pt-4 text-left">
            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Itens Sugeridos</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
              {suggestions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => onViewItem(s)}
                  className="min-w-[130px] max-w-[130px] bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:border-gray-200 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <img src={s.imageUrl} className="w-full h-20 object-cover" alt="" />
                  <div className="p-2.5">
                    <h4 className="font-black text-[9px] line-clamp-1 uppercase leading-snug">{s.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seção de Comentários e Avistamentos */}
        <div id="comments-section" className="space-y-4 pt-6 border-t border-gray-100 text-left">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-comments text-[#009739]"></i>
                Comentários e Avistamentos
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                Ofereça pistas, localizações ou avistamentos sobre este artigo
              </p>
            </div>
            <span className="bg-gray-100 text-gray-700 font-mono text-xs font-bold px-2.5 py-1 rounded-full">
              {comments.length}
            </span>
          </div>

          {/* Form para novo comentário */}
          {currentUser ? (
            <form onSubmit={handleAddComment} className="space-y-3">
              <div className="relative">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escreva novas informações, pistas ou descreva onde viu o artigo perdidos ou roubados..."
                  maxLength={2000}
                  className="w-full min-h-[90px] p-3 text-xs sm:text-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#009739]/50 placeholder-gray-400 font-semibold"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submittingComment || !newCommentText.trim()}
                  className="bg-[#009739] hover:bg-[#008f35] text-white disabled:bg-gray-200 disabled:text-gray-400 font-black uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {submittingComment ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>A adicionar...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      <span>Comentar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-center">
              <p className="text-xs font-bold text-gray-500 uppercase leading-relaxed">
                Pretende dar pistas ou partilhar informações?
              </p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mt-0.5">
                Faça login para poder participar e contribuir nesta busca.
              </p>
            </div>
          )}

          {/* Lista de comentários */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <div className="text-center py-6 text-gray-450 uppercase text-[10px] font-black tracking-wider bg-gray-55/40 rounded-2xl">
                Nenhum comentário ou pista até ao momento.
              </div>
            ) : (
              comments.map((c) => {
                const isItemOwner = c.userId === item.userId;
                const canDelete = currentUser && (currentUser.id === c.userId || currentUser.isAdmin || currentUser.isSuperAdmin);

                return (
                  <div key={c.id} className="bg-gray-50/70 hover:bg-gray-50 border border-gray-100/60 p-3.5 rounded-2xl space-y-2 transition-all duration-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={c.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`}
                          alt={c.userName}
                          className="w-7 h-7 rounded-full object-cover shadow-sm bg-white border border-gray-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-black text-xs text-gray-800 truncate uppercase">{c.userName}</span>
                            {isItemOwner && (
                              <span className="bg-[#009739]/10 text-[#009739] text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">
                                Editor do Post
                              </span>
                            )}
                          </div>
                          <span className="text-[8px] font-mono font-bold text-gray-400 block uppercase mt-0.5">
                            {new Date(c.createdAt).toLocaleString('pt-MZ', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer text-left"
                          title="Eliminar este comentário"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      )}
                    </div>

                    <p className="text-gray-700 text-xs sm:text-sm font-semibold whitespace-pre-line leading-relaxed pl-1 text-left">
                      {c.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions (Ligar & SMS em tons Souto Navy e Azure) */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 border-t border-gray-200 dark:border-slate-800 z-40 shadow-lg">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <button 
            type="button"
            onClick={handleCall}
            className="bg-gradient-to-r from-[#008fe2] to-[#1d4ed8] hover:opacity-95 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl text-center text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-phone text-xs"></i>
            <span>Ligar</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (item.ownerPhone) {
                const text = `Olá! Vi a sua publicação sobre "${item.title}" no ComeBack Moçambique.`;
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                window.open(`sms:${item.ownerPhone}${isIOS ? '&' : '?'}body=${encodeURIComponent(text)}`, '_blank');
              } else {
                const initialMsg = `Olá! Vi a publicação "${item.title}" e pretendo conversar.`;
                onStartChat(item, initialMsg);
              }
            }}
            className="bg-[#0f224a] hover:bg-[#153268] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl text-center text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#008fe2]/20"
          >
            <i className="fa-solid fa-comment-sms text-xs text-[#008fe2]"></i>
            <span>Enviar SMS</span>
          </button>
        </div>
      </div>

      {/* Modal de Detalhes do Proprietário */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOwnerModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            {loadingOwner && (
              <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                <i className="fa-solid fa-circle-notch animate-spin text-2xl text-[#009739]"></i>
              </div>
            )}
            
            <button 
              onClick={() => setIsOwnerModalOpen(false)}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors z-30"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-tr from-[#009739] to-[#fce100] rounded-full mx-auto mb-6 p-1 shadow-xl">
                <div className="bg-white rounded-full w-full h-full flex items-center justify-center overflow-hidden border-4 border-white">
                  <img src={ownerUser?.documentImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.userId}`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              </div>
              
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{ownerUser?.name || item.ownerName || 'Utilizador ComeBack'}</h2>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i 
                    key={star}
                    className={`fa-solid fa-star text-[10px] ${
                      averageOwnerRating >= star ? 'text-[#fce100]' : 'text-gray-200'
                    }`}
                  ></i>
                ))}
                <span className="text-[9px] font-black text-gray-400 uppercase ml-1">{averageOwnerRating.toFixed(1)} ({ownerReviews.length} {ownerReviews.length === 1 ? 'avaliação' : 'avaliações'})</span>
              </div>
              
              {(ownerUser?.isVerified || item.userId.startsWith('u')) && (
                <p className="text-xs font-black text-[#009739] uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
                  <i className="fa-solid fa-circle-check"></i>
                  Membro Verificado
                </p>
              )}
              
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="text-lg font-black text-[#009739]">{ownerStats.found.toString().padStart(2, '0')}</div>
                  <div className="text-[8px] font-black text-gray-400 uppercase">Itens Achados</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="text-lg font-black text-[#d21034]">{ownerStats.lost.toString().padStart(2, '0')}</div>
                  <div className="text-[8px] font-black text-gray-400 uppercase">Perdidos</div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#fce100] p-2 rounded-xl text-black">
                      <i className="fa-solid fa-phone"></i>
                    </div>
                    <div className="text-left">
                      <div className="text-[8px] font-black text-gray-400 uppercase">Contacto</div>
                      <div className="text-sm font-black text-gray-800">{ownerUser?.phone || item.ownerPhone || 'Não disponível'}</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleCall}
                    className="bg-black text-white p-3 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-md"
                  >
                    <i className="fa-solid fa-phone-flip"></i>
                  </button>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3 border border-gray-100">
                  <div className="bg-[#009739] p-2 rounded-xl text-white">
                    <i className="fa-solid fa-location-dot"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-[8px] font-black text-gray-400 uppercase">Localização</div>
                    <div className="text-sm font-black text-gray-800">{item.province}</div>
                  </div>
                </div>

                {/* Bloco de Avaliações Recebidas e Estatísticas de Confiança */}
                <div className="bg-gray-50/50 p-1 border border-gray-100 rounded-[1.75rem] overflow-hidden text-left shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowReviewsTab(!showReviewsTab)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white rounded-[1.5rem] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="bg-amber-50 text-[#009739] p-2 rounded-xl border border-white">
                        <i className="fa-solid fa-star-half-stroke"></i>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-wider block leading-none">Avaliações do Membro</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mt-1">{ownerReviews.length} {ownerReviews.length === 1 ? 'Avaliação Recebida' : 'Avaliações Recebidas'}</span>
                      </div>
                    </div>
                    <div className="text-gray-400 mr-1.5">
                      <i className={`fa-solid ${showReviewsTab ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                    </div>
                  </button>

                  {showReviewsTab && (
                    <div className="p-3.5 pt-1 space-y-3 max-h-[180px] overflow-y-auto no-scrollbar border-t border-gray-100/55 animate-in slide-in-from-top-2 duration-150 bg-white/40">
                      {ownerReviews.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider font-mono">Nenhuma avaliação registada até ao momento.</p>
                        </div>
                      ) : (
                        ownerReviews.map((rev) => (
                          <div key={rev.id} className="text-left bg-white p-3 rounded-[1.25rem] border border-gray-100 space-y-1.5 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <img src={rev.reviewerPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rev.reviewerId}`} alt="Reviewer" className="w-[18px] h-[18px] rounded-full object-cover" />
                                <div>
                                  <h4 className="text-[9px] font-black text-gray-800 truncate max-w-[100px] leading-tight">{rev.reviewerName}</h4>
                                  <span className="text-[7.5px] text-gray-405 font-mono">{new Date(rev.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <i key={s} className={`fa-solid fa-star text-[7px] ${s <= rev.userRating ? 'text-[#fce100]' : 'text-gray-200'}`}></i>
                                ))}
                              </div>
                            </div>
                            <p className="text-[9.5px] text-gray-600 font-bold leading-normal italic">"{rev.feedback}"</p>
                            <div className="text-[7.5px] font-black text-[#009739] uppercase tracking-wide flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg w-fit font-mono">
                              <i className="fa-solid fa-tag"></i>
                              Ref: {rev.itemTitle}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setIsOwnerModalOpen(false);
                  setIsClaimModalOpen(true);
                }}
                className="w-full mt-8 bg-black text-[#fce100] py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <i className="fa-solid fa-message"></i> Iniciar Conversa
              </button>
              
              <p className="mt-6 text-[9px] font-bold text-gray-400 uppercase leading-relaxed">
                <i className="fa-solid fa-shield-halved mr-1 text-[#d21034]"></i>
                Por segurança, combine encontros em locais públicos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Denúncia */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsReportModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-50 text-[#d21034] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl border-4 border-white shadow-lg">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h2 className="text-xl font-black text-gray-900 uppercase">Denunciar Item</h2>
              <p className="text-xs font-bold text-gray-400 mt-1">Ajude-nos a manter a comunidade segura.</p>
            </div>

            <form onSubmit={handleSendReport} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Motivo da Denúncia</label>
                <div className="space-y-2">
                  {[
                    { id: 'incorrect', label: 'Item Incorreto' },
                    { id: 'false_info', label: 'Informação Falsa' },
                    { id: 'spam', label: 'Spam' },
                    { id: 'other', label: 'Outro Motivo' }
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`w-full p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-center gap-3 ${
                        reportReason === option.id 
                          ? 'border-[#d21034] bg-red-50 text-[#d21034]' 
                          : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-100'
                      }`}
                    >
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="reportReason"
                          className="sr-only"
                          checked={reportReason === option.id}
                          onChange={() => setReportReason(option.id)}
                        />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          reportReason === option.id ? 'border-[#d21034]' : 'border-gray-300'
                        }`}>
                          {reportReason === option.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#d21034] animate-in zoom-in duration-200"></div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-bold">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Detalhes Adicionais (Opcional)</label>
                <textarea
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-[#d21034] rounded-2xl p-4 text-xs font-bold outline-none transition-all h-24 resize-none shadow-inner"
                  placeholder="Explique o que há de errado..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-xs text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport || !reportReason}
                  className="flex-[2] bg-[#d21034] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg shadow-red-200 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {isSubmittingReport ? (
                    <i className="fa-solid fa-circle-notch animate-spin mr-2"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane mr-2"></i>
                  )}
                  {isSubmittingReport ? 'Enviando...' : 'Enviar Denúncia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Negociação e Resgate - Recompensa Liquida e Lances */}
      {isRescueModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsRescueModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-7 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-left">
            
            <button 
              onClick={() => {
                setIsRescueModalOpen(false);
                setIsNegotiating(false);
                setBidValue('');
              }}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors z-30"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-[#009739]/10 text-[#009739] rounded-full flex items-center justify-center mx-auto mb-3 text-xl border-4 border-white shadow-md">
                <i className="fa-solid fa-hand-holding-heart animate-pulse"></i>
              </div>
              <h2 className="text-lg font-black text-gray-900 uppercase">Resgatar Artigo</h2>
              <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase">Radar ComeBack • Negociação Direta</p>
            </div>

            <div className="space-y-4">
              {/* Seção das Informações de Recompensa Deduzida */}
              <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase">Recompensa Comercial</span>
                  <span className="text-xs font-black text-gray-700">{item.reward ? `${item.reward.toLocaleString()} MT` : 'Sem Gratificação'}</span>
                </div>
                
                {item.reward ? (
                  <>
                    <div className="flex justify-between items-center text-[9px] font-bold text-red-500 mb-2.5 border-b border-dashed border-gray-200 pb-2">
                      <span>Taxa Operacional & Custódia ({(TOTAL_FEE_PERCENT * 100).toFixed(0)}%)</span>
                      <span>-{(item.reward * TOTAL_FEE_PERCENT).toLocaleString()} MT</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[8px] font-black text-[#009739] uppercase">Líquido Descontado</div>
                        <div className="text-md font-black text-[#009739]">{netReward.toLocaleString()} MT</div>
                      </div>
                      <div className="bg-[#009739]/10 text-[#009739] px-2 py-0.5 rounded-md text-[8px] font-black uppercase mb-0.5">
                        {((1 - TOTAL_FEE_PERCENT) * 100).toFixed(0)}% Líquido
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-[9px] font-semibold text-gray-500 leading-normal">
                    Este artigo não possui recompensa pré-definida. Pode submeter uma contraproposta ou lance para cobrir os seus custos de entrega abaixo!
                  </p>
                )}
              </div>

              {!isNegotiating ? (
                <div className="space-y-2.5 pt-1">
                  {item.reward ? (
                    <button
                      onClick={() => {
                        const initialMsg = `🤝 NOTA DE NEGOCIAÇÃO: Encontrei o seu artigo e aceito a recompensa sugerida de ${item.reward?.toLocaleString()} MT (Valor líquido real a receber: ${netReward.toLocaleString()} MT após dedução de 12% administrativa da plataforma). Pronto para combinar o local de entrega!`;
                        setIsRescueModalOpen(false);
                        onStartChat(item, initialMsg);
                      }}
                      className="w-full bg-[#009739] text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <i className="fa-solid fa-check text-xs"></i>
                      <span>Aceitar {netReward.toLocaleString()} MT Líquidos</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => setIsNegotiating(true)}
                    className="w-full bg-black text-[#fce100] py-3.5 rounded-xl font-black uppercase text-[10px] tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-scale-unbalanced-flip text-xs"></i>
                    <span>{item.reward ? 'Propor Outro Valor (Lance)' : 'Sugerir Valor de Recompensa'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3.5 pt-0.5 animate-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1">Introduzir Novo Lance (MT)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex: 2000"
                        className="w-full bg-white border-2 border-gray-100 focus:border-[#009739] rounded-xl p-3 text-xs font-bold outline-none"
                        value={bidValue}
                        onChange={(e) => setBidValue(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">MT</span>
                    </div>
                  </div>

                  {bidValue && Number(bidValue) > 0 && (
                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/50 flex justify-between items-center text-left">
                      <div>
                        <div className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">Seu Líquido Estimado</div>
                        <div className="text-xs font-black text-[#009739]">{(Number(bidValue) * (1 - TOTAL_FEE_PERCENT)).toLocaleString('pt-MZ', { maximumFractionDigits: 0 })} MT</div>
                      </div>
                      <div className="text-[7px] font-bold text-gray-400 uppercase text-right leading-none max-w-[120px]">
                        Comissão de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% retida.
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNegotiating(false);
                        setBidValue('');
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-[10px] uppercase transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={!bidValue || Number(bidValue) <= 0}
                      onClick={() => {
                        const bidNum = Number(bidValue);
                        const bidNet = bidNum * (1 - TOTAL_FEE_PERCENT);
                        const initialMsg = `⚖️ NOTA DE NEGOCIAÇÃO: Encontrei o seu artigo e propus um lance alternativo de recompensa de ${bidNum.toLocaleString()} MT (Valor líquido real a receber: ${bidNet.toLocaleString('pt-MZ', { maximumFractionDigits: 0 })} MT após retenção operacional de 12%). Aguardo a sua aceitação ou contraproposta!`;
                        setIsRescueModalOpen(false);
                        setIsNegotiating(false);
                        setBidValue('');
                        onStartChat(item, initialMsg);
                      }}
                      className="flex-[2] bg-black text-[#fce100] py-3 rounded-xl font-black text-[10px] uppercase shadow-xs active:scale-95 transition-all disabled:opacity-30"
                    >
                      Enviar Lance
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-[8px] font-bold text-gray-400 leading-tight uppercase italic text-center">
              * A taxa administrativa de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% apoia a infraestrutura ComeBack. Combine com cuidado.
            </p>
          </div>
        </div>
      )}

      {/* Modal Autopreenchido para Esquadra da PRM quando Roubado */}
      {isPoliceModalOpen && (
        <PoliceReportPDFModal 
          isOpen={isPoliceModalOpen} 
          onClose={() => setIsPoliceModalOpen(false)} 
          item={item} 
        />
      )}

      {/* Modal de Reivindicação de Propriedade do Artigo - Prova de Propriedade Exclusiva */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => {
            setIsClaimModalOpen(false);
            setProofPhoto('');
            setProofDescription('');
          }}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] p-7 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-left">
            
            <button 
              onClick={() => {
                setIsClaimModalOpen(false);
                setProofPhoto('');
                setProofDescription('');
              }}
              className="absolute top-6 right-6 text-gray-300 hover:text-black transition-colors z-30"
            >
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>

            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-red-100 text-[#d21034] rounded-full flex items-center justify-center mx-auto mb-3 text-xl border-4 border-white shadow-md animate-pulse">
                <i className="fa-solid fa-shield-halved text-sm"></i>
              </div>
              <h2 className="text-lg font-black text-gray-900 uppercase">
                Prova de Propriedade
              </h2>
              <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase">Radar ComeBack • Verificação de Posse Exclusiva</p>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 text-left space-y-1">
                <h3 className="text-xs font-black text-[#d21034] uppercase flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation animate-bounce"></i>
                  Verificação do Dono Original
                </h3>
                <p className="text-[10px] text-red-700 font-bold uppercase leading-relaxed mb-0">
                  Este artigo foi achado por outra pessoa. Para sua segurança e conformidade, é estritamente de caráter obrigatório provar que é realmente o dono, fornecendo prova visual antes de aceder ao chat direto.
                </p>
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 ml-1">
                  Carregar Foto da Prova (Obrigatório)
                </label>
                {proofPhoto ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-gray-100 shadow-inner group">
                    <img src={proofPhoto} alt="Upload proof" className="w-full h-44 object-cover" />
                    <button 
                      type="button"
                      onClick={() => setProofPhoto('')}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all shadow-md active:scale-90"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-[#d21034] rounded-2xl h-44 cursor-pointer bg-gray-50/50 hover:bg-red-50/10 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-red-50 text-[#d21034] flex items-center justify-center mb-3 text-lg group-hover:scale-110 transition-all border border-red-100 shadow-inner">
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                      </div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">
                        Carregar Foto de Prova
                      </p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase mt-1 leading-normal max-w-[200px] text-center">
                        Carregue a foto do documento idêntico perdido (BI, etc.), factura de compra, número de série ou chave reserva correspondente.
                      </p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          const file = files[0];
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            const base64 = event.target?.result as string;
                            const compressed = await compressImage(base64, 800, 800, 0.6);
                            setProofPhoto(compressed);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 ml-1">
                  Explique de que forma este artigo é seu (BI, Marcas, Ricos Secretos)
                </label>
                <textarea
                  className="w-full bg-gray-50 border-2 border-gray-100 focus:border-[#d21034] rounded-2xl p-4 text-xs font-bold outline-none h-24 resize-none shadow-inner"
                  placeholder="Ex: O documento com meu nome completo gravado, ou a chave tem um porta-chaves azul que diz..."
                  value={proofDescription}
                  onChange={(e) => setProofDescription(e.target.value)}
                ></textarea>
                <p className="text-[8px] text-gray-400 font-medium italic mt-1 uppercase text-right">Ambos os passos são registados de forma segura.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsClaimModalOpen(false);
                    setProofPhoto('');
                    setProofDescription('');
                  }}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isUploadingProof || !proofDescription.trim() || !proofPhoto}
                  onClick={handleSubmitProof}
                  className="flex-[2] bg-[#d21034] text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-wider shadow-md hover:bg-[#bf0e2e] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  {isUploadingProof ? (
                    <i className="fa-solid fa-circle-notch animate-spin text-[9px]"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane text-[9px]"></i>
                  )}
                  <span>{isUploadingProof ? 'Enviando...' : 'Submeter e Iniciar Chat'}</span>
                </button>
              </div>
            </div>

            <p className="mt-4 text-[8px] font-bold text-gray-400 leading-tight uppercase italic text-center">
              * A partilha de informações corretas e precisas de posse direta acelera a devolução segura de forma totalmente idónea.
            </p>
          </div>
        </div>
      )}

      {/* Modal do Gerador de Cartaz de WhatsApp com Thumbnail do Artigo */}
      {isWhatsappPosterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsWhatsappPosterModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            
            {/* Header com Ícone e Fechar */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#25d366]/10 text-[#128C7E] flex items-center justify-center text-xl shadow-inner border border-[#25d366]/20">
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-950 tracking-wider">Cartaz de Divulgação</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">WhatsApp & Redes Sociais</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWhatsappPosterModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:text-gray-700 hover:bg-gray-250 flex items-center justify-center transition-all active:scale-90"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            {/* Secção de Thumbnail - Buscar a Primeira Foto do Artigo */}
            <div className="mb-5 space-y-2 text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Thumbnail do Artigo</span>
              {item.imageUrls && item.imageUrls.length > 0 ? (
                <div className="relative rounded-3xl overflow-hidden border-2 border-slate-100 shadow-md h-48 bg-slate-50 flex items-center justify-center group">
                  <MediaViewer 
                    src={item.imageUrls[0]} 
                    category={item.category}
                    alt="Thumbnail do Artigo" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                  <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                    <i className="fa-solid fa-camera"></i>
                    <span>Primeira Foto</span>
                  </div>
                </div>
              ) : item.imageUrl ? (
                <div className="relative rounded-3xl overflow-hidden border-2 border-slate-100 shadow-md h-48 bg-slate-50 flex items-center justify-center group">
                  <MediaViewer 
                    src={item.imageUrl} 
                    category={item.category}
                    alt="Thumbnail do Artigo" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                  <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-sm">
                    <i className="fa-solid fa-camera"></i>
                    <span>Foto de Capa</span>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-3xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50/50 h-32 flex flex-col items-center justify-center text-center p-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-md mb-2 shadow-inner border border-gray-150">
                    <i className="fa-solid fa-image"></i>
                  </div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wide">Sem Foto Anexada</p>
                  <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5 leading-normal max-w-[220px]">
                    Nenhuma imagem foi carregada para este artigo. Pode adicionar uma editando o artigo.
                  </p>
                </div>
              )}
            </div>

            {/* Preview do Cartaz de Texto formatado */}
            <div className="space-y-2 mb-6 text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Mensagem Copiada</span>
              <div className="bg-[#0b141a]/95 text-[#e9edef] rounded-3xl p-4.5 text-[10px] sm:text-[11px] font-sans whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto no-scrollbar border-2 border-emerald-950/20 shadow-inner">
                {`🚨 *ComeBack Moçambique - ARTIGO ${item.status === ItemStatus.LOST ? 'PERDIDO' : item.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨\n\n*Artigo:* ${item.title}\n*Província:* ${item.province}\n*Local aproximado:* ${item.location}\n${item.reward ? `*Recompensa Garantida:* ${item.reward.toLocaleString()} MT (Em Custódia Segura via M-Pesa 🛡️)\n` : ''}*Contacto Directo:* ${item.ownerPhone || 'Através do Chat Interno'}\n\nApoie a nossa comunidade a recuperar artigos perdidos em Moçambique! Ver mais detalhes e localização no mapa:\n🔗 http://comeback.co.mz/item/${item.id}`}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  const msgText = `🚨 *ComeBack Moçambique - ARTIGO ${item.status === ItemStatus.LOST ? 'PERDIDO' : item.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨\n\n*Artigo:* ${item.title}\n*Província:* ${item.province}\n*Local aproximado:* ${item.location}\n${item.reward ? `*Recompensa Garantida:* ${item.reward.toLocaleString()} MT (Em Custódia Segura via M-Pesa 🛡️)\n` : ''}*Contacto Directo:* ${item.ownerPhone || 'Através do Chat Interno'}\n\nApoie a nossa comunidade a recuperar artigos perdidos em Moçambique! Ver mais detalhes e localização no mapa:\n🔗 http://comeback.co.mz/item/${item.id}`;
                  navigator.clipboard.writeText(msgText);
                  setPosterCopied(true);
                  setTimeout(() => setPosterCopied(false), 2500);
                }}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border-b-4 ${
                  posterCopied 
                    ? 'bg-[#009739] text-white border-[#007a2d] hover:bg-[#008130]' 
                    : 'bg-[#25d366] text-slate-950 border-[#189b48] hover:bg-[#20bd5a] active:scale-[0.98]'
                }`}
              >
                {posterCopied ? (
                  <>
                    <i className="fa-solid fa-check"></i>
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-copy"></i>
                    <span>Copiar Texto do Cartaz</span>
                  </>
                )}
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWhatsappPosterModalOpen(false)}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-gray-200"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const msgText = `🚨 *ComeBack Moçambique - ARTIGO ${item.status === ItemStatus.LOST ? 'PERDIDO' : item.status === ItemStatus.FOUND ? 'ACHADO' : 'ROUBADO'}* 🚨\n\n*Artigo:* ${item.title}\n*Província:* ${item.province}\n*Local aproximado:* ${item.location}\n${item.reward ? `*Recompensa Garantida:* ${item.reward.toLocaleString()} MT (Em Custódia Segura via M-Pesa 🛡️)\n` : ''}*Contacto Directo:* ${item.ownerPhone || 'Através do Chat Interno'}\n`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msgText)}%20${encodeURIComponent(window.location.href)}`, '_blank');
                  }}
                  className="flex-[2] bg-slate-950 text-[#fce100] hover:bg-slate-900 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 border-b-2 border-yellow-600"
                >
                  <i className="fa-brands fa-whatsapp text-xs text-[#25d366]"></i>
                  <span>Partilhar no WhatsApp</span>
                </button>
              </div>
            </div>

            <p className="mt-4 text-[8px] font-bold text-gray-400 leading-normal uppercase italic text-center px-2">
              * Ao partilhar nos seus estados ou grupos, o link do ComeBack gerará automaticamente a pré-visualização com a imagem nos dispositivos dos seus contactos.
            </p>
          </div>
        </div>
      )}

      {/* MODAL DE IMPULSIONAMENTO (CAMPAIGN BUILDER MODAL) */}
      {showBoostModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-350" onClick={() => setShowBoostModal(false)}></div>
          
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto no-scrollbar animate-in scale-in duration-300">
            {/* Header info */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 p-2.5 rounded-xl border border-indigo-100/40">
                  <i className="fa-solid fa-bullhorn text-sm animate-bounce"></i>
                </div>
                <div className="text-left">
                  <span className="text-[7.5px] font-black uppercase tracking-wider text-indigo-500 block">Campanha de Marketing</span>
                  <h3 className="text-sm font-black text-slate-800 dark:text-gray-150 uppercase tracking-tight">Criar Impulsionamento</h3>
                </div>
              </div>
              <button 
                onClick={() => setShowBoostModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            {isProcessingBoost ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 font-sans select-none">
                <div className="w-12 h-12 border-4 border-t-indigo-600 border-slate-100 rounded-full animate-spin"></div>
                <div className="space-y-1 bg-slate-50 dark:bg-slate-950 px-4 py-3 border border-slate-150 dark:border-slate-850 rounded-2xl max-w-sm">
                  <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest block font-mono">Gateway de Pagamentos Móveis</span>
                  <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase leading-relaxed font-mono">
                    {boostActionMessage}
                  </p>
                </div>
              </div>
            ) : boostActionSuccess !== null ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-5 font-sans">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                  boostActionSuccess 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-[#009739] dark:text-emerald-400' 
                    : 'bg-red-50 dark:bg-red-950/20 border-red-200 text-red-500'
                }`}>
                  <i className={`fa-solid ${boostActionSuccess ? 'fa-circle-check text-2xl' : 'fa-triangle-exclamation text-2xl'}`}></i>
                </div>
                
                <p className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300 leading-relaxed max-w-sm px-2">
                  {boostActionMessage}
                </p>

                <button
                  onClick={() => {
                    setShowBoostModal(false);
                    setBoostActionSuccess(null);
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider shadow-md transition-all ${
                    boostActionSuccess 
                      ? 'bg-[#009739] hover:bg-emerald-750 text-white border-b-4 border-emerald-800' 
                      : 'bg-indigo-600 hover:bg-indigo-705 text-white'
                  }`}
                >
                  Concluir e Voltar
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmBoostPayment} className="space-y-4 text-left">
                <p className="text-[9.5px] text-gray-550 dark:text-gray-400 font-bold uppercase leading-relaxed border-b pb-2 dark:border-slate-800">
                  Defina o orçamento de publicidade da sua campanha segmentada direcionada para o telemóvel dos utilizadores da província de <strong className="text-indigo-600 dark:text-indigo-400 font-black">{item.province || 'localidade'}</strong>.
                </p>

                {/* Campaign Days */}
                <div className="space-y-1.5 animate-in fade-in">
                  <div className="flex justify-between text-[9px] font-black uppercase text-gray-450 dark:text-gray-300">
                    <span>1. Duração da Campanha:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{boostDays} {boostDays === 1 ? 'Dia' : 'Dias'}</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={boostDays}
                    onChange={(e) => setBoostDays(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-150 dark:bg-slate-800 accent-indigo-650 rounded-full cursor-pointer"
                  />
                </div>

                {/* Daily Budget */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] font-black uppercase text-gray-450 dark:text-gray-300">
                    <span>2. Orçamento Diário (MT):</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{boostDailyBudget} MT / dia</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="range"
                      min="22"
                      max="500"
                      step="1"
                      value={boostDailyBudget}
                      onChange={(e) => setBoostDailyBudget(Math.max(22, Number(e.target.value)))}
                      className="flex-1 accent-indigo-650 h-1.5 bg-gray-150 dark:bg-slate-800 rounded-full cursor-pointer mt-2"
                    />
                    <input
                      type="number"
                      min="22"
                      value={boostDailyBudget}
                      onChange={(e) => setBoostDailyBudget(Math.max(22, Number(e.target.value)))}
                      className="w-16 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded py-1 text-center font-bold text-[10px] font-mono text-gray-800 dark:text-gray-150"
                    />
                  </div>
                </div>

                {/* Audience specs */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col gap-3">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block border-b pb-1 dark:border-slate-800">
                    🎯 Configuração Regional Moçambique
                  </span>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[7.5px] font-black uppercase text-slate-400">Província Alvo da Audiência:</label>
                    <select
                      value={boostTargetProvince}
                      onChange={(e) => setBoostTargetProvince(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-xl text-[9px] font-black uppercase text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="ALL">Todo Moçambique</option>
                      <option value="Maputo Cidade">Cidade de Maputo</option>
                      <option value="Maputo Província">Província de Maputo</option>
                      <option value="Gaza">Gaza</option>
                      <option value="Inhambane">Inhambane</option>
                      <option value="Sofala">Sofala</option>
                      <option value="Manica">Manica</option>
                      <option value="Tete">Tete</option>
                      <option value="Zambézia">Zambézia</option>
                      <option value="Nampula">Nampula</option>
                      <option value="Cabo Delgado">Cabo Delgado</option>
                      <option value="Niassa">Niassa</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[7.5px] font-black uppercase text-slate-400">Posicionamento Preferencial:</label>
                    <select
                      value={boostPlacement}
                      onChange={(e) => setBoostPlacement(e.target.value as any)}
                      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-xl text-[9px] font-black uppercase text-slate-705 dark:text-slate-300 outline-none"
                    >
                      <option value="feed_and_modal">Feed + Modal Intersticial (Impacto Total)</option>
                      <option value="feed_only">Apenas no Feed Principal (Normal)</option>
                    </select>
                  </div>

                  <div className="flex flex-col items-center justify-center pt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-2 text-center">
                    <span className="text-[7px] font-black text-slate-400 uppercase">Alcance Total Estimado:</span>
                    <span className="text-indigo-650 dark:text-indigo-400 text-xs font-black font-mono">
                      {((boostDailyBudget * boostDays) * 14).toLocaleString()} - {((boostDailyBudget * boostDays) * 45).toLocaleString()}
                    </span>
                    <span className="text-[6px] font-bold text-gray-400 uppercase">Pessoas Alcançadas no WhatsApp e GPS</span>
                  </div>
                </div>

                {/* Phone & Payment selection */}
                <div className="space-y-3 pt-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">💳 Detalhes do Pagamento Carteira Móvel</span>
                  
                  {/* Wallets Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('mpesa')}
                      className={`py-2 px-1 rounded-xl font-black text-[9px] uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-1 ${
                        checkoutWalletType === 'mpesa' 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400' 
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'
                      }`}
                    >
                      <span className="text-red-650 block sm:inline">M-Pesa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('emola')}
                      className={`py-2 px-1 rounded-xl font-black text-[9px] uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-1 ${
                        checkoutWalletType === 'emola' 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400' 
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'
                      }`}
                    >
                      <span className="text-orange-500 block sm:inline">e-Mola</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('mkesh')}
                      className={`py-2 px-1 rounded-xl font-black text-[9px] uppercase tracking-wide border-2 transition-all flex items-center justify-center gap-1 ${
                        checkoutWalletType === 'mkesh' 
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400' 
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'
                      }`}
                    >
                      <span className="text-emerald-600 block sm:inline">mKesh</span>
                    </button>
                  </div>

                  <div className="relative">
                    <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input 
                      type="tel"
                      required
                      placeholder="Número de Telefone Carteira Móvel"
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      className="w-full p-3.5 pl-10 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-600 text-xs font-bold text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>

                {/* Pricing block & confirmation */}
                <div className="pt-4 border-t border-dashed dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block">Total do Orçamento</span>
                    <span className="text-md font-black text-slate-800 dark:text-gray-150 font-mono">{(boostDays * boostDailyBudget).toFixed(2)} MT</span>
                  </div>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9.5px] tracking-wider uppercase py-3 px-6 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center gap-2 border-b-4 border-indigo-805"
                  >
                    <i className="fa-solid fa-credit-card"></i>
                    <span>Confirmar Pagamento</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Overlay do Alerta de Pânico */}
      <AnimatePresence>
        {(isCountingPanic || panicLoading) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#3a0205]/95 z-[9999] flex flex-col items-center justify-center p-6 text-center select-none backdrop-blur-md"
          >
            <div className="max-w-md w-full space-y-8">
              {isCountingPanic ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="w-32 h-32 bg-red-650 rounded-full animate-ping opacity-25 absolute"></div>
                    <div className="w-24 h-24 bg-red-650 rounded-full flex items-center justify-center text-4xl text-white shadow-2xl relative border-2 border-[#fce100]/50">
                      <i className="fa-solid fa-triangle-exclamation animate-bounce"></i>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">🚨 DISPARANDO SOS</h2>
                    <p className="text-[11px] text-red-200 font-bold uppercase tracking-wide px-4 leading-relaxed">
                      Lançando protocolo de pânico. A sua geolocalização exata será transmitida aos contactos prioritários e suporte de emergência.
                    </p>
                  </div>

                  {/* Mostrador gigante de contagem decrescente */}
                  <div className="text-8xl font-black text-white font-mono leading-none py-2">
                    {panicCountdown}
                  </div>

                  <button 
                    onClick={handleAbortPanic}
                    className="w-full bg-white hover:bg-red-50 text-[#d21034] py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95"
                  >
                    <span>ABORTAR ALERTA</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="w-16 h-16 border-4 border-t-red-650 border-[#fce100] rounded-full animate-spin"></div>
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none">PROTOCOLANDO SATÉLITE</h3>
                      <div className="bg-[#5a050a] px-4 py-3 border border-red-900 rounded-2xl max-w-sm mx-auto shadow-inner">
                        <p className="text-[10px] font-mono font-bold text-red-100 uppercase tracking-wider leading-relaxed">
                          {panicStateMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Share Feedback Toast */}
      {shareToast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider animate-in fade-in slide-in-from-bottom-4 duration-200 ${
          shareToast.type === 'success' 
            ? 'bg-slate-900 text-emerald-400 border-emerald-500/50' 
            : shareToast.type === 'error' 
            ? 'bg-rose-950 text-rose-200 border-rose-600/50'
            : 'bg-slate-900 text-amber-300 border-amber-500/50'
        }`}>
          <i className={`fa-solid ${
            shareToast.type === 'success' ? 'fa-circle-check text-emerald-400' :
            shareToast.type === 'error' ? 'fa-circle-xmark text-rose-400' : 'fa-info-circle text-amber-400'
          }`}></i>
          <span>{shareToast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ItemDetails;
