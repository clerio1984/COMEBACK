import { Item, MatchResult } from "../types";

export const analyzeItemMatch = async (lostItem: Item, foundItem: Item): Promise<MatchResult> => {
  try {
    const response = await fetch("/api/analyze-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lostItem, foundItem }),
    });

    if (!response.ok) {
      throw new Error("Falha ao comunicar com o servidor para análise.");
    }

    return await response.json();
  } catch (error) {
    console.warn("[CLIENT IA FALLBACK] Falha na análise biométrica de itens via API:", error);
    return { similarity: 0, reasoning: "Serviço de análise inteligente ocupado. Tente mais tarde.", isMatch: false };
  }
};

export interface SmartSuggestionMatch {
  itemId: string;
  confidenceScore: number;
  matchReason: string;
  matchedQuery?: string;
}

export interface DescriptionValidationResult {
  isSufficient: boolean;
  score: number;
  hasBrandOrModel: boolean;
  hasSerialOrIdentifier: boolean;
  hasUniqueDetails: boolean;
  summary: string;
  feedback: string;
  suggestions: string[];
}

export interface CategorySuggestionResult {
  suggestedCategory: string;
  confidence: number;
  reason: string;
}

export const validateDescriptionAI = async (
  title: string,
  description: string,
  category?: string,
  status?: string
): Promise<DescriptionValidationResult> => {
  try {
    const response = await fetch("/api/validate-description", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        category,
        status,
      }),
    });

    if (!response.ok) {
      throw new Error("Falha na validação inteligente de descrição.");
    }

    const data = await response.json();
    return {
      isSufficient: Boolean(data.isSufficient),
      score: typeof data.score === "number" ? data.score : 70,
      hasBrandOrModel: Boolean(data.hasBrandOrModel),
      hasSerialOrIdentifier: Boolean(data.hasSerialOrIdentifier),
      hasUniqueDetails: Boolean(data.hasUniqueDetails),
      summary: data.summary || (data.isSufficient ? "Descrição aprovada com detalhes úteis." : "Faltam detalhes identificadores."),
      feedback: data.feedback || "",
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    };
  } catch (error) {
    console.warn("[CLIENT IA FALLBACK] Falha na validação de descrição via API, aplicando validação heurística local:", error);
    return fallbackValidateDescription(title, description);
  }
};

function fallbackValidateDescription(title: string, description: string): DescriptionValidationResult {
  const text = `${title} ${description}`.toLowerCase();
  const brandTerms = ["samsung", "apple", "iphone", "xiaomi", "redmi", "huawei", "dell", "hp", "lenovo", "asus", "acer", "sony", "toyota", "nissan", "honda", "ford", "hyundai", "casio", "rolex", "nike", "adidas", "zara", "puma"];
  const idTerms = ["imei", "s/n", "sn", "série", "serie", "número", "numero", "bi", "placa", "matrícula", "matricula", "chassi", "código", "codigo", "nuit"];
  const uniqueTerms = ["risco", "arranhão", "rachad", "partid", "capa", "adesivo", "autocolante", "chaveiro", "foto", "mancha", "amassad", "gravad", "porta-chaves", "azul", "vermelho", "dourado", "prata", "verde"];

  const hasBrandOrModel = brandTerms.some(b => text.includes(b)) || /[A-Z0-9]{2,}\s*[A-Z0-9]+/.test(title);
  const hasSerialOrIdentifier = idTerms.some(id => text.includes(id)) || /\b[0-9]{6,}\b/.test(text);
  const hasUniqueDetails = uniqueTerms.some(u => text.includes(u)) || description.length > 70;

  let score = 25;
  if (hasBrandOrModel) score += 25;
  if (hasSerialOrIdentifier) score += 30;
  if (hasUniqueDetails) score += 20;
  if (description.length > 50) score += 10;

  const isSufficient = score >= 55;
  const suggestions: string[] = [];
  if (!hasBrandOrModel) suggestions.push("Indique a marca ou modelo do objeto (ex: Samsung, Toyota, HP, Nike).");
  if (!hasSerialOrIdentifier) suggestions.push("Adicione identificadores numéricos (IMEI, número de série, placa ou BI).");
  if (!hasUniqueDetails) suggestions.push("Descreva marcas particulares (riscos, cor da capa, autocolantes ou avarias).");

  return {
    isSufficient,
    score: Math.min(100, score),
    hasBrandOrModel,
    hasSerialOrIdentifier,
    hasUniqueDetails,
    summary: isSufficient 
      ? "Descrição aprovada com bons detalhes identificadores." 
      : "A descrição carece de dados únicos ou marcas para identificação segura.",
    feedback: isSufficient
      ? "Contém detalhes distintivos que facilitam o reconhecimento inequívoco do item."
      : "Para proteger contra falsas reivindicações e acelerar a recuperação, adicione detalhes específicos.",
    suggestions: suggestions.slice(0, 3),
  };
}

