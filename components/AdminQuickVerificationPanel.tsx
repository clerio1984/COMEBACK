import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  ShieldAlert, 
  Search, 
  FileCheck, 
  Eye, 
  X, 
  Check, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Filter, 
  AlertCircle,
  Clock,
  Sparkles,
  UserCog
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { User } from '../types';

interface AdminQuickVerificationPanelProps {
  currentUser: User;
  onOpenFullDashboard?: () => void;
}

export const AdminQuickVerificationPanel: React.FC<AdminQuickVerificationPanelProps> = ({ 
  currentUser,
  onOpenFullDashboard 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'pending_docs' | 'all' | 'verified' | 'verifiers'>('pending_docs');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocUser, setSelectedDocUser] = useState<User | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [rejectionModalUser, setRejectionModalUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Carregar utilizadores em tempo real do Firestore
  useEffect(() => {
    setLoading(true);
    const usersCol = collection(db, 'users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const usersList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as User[];

      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Notificação temporária de sucesso
  const showFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => {
      setActionSuccessMsg(null);
    }, 4000);
  };

  // Aprovar verificação de documento
  const handleApproveVerification = async (userId: string, userName: string) => {
    try {
      setActionLoadingId(userId);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isVerified: true,
        verificationNote: `Aprovado por ${currentUser.name || 'Admin'} em ${new Date().toLocaleDateString('pt-MZ')}`,
        verifiedAt: new Date().toISOString()
      });
      showFeedback(`Documento de ${userName} verificado e aprovado com sucesso!`);
      if (selectedDocUser?.id === userId) {
        setSelectedDocUser(prev => prev ? { ...prev, isVerified: true } : null);
      }
    } catch (err: any) {
      console.error("Erro ao aprovar verificação:", err);
      alert("Não foi possível aprovar a verificação: " + (err.message || 'Erro desconhecido'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Revogar ou rejeitar verificação de documento
  const handleConfirmRejection = async () => {
    if (!rejectionModalUser) return;
    const userId = rejectionModalUser.id;
    try {
      setActionLoadingId(userId);
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isVerified: false,
        verificationNote: rejectionReason.trim() 
          ? `Rejeitado/Revogado: ${rejectionReason.trim()} (${new Date().toLocaleDateString('pt-MZ')})` 
          : `Verificação revogada por ${currentUser.name || 'Admin'} em ${new Date().toLocaleDateString('pt-MZ')}`
      });
      showFeedback(`Estado de verificação de ${rejectionModalUser.name} revogado.`);
      setRejectionModalUser(null);
      setRejectionReason('');
      if (selectedDocUser?.id === userId) {
        setSelectedDocUser(prev => prev ? { ...prev, isVerified: false } : null);
      }
    } catch (err: any) {
      console.error("Erro ao revogar verificação:", err);
      alert("Erro ao atualizar verificação: " + (err.message || 'Erro desconhecido'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Gerir permissão para verificar documentos (delegar papel de verificador)
  const handleToggleVerifierPermission = async (user: User) => {
    try {
      setActionLoadingId(user.id);
      const newStatus = !user.canVerifyDocuments;
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        canVerifyDocuments: newStatus
      });
      showFeedback(
        newStatus 
          ? `Permissão de Verificador de Documentos concedida a ${user.name}!` 
          : `Permissão de Verificador revogada de ${user.name}.`
      );
    } catch (err: any) {
      console.error("Erro ao atualizar permissão:", err);
      alert("Erro ao alterar permissão: " + (err.message || 'Erro desconhecido'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const pendingWithDocs = users.filter(u => !!u.documentImageUrl && !u.isVerified).length;
    const verified = users.filter(u => u.isVerified).length;
    const verifiers = users.filter(u => u.canVerifyDocuments || u.isAdmin || u.isSuperAdmin).length;
    return {
      pendingWithDocs,
      verified,
      total: users.length,
      verifiers
    };
  }, [users]);

  // Lista filtrada
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Busca textual
      const q = searchTerm.toLowerCase().trim();
      const matchesQuery = !q || 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.province && u.province.toLowerCase().includes(q));

      if (!matchesQuery) return false;

      // Filtro de separador
      if (activeFilter === 'pending_docs') {
        return !!u.documentImageUrl && !u.isVerified;
      }
      if (activeFilter === 'verified') {
        return u.isVerified;
      }
      if (activeFilter === 'verifiers') {
        return !!(u.canVerifyDocuments || u.isAdmin || u.isSuperAdmin);
      }
      return true; // 'all'
    });
  }, [users, searchTerm, activeFilter]);

  return (
    <div 
      id="admin-quick-verification-panel"
      className="bg-white dark:bg-slate-900 border-2 border-emerald-500/25 dark:border-emerald-500/20 rounded-[2rem] p-4 sm:p-5 shadow-sm space-y-4 text-left transition-all duration-300"
    >
      {/* Header do Painel Rápido */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white tracking-wide">
                Gestão Rápida de Verificações
              </h3>
              <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Admin
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Aprovação de documentos BI e gestão de permissões sem sair do perfil
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenFullDashboard && (
            <button
              type="button"
              onClick={onOpenFullDashboard}
              className="text-[9.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-[#009739] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#009739] transition-all flex items-center gap-1.5 cursor-pointer"
              title="Aceder ao Dashboard Completo de Administração"
              id="admin-quick-open-full-dashboard-btn"
            >
              <span>Dashboard Completo</span>
              <ExternalLink size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={isOpen ? "Recolher Painel Rápido" : "Expandir Painel Rápido"}
            id="admin-quick-toggle-panel-btn"
          >
            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Notificação Temporária de Sucesso */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200">
          <Check size={16} className="shrink-0 text-emerald-600" />
          <span className="flex-1">{actionSuccessMsg}</span>
          <button 
            type="button" 
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-800 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* Barra de Contadores e Filtros Rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter('pending_docs')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'pending_docs'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-400 text-slate-700 dark:text-slate-300'
              }`}
              id="admin-filter-pending-docs-btn"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Pendentes c/ BI
                </span>
                <Clock size={12} className="text-amber-500" />
              </div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">
                {stats.pendingWithDocs}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('verified')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'verified'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-emerald-400 text-slate-700 dark:text-slate-300'
              }`}
              id="admin-filter-verified-btn"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Verificados
                </span>
                <UserCheck size={12} className="text-emerald-500" />
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                {stats.verified}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('verifiers')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'verifiers'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-blue-400 text-slate-700 dark:text-slate-300'
              }`}
              id="admin-filter-verifiers-btn"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Verificadores
                </span>
                <UserCog size={12} className="text-blue-500" />
              </div>
              <div className="text-lg font-black text-blue-600 dark:text-blue-400 leading-tight">
                {stats.verifiers}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 text-slate-900 dark:text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
              }`}
              id="admin-filter-all-btn"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Todos
                </span>
                <Filter size={12} className="text-slate-400" />
              </div>
              <div className="text-lg font-black text-slate-700 dark:text-slate-200 leading-tight">
                {stats.total}
              </div>
            </button>
          </div>

          {/* Campo de Pesquisa em Tempo Real */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar utilizador por nome, telefone ou email..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 transition-colors"
              id="admin-quick-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lista de Utilizadores */}
          {loading ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-[11px] font-bold uppercase tracking-wider">A carregar dados de utilizadores...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
              <FileCheck size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {activeFilter === 'pending_docs' 
                  ? 'Nenhum utilizador com documento pendente de verificação.' 
                  : 'Nenhum utilizador encontrado para este critério.'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {activeFilter === 'pending_docs' 
                  ? 'Todas as submissões de BI foram analisadas!' 
                  : 'Tente ajustar a pesquisa ou o filtro selecionado.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
              {filteredUsers.map((user) => {
                const isWorking = actionLoadingId === user.id;
                const hasDoc = !!user.documentImageUrl;
                const isVerifier = !!(user.canVerifyDocuments || user.isAdmin || user.isSuperAdmin);

                return (
                  <div
                    key={user.id}
                    className="p-3 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Informações do Utilizador */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative mt-0.5">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-slate-600 dark:text-slate-300 text-xs">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </span>
                        )}
                        {user.isVerified && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white dark:border-slate-900"></span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {user.name || 'Sem Nome'}
                          </span>

                          {user.isVerified ? (
                            <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              Verificado
                            </span>
                          ) : hasDoc ? (
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 animate-pulse">
                              BI Submetido
                            </span>
                          ) : (
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">
                              Sem Documento
                            </span>
                          )}

                          {user.canVerifyDocuments && (
                            <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                              Verificador
                            </span>
                          )}

                          {user.isAdmin && (
                            <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-800 font-mono">
                              Admin
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex-wrap">
                          {user.phone && <span>📞 {user.phone}</span>}
                          {user.province && <span>📍 {user.province}</span>}
                          {user.verificationNote && (
                            <span className="text-slate-400 italic text-[9px] truncate max-w-[200px]" title={user.verificationNote}>
                              Nota: {user.verificationNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações Rápidas do Administrador */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                      {/* Botão de Ver Documento Anexado */}
                      {hasDoc ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDocUser(user)}
                          className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                          title="Inspecionar Documento BI anexado"
                        >
                          <Eye size={12} />
                          <span>Ver BI</span>
                        </button>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-400 px-1">
                          Sem BI
                        </span>
                      )}

                      {/* Botão de Aprovação / Revogação Rápida */}
                      {!user.isVerified ? (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => handleApproveVerification(user.id, user.name)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                          title="Aprovar Documento e Conceder Selo Verificado"
                        >
                          <Check size={12} />
                          <span>{isWorking ? '...' : 'Aprovar'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => {
                            setRejectionModalUser(user);
                            setRejectionReason('');
                          }}
                          className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                          title="Revogar Verificação de Documento"
                        >
                          <ShieldAlert size={12} />
                          <span>Revogar</span>
                        </button>
                      )}

                      {/* Botão de Atribuição de Permissão de Verificador */}
                      {(currentUser.isAdmin || currentUser.isSuperAdmin) && (
                        <button
                          type="button"
                          disabled={isWorking || user.id === currentUser.id}
                          onClick={() => handleToggleVerifierPermission(user)}
                          className={`p-1.5 rounded-xl border text-[10px] font-black transition-all cursor-pointer ${
                            user.canVerifyDocuments
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600'
                          }`}
                          title={
                            user.canVerifyDocuments 
                              ? "Revogar permissão de verificador deste utilizador" 
                              : "Conceder permissão para verificar documentos a este utilizador"
                          }
                        >
                          <UserCog size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dica de Segurança Institucional */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] text-slate-400 font-medium">
            <span>
              🔒 Apenas administradores e verificadores autorizados podem validar documentos BI.
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Sincronização em Tempo Real
            </span>
          </div>
        </div>
      )}

      {/* Modal de Inspeção e Visualização de Documento */}
      {selectedDocUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-left relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 dark:text-white">
                    Documento de Identificação (BI)
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {selectedDocUser.name} • {selectedDocUser.phone || 'Sem telefone'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Imagem do Documento */}
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[320px] flex items-center justify-center relative group">
              {selectedDocUser.documentImageUrl ? (
                <img
                  src={selectedDocUser.documentImageUrl}
                  alt={`Documento de ${selectedDocUser.name}`}
                  className="w-full h-full max-h-[320px] object-contain"
                />
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">Nenhum ficheiro de documento carregado.</p>
                </div>
              )}
            </div>

            {/* Selfie de Prova de Vida (se disponível) */}
            {selectedDocUser.livenessSelfieUrl && (
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <img
                  src={selectedDocUser.livenessSelfieUrl}
                  alt="Prova de Vida"
                  className="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-slate-700"
                />
                <div className="text-[10px]">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Selfie de Prova de Vida
                  </span>
                  <span className="text-slate-400">Capturada em presença física ativa</span>
                </div>
              </div>
            )}

            {/* Botões de Ação no Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedDocUser(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Fechar
              </button>

              {!selectedDocUser.isVerified ? (
                <button
                  type="button"
                  disabled={actionLoadingId === selectedDocUser.id}
                  onClick={() => handleApproveVerification(selectedDocUser.id, selectedDocUser.name)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check size={14} />
                  <span>Aprovar Documento</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRejectionModalUser(selectedDocUser);
                    setRejectionReason('');
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert size={14} />
                  <span>Revogar Verificação</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Justificação para Revogação/Rejeição */}
      {rejectionModalUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-4 text-left">
            <div className="flex items-center gap-2.5 text-rose-600">
              <ShieldAlert size={22} />
              <h4 className="text-sm font-black uppercase">
                Revogar Verificação
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem a certeza de que deseja revogar o estado verificado de <strong className="text-slate-900 dark:text-white">{rejectionModalUser.name}</strong>?
            </p>

            <div>
              <label className="block text-[9.5px] font-black uppercase text-slate-400 mb-1">
                Motivo ou Nota (Opcional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Foto do BI ilegível, nome divergente, etc."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-rose-500 resize-none h-20"
              ></textarea>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalUser(null)}
                className="px-3.5 py-2 text-slate-500 font-bold text-xs uppercase rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoadingId === rejectionModalUser.id}
                onClick={handleConfirmRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirmar Revogação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
