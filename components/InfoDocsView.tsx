import React, { useState, useEffect } from 'react';
import promoBanner from '../src/assets/images/comeback_promo_banner_1780660281260.png';
import { TOTAL_FEE_PERCENT, COMMISSION_FEE_PERCENT, MAINTENANCE_FEE_PERCENT } from '../constants';

export const InfoDocsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'about' | 'terms' | 'privacy' | 'security' | 'contact'>('about');
  const [bannerError, setBannerError] = useState(false);

  // States for the direct contact form
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Interactive Fee Calculator in Terms and Conditions
  const [termsSimAmount, setTermsSimAmount] = useState<number>(2000);

  useEffect(() => {
    const handleSubtabChange = (e: any) => {
      if (e.detail) {
        setActiveSubTab(e.detail);
      }
    };
    window.addEventListener('comeback_info_subtab_change', handleSubtabChange);

    // Check localStorage on mount
    const saved = localStorage.getItem('comeback_info_subtab');
    if (saved && ['about', 'terms', 'privacy', 'security', 'contact'].includes(saved)) {
      setActiveSubTab(saved as any);
      localStorage.removeItem('comeback_info_subtab'); // consume item
    }

    return () => window.removeEventListener('comeback_info_subtab_change', handleSubtabChange);
  }, []);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      alert('Por favor, preencha todos os campos do formulário.');
      return;
    }
    setFormSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setFormSubmitted(false);
      alert('Mensagem enviada com sucesso! A nossa equipa de apoio entrará em contacto dentro de 12 horas.');
    }, 1000);
  };

  return (
    <div className="p-5 sm:p-6 bg-slate-50 min-h-screen text-left font-sans" id="comeback-legal-docs-view">
      {/* Title section */}
      <div className="mb-6 bg-white p-5 rounded-3xl border border-gray-150 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-[#009739] text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-xs">
            ComeBack Moçambique
          </span>
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">
            Utilidade Pública & Transparência
          </span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Centro de Informação & Leis</h2>
        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Conectando perdas e retornos com total segurança e suporte legal</p>
      </div>

      {/* Inline Segmented Control with active styling */}
      <div className="grid grid-cols-5 gap-1 p-1.5 bg-white border border-gray-150 rounded-2xl mb-6 shadow-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('about')}
          className={`py-3 rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wide transition-all cursor-pointer ${
            activeSubTab === 'about' ? 'bg-[#009739] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <i className="fa-solid fa-circle-info block mb-1 text-sm sm:text-base"></i>
          Sobre Nós
        </button>
        <button
          onClick={() => setActiveSubTab('terms')}
          className={`py-3 rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wide transition-all cursor-pointer ${
            activeSubTab === 'terms' ? 'bg-[#009739] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <i className="fa-solid fa-file-contract block mb-1 text-sm sm:text-base"></i>
          Termos
        </button>
        <button
          onClick={() => setActiveSubTab('privacy')}
          className={`py-3 rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wide transition-all cursor-pointer ${
            activeSubTab === 'privacy' ? 'bg-[#009739] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <i className="fa-solid fa-user-shield block mb-1 text-sm sm:text-base"></i>
          Privacidade
        </button>
        <button
          onClick={() => setActiveSubTab('security')}
          className={`py-3 rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wide transition-all cursor-pointer ${
            activeSubTab === 'security' ? 'bg-[#009739] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <i className="fa-solid fa-shield-halved block mb-1 text-sm sm:text-base"></i>
          Segurança
        </button>
        <button
          onClick={() => setActiveSubTab('contact')}
          className={`py-3 rounded-xl font-black uppercase text-[8px] sm:text-[9px] tracking-wide transition-all cursor-pointer ${
            activeSubTab === 'contact' ? 'bg-[#009739] text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <i className="fa-solid fa-envelope block mb-1 text-sm sm:text-base"></i>
          Contacto
        </button>
      </div>

      {/* Docs Sub-tabs Rendering */}
      <div className="space-y-6 animate-in fade-in duration-350">
        
        {/* ================= ABOUT US TAB ================= */}
        {activeSubTab === 'about' && (
          <div className="space-y-6" id="about-us-document">
            <div className="relative rounded-[2.5rem] overflow-hidden border border-gray-150 shadow-lg group aspect-[16/9] bg-gradient-to-br from-[#009739] via-emerald-800 to-slate-900">
              {!bannerError && (
                <img 
                  src={promoBanner} 
                  alt="Banner Promocional ComeBack" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]" 
                  referrerPolicy="no-referrer"
                  id="comeback-promo-artwork"
                  onError={() => setBannerError(true)}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 flex flex-col justify-end text-white text-left">
                <span className="bg-[#fce100] text-black text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md self-start mb-2">
                  Retorno Inteligente de Bens
                </span>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight mb-1">
                  Unir Moçambique na Recuperação de Pertences
                </h3>
                <p className="text-[10px] sm:text-xs text-white/90 leading-relaxed font-semibold">
                  A nossa missão é conectar perdas e retornos com honestidade, aliando a comunidade, tecnologia inovadora e parcerias com as autoridades públicas.
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-xs space-y-4 text-xs font-semibold text-slate-600 leading-relaxed">
              <h4 className="text-sm font-black text-slate-900 uppercase border-b-2 border-[#009739] pb-1.5 flex items-center gap-2">
                <i className="fa-solid fa-flag text-[#009739]"></i>
                Quem Somos
              </h4>
              <p className="uppercase">
                O <span className="text-slate-900 font-black">ComeBack Moçambique</span> é uma iniciativa pioneira de utilidade pública desenvolvida pela <span className="text-[#009739] font-black">Souto Digital Serviços</span>. Fomos motivados pela necessidade de combater o elevado índice de perda de documentos e bens essenciais (telemóveis, carteiras, chaves) nas províncias moçambicanas, eliminando a desorganização e as burlas frequentes nas redes sociais tradicionais.
              </p>
              <p className="uppercase">
                Aliamos tecnologia de geolocalização, inteligência artificial do Gemini para correspondência de dados de forma automatizada e verificação robusta de identidade por Bilhete de Identidade (BI) para que cada devolução ocorra dentro dos trâmites legais de segurança jurídica e física.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                  <div className="text-2xl font-black text-[#009739] font-mono">1.2k+</div>
                  <div className="text-[9px] font-black uppercase text-slate-500">Bens Reunidos</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                  <div className="text-2xl font-black text-[#009739] font-mono">98%</div>
                  <div className="text-[9px] font-black uppercase text-slate-500">BI Verificados</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                  <div className="text-2xl font-black text-[#009739] font-mono">24/7</div>
                  <div className="text-[9px] font-black uppercase text-slate-500">Radar de Varredura</div>
                </div>
              </div>
            </div>

            {/* Guia Prático de Utilização */}
            <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <i className="fa-solid fa-compass text-[#008fe2]"></i>
                    Como Funciona o ComeBack
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold uppercase mt-0.5">
                    Processo simples e seguro em 3 passos
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-sky-50 dark:bg-sky-950/30 text-[#008fe2] rounded-lg border border-sky-150 dark:border-sky-900/40">
                  Guia Rápido
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-2xs space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm border border-amber-200/60">
                    01
                  </div>
                  <h5 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                    Registar o Objeto
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    Publique em poucos segundos se perdeu ou encontrou um bem. Adicione fotos claras, local aproximado e categoria (documento, telemóvel, chave, etc.).
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-2xs space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-[#008fe2] flex items-center justify-center font-black text-sm border border-sky-200/60">
                    02
                  </div>
                  <h5 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                    Radar Inteligente
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    O sistema cruza dados em tempo real. Quando há semelhança entre quem perdeu e quem achou, ambas as partes recebem notificações imediatas.
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-2xs space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-200/60">
                    03
                  </div>
                  <h5 className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-wide">
                    Devolução com Segurança
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    Converse pelo chat integrado e confirme a titularidade. As entregas devem ocorrer sempre em locais públicos seguros (esquadras da PRM, shoppings ou bancos).
                  </p>
                </div>
              </div>

              {/* Dicas de Proteção Essenciais */}
              <div className="bg-slate-100/70 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs">
                <i className="fa-solid fa-shield-check text-[#008fe2] text-lg mt-0.5 shrink-0"></i>
                <div className="space-y-1">
                  <p className="font-black text-slate-900 dark:text-white uppercase text-[11px]">
                    Recomendações Importantes
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Nunca faça transferências adiantadas a desconhecidos. Para objetos recuperados, o registo é automaticamente eliminado após 7 dias para garantir a privacidade total dos seus dados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TERMS & CONDITIONS TAB ================= */}
        {activeSubTab === 'terms' && (
          <div className="space-y-6" id="terms-conditions-document">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <i className="fa-solid fa-file-invoice text-[#009739]"></i>
                Termos de Uso & Condições de Operação
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Última actualização: Julho de 2026</p>
              
              <div className="space-y-4 text-xs font-semibold text-slate-600 uppercase leading-relaxed">
                <p>
                  Ao utilizar a plataforma <span className="text-slate-900 font-black">ComeBack</span>, seja registando itens perdidos, declarando itens achados ou interagindo no nosso chat seguro, o utilizador aceita integralmente e sem reservas os seguintes termos de serviço:
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  1. Política Estrita de Exclusão após 7 Dias (Muito Importante!)
                </h4>
                <div className="bg-emerald-55 bg-emerald-50 text-slate-800 p-4 rounded-2xl border border-emerald-200/50 space-y-2">
                  <p className="font-black text-[#009739]">PROCESSO DE APAGAMENTO AUTOMÁTICO DE PRIVACIDADE</p>
                  <p className="text-[11px] leading-relaxed">
                    Assim que um item for marcado com o status de <strong className="text-[#009739]">RECUPERADO / DEVOLVIDO</strong> na base de dados, o registo permanecerá público por apenas <span className="text-slate-900 font-black">7 dias (período de tolerância e validação)</span>. Após decorridos estes 7 dias:
                  </p>
                  <ul className="list-disc list-inside text-[11px] font-bold space-y-1 pl-2">
                    <li>Todas as fotografias anexadas ao artigo são permanentemente deletadas.</li>
                    <li>As descrições físicas, nomes e localizações são purgados.</li>
                    <li>O registo deixa de existir na nossa base de dados ativa de forma definitiva e irreversível.</li>
                  </ul>
                </div>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  2. Honestidade de Cadastro e Falsas Declarações
                </h4>
                <p>
                  Qualquer cidadão que registar itens não pertencentes a si de má-fé, ou que registar falsos bens encontrados com o objetivo de burlar terceiros ou extorquir recompensas, será sumariamente banido e a sua conta será entregue à Procuradoria e forças de investigação criminal em Moçambique.
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  3. Política de Retenção de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% em Todas as Transações & Custódia Automática
                </h4>
                <p>
                  As gratificações voluntárias, recompensas acordadas e pagamentos de resgate efetuados através da plataforma ComeBack operam sob o nosso sistema automatizado de custódia e garantia de entrega (Escrow Seguro).
                </p>

                {/* Caixa Destaque de Regra dos 12% */}
                <div className="bg-emerald-50 border-2 border-emerald-200 p-4.5 rounded-2xl space-y-3.5 text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#009739] text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      Regra Geral de Transação
                    </span>
                    <span className="font-black text-xs text-emerald-900 uppercase">
                      Retenção Automática de {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% sobre o Valor Total
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed">
                    <strong>Em todas as transações financeiras processadas na plataforma ComeBack, o sistema retém automaticamente {(TOTAL_FEE_PERCENT * 100).toFixed(0)}% sobre o montante total transacionado.</strong> Esta dedução é calculada e aplicada de forma estritamente instantânea pelo sistema antes da liberação do saldo líquido para o utilizador beneficiário.
                  </p>

                  {/* Detalhes de Repartição da Taxa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/70">
                      <span className="text-[#009739] font-black block uppercase text-[9px]">Comissão de Intermediação ({(COMMISSION_FEE_PERCENT * 100).toFixed(0)}%)</span>
                      <span className="text-gray-600 font-semibold leading-tight block mt-0.5">
                        Cobertura de arbitragem, segurança antifraude, mediação de disputas e suporte operacional ao cidadão.
                      </span>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/70">
                      <span className="text-[#009739] font-black block uppercase text-[9px]">Custódia & Infraestrutura ({(MAINTENANCE_FEE_PERCENT * 100).toFixed(0)}%)</span>
                      <span className="text-gray-600 font-semibold leading-tight block mt-0.5">
                        Manutenção dos servidores, barramento de integração mobile money (M-Pesa, e-Mola) e radar GPS.
                      </span>
                    </div>
                  </div>

                  {/* Simulador Interativo Dentro dos Termos */}
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
                    <span className="text-[9px] font-black text-slate-800 uppercase tracking-wider block">
                      🧮 Simulador de Cálculo Automático de Transação:
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-[9px] font-bold text-gray-500 uppercase whitespace-nowrap">Valor da Recompensa:</label>
                      <input 
                        type="number"
                        min="100"
                        step="100"
                        value={termsSimAmount}
                        onChange={(e) => setTermsSimAmount(Math.max(0, Number(e.target.value)))}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-black text-slate-800 w-28 outline-none focus:border-[#009739]"
                      />
                      <span className="text-xs font-black text-gray-600">MT</span>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-150 space-y-1.5 text-[9.5px]">
                      <div className="flex justify-between font-semibold text-gray-600">
                        <span>• Valor Total Declarado:</span>
                        <span className="font-bold text-slate-800">{termsSimAmount.toLocaleString('pt-MZ')} MT (100%)</span>
                      </div>
                      <div className="flex justify-between font-bold text-red-500">
                        <span>• Retenção Automática do Sistema ({(TOTAL_FEE_PERCENT * 100).toFixed(0)}%):</span>
                        <span>-{(termsSimAmount * TOTAL_FEE_PERCENT).toLocaleString('pt-MZ', { maximumFractionDigits: 0 })} MT</span>
                      </div>
                      <div className="flex justify-between font-black text-[#009739] border-t border-dashed border-gray-200 pt-1 text-[10.5px]">
                        <span>★ Valor Líquido Final Creditado ({((1 - TOTAL_FEE_PERCENT) * 100).toFixed(0)}%):</span>
                        <span>{(termsSimAmount * (1 - TOTAL_FEE_PERCENT)).toLocaleString('pt-MZ', { maximumFractionDigits: 0 })} MT</span>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  4. Processo de Pagamento Seguro e Liberação
                </h4>
                <p>
                  O dinheiro depositado em custódia permanece bloqueado pelo protocolo ComeBack Escrow e apenas é transferido para o número M-Pesa ou e-Mola do achador após o legítimo proprietário confirmar expressamente que recebeu o seu artigo intacto, ou após validação por comprovativo fotográfico irrevogável.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= PRIVACY POLICY TAB ================= */}
        {activeSubTab === 'privacy' && (
          <div className="space-y-6" id="privacy-policy-document">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <i className="fa-solid fa-user-lock text-[#009739]"></i>
                Políticas de Privacidade de Dados
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Segurança de Dados e Identidade sob o Regulamento Nacional</p>

              <div className="space-y-4 text-xs font-semibold text-slate-600 uppercase leading-relaxed">
                <h4 className="font-black text-slate-900 text-xs uppercase border-l-4 border-[#009739] pl-2">
                  1. Proteção de Identidade e Contactos Móveis
                </h4>
                <p>
                  O seu número de telemóvel registado no ComeBack nunca é exibido publicamente de forma aberta. Ele é protegido e apenas partilhado no âmbito do resgate após as contas estarem verificadas através do nosso canal de SMS e M-Pesa.
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase border-l-4 border-[#009739] pl-2">
                  2. Eliminação de Imagens e Histórico de Bens
                </h4>
                <p>
                  Garantimos que todas as fotografias carregadas pelos utilizadores (sejam documentos de identificação ou bens físicos) são mantidas em servidores encriptados e sofrem exclusão definitiva ao fim de 7 dias após a reunificação do bem, em estrita conformidade com as regras de confidencialidade de dados moçambicanas.
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase border-l-4 border-[#009739] pl-2">
                  3. Coleta de Geolocalização Pontual
                </h4>
                <p>
                  As coordenadas GPS do radar servem exclusivamente para calcular a distância e detetar correspondências geográficas automáticas entre itens perdidos e achados na mesma vizinhança. O histórico das suas coordenadas não é guardado e é renovado em cada sessão.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= SECURITY POLICY TAB ================= */}
        {activeSubTab === 'security' && (
          <div className="space-y-6" id="security-policy-document">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-[#009739]"></i>
                Política e Diretrizes de Encontro Seguro
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Como prevenir fraudes e garantir uma devolução 100% segura</p>

              <div className="space-y-4 text-xs font-semibold text-slate-600 uppercase leading-relaxed">
                <div className="bg-amber-50 text-amber-900 p-5 rounded-2xl border border-amber-200 space-y-2">
                  <h4 className="font-black text-xs uppercase flex items-center gap-1.5">
                    <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                    REGRA DE OURO: ESQUADRAS DA POLÍCIA
                  </h4>
                  <p className="text-[11px] leading-relaxed">
                    Recomendamos veementemente que TODO e qualquer encontro físico para devolução de telemóveis, malas, dinheiro ou documentos ocorra <strong className="text-slate-900 font-extrabold">dentro ou diretamente em frente a uma Esquadra Oficial da Polícia da República de Moçambique (PRM)</strong>. Nunca marque encontros em ruelas, becos ou locais isolados após o pôr do sol.
                  </p>
                </div>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  1. Nunca envie dinheiro adiantado
                </h4>
                <p>
                  Nunca envie valores de transporte ou "adiantamentos" de gratificação ao localizador via M-Pesa antes de ver o seu artigo com os seus próprios olhos e confirmar a sua autenticidade. Use a nossa funcionalidade de custódia onde o valor fica retido na carteira oficial do ComeBack.
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  2. Exija Prova Visual Inequívoca
                </h4>
                <p>
                  Antes de se deslocar para o encontro, utilize o nosso chat seguro para solicitar uma fotografia ou vídeo em tempo real do objeto ao lado de um papel escrito à mão com a data de hoje. Isso evita lidar com burladores que afirmam ter encontrado bens que na realidade não possuem.
                </p>

                <h4 className="font-black text-slate-900 text-xs uppercase mt-4 border-l-4 border-[#009739] pl-2">
                  3. Verificação de Identidade Obrigatória (BI)
                </h4>
                <p>
                  A plataforma ComeBack exige que os utilizadores que declarem bens achados submetam uma foto legível do Bilhete de Identidade. Isso garante a rastreabilidade e previne que criminosos usem a rede anonimamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONTACT TAB ================= */}
        {activeSubTab === 'contact' && (
          <div className="space-y-6" id="contact-us-document">
            <div className="bg-white p-6 rounded-[2rem] border border-gray-150 shadow-xs space-y-4">
              <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-[#009739]"></i>
                Contacto e Canal de Apoio
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Estamos aqui para o apoiar a qualquer hora</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 font-semibold leading-relaxed">
                {/* Contact list info */}
                <div className="space-y-4">
                  <p className="uppercase">
                    Se tem dúvidas jurídicas, precisa de apoio para reportar uma burla, ou é uma agência municipal interessada em sincronizar documentos perdidos, contacte a nossa equipa de atendimento técnico:
                  </p>

                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-gray-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#009739]/10 text-[#009739] flex items-center justify-center">
                        <i className="fa-solid fa-phone"></i>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-black text-gray-400 block uppercase">Linha Telefónica / WhatsApp</span>
                        <span className="text-[11.5px] font-black text-slate-800 font-mono">+258 84 900 8500</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#009739]/10 text-[#009739] flex items-center justify-center">
                        <i className="fa-solid fa-envelope"></i>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-black text-gray-400 block uppercase">Correio Eletrónico Geral</span>
                        <span className="text-[11.5px] font-black text-slate-800 font-mono">suporte@comeback.co.mz</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#009739]/10 text-[#009739] flex items-center justify-center">
                        <i className="fa-solid fa-location-dot"></i>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-black text-gray-400 block uppercase">Sede Física</span>
                        <span className="text-[10.5px] font-black text-slate-800 uppercase">Av. Julius Nyerere, Edifício Souto, Maputo</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct contact message form */}
                <form onSubmit={handleContactSubmit} className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-gray-150 text-left">
                  <h4 className="text-[10.5px] font-black uppercase text-slate-800 tracking-tight pl-1">
                    Envie-nos uma mensagem directa
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider block">O seu Nome</label>
                    <input 
                      type="text" 
                      className="w-full bg-white border border-gray-250 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#009739]" 
                      placeholder="Ex: Clério Souto"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider block">O seu Email</label>
                    <input 
                      type="email" 
                      className="w-full bg-white border border-gray-250 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#009739]" 
                      placeholder="Ex: clerio@gmail.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider block">A sua Mensagem</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-white border border-gray-250 rounded-xl p-2.5 text-xs font-semibold outline-none focus:border-[#009739] resize-none" 
                      placeholder="Escreva aqui a sua mensagem..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-[#009739] hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] py-3 rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    Enviar Mensagem
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
