import React, { useState, useEffect } from 'react';
import { authenticatedFetch } from '../services/firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, getCountFromServer, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { User, Item, ItemStatus, Category, SmsGatewayConfig } from '../types';
import { INITIAL_ITEMS } from '../constants';
import Layout from './Layout';
import { useAuth } from '../AuthContext';
import { 
  Users, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Star,
  ChevronRight,
  Filter,
  Search,
  ArrowBigRight,
  UserCheck,
  Award,
  Shield,
  ShieldAlert,
  UserCog,
  Smartphone,
  Radio,
  MapPin,
  RefreshCw,
  Lock,
  Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminD3Stats } from './AdminD3Stats';
import { AdminTrackerMap } from './AdminTrackerMap';

export const AdminDashboard: React.FC = () => {
  const { currentUser: authUser, firebaseUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Real Firebase Auth check for rules compliance
  const isPrototypeAdmin = firebaseUser?.uid === 'admin_root';
  const insuredPhones: any[] = [];
  const filteredPhones: any[] = [];
  const selectedPhone: any = null;
  const selectedPhoneOwner: any = null;
  const selectedPhoneLatestSwap: any = null;
  const selectedPhoneId: any = null;
  const setSelectedPhoneId = (() => {}) as any;
  const handleVerifyImei = (() => {}) as any;
  const handleUpdatePhoneStatus = (() => {}) as any;
  const handleSimulateOperatorTrack = (() => {}) as any;
  const [stats, setStats] = useState({
    totalUsers: 0,
    lostItems: 0,
    foundItems: 0,
    reunitedItems: 0,
    inTransit: 0
  });

  useEffect(() => {
    if (!firebaseUser || firebaseUser.uid === 'admin_root') {
      setLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const itemsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(itemsData);
      
      const counts = itemsData.reduce((acc, item) => {
        if (item.status === ItemStatus.LOST) acc.lost++;
        if (item.status === ItemStatus.FOUND) acc.found++;
        if (item.status === ItemStatus.STOLEN) acc.stolen++;
        if (item.status === ItemStatus.REUNITED) acc.reunited++;
        if (item.status === ItemStatus.IN_TRANSIT) acc.transit++;
        return acc;
      }, { lost: 0, found: 0, stolen: 0, reunited: 0, transit: 0 });

      setStats(prev => ({
        ...prev,
        lostItems: counts.lost + counts.stolen,
        foundItems: counts.found,
        reunitedItems: counts.reunited,
        inTransit: counts.transit
      }));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });

    return () => {
      unsubUsers();
      unsubItems();
    };
  }, []);

  const handleVerifyUser = async (userId: string, status: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isVerified: status });
      // No alert on success to keep it smooth, state will update via listener
    } catch (error: any) {
      console.error("Error updating user verification:", error);
      alert("Erro ao verificar utilizador: " + (error.message || "Acesso Negado"));
    }
  };

  const handleRateUser = async (userId: string, rating: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { rating });
    } catch (error) {
      console.error("Error updating user rating:", error);
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean | undefined) => {
    if (!authUser?.isSuperAdmin) {
      alert("Apenas Super Administradores podem gerir permissões de admin.");
      return;
    }
    
    // Prevent self-demotion of the root/super admin in this simple flow
    if (userId === authUser.id) {
      alert("Não pode alterar suas próprias permissões de Super Admin.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), { isAdmin: !currentStatus });
    } catch (error) {
      console.error("Error updating admin status:", error);
    }
  };

  const [activeViewTab, setActiveViewTab] = useState<'all' | 'pending' | 'sms_settings' | 'stats_graphics'>('stats_graphics');
  const [selectedVerificationUser, setSelectedVerificationUser] = useState<User | null>(null);

  // SMS Custom Webhook Configuration States
  const [smsConfig, setSmsConfig] = useState<SmsGatewayConfig>({
    webhookUrl: '',
    method: 'POST',
    headersText: 'Authorization: Bearer SEU_TOKEN_AQUI\nContent-Type: application/json',
    payloadTemplate: '{\n  "to": "{{phone}}",\n  "message": "{{message}}"\n}',
    isActive: false,
    useRealWebhook: false
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Webhook Testing States
  const [testPhone, setTestPhone] = useState('841234567');
  const [testMessage, setTestMessage] = useState('Achei.mz Alerta Crítico: Seu Bilhete de Identidade com final 892 foi localizado perto de Maputo!');
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    statusCode: number;
    statusText: string;
    responseBody: string;
    responseTimeMs?: number;
  } | null>(null);

  useEffect(() => {
    // Escuta alterações na configuração persistida no Firestore
    if (!firebaseUser || firebaseUser.uid === 'admin_root') return;

    const configDocRef = doc(db, 'settings', 'sms_config');
    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSmsConfig({
          webhookUrl: data.webhookUrl || '',
          method: (data.method as 'GET' | 'POST') || 'POST',
          headersText: data.headersText || 'Authorization: Bearer SEU_TOKEN_AQUI\nContent-Type: application/json',
          payloadTemplate: data.payloadTemplate || '{\n  "to": "{{phone}}",\n  "message": "{{message}}"\n}',
          isActive: !!data.isActive,
          useRealWebhook: !!data.useRealWebhook,
          lastTestedAt: data.lastTestedAt,
          lastTestStatus: data.lastTestStatus as 'success' | 'failed' | undefined,
          lastTestResponse: data.lastTestResponse
        });
      }
    });

    return () => {
      unsubConfig();
    };
  }, [firebaseUser]);

  const handleSaveSmsConfig = async () => {
    setSavingConfig(true);
    try {
      const configDocRef = doc(db, 'settings', 'sms_config');
      await setDoc(configDocRef, {
        webhookUrl: smsConfig.webhookUrl,
        method: smsConfig.method,
        headersText: smsConfig.headersText,
        payloadTemplate: smsConfig.payloadTemplate,
        isActive: smsConfig.isActive,
        useRealWebhook: smsConfig.useRealWebhook,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert("Configuração de Webhook de SMS guardada com sucesso no Firestore!");
    } catch (e: any) {
      console.error("Error saving SMS config:", e);
      alert("Erro ao guardar configuração: " + (e.message || e));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!smsConfig.webhookUrl) {
      alert("Por favor, introduza um URL de Webhook antes de testar.");
      return;
    }
    setTestingSms(true);
    setTestResult(null);
    try {
      const response = await authenticatedFetch('/api/test-sms-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl: smsConfig.webhookUrl,
          method: smsConfig.method,
          headersText: smsConfig.headersText,
          payloadTemplate: smsConfig.payloadTemplate,
          testPhone,
          testMessage
        })
      });
      const data = await response.json();
      if (response.ok) {
        setTestResult({
          success: data.success,
          statusCode: data.statusCode,
          statusText: data.statusText,
          responseBody: data.responseBody,
          responseTimeMs: data.responseTimeMs
        });
        
        // Registrar logs de teste
        const configDocRef = doc(db, 'settings', 'sms_config');
        await updateDoc(configDocRef, {
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: data.success ? 'success' : 'failed',
          lastTestResponse: `Status ${data.statusCode}: ${data.responseBody.substring(0, 100)}`
        });
      } else {
        alert("Erro na execução do teste: " + (data.error || "Sem detalhes"));
      }
    } catch (e: any) {
      console.error("Error testing webhook:", e);
      setTestResult({
        success: false,
        statusCode: 500,
        statusText: "Fetch Error",
        responseBody: e.message || "Não foi possível conectar ao servidor de teste."
      });
    } finally {
      setTestingSms(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.phone.includes(searchTerm) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeViewTab === 'pending') {
      return matchesSearch && !u.isVerified;
    }
    return matchesSearch;
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {isPrototypeAdmin && (
        <div className="bg-[#d21034] text-white p-3 text-[10px] font-black uppercase text-center flex items-center justify-center gap-4">
          <ShieldAlert size={16} />
          MODO PROTÓTIPO: OPERAÇÕES DE ESCRITA PODEM SER BLOQUEADAS PELAS REGRAS DE SEGURANÇA. PARA TESTE RELAL, USE O LOGIN COM GOOGLE.
          <button onClick={() => window.location.reload()} className="bg-white text-[#d21034] px-4 py-1 rounded-full text-[8px] font-black">VOLTAR</button>
        </div>
      )}
      {/* Header Stats */}
      <div className="p-6 bg-white border-b border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 uppercase">Gestor do Sistema</h1>
            <p className="text-xs font-bold text-gray-400">Painel de Administração ComeBack</p>
          </div>
          <div className="bg-[#fce100] p-2 rounded-xl shadow-sm">
            <ShieldCheck className="text-black" size={24} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard 
            icon={<Users className="text-blue-500" />} 
            label="Usuários" 
            value={stats.totalUsers} 
            color="bg-blue-50"
          />
          <StatCard 
            icon={<AlertTriangle className="text-red-500" />} 
            label="Perdidos" 
            value={stats.lostItems} 
            color="bg-red-50"
          />
          <StatCard 
            icon={<Package className="text-amber-500" />} 
            label="Achados" 
            value={stats.foundItems} 
            color="bg-amber-50"
          />
          <StatCard 
            icon={<CheckCircle2 className="text-[#009739]" />} 
            label="Recuperados" 
            value={stats.reunitedItems} 
            color="bg-green-50"
          />
          <StatCard 
            icon={<TrendingUp className="text-[#d21034]" />} 
            label="Em Trânsito" 
            value={stats.inTransit} 
            color="bg-rose-50"
          />
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-black text-gray-900 uppercase flex items-center gap-2">
                <UserCheck size={20} className="text-[#009739]" />
                Gestão de Usuários
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Procurar usuário..."
                  className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#fce100] outline-none w-full md:w-64 font-bold"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setActiveViewTab('all')}
                className={`px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all ${activeViewTab === 'all' ? 'bg-black text-[#fce100]' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                Todos Usuários
              </button>
              <button 
                onClick={() => setActiveViewTab('pending')}
                className={`px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeViewTab === 'pending' ? 'bg-[#d21034] text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                Pendentes
                {users.filter(u => !u.isVerified).length > 0 && (
                  <span className="bg-white text-[#d21034] rounded-full w-4 h-4 flex items-center justify-center text-[8px]">
                    {users.filter(u => !u.isVerified).length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveViewTab('stats_graphics')}
                className={`px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeViewTab === 'stats_graphics' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                <i className="fa-solid fa-chart-line text-xs"></i>
                Estatísticas D3
              </button>
              <button 
                onClick={() => setActiveViewTab('sms_settings')}
                className={`px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeViewTab === 'sms_settings' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                <i className="fa-solid fa-gears text-xs"></i>
                Gestão SMS Webhook
              </button>
              <button 
                onClick={async () => {
                  const testUserId = 'test_user_' + Math.random().toString(36).substr(2, 5);
                  const testUser: User = {
                    id: testUserId,
                    name: 'Usuário Teste',
                    email: 'teste@exemplo.mz',
                    phone: '+258 84 000 0000',
                    isVerified: true,
                    createdAt: new Date().toISOString(),
                    rating: 5,
                    documentImageUrl: 'https://picsum.photos/seed/doc/800/600'
                  };
                  try {
                    await setDoc(doc(db, 'users', testUserId), testUser);
                    alert("Usuário de teste 'Teste' criado e verificado com sucesso!");
                  } catch (e) {
                    alert("Erro ao criar usuário de teste: " + e);
                  }
                }}
                className="px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase bg-[#009739] text-white hover:bg-green-700 transition-all flex items-center gap-2"
              >
                <UserCheck size={14} />
                Gerar Teste
              </button>
              <button 
                onClick={async () => {
                  try {
                    let seededCount = 0;
                    for (const item of INITIAL_ITEMS) {
                      await setDoc(doc(db, 'items', item.id), item);
                      seededCount++;
                    }
                    alert(`Sucesso! ${seededCount} artigos de exemplo foram carregados no sistema.`);
                  } catch (e) {
                    alert("Erro ao semear artigos: " + e);
                  }
                }}
                className="px-3 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase bg-[#fce100] text-black hover:bg-[#e6cd00] transition-all flex items-center gap-2"
              >
                <Package size={14} />
                Semear Exemplo
              </button>
            </div>
          </div>

          {activeViewTab === 'stats_graphics' ? (
            <div className="p-6 bg-white">
              <AdminD3Stats items={items} />
            </div>
          ) : activeViewTab === 'sms_settings' ? (
            <div className="p-6 sm:p-10 bg-white">
              <div className="max-w-4xl mx-auto space-y-10">
                {/* Header Information */}
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-network-wired text-blue-600"></i>
                    APIs de Provedoras e Gateways SMS
                  </h3>
                  <p className="text-xs text-gray-500 font-bold uppercase leading-relaxed">
                    Integre provedores de SMS globais (como <span className="text-blue-600">Twilio</span>, <span className="text-pink-600 font-black">Vonage</span> / <span className="text-pink-600 font-black">Infobip</span>) ou gateways locais de Moçambique (<span className="text-amber-500 font-extrabold text-xs">Vodacom, Movitel, mCel</span>). As mensagens críticas de offline enviadas a utilizadores verificados passarão por este canal quando fatias de rede normais falharem.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  
                  {/* Left Column: Form Settings */}
                  <div className="bg-gray-50 border border-gray-150 p-6 rounded-3xl space-y-5 text-left">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2 flex items-center justify-between">
                      <span>⚙️ Parâmetros de Ligação</span>
                      {smsConfig.isActive ? (
                        <span className="text-[8px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded font-black">HABILITADO</span>
                      ) : (
                        <span className="text-[8px] bg-gray-100 border border-gray-250 text-gray-400 px-1.5 py-0.5 rounded font-black">DESATIVADO</span>
                      )}
                    </h4>

                    {/* Webhook API URL */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block">Endereço Webhook (API Gateway URL)</label>
                      <input 
                        type="text" 
                        placeholder="https://api.sms-provider.mz/v1/send" 
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold leading-normal outline-none focus:border-blue-500 transition-colors"
                        value={smsConfig.webhookUrl}
                        onChange={e => setSmsConfig({ ...smsConfig, webhookUrl: e.target.value })}
                      />
                      <span className="text-[7px] text-gray-400 font-bold block ml-1 uppercase">Substitua: <code className="font-mono text-blue-600 bg-gray-200 px-1 rounded">{"{{phone}}"}</code> - Telemóvel, <code className="font-mono text-blue-600 bg-gray-200 px-1 rounded">{"{{message}}"}</code> - Conteúdo</span>
                    </div>

                    {/* Method & Flags */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block font-bold">Método HTTP</label>
                        <select 
                          className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold font-medium outline-none focus:border-blue-500"
                          value={smsConfig.method}
                          onChange={e => setSmsConfig({ ...smsConfig, method: e.target.value as 'GET' | 'POST' })}
                        >
                          <option value="POST">POST (JSON/Body)</option>
                          <option value="GET">GET (Query String)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end pb-1.5 pl-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={smsConfig.isActive}
                            onChange={e => setSmsConfig({ ...smsConfig, isActive: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-black text-gray-700 uppercase">Gateway Ativo</span>
                        </label>
                      </div>
                    </div>

                    {/* Headers Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block">Cabeçalhos HTTP (Um por linha)</label>
                      <textarea 
                        rows={3}
                        placeholder="Authorization: Bearer YOUR_TOKEN_HERE&#10;Content-Type: application/json" 
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 font-mono text-xs font-bold leading-normal outline-none focus:border-blue-500 transition-colors"
                        value={smsConfig.headersText}
                        onChange={e => setSmsConfig({ ...smsConfig, headersText: e.target.value })}
                      />
                      <span className="text-[7px] text-gray-400 font-bold block ml-1 uppercase">Ex: <code className="font-mono">Header-Name: Header-Value</code></span>
                    </div>

                    {/* Payload Template Textarea */}
                    {smsConfig.method === 'POST' && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block font-bold">Estrutura Payload (JSON Template)</label>
                        <textarea 
                          rows={4}
                          placeholder='{&#10;  "to": "{{phone}}",&#10;  "message": "{{message}}"&#10;}' 
                          className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 font-mono text-[11px] font-semibold leading-normal outline-none focus:border-blue-500 transition-colors"
                          value={smsConfig.payloadTemplate}
                          onChange={e => setSmsConfig({ ...smsConfig, payloadTemplate: e.target.value })}
                        />
                        <span className="text-[7.2px] text-gray-400 font-bold block ml-1 uppercase">Substitui placeholders dinâmicos no corpo POST.</span>
                      </div>
                    )}

                    {/* Flags - Use Real Webhook API */}
                    <div className="p-3 bg-white border border-gray-200 rounded-2xl flex items-center justify-between text-left">
                      <div className="pr-2">
                        <span className="text-[9px] font-black text-gray-800 uppercase block">Envio Físico Real (Chamadas Ativas)</span>
                        <span className="text-[7px] text-gray-400 font-semibold uppercase block">Se inativo, as SMS são registadas apenas em MODO SIMULADOR</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={smsConfig.useRealWebhook}
                          onChange={e => setSmsConfig({ ...smsConfig, useRealWebhook: e.target.checked })}
                        />
                        <div className="w-[36px] h-[18px] bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Save Button */}
                    <button 
                      onClick={handleSaveSmsConfig}
                      disabled={savingConfig}
                      className="w-full bg-blue-600 text-white font-black uppercase text-xs p-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {savingConfig ? (
                        <span><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>A Guardar...</span>
                      ) : (
                        <span>Salvar Configuração</span>
                      )}
                    </button>
                  </div>

                  {/* Right Column: Webhook testing panel */}
                  <div className="space-y-6">
                    <div className="bg-gray-50 border border-gray-150 p-6 rounded-3xl text-left space-y-4">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-2">
                        🧪 Sandbox de Depuração SMS
                      </h4>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block">Número de Telemóvel para Ensaio</label>
                        <input 
                          type="text" 
                          placeholder="841234567" 
                          className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold leading-normal outline-none focus:border-blue-500 transition-colors"
                          value={testPhone}
                          onChange={e => setTestPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1 block font-bold">Mensagem de Teste</label>
                        <textarea 
                          rows={2}
                          className="w-full bg-white border-2 border-gray-200 rounded-xl p-3 text-xs font-bold leading-normal outline-none focus:border-blue-500 transition-colors"
                          value={testMessage}
                          onChange={e => setTestMessage(e.target.value)}
                        />
                      </div>

                      <button 
                        onClick={handleTestWebhook}
                        disabled={testingSms || !smsConfig.webhookUrl}
                        className="w-full bg-[#fce100] text-black font-black uppercase text-xs p-4 rounded-xl shadow hover:bg-[#e6cd00] active:scale-95 transition-all disabled:opacity-55 disabled:cursor-not-allowed"
                      >
                        {testingSms ? (
                          <span><i className="fa-solid fa-circle-notch animate-spin mr-2"></i>A Disparar Webhook...</span>
                        ) : (
                          <span>Disparar SMS de Teste</span>
                        )}
                      </button>

                      {smsConfig.lastTestedAt && (
                        <div className="p-3.5 bg-white border border-gray-200 rounded-xl text-[9px] font-bold uppercase leading-normal text-gray-550 space-y-1">
                          <div className="flex justify-between items-center text-gray-400 pb-1 border-b border-gray-100 mb-1">
                            <span>Estado da Última Chamada</span>
                            <span className="text-[8px] font-mono">{new Date(smsConfig.lastTestedAt).toLocaleTimeString()}</span>
                          </div>
                          <div>Status Resposta: <span className={`font-black ${smsConfig.lastTestStatus === 'success' ? 'text-green-600' : 'text-red-500'}`}>{smsConfig.lastTestStatus === 'success' ? 'CUMPRIDO (2xx)' : 'ERRO/FALHADO'}</span></div>
                          <div className="truncate text-gray-400 font-mono text-[8.5px] mt-1 bg-gray-50 p-2 rounded border border-gray-100">{smsConfig.lastTestResponse || 'Sem resposta acumulada'}</div>
                        </div>
                      )}
                    </div>

                    {/* Test result display */}
                    {testResult && (
                      <div className="bg-gray-50 border border-gray-150 p-6 rounded-3xl text-left space-y-3">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-gray-200 pb-2 flex justify-between items-center">
                          <span>📦 Retorno HTTP do Destino</span>
                          <span className="font-mono text-[8px] text-gray-400">{testResult.responseTimeMs}ms</span>
                        </h4>

                        <div className="grid grid-cols-2 gap-2 text-[9px] uppercase font-bold text-gray-500">
                          <div className="bg-white p-2.5 rounded-xl border border-gray-150">
                            <span className="text-gray-400 block pb-0.5">Resultado</span>
                            <span className={`font-black uppercase ${testResult.success ? 'text-green-600' : 'text-red-500'}`}>
                              {testResult.success ? "Sucesso ✅" : "Falha ❌"}
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-gray-150">
                            <span className="text-gray-400 block pb-0.5">Código HTTP</span>
                            <span className={`font-black ${testResult.statusCode >= 200 && testResult.statusCode < 300 ? 'text-green-600' : 'text-red-500'}`}>
                              {testResult.statusCode} ({testResult.statusText})
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[8px] font-black text-gray-400 uppercase ml-1 block">Corpo de Retorno Recebido</span>
                          <pre className="p-3 bg-gray-900 text-green-400 font-mono text-[9px] rounded-xl overflow-x-auto max-h-[120px] whitespace-pre-wrap leading-tight">
                            {testResult.responseBody || "O destino respondeu com sucesso, mas o corpo de retorno está vazio."}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                  <tr>
                    <th className="px-6 py-4">Utilizador</th>
                    <th className="px-6 py-4">Contacto</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Permissões</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-500">
                            {user.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900">{user.name}</p>
                            <p className="text-[10px] font-medium text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-black text-gray-500">{user.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        {user.isVerified ? (
                          <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 w-fit">
                            <CheckCircle2 size={10} /> Verificado
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-500 text-[8px] font-black px-2 py-1 rounded-full uppercase flex items-center gap-1 w-fit">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {user.isAdmin ? (
                            <span className="bg-purple-100 text-purple-700 text-[7px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                              <Shield size={10} /> Administrador
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 text-[7px] font-black px-2 py-0.5 rounded-full uppercase w-fit">
                              Utilizador
                            </span>
                          )}
                          {user.isSuperAdmin && (
                            <span className="bg-rose-100 text-rose-700 text-[7px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit">
                              <ShieldAlert size={10} /> Super Admin
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star 
                              key={star} 
                              size={12} 
                              className={`${(user.rating || 0) >= star ? 'text-[#fce100] fill-[#fce100]' : 'text-gray-200'}`} 
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {authUser?.isSuperAdmin && (
                            <button 
                              onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                              className={`p-2 rounded-lg transition-colors ${user.isAdmin ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-200'}`}
                              title={user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                            >
                              <UserCog size={16} />
                            </button>
                          )}
                          
                          {!user.isVerified && (
                            <button 
                              onClick={() => setSelectedVerificationUser(user)}
                              className="p-2 bg-green-50 text-[#009739] rounded-lg hover:bg-green-100 transition-colors"
                              title="Verificar Documentos"
                            >
                              <ShieldCheck size={16} />
                            </button>
                          )}

                          <button 
                            onClick={() => handleVerifyUser(user.id, !user.isVerified)}
                            className={`p-2 rounded-lg transition-colors ${user.isVerified ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-[#009739] hover:bg-green-100'}`}
                            title={user.isVerified ? "Revogar Verificação" : "Aprovar Instantaneamente"}
                          >
                            {user.isVerified ? <ShieldAlert size={16} /> : <UserCheck size={16} />}
                          </button>
                          <div className="relative group">
                            <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:bg-gray-100" title="Dar Pontuação">
                              <Award size={16} />
                            </button>
                            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:flex bg-white shadow-xl rounded-xl p-2 border border-gray-100 gap-1 z-10">
                              {[1,2,3,4,5].map(r => (
                                <button 
                                  key={r}
                                  onClick={() => handleRateUser(user.id, r)}
                                  className="w-6 h-6 flex items-center justify-center text-[10px] font-black hover:bg-[#fce100] rounded-md transition-colors"
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredUsers.length === 0 && (
                <div className="p-12 text-center">
                  <i className="fa-solid fa-users-slash text-4xl text-gray-100 mb-4"></i>
                  <p className="text-gray-400 font-black text-xs uppercase">Nenhum utilizador encontrado</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      <AnimatePresence>
        {selectedVerificationUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedVerificationUser(null)}></div>
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 uppercase">Verificar Conformidade</h3>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
                    Utilizador: {selectedVerificationUser.name}
                  </p>
                </div>
                <button onClick={() => setSelectedVerificationUser(null)} className="p-3 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-black">
                  <ShieldAlert size={24} />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Documento de Identidade</h4>
                    <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-xl relative group flex items-center justify-center p-4">
                      {selectedVerificationUser.documentImageUrl ? (
                        <img 
                          src={selectedVerificationUser.documentImageUrl} 
                          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" 
                          alt="ID Document" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 p-8 text-center">
                          <i className="fa-solid fa-id-card text-5xl mb-4"></i>
                          <p className="text-[10px] font-black uppercase">Nenhuma foto de documento enviada pelo utilizador</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Dados de Registo</h4>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="text-[8px] font-black text-gray-400 uppercase mb-1">E-mail</div>
                        <div className="text-sm font-black text-gray-800">{selectedVerificationUser.email}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Telemóvel</div>
                        <div className="text-sm font-black text-gray-800">{selectedVerificationUser.phone || 'NÃO FORNECIDO'}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="text-[8px] font-black text-gray-400 uppercase mb-1">Data de Ingresso</div>
                        <div className="text-sm font-black text-gray-800">
                           {new Date(selectedVerificationUser.createdAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-500">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h5 className="font-black text-blue-900 text-sm uppercase">Requisitos de Segurança</h5>
                    <p className="text-xs text-blue-700/70 font-medium mt-1">
                      Certifique-se de que o nome no documento corresponde ao nome de registo. A verificação dá ao utilizador o selo de confiança ComeBack.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                <button 
                  onClick={async () => {
                    await handleVerifyUser(selectedVerificationUser.id, true);
                    setSelectedVerificationUser(null);
                  }}
                  className="flex-1 bg-[#009739] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={24} />
                  Aprovar Utilizador
                </button>
                <button 
                  onClick={() => setSelectedVerificationUser(null)}
                  className="flex-1 bg-white border-2 border-gray-100 text-gray-400 py-5 rounded-2xl font-black uppercase tracking-widest hover:border-black hover:text-black transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className={`p-4 rounded-2xl ${color} border border-white shadow-sm`}>
    <div className="flex justify-between items-start mb-2">
      <div className="p-2 bg-white rounded-xl shadow-sm">{icon}</div>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{label}</span>
    </div>
    <div className="text-xl font-black text-gray-900">{value}</div>
  </div>
);