export const suggestCategoryAI = async (
  title: string,
  description: string
): Promise<CategorySuggestionResult> => {
  try {
    const response = await fetch("/api/suggest-category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
      }),
    });

    if (!response.ok) {
      throw new Error("Falha ao sugerir categoria.");
    }

    const data = await response.json();
    return {
      suggestedCategory: data.suggestedCategory || "Outros",
      confidence: typeof data.confidence === "number" ? data.confidence : 80,
      reason: data.reason || "Sugerido pela inteligência artificial com base no título e descrição.",
    };
  } catch (error) {
    console.warn("[CLIENT IA FALLBACK] Falha na sugestão de categoria via API, aplicando heurística local:", error);
    return fallbackSuggestCategory(title, description);
  }
};

function fallbackSuggestCategory(title: string, description: string): CategorySuggestionResult {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/b\.?i\b|bilhete|passaporte|carta de condução|conducao|certidão|certidao|nuit|diploma|eleitor|livrete/)) {
    return { suggestedCategory: "Documentos", confidence: 90, reason: "Identificado como documento pessoal ou oficial." };
  }
  if (text.match(/iphone|samsung|celular|telemóvel|telemovel|telefone|laptop|computador|tablet|fones|airpod|fone|carregador|smartwatch|computador/)) {
    return { suggestedCategory: "Eletrónicos", confidence: 92, reason: "Identificado como aparelho eletrónico ou smartphone." };
  }
  if (text.match(/cão|cao|cadela|cachorro|gato|gata|animal|papagaio|pitbull|pastor/)) {
    return { suggestedCategory: "Animais", confidence: 95, reason: "Identificado como animal de estimação." };
  }
  if (text.match(/chave|comando|porta-chave|chaveiro/)) {
    return { suggestedCategory: "Chaves", confidence: 90, reason: "Identificado como chaves ou telecomando." };
  }
  if (text.match(/carteira|porta-moedas|porta-cartao|porta-cartão/)) {
    return { suggestedCategory: "Carteiras", confidence: 90, reason: "Identificado como carteira ou porta-cartões." };
  }
  if (text.match(/mochila|mala|bolsa|pasta|sacola/)) {
    return { suggestedCategory: "Malas/Bolsas", confidence: 88, reason: "Identificado como mala, bolsa ou mochila." };
  }
  if (text.match(/relógio|relogio|anel|aliança|alianca|brinco|corrente|pulseira|ouro|prata/)) {
    return { suggestedCategory: "Jóias/Relógios", confidence: 85, reason: "Identificado como relógio ou acessório de joalharia." };
  }
  if (text.match(/casaco|calça|calca|camisa|vestido|ténis|tenis|sapato|óculos|oculos|boné|bone/)) {
    return { suggestedCategory: "Vestuário", confidence: 85, reason: "Identificado como peça de vestuário ou calçado." };
  }
  if (text.match(/pessoa|criança|crianca|menino|menina|idoso|desaparecid/)) {
    return { suggestedCategory: "Pessoas Desaparecidas", confidence: 95, reason: "Identificado como registo de pessoa desaparecida." };
  }
  return { suggestedCategory: "Outros", confidence: 70, reason: "Categoria genérica baseada nos termos inseridos." };
}

