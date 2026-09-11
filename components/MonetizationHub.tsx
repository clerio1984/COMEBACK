import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { COMMISSION_FEE_PERCENT, MAINTENANCE_FEE_PERCENT, TOTAL_FEE_PERCENT } from '../constants';
import { 
  Coins, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Sparkles, 
  Award, 
  Calculator, 
  ShieldCheck, 
  HelpCircle, 
  Smartphone, 
  History, 
  Check, 
  X, 
  ChevronRight,
  Info,
  Clock,
  Briefcase
} from 'lucide-react';

interface MonetizationHubProps {
  currentUser: any;
  onClose: () => void;
  onRefreshUser?: () => void;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payout' | 'upgrade_premium' | 'upgrade_verified';
  amount: number;
  description: string;
  timestamp: string;
  refCode: string;
  status: 'completed' | 'pending' | 'failed';
}

export const MonetizationHub: React.FC<MonetizationHubProps> = ({ currentUser, onClose, onRefreshUser }) => {
  const [activeTab, setActiveTab] = useState<'finance' | 'calculator' | 'upgrades' | 'info'>('finance');
  
  // Saldos e Finanças persistidos no LocalStorage do dispositivo para realismo
  const [userBalance, setUserBalance] = useState<number>(() => {
    const saved = localStorage.getItem(`comeback_balance_${currentUser?.id}`);
    return saved ? parseFloat(saved) : 1250.00; // saldo inicial fictício realista de achados anteriores
  });

  const [referralEarnings, setReferralEarnings] = useState<number>(() => {
    const saved = localStorage.getItem(`comeback_referral_${currentUser?.id}`);
    return saved ? parseFloat(saved) : 3450.00; // intermediações acumuladas históricas
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`comeback_txs_${currentUser?.id}`);
    if (saved) return JSON.parse(saved);
    
    // Lista inicial de transações mock persistentes e ricas
    return [
      {
        id: 'tx1',
        type: 'payout',
        amount: 3500.00,
        description: 'Recompensa Recebida: Gata Siamês Nina #180',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        refCode: 'TX_93HA812DS9',
        status: 'completed'
      },
      {
        id: 'tx2',
        type: 'upgrade_premium',
        amount: -250.00,
        description: 'Destaque Premium: iPhone 13 Pro Max #42',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        refCode: 'TX_10LKF9283B',
        status: 'completed'
      },
      {
        id: 'tx3',
        type: 'deposit',
        amount: 500.00,
        description: 'Recarga Saldo via M-Pesa',
        timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
        refCode: 'TX_99OPY1230X',
        status: 'completed'
      }
    ];
  });

  // Salvar finanças no localStorage sempre que alterarem
  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`comeback_balance_${currentUser.id}`, userBalance.toString());
      localStorage.setItem(`comeback_referral_${currentUser.id}`, referralEarnings.toString());
      localStorage.setItem(`comeback_txs_${currentUser.id}`, JSON.stringify(transactions));
    }
  }, [userBalance, referralEarnings, transactions, currentUser]);

  // Carregar os posts ativos do utilizador logado para oferecer impulsionamento (destaque)
  const [userItems, setUserItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedItemToBoost, setSelectedItemToBoost] = useState<string>('');

  useEffect(() => {
    const fetchUserItems = async () => {
      if (!currentUser?.id) return;
      setLoadingItems(true);
      try {
        const q = query(collection(db, 'items'), where('userId', '==', currentUser.id), where('status', '!=', 'REUNITED'));
        const querySnapshot = await getDocs(q);
        const docs: any[] = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        setUserItems(docs);
        if (docs.length > 0) {
          setSelectedItemToBoost(docs[0].id);
        }
      } catch (e) {
        console.error("Erro ao puxar itens para destaque:", e);
      } finally {
        setLoadingItems(false);
      }
    };
    if (activeTab === 'upgrades') {
      fetchUserItems();
    }
  }, [activeTab, currentUser]);

  // Estados dos Modais de Ação Realística / Levantamento e Pagamento M-Pesa
  const [showMpesaWithdrawModal, setShowMpesaWithdrawModal] = useState(false);
  const [withdrawPhone, setWithdrawPhone] = useState(currentUser?.phone || '');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [isActionSuccess, setIsActionSuccess] = useState<boolean | null>(null);

  // Estados para Pagamento de Destaque / Badge
  const [selectedUpgradeType, setSelectedUpgradeType] = useState<'highlight' | 'vip_badge'>('highlight');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState(currentUser?.phone || '');
  const [checkoutWalletType, setCheckoutWalletType] = useState<'mpesa' | 'emola' | 'mkesh'>('mpesa');

  // Facebook Style Campaign state variables
  const [boostDays, setBoostDays] = useState<number>(3);
  const [boostDailyBudget, setBoostDailyBudget] = useState<number>(22);
  const [boostTargetProvince, setBoostTargetProvince] = useState<string>('ALL');
  const [boostTargetCategory, setBoostTargetCategory] = useState<string>('ALL');
  const [boostTargetStatus, setBoostTargetStatus] = useState<string>('ALL');
  const [boostPlacement, setBoostPlacement] = useState<'feed_and_modal' | 'feed_only'>('feed_and_modal');

  // Variável para simulador de calculadora interativa
  const [simulationReward, setSimulationReward] = useState<number>(5000);
  const [simulationCategory, setSimulationCategory] = useState<'lost' | 'found'>('lost');

  // Cálculos do simulador baseados nas constantes de constants.ts
  const comissaoBroker = Math.round(simulationReward * COMMISSION_FEE_PERCENT); // 5% comissão operacional
  const taxaManutencao = Math.round(simulationReward * MAINTENANCE_FEE_PERCENT); // 7% taxa de manutenção/infraestrutura
  const totalComebackTax = Math.round(simulationReward * TOTAL_FEE_PERCENT); // 12% retenção total
  const finderPayout = Math.round(simulationReward * (1 - TOTAL_FEE_PERCENT)); // Recuperador recebe 88% líquido

  // Tratar Levantamento M-Pesa (Simulação dinâmica)
  const handleMpesaWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Por favor insira um valor de levantamento válido.");
      return;
    }
    if (amountNum > userBalance) {
      alert("Saldo insuficiente para efetuar este levantamento.");
      return;
    }
    if (!withdrawPhone.trim()) {
      alert("Insira um número de telefone registado no M-Pesa.");
      return;
    }

    setIsProcessingAction(true);
    setActionMessage("A enviar pedido para a gateway de pagamentos móveis...");
    setIsActionSuccess(null);

    // Passo 1: Inicializando
    await new Promise(resolve => setTimeout(resolve, 1500));
    setActionMessage("A verificar dados de carteira junto dos servidores M-Pesa...");
    
    // Passo 2: Validando transação
    await new Promise(resolve => setTimeout(resolve, 2000));
    setActionMessage("Validação de identidade biométrica aprovada pelo canal seguro. A creditar saldo...");

    // Passo 3: Payout realístico
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newTx: Transaction = {
      id: 'tx_with_' + Math.random().toString(36).substring(2),
      type: 'withdrawal',
      amount: -amountNum,
      description: `Levantamento M-Pesa efetuado para o ${withdrawPhone}`,
      timestamp: new Date().toISOString(),
      refCode: 'LV_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      status: 'completed'
    };

    setUserBalance(prev => prev - amountNum);
    setTransactions(prev => [newTx, ...prev]);
    setIsActionSuccess(true);
    setActionMessage(`Pedido processado com sucesso! Foram depositados ${amountNum.toFixed(2)} MT na sua conta M-Pesa. Receberá um SMS de confirmação instantâneo.`);
    setIsProcessingAction(false);
  };

  // Tratar Gateway de Recarga e Pagamento de Serviços Premium (Destaque & Verificação)
  const handleCheckoutPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutPhone.trim()) {
      alert("Por favor introduza o seu número de carteira móvel!");
      return;
    }

    const valueToPay = selectedUpgradeType === 'highlight' ? (boostDays * boostDailyBudget) : 500;
    
    setIsProcessingAction(true);
    setActionMessage(`A iniciar transação com ${checkoutWalletType.toUpperCase()} Moçambique...`);
    setIsActionSuccess(null);

    // Etapa 1: Push USSD
    await new Promise(resolve => setTimeout(resolve, 1500));
    setActionMessage(`A enviar notificação push USSD para o telemóvel ${checkoutPhone}...`);

    // Etapa 2: Espera pelo PIN secreto do utilizador no ecrã simulado
    await new Promise(resolve => setTimeout(resolve, 2500));
    setActionMessage("Autorização detectada. A processar o pagamento com barramento do Banco de Moçambique...");

    // Etapa 3: Efetivar upgrade realísticas na base de dados Firebase Firestore se for destaque
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      if (selectedUpgradeType === 'highlight' && selectedItemToBoost) {
        // Encontra o item em Firestore e ativa o Premium Booster real
        const itemRef = doc(db, 'items', selectedItemToBoost);
        await updateDoc(itemRef, {
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
        });
        
        // Atualizar lista local
        setUserItems(prev => prev.map(item => item.id === selectedItemToBoost ? { 
          ...item, 
          isPremium: true,
          isBoosted: true,
          boostDays: boostDays,
          boostDailyBudget: boostDailyBudget,
          boostTotalBudget: boostDays * boostDailyBudget,
          boostTargetProvince: boostTargetProvince,
          boostTargetCategory: boostTargetCategory,
          boostTargetStatus: boostTargetStatus,
          boostPlacement: boostPlacement,
          boostPaymentMethod: checkoutWalletType,
          boostPaymentPhone: checkoutPhone,
          boostImpressions: 0,
          boostedAt: new Date().toISOString()
        } : item));
      } else if (selectedUpgradeType === 'vip_badge') {
        // Encontra utilizador atual e marca perfil como VIP/Elite Verificado com Golden Badge
        if (currentUser?.id) {
          const userRef = doc(db, 'users', currentUser.id);
          await updateDoc(userRef, {
            isVerified: true,
            isPremiumFinder: true
          });
          if (onRefreshUser) onRefreshUser();
        }
      }

      // Adicionar Transação à lista
      const newTx: Transaction = {
        id: 'tx_pay_' + Math.random().toString(36).substring(2),
        type: selectedUpgradeType === 'highlight' ? 'upgrade_premium' : 'upgrade_verified',
        amount: -valueToPay,
        description: selectedUpgradeType === 'highlight' 
          ? `Campanha Tráfego Pago Estilo Facebook (${boostDays} dias x ${boostDailyBudget} MT/dia) - Item ID: ${selectedItemToBoost.substring(0, 6)}` 
          : `Ativação de Selo de Verificação Elite ComeBack`,
        timestamp: new Date().toISOString(),
        refCode: 'PG_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        status: 'completed'
      };

      setTransactions(prev => [newTx, ...prev]);
      setIsActionSuccess(true);
      setActionMessage(`Sucesso! O pagamento de ${valueToPay} MT foi aprovado. O seu anúncio impulsionado já se encontra ativo na maior rede de achados e perdidos de Moçambique!`);
    } catch (err: any) {
      console.error(err);
      setIsActionSuccess(false);
      setActionMessage("Falha ao integrar compra com a base de dados central: " + err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 flex flex-col font-sans" id="monetization-management-panel">
      
      {/* Header Fixo de Navegação */}
      <div className="bg-[#009739] text-white p-5 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
          title="Regressar ao Perfil"
        >
          <X size={20} />
        </button>
        <div className="text-center flex-1">
          <span className="text-[7.5px] font-black uppercase text-[#fce100] tracking-widest block font-mono">Premium Hub</span>
          <h2 className="text-sm font-black uppercase tracking-tight leading-none mt-1">Estatísticas & Monetização</h2>
        </div>
        <div className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-xl border border-white/20">
          <Coins size={16} className="text-[#fce100] animate-bounce" />
        </div>
      </div>

      {/* Tabs Layout Subnavegação de Monetização */}
      <div className="grid grid-cols-4 gap-1 bg-white dark:bg-slate-900 border-b border-gray-150 dark:border-slate-850 p-2 sticky top-[69px] z-30">
        <button
          onClick={() => setActiveTab('finance')}
          className={`py-2 px-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
            activeTab === 'finance'
              ? 'bg-[#009739] text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <History size={14} />
          <span>Finanças</span>
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`py-2 px-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
            activeTab === 'calculator'
              ? 'bg-[#009739] text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Calculator size={14} />
          <span>Simulador</span>
        </button>
        <button
          onClick={() => setActiveTab('upgrades')}
          className={`py-2 px-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
            activeTab === 'upgrades'
              ? 'bg-[#009739] text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Sparkles size={14} />
          <span>Serviços</span>
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`py-2 px-1 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all flex flex-col items-center justify-center gap-1 ${
            activeTab === 'info'
              ? 'bg-[#009739] text-white shadow-sm'
              : 'text-gray-400 dark:text-gray-400 hover:text-slate-900'
          }`}
        >
          <Briefcase size={14} />
          <span>Como Funciona</span>
        </button>
      </div>

      {/* Conteúdo Principal do Tab */}
      <div className="flex-1 p-5 space-y-6">

        {/* ==================== TAB 1: FINANÇAS & SALDO ==================== */}
        {activeTab === 'finance' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            
            {/* Visual Balance Card Container */}
            <div className="bg-gradient-to-br from-slate-900 via-stone-900 to-black text-white p-6 rounded-[2.5rem] border-2 border-slate-800 shadow-xl relative overflow-hidden">
              
              {/* Decorative backgrounds flag ribbon */}
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-[#009739]/5 clip-triangle pointer-events-none" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[7.5px] font-black uppercase text-gray-400 tracking-wider block">Saldo do Utilizador</span>
                  <p className="text-3xl font-black text-[#fce100] font-mono leading-none mt-1">
                    {userBalance.toFixed(2)} <span className="text-xs">MT</span>
                  </p>
                </div>
                <div className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-right shrink-0">
                  <span className="text-[6.5px] font-black text-gray-400 uppercase tracking-widest block">Intermediações Totais</span>
                  <span className="text-xs font-bold text-gray-200 block font-mono mt-0.5">{referralEarnings.toFixed(2)} MT</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-800/80">
                <button
                  onClick={() => {
                    setWithdrawAmount('');
                    setShowMpesaWithdrawModal(true);
                  }}
                  className="flex-1 bg-[#009739] hover:bg-emerald-600 font-extrabold uppercase text-[9px] py-3.5 tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-white"
                >
                  <ArrowUpRight size={13} className="text-white" />
                  <span>Levantar M-Pesa</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedUpgradeType('highlight');
                    setShowCheckoutModal(true);
                  }}
                  className="flex-1 bg-white hover:bg-gray-100 font-extrabold uppercase text-[9px] py-3.5 tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-slate-900 shadow-sm border border-gray-200"
                >
                  <ArrowDownLeft size={13} className="text-slate-600" />
                  <span>Recarregar Carteira</span>
                </button>
              </div>

              <div className="absolute top-4 right-4 animate-pulse">
                <span className="text-[6px] font-mono uppercase bg-[#009739]/20 text-[#009739] px-2 py-0.5 rounded border border-[#009739]/30">Protegido por IA</span>
              </div>
            </div>

            {/* Histórico Financeiro Log list */}
            <div className="space-y-3.5">
              <div className="flex justify-between items-center text-left">
                <h3 className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Histórico de Transações</h3>
                <span className="text-[7.5px] font-mono font-black border uppercase text-gray-400 px-1.5 py-0.5 rounded-md">Registo Geral</span>
              </div>

              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div 
                    key={tx.id}
                    className="bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 p-4.5 rounded-[1.8rem] flex items-center justify-between gap-3.5 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center border ${
                        tx.amount > 0 
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/30' 
                          : 'bg-red-50 dark:bg-red-950/20 text-red-650 border-red-100 dark:border-red-900/20'
                      }`}>
                        {tx.amount > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div className="min-w-0 text-left">
                        <span className="text-[9.5px] font-black text-gray-800 dark:text-gray-150 block truncate uppercase leading-snug">{tx.description}</span>
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-gray-400 dark:text-gray-400 text-[8px] font-bold">
                          <span>{new Date(tx.timestamp).toLocaleDateString('pt-MZ')} {new Date(tx.timestamp).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className="bg-gray-50 dark:bg-slate-950 px-1 rounded uppercase tracking-wider border border-gray-150 dark:border-slate-850">{tx.refCode}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-extrabold font-mono shrink-0 ${tx.amount > 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} MT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: SIMULADOR DE GANHOS ==================== */}
        {activeTab === 'calculator' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl flex items-start gap-3">
              <Calculator size={20} className="text-[#009739] shrink-0 mt-0.5" />
              <p className="text-[9.5px] text-[#009739] dark:text-emerald-400/90 leading-relaxed font-bold uppercase text-left">
                Simule receitas e entenda em tempo real como o ecossistema financeiro é dividido entre os utilizadores e a plataforma ComeBack Moçambique.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 p-5 rounded-[2.2rem] text-left space-y-4 shadow-3xs">
              
              {/* Toggles */}
              <div className="grid grid-cols-2 gap-1.5 mb-2 bg-gray-50 dark:bg-slate-950/40 p-1.5 rounded-xl border border-gray-150 dark:border-slate-800">
                <button
                  onClick={() => setSimulationCategory('lost')}
                  className={`py-2 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    simulationCategory === 'lost' 
                      ? 'bg-white dark:bg-slate-900 text-[#009739] shadow-inner border border-gray-150 dark:border-slate-800' 
                      : 'text-gray-400'
                  }`}
                >
                  Dono do Item (Proponente)
                </button>
                <button
                  onClick={() => setSimulationCategory('found')}
                  className={`py-2 text-[8.5px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    simulationCategory === 'found' 
                      ? 'bg-white dark:bg-slate-900 text-[#009739] shadow-inner border border-gray-150 dark:border-slate-800' 
                      : 'text-gray-400'
                  }`}
                >
                  Recuperador (Bounty Hunter)
                </button>
              </div>

              {/* Slider de Recompensa */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-black uppercase text-gray-800 dark:text-gray-200">
                  <span>Recompensa de Descoberta estabelecida:</span>
                  <span className="text-[#009739] font-mono">{simulationReward.toLocaleString()} MT</span>
                </div>
                <input 
                  type="range"
                  min="500"
                  max="50000"
                  step="500"
                  value={simulationReward}
                  onChange={(e) => setSimulationReward(Number(e.target.value))}
                  className="w-full accent-[#009739] h-1.5 bg-gray-100 dark:bg-slate-800 rounded-full cursor-pointer mt-2"
                />
              </div>

              {/* Tabela de repartição de taxas realistas */}
              <div className="border-t border-gray-100 dark:border-slate-800/80 pt-4.5 space-y-3">
                <span className="text-[8px] font-black uppercase text-gray-400 tracking-wider block">Divisão da Transação Custodiada (Gateway M-Pesa/ComeBack):</span>
                
                <div className="bg-gray-50 dark:bg-slate-950 border border-gray-150 dark:border-slate-850 p-4 rounded-xl space-y-2.5">
                  <div className="flex justify-between text-[10px] items-center">
                    <span className="font-bold text-gray-500 uppercase flex items-center gap-1">
                      <ChevronRight size={10} className="text-gray-400" /> Valor Pago pelo Dono do Item:
                    </span>
                    <span className="font-black text-gray-800 dark:text-gray-200">{simulationReward.toFixed(2)} MT</span>
                  </div>

                  <div className="flex justify-between text-[10px] items-center">
                    <span className="font-bold text-gray-500 uppercase flex items-center gap-1">
                      <ChevronRight size={10} className="text-gray-400" /> Comissão de Intermediação ({(COMMISSION_FEE_PERCENT * 100).toFixed(0)}%):
                    </span>
                    <span className="font-semibold text-gray-650 dark:text-gray-400">-{comissaoBroker.toFixed(2)} MT</span>
                  </div>

                  <div className="flex justify-between text-[10px] items-center">
                    <span className="font-bold text-gray-500 uppercase flex items-center gap-1">
                      <ChevronRight size={10} className="text-gray-400" /> Taxa de Servidores & Custódia ({(MAINTENANCE_FEE_PERCENT * 100).toFixed(0)}%):
                    </span>
                    <span className="font-semibold text-gray-650 dark:text-gray-400">-{taxaManutencao.toFixed(2)} MT</span>
                  </div>

                  <div className="flex justify-between text-[10px] border-t border-dashed border-gray-200 dark:border-slate-800 pt-2 items-center">
                    <span className="font-black text-[#009739] uppercase flex items-center gap-1">
                      ★ Total Creditado ao Recuperador ({((1 - TOTAL_FEE_PERCENT) * 100).toFixed(0)}%):
                    </span>
                    <span className="font-black text-emerald-500 font-mono text-xs">{finderPayout.toFixed(2)} MT</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 dark:bg-slate-900 border border-blue-105 rounded-xl space-y-1 text-center">
                  <span className="text-[8px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                    Retenção Total do Sistema sobre a Transação:
                  </span>
                  <p className="text-[13px] font-black text-slate-800 dark:text-white font-mono uppercase mt-1">
                    💸 {totalComebackTax.toFixed(2)} MT <span className="text-[9px] font-mono text-[#009739] font-black">({(TOTAL_FEE_PERCENT * 100).toFixed(0)}% Retido de Custódia)</span>
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 3: PRODUTOS & UPGRADES PREMIUM ==================== */}
        {activeTab === 'upgrades' && (
          <div className="space-y-5 text-left animate-in fade-in duration-300">
            <h3 className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight pl-1 mb-1">Selecione o Serviço de Monetização:</h3>

            {/* UPGRADE 1: FB PAID TRAFFIC ADS CONFIGURATOR */}
            <div className="bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 p-6 rounded-[2.2rem] flex flex-col gap-5 shadow-3xs hover:border-[#009739]/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-500 p-3 rounded-xl border border-amber-100/30">
                  <TrendingUp size={20} className="animate-pulse" />
                </div>
                <div>
                  <span className="font-black text-gray-800 dark:text-gray-150 uppercase text-xs block leading-none mb-1">Impulsionador de Tráfego Pago (estilo Facebook Ads)</span>
                  <span className="text-[7.5px] font-mono font-black text-[#009739] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">MÍNIMO: 22 MT / DIA</span>
                </div>
              </div>

              <p className="text-[9.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-normal">
                Configure uma campanha de captação de tráfego ultra-segmentada para o seu item desaparecido. O anúncio aparecerá prioritariamente no topo do feed e, opcionalmente, em janelas pop-up de alta visibilidade com contagem decrescente para os utilizadores da plataforma.
              </p>

              {loadingItems ? (
                <div className="text-[9px] font-black text-center py-2 text-gray-400 animate-pulse">A procurar seus registos...</div>
              ) : userItems.length === 0 ? (
                <div className="p-3 bg-gray-50 dark:bg-slate-950/50 rounded-xl border border-gray-100 dark:border-slate-850 text-center text-[9px] font-black uppercase text-gray-400 leading-normal">
                  ⚠️ Não possui nenhum item ativo registado em sua conta de momento para aplicar o impulsionamento.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select Item */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-400 pl-1">1. Qual item deseja impulsionar?</label>
                    <select
                      value={selectedItemToBoost}
                      onChange={(e) => setSelectedItemToBoost(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-slate-950 border-2 border-gray-150 dark:border-slate-800 p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:border-[#009739] text-gray-800 dark:text-gray-200"
                    >
                      {userItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.title} ({item.isPremium ? '★ Ativo' : 'Não impulsionado'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Range Sliders for Days and Budget */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Days Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black uppercase text-gray-650 dark:text-gray-300">
                        <span>Duração da Campanha:</span>
                        <span className="text-[#009739] font-mono">{boostDays} {boostDays === 1 ? 'Dia' : 'Dias'}</span>
                      </div>
                      <input 
                        type="range"
                        min="1"
                        max="30"
                        step="1"
                        value={boostDays}
                        onChange={(e) => setBoostDays(Number(e.target.value))}
                        className="w-full accent-[#009739] h-1.5 bg-gray-100 dark:bg-slate-850 rounded-full cursor-pointer"
                      />
                    </div>

                    {/* Daily Budget Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black uppercase text-gray-650 dark:text-gray-300">
                        <span>Orçamento Diário (Mín. 22 MT):</span>
                        <span className="text-[#009739] font-mono">{boostDailyBudget} MT/dia</span>
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="range"
                          min="22"
                          max="1000"
                          step="1"
                          value={boostDailyBudget}
                          onChange={(e) => setBoostDailyBudget(Math.max(22, Number(e.target.value)))}
                          className="flex-1 accent-[#009739] h-1.5 bg-gray-100 dark:bg-slate-850 rounded-full cursor-pointer mt-2"
                        />
                        <input
                          type="number"
                          min="22"
                          value={boostDailyBudget}
                          onChange={(e) => setBoostDailyBudget(Math.max(22, Number(e.target.value)))}
                          className="w-16 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded px-1 text-center font-bold text-[10px] font-mono text-gray-800 dark:text-gray-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Facebook targeting settings */}
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-150 dark:border-slate-850 space-y-3.5">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block border-b pb-1 dark:border-slate-850">⚙️ Configurações de Audiência (Facebook Ads Logic)</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[7.5px] font-black uppercase text-gray-400 pl-1">Segmentação Regional:</label>
                        <select
                          value={boostTargetProvince}
                          onChange={(e) => setBoostTargetProvince(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-2 rounded-xl text-[9px] font-black uppercase text-gray-700 dark:text-gray-300"
                        >
                          <option value="ALL">Todo o Moçambique</option>
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
                        <label className="text-[7.5px] font-black uppercase text-gray-400 pl-1">Posicionamento (Placement):</label>
                        <select
                          value={boostPlacement}
                          onChange={(e) => setBoostPlacement(e.target.value as any)}
                          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-2 rounded-xl text-[9px] font-black uppercase text-gray-700 dark:text-gray-300"
                        >
                          <option value="feed_and_modal">Feed + Modal Intersticial (Full Impact)</option>
                          <option value="feed_only">Apenas Feed Principal (Padrão)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[7.5px] font-black uppercase text-gray-400 pl-1">Segmentação por Filtro:</label>
                        <select
                          value={boostTargetStatus}
                          onChange={(e) => setBoostTargetStatus(e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-2 rounded-xl text-[9px] font-black uppercase text-gray-700 dark:text-gray-300"
                        >
                          <option value="ALL">Todos os Utilizadores</option>
                          <option value="LOST">Utilizadores que procuram Perdidos</option>
                          <option value="FOUND">Utilizadores que relatam Achados</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 justify-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-805 p-2 rounded-xl text-center">
                        <span className="text-[7.5px] font-black text-gray-400 uppercase">Alcance Diário Estimado:</span>
                        <span className="text-[#009739] text-xs font-black font-mono">{(boostDailyBudget * 14).toLocaleString()} - {(boostDailyBudget * 42).toLocaleString()}</span>
                        <span className="text-[6px] font-bold text-gray-400 uppercase">Pessoas Alcançadas</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-150 rounded-xl flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <span className="text-[7.5px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest block leading-none">Total Faturamento (Ad Budget):</span>
                      <p className="text-sm font-black text-gray-800 dark:text-gray-200 font-mono">{(boostDays * boostDailyBudget).toFixed(2)} MT</p>
                      <span className="text-[6.5px] font-extrabold text-gray-400 uppercase tracking-wider block">Pagamento antecipado (Pre-paid)</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedUpgradeType('highlight');
                        setShowCheckoutModal(true);
                      }}
                      className="bg-[#009739] text-white px-4 py-2.5 rounded-xl font-black text-[9px] tracking-wider uppercase shadow-md hover:bg-[#008331] transition-all flex items-center gap-1.5"
                    >
                      <Smartphone size={12} />
                      <span>Impulsionar Agora</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* UPGRADE 2: ELITE VERIFIED BADGE */}
            <div className="bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 p-5 rounded-[2.2rem] flex flex-col gap-4 shadow-3xs hover:border-[#009739]/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-500 p-3 rounded-xl border border-blue-105">
                  <Award size={20} className="animate-bounce" />
                </div>
                <div>
                  <span className="font-black text-gray-800 dark:text-gray-150 uppercase text-xs block leading-none mb-1">Selo de Verificação Elite ComeBack Pro</span>
                  <span className="text-[7.5px] font-mono font-black text-[#009739] uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">CUSTO VALIDAÇÃO: 500 MT</span>
                </div>
              </div>

              <p className="text-[9.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-normal">
                Garanta um selo dourado ao lado do seu nome. Perfis Pro têm 3x mais probabilidade de fechar negociações ricas, são listados na Proximity Bounty Hunters Network da nossa IA e usufruem de taxas de comissão reduzidas de 7% para apenas 4%.
              </p>

              {currentUser?.isPremiumFinder ? (
                <div className="bg-emerald-50/50 p-3.5 text-center text-[9px] font-black uppercase border border-emerald-150 text-emerald-800 rounded-xl">
                  🚀 Parabéns! O seu perfil já é Elite Verificado ComeBack. Usufrua de plenos privilégios no ecossistema maputense!
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedUpgradeType('vip_badge');
                    setShowCheckoutModal(true);
                  }}
                  className="w-full bg-[#009739] text-white py-3.5 rounded-xl font-black text-[10px] tracking-wider uppercase flex items-center justify-center gap-2 border-b-4 border-[#007a2d] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
                >
                  <Award size={14} />
                  <span>Obter Badge Elite por 500 MT</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: COMO FUNCIONA A MONETIZAÇÃO (INFO) ==================== */}
        {activeTab === 'info' && (
          <div className="space-y-4 text-left animate-in fade-in duration-300">
            <h3 className="text-xs font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight pl-1 mb-1">Canais de Lucro & Negócio ComeBack:</h3>
            
            <div className="space-y-3">
              <div className="p-4 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 rounded-[1.8rem] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-gray-800 dark:text-gray-100 uppercase">1. Comissões sobre Recompensas (Escrow)</span>
                </div>
                <p className="text-[8.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-relaxed pl-4">
                  A plataforma atua como árbitro seguro na guarda e liquidação de recompensas voluntárias estabelecidas de 500 MT a 50.000 MT. Retemos uma taxa padrão de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% sobre o valor total no barramento de segurança para cobrir custos de custódia, infraestrutura e processamento de mobile money (M-Pesa, e-Mola).
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 rounded-[1.8rem] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-gray-800 dark:text-gray-100 uppercase">2. Upgrades Premium de Posts de Perda</span>
                </div>
                <p className="text-[8.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-relaxed pl-4">
                  Proprietários ansiosos por recuperar telemóveis de alto valor ou documentos de imigração cruciais compram o Destaque Premium por 250 MT. Esta é uma fonte constante de rendimento passivo direto para o gestor da plataforma.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 rounded-[1.8rem] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-gray-800 dark:text-gray-100 uppercase">3. Assinatura Mensal Proximity Alerts</span>
                </div>
                <p className="text-[8.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-relaxed pl-4">
                  Agências de segurança civil, recuperadores locais profissionais da comunidade de Maputo, e motoristas de Chapa pagam uma subscrição recorrente de 150 MT/semana para ter o radar de rastreamento com filtro inteligente ativado no telemóvel por Proximidade GPS.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-850 rounded-[1.8rem] space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-gray-800 dark:text-gray-100 uppercase">4. Espaço Publicitário</span>
                </div>
                <p className="text-[8.5px] text-gray-500 dark:text-gray-400 font-bold uppercase leading-relaxed pl-4">
                  Banners inteligentes contextuais e anúncios de parceiros locais são exibidos no feed do radar. A plataforma recebe receitas através de parcerias institucionais diretas para divulgar serviços e promoções em Moçambique.
                </p>
              </div>

              <div className="p-4.5 bg-[#009739]/5 border border-[#009739]/15 rounded-[2rem] space-y-1.5 mt-4 text-center">
                <span className="text-[10px] font-black text-[#009739] uppercase block tracking-wider">Como VOCÊ pode rentabilizar este sistema?</span>
                <p className="text-[9.5px] text-gray-650 dark:text-emerald-300/80 font-bold uppercase leading-relaxed">
                  Ao gerir a rede ComeBack Moçambique na sua província, acumulará saldo proveniente do destaque e das micro-tarifas de intermediação. Também pode atuar como um "Recuperador Elite", ativando o serviço Proximity Radar, localizando BI e outros itens de alto valor para reclamar as gratificações M-Pesa dos donos legítimos de forma encriptada, transparente e justa!
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ==================== MODAL DE LEVANTAMENTO M-PESA ==================== */}
      <AnimatePresence>
        {showMpesaWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isProcessingAction) setShowMpesaWithdrawModal(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              id="withdrawal-mpesa-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-gray-150 dark:border-slate-800 rounded-[2.5rem] p-6 text-center shadow-2xl z-10"
              id="withdrawal-mpesa-content"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100 dark:border-red-900/30">
                <Smartphone className="text-red-500 animate-pulse" size={24} />
              </div>
              
              <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight mb-1">
                Levantamento via M-Pesa
              </h3>
              <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block leading-none mb-4">Vodacom Moçambique</span>

              {isActionSuccess === null ? (
                <form onSubmit={handleMpesaWithdraw} className="space-y-3.5 text-left">
                  <div className="bg-gray-50 dark:bg-slate-950 p-3 rounded-xl border border-gray-100 dark:border-slate-850 text-center text-[10px] font-black uppercase text-gray-500 mb-1 leading-normal select-none">
                    Saldo Disponível: <span className="text-[#009739]">{userBalance.toFixed(2)} MT</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-gray-400 pl-1.5 select-none">Valor em MT a sacar:</label>
                    <input
                      type="number"
                      placeholder="Ex: 500"
                      required
                      className="w-full bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 p-4 rounded-xl outline-none focus:border-[#009739] font-mono font-bold text-sm text-gray-900 dark:text-gray-150"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      disabled={isProcessingAction}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-gray-400 pl-1.5 select-none">Número M-Pesa do Destinatário (+258):</label>
                    <input
                      type="tel"
                      placeholder="Ex: 841234567"
                      required
                      className="w-full bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 p-4 rounded-xl outline-none focus:border-[#009739] font-mono font-bold text-sm text-gray-900 dark:text-gray-150"
                      value={withdrawPhone}
                      onChange={(e) => setWithdrawPhone(e.target.value)}
                      disabled={isProcessingAction}
                    />
                  </div>

                  {isProcessingAction ? (
                    <div className="py-4 text-center space-y-2 select-none">
                      <div className="w-8 h-8 border-3 border-red-500/10 border-t-red-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-wider animate-pulse pt-1">{actionMessage}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer border-b-4 border-red-900"
                      >
                        Autorizar Transferência Instantânea
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMpesaWithdrawModal(false)}
                        className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl text-[9.5px] font-semibold text-center uppercase leading-relaxed ${
                    isActionSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                  }`}>
                    {actionMessage}
                  </div>
                  <button
                    onClick={() => {
                      setShowMpesaWithdrawModal(false);
                      setIsActionSuccess(null);
                    }}
                    className="w-full bg-black text-[#fce100] font-black text-[10px] py-4 rounded-xl uppercase active:scale-95 transition-all tracking-wider cursor-pointer"
                  >
                    Confirmar & Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== MODAL DE PAGAMENTO GATEWAY (DESTAQUE / VIP) ==================== */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isProcessingAction) setShowCheckoutModal(false);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              id="premium-checkout-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-gray-150 dark:border-slate-800 rounded-[2.5rem] p-6 text-center shadow-2xl z-10"
              id="premium-checkout-content"
            >
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-100 dark:border-emerald-900/30">
                <Smartphone className="text-[#009739] animate-bounce" size={24} />
              </div>
              
              <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight mb-1">
                Gateway de Pagamento Móvel
              </h3>
              <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-widest block leading-none mb-4">ComeBack Moçambique Pay</span>

              {isActionSuccess === null ? (
                <form onSubmit={handleCheckoutPayment} className="space-y-4 text-left">
                  <div className="p-3 bg-gray-50 dark:bg-slate-950 rounded-xl border border-gray-150 dark:border-slate-850 text-center font-bold text-[10px] uppercase text-gray-500">
                    Valor a faturar: <span className="text-emerald-600 font-extrabold">{selectedUpgradeType === 'highlight' ? '250.00 MT' : '500.00 MT'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-slate-950 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('mpesa')}
                      className={`py-2 text-[8px] font-black uppercase tracking-wider rounded-lg text-center transition-all ${
                        checkoutWalletType === 'mpesa' ? 'bg-[#e11a22] text-white shadow-md' : 'text-gray-400'
                      }`}
                    >
                      M-Pesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('emola')}
                      className={`py-2 text-[8px] font-black uppercase tracking-wider rounded-lg text-center transition-all ${
                        checkoutWalletType === 'emola' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-400'
                      }`}
                    >
                      e-Mola
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutWalletType('mkesh')}
                      className={`py-2 text-[8px] font-black uppercase tracking-wider rounded-lg text-center transition-all ${
                        checkoutWalletType === 'mkesh' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-400'
                      }`}
                    >
                      mKesh
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-gray-400 pl-1 select-none">Contacto da Carteira Móvel (+258):</label>
                    <input
                      type="tel"
                      placeholder="Ex: 841234567"
                      required
                      className="w-full bg-gray-50 dark:bg-slate-950 border-2 border-gray-100 dark:border-slate-800 p-4 rounded-xl outline-none focus:border-[#009739] font-mono font-bold text-sm text-gray-900 dark:text-gray-150"
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      disabled={isProcessingAction}
                    />
                  </div>

                  {isProcessingAction ? (
                    <div className="py-4 text-center space-y-2 select-none">
                      <div className="w-8 h-8 border-3 border-emerald-500/10 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-[8px] text-gray-500 font-black uppercase tracking-wider animate-pulse pt-1">{actionMessage}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="submit"
                        className="w-full bg-[#009739] text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer border-b-4 border-emerald-800"
                      >
                        Pagar com {checkoutWalletType.toUpperCase()}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCheckoutModal(false)}
                        className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl text-[9.5px] font-semibold text-center uppercase leading-relaxed ${
                    isActionSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                  }`}>
                    {actionMessage}
                  </div>
                  <button
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setIsActionSuccess(null);
                    }}
                    className="w-full bg-black text-[#fce100] font-black text-[10px] py-4 rounded-xl uppercase active:scale-95 transition-all tracking-wider cursor-pointer"
                  >
                    Confirmar & Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
