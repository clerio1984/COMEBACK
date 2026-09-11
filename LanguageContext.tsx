import React from 'react';

export type Language = 'pt' | 'en';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = React.createContext<LanguageContextType | undefined>(undefined);

// Portuguese (PT) is the default/fallback original text in the codebase.
// This simple key-value object lookup maps Portuguese strings to their English translations.
const dictionary: Record<string, string> = {
  // Navigation Tabs & General
  "Explorar": "Explore",
  "Sobre": "About",
  "Publicar": "Post",
  "Perfil": "Profile",
  "Entrar": "Sign In",
  "Sair": "Sign Out",
  "Voltar": "Back",
  "Confirmar": "Confirm",
  "Cancelar": "Cancel",
  "Guardar": "Save",
  "Carregando...": "Loading...",
  "A Sincronizar Dados...": "Syncing Data...",

  // Headers & Banners
  "Recuperação de Perdidos e Achados": "Lost and Found Recovery",
  "Sem Conexão à Internet: Modo Offline Ativo": "No Internet Connection: Offline Mode Active",
  "Modo Offline Ativo": "Offline Mode Active",
  "A Sincronizar com a Base de Dados": "Syncing with Database",
  "O feed de dados e o histórico das últimas buscas no radar continuam totalmente acessíveis através do seu cache local.": "The data feed and history of the last radar searches remain fully accessible via your local cache.",
  "Ligação à Rede Restabelecida. Atualizando Dados...": "Network Connection Restored. Updating Data...",
  "DESENVOLVIDO POR": "DEVELOPED BY",

  // Feed / Searches
  "Pesquisar por artigo...": "Search items...",
  "Todos": "All",
  "Perdidos": "Lost",
  "Achados": "Found",
  "Roubados": "Stolen",
  "Filtros Ativos": "Active Filters",
  "Limpar": "Clear",
  "Categorias": "Categories",
  "Províncias": "Provinces",
  "Nenhum item encontrado correspondente aos filtros.": "No items matching the filters were found.",

  // Safety & AI Tools
  "Dica de Segurança da IA": "AI Safety Advice",
  "Buscando conselho de segurança personalizado...": "Fetching personalized safety advice...",
  "Sugerir Melhorias": "Suggest Improvements",
  "Melhorar com IA": "Improve with AI",
  "A otimizar descrição...": "Optimizing description...",
  "Descrição Otimizada do Artigo": "Optimized Item Description",

  // Item Details
  "Detalhes do Artigo": "Item Details",
  "Voltar ao Feed": "Back to Feed",
  "Descrição": "Description",
  "Recompensa Oferecida": "Reward Offered",
  "Estado do Artigo": "Item Status",
  "Data do Ocorrido": "Incident Date",
  "Província do Ocorrido": "Incident Province",
  "Local / Bairro": "Location / Neighborhood",
  "Contactar Proprietário": "Contact Owner",
  "Contactar Localizador": "Contact Finder",
  "Denunciar Anúncio": "Report Ad",
  "Artigo Recuperado!": "Item Recovered!",
  "Ver no Mapa": "View on Map",

  // Reviews & Evaluation
  "Minhas Avaliações": "My Reviews",
  "Avaliações do Membro": "Member Reviews",
  "Avaliação Recebida": "Review Received",
  "Avaliações Recebidas": "Reviews Received",
  "Feedback de transações com reunificação": "Feedback from completed rescues",
  "Não recebeu avaliações ainda.": "No reviews received yet.",
  "Nenhuma avaliação registada até ao momento.": "No reviews registered so far.",
  "Classificação Geral do Utilizador": "User's General Rating",
  "avaliação": "review",
  "avaliações": "reviews",
  "Comentários (Opcional)": "Comments (Optional)",

  // Post / Publish Form
  "Publicar Pertence": "Publish Item",
  "Título do Artigo": "Item Title",
  "Ex: Chaves com Porta-Chaves Azul": "Ex: Keys with Blue Keychain",
  "Categoria": "Category",
  "Selecione uma categoria": "Select a category",
  "Estado": "Status",
  "Selecione o estado": "Select status",
  "Cidade ou Local do Ocorrido": "City or Location of Incident",
  "Ex: Av. Eduardo Mondlane, Próximo ao Banco": "Ex: Av. Eduardo Mondlane, near the bank",
  "Selecione a Província": "Select Province",
  "Mensagem da IA de Segurança": "AI Safety Alert",
  "O valor mínimo recomendado para incentivar a devolução de forma justa e segura é de": "The recommended minimum value to fairly and safely encourage return is",
  "Abaixo desse valor, o radar de proximidade terá alcance moderado.": "Below this amount, the proximity radar will have moderate range.",
  "Publicar Agora": "Publish Now",

  // Wallet / Monetization
  "Carteira ComeBack": "ComeBack Wallet",
  "Saldo Disponível": "Available Balance",
  "Solicitar Levantamento": "Request Withdrawal",

  // Chat/Delivery Safety
  "Conversa Segura": "Secure Chat",
  "Combine a entrega aqui. Lembre-se: locais públicos são mais seguros.": "Coordinate delivery here. Remember: public places are safer.",
  "Iniciar Entrega (Live)": "Start Delivery (Live)",
  "Concluir Resgate": "Complete Rescue",
  "Escreva sua mensagem...": "Write your message...",
  "Localização Partilhada": "Shared Location",
  "Ver Mapa": "View Map",
  "Parar": "Stop",
  "Concluir": "Complete",
  "Imagem": "Image",
  "Localização": "Location",
  "Pessoas Desaparecidas": "Missing Persons",
  "Nome Completo": "Full Name",
  "Idade": "Age",
  "Altura": "Height",
  "Postura Física": "Physical Build",
  "Corte de Cabelo": "Haircut",
  "Cor das Calças": "Trousers Color",
  "Cor da Camisa/Camiseta": "Shirt/T-shirt Color",
  "Arraste ou clique para selecionar as características e montar o retrato falado:": "Drag or click to select features and build the composite sketch:",
  "Montar Aparência Visual (Retrato Falado)": "Build Visual Appearance (Composite Portrait)",
  "Cor da Pele": "Skin Color",
  "Cabelo": "Hair",
  "Corpo / Postura": "Body / Silhouette",
  "Acessórios": "Accessories",
  "Carregas": "Carry",
  "Limpar Retrato": "Clear Portrait",
  "Retrato Falado Gerado": "Generated Composite Sketch",
  "Ex: João da Silva": "Ex: Joao da Silva",
  "Ex: 28 anos": "Ex: 28 years old",
  "Ex: 1.75m": "Ex: 1.75m",
  "Ex: Magro, Atlético": "Ex: Thin, Athletic",
  "Ex: Curto Crespo": "Ex: Short Curly",
  "Ex: Jeans Azul": "Ex: Blue Jeans",
  "Ex: T-Shirt Branca": "Ex: White T-Shirt",
  "Características da Pessoa Desaparecida": "Missing Person Characteristics",
  "Preencha as informações físicas da pessoa para facilitar buscas e identificação.": "Fill out the physical characteristics of the person to facilitate search and identification.",
  "anos": "years old",

  // Static Fallback Safety Tips translations
  "⚠️ **Conselho de Segurança:** NUNCA pague nenhuma recompensa adiantada (via M-Pesa, e-Mola ou m-Kesh) sem antes ver e inspecionar o seu artigo pessoalmente. Agende sempre encontros num local público e movimentado.":
    "⚠️ **Safety Advice:** NEVER pay any reward in advance (via M-Pesa, e-Mola, or m-Kesh) without seeing and inspecting your item first in person. Always schedule meetings in a busy, public place.",
  "⚠️ **Conselho de Segurança:** Não entregue o artigo a qualquer pessoa sem que esta prove de forma inequívoca que é o verdadeiro dono (como desbloquear o telemóvel na sua presença, descrever o conteúdo ou mostrar recibo).":
    "⚠️ **Safety Advice:** Do not hand over the item to anyone without unequivocal proof of ownership (such as unlocking the phone in your presence, describing the content, or showing a receipt).",
  "⚠️ **Alerta:** Cuidado com farsa com clonagem de identidade ou extorsão. Nunca forneça dados confidenciais pelo telefone.":
    "⚠️ **Alert:** Beware of identity theft or extortion scams. Never share confidential information over the phone.",
  "⚠️ **Conselho Prático:** Ao partilhar imagens ou dados do documento encontrado, oculte sempre pormenores sensíveis. Tente combinar a entrega numa esquadra de polícia para total segurança.":
    "⚠️ **Practical Advice:** When sharing images or data of a found document, always hide sensitive details. Try to arrange delivery at a police station for total safety.",
  "⚠️ **Aviso de Segurança:** Cuidado com burladores que afirmam ter o seu animal de estimação apenas para extorquir pagamentos com desculpas urgentes como tratamento clínico ou transporte. Encontre-se em público.":
    "⚠️ **Safety Warning:** Beware of scammers who claim they found your pet only to extort payments with urgent excuses like emergency medical treatment or transport. Meet in public.",
  "⚠️ **Cuidados Gerais:** Combine sempre a devolução ou verificação física do artigo em locais de grande movimento (como centros de retalho ou bombas de combustível) durante o dia e nunca vá sozinho(a).":
    "⚠️ **General Care:** Always coordinate delivery or physical verification of the item in highly frequented public places (such as retail centers or gas stations) during the day, and never go alone."
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = React.useState<Language>(() => {
    try {
      const saved = localStorage.getItem('comeback_language') as Language;
      if (saved === 'pt' || saved === 'en') return saved;
    } catch {}
    return 'pt';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('comeback_language', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  // The translation function works by mapping Portuguese key strings to English if language is set to 'en'
  const t = (key: string): string => {
    if (language === 'pt' || !key) return key;
    
    // Check if exact match is in the dictionary
    if (dictionary[key]) {
      return dictionary[key];
    }

    // Dynamic partial / fallback search matching for AI generated-like structures
    // For example, if a safety tip starts with "⚠️ **Conselho de Segurança:**" we can map it or parts of it
    for (const [ptKey, enVal] of Object.entries(dictionary)) {
      if (key.trim() === ptKey.trim()) {
        return enVal;
      }
    }

    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