export const fetchSmartSuggestions = async (
  recentSearches: string[],
  candidateItems: Item[],
  userCoords?: { lat: number; lng: number },
  userProvince?: string
): Promise<SmartSuggestionMatch[]> => {
  try {
    const response = await fetch("/api/smart-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recentSearches,
        candidateItems,
        userCoords,
        userProvince
      }),
    });

    if (!response.ok) {
      throw new Error("Falha na rota /api/smart-suggestions");
    }

    const data = await response.json();
    if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      return data.suggestions;
    }
  } catch (error) {
    console.warn("[CLIENT IA FALLBACK] Falha ao obter sugestões via API, calculando localmente:", error);
  }

  // Fallback local robusto se a API falhar ou estiver offline
  return fallbackCalculateSuggestions(recentSearches, candidateItems, userCoords, userProvince);
};

function fallbackCalculateSuggestions(
  recentSearches: string[],
  items: Item[],
  userCoords?: { lat: number; lng: number },
  userProvince?: string
): SmartSuggestionMatch[] {
  if (!items || items.length === 0) return [];

  const validItems = items.filter(i => i.status !== 'REUNITED');
  const scores: { item: Item; score: number; reason: string; query?: string }[] = [];

  const searches = recentSearches.filter(s => s && s.trim().length > 1);

  validItems.forEach(item => {
    let score = 50; // base score
    let reason = "Item recente no radar";
    let matchedQuery = undefined;

    const titleLower = (item.title || "").toLowerCase();
    const descLower = (item.description || "").toLowerCase();
    const catLower = (item.category || "").toLowerCase();
    const provLower = (item.province || "").toLowerCase();
    const locLower = (item.location || "").toLowerCase();

    // 1. Verificar correspondência com pesquisas recentes
    for (const search of searches) {
      const sLower = search.toLowerCase();
      const words = sLower.split(/\s+/).filter(w => w.length > 2);

      let matchCount = 0;
      if (titleLower.includes(sLower) || descLower.includes(sLower)) {
        matchCount += 3;
      }
      words.forEach(w => {
        if (titleLower.includes(w)) matchCount += 2;
        if (descLower.includes(w)) matchCount += 1;
        if (catLower.includes(w)) matchCount += 1.5;
      });

      if (matchCount > 0) {
        score += matchCount * 12;
        reason = `Corresponde à sua pesquisa por "${search}"`;
        matchedQuery = search;
        break;
      }
    }

    // 2. Proximidade Geográfica
    if (userProvince && provLower.includes(userProvince.toLowerCase())) {
      score += 15;
      if (!matchedQuery) {
        reason = `Localizado na sua província (${item.province})`;
      }
    }

    if (userCoords && item.latitude && item.longitude) {
      // cálculo simplificado de distância
      const dLat = item.latitude - userCoords.lat;
      const dLng = item.longitude - userCoords.lng;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111; // aprox em km
      if (dist <= 5) {
        score += 20;
        reason = matchedQuery 
          ? `Combina com "${matchedQuery}" a ~${dist.toFixed(1)} km de si`
          : `Item a ~${dist.toFixed(1)} km da sua localização atual`;
      } else if (dist <= 15) {
        score += 10;
      }
    }

    // 3. Recompensa ou recência
    if (item.reward && item.reward > 0) {
      score += 8;
    }

    scores.push({
      item,
      score: Math.min(99, Math.max(78, Math.round(score))),
      reason,
      query: matchedQuery
    });
  });

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3).map(s => ({
    itemId: s.item.id,
    confidenceScore: s.score,
    matchReason: s.reason,
    matchedQuery: s.query
  }));
}

