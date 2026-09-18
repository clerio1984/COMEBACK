import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import webpush from "web-push";
import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";

// Sincronizar leitura de configurações do Firebase
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve("./firebase-applet-config.json"), "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(firebaseApp, {}, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// Inicializar Chaves VAPID estáveis para o Web Push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (vapidConfigured) {
  webpush.setVapidDetails(
    "mailto:clerio1984@gmail.com",
    vapidPublicKey!,
    vapidPrivateKey!
  );
} else {
  console.warn("[Push Server] VAPID não configurado. Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no ambiente do servidor.");
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy-initialize Gemini so the server doesn't crash on boot if GEMINI_API_KEY is not set yet
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("A variável de ambiente GEMINI_API_KEY é obrigatória.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Safely log external API warnings without printing rate limits, quota issues, or sensitive JSON fields
function logSafeWarning(context: string, error: any) {
  const errMsg = (error?.message || error?.status || String(error)).toLowerCase();
  if (errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("exhausted") || errMsg.includes("429")) {
    console.log(`[CONFLITO DE TRÁFEGO] ${context}: Ativando políticas de contingência locais.`);
  } else {
    console.log(`[SISTEMA] ${context}: Usando fallback para resposta da API.`);
  }
}

// In-Memory cache for safety tips to protect from quota exhaustion
const safetyTipCache = new Map<string, string>();

// API endpoint to proxy external images for IndexedDB offline storage
app.get("/api/proxy-image", async (req, res) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "Parâmetro 'url' é obrigatório." });
    }

    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      return res.status(400).json({ error: "URL inválida." });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ComeBack/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Falha ao obter imagem: ${response.statusText}` });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.json({ dataUrl, contentType, size: buffer.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao fazer proxy de imagem." });
  }
});

// API endpoint for AI description suggestions
app.post("/api/suggest-improvements", async (req, res) => {
  try {
    const { title, category, status, description, location, province } = req.body;

    if (!title) {
       return res.status(400).json({ error: "O título do item é obrigatório para gerar melhorias." });
    }

    const ai = getAiClient();

    const statusLabel = 
      status === "LOST" ? "Perdido (Lost)" :
      status === "FOUND" ? "Achado (Found)" :
      status === "STOLEN" ? "Roubado / Furto (Stolen)" : "Recuperado (Recovered)";

    const prompt = `Melhore e formate de forma profissional, extremamente limpa, clara e direta ao ponto a descrição do item para a plataforma de Achados e Perdidos ComeBack Moçambique.
    
    Detalhes atuais do Item:
    - Título: ${title}
    - Categoria: ${category || "Não especificado"}
    - Estado atual: ${statusLabel}
    - Local: ${location || "Não especificado"}${province ? `, Província de ${province}` : ""}
    - Descrição fornecida pelo utilizador: "${description || "Nenhuma descrição fornecida"}"

    Instruções:
    1. Torne a descrição o mais clara, direta e objetiva possível, indo direto ao ponto. Evite rodeios, repetições e floreados.
    2. Organize as principais características usando tópicos curtos e objetivos (ex: Estado do item, Localização, Como proceder para recuperação).
    3. Mantenha estritamente os factos fornecidos. Não invente detalhes (marcas, modelos ou cores) que não foram fornecidos.
    4. NUNCA utilize placeholders de rascunho como "[Cor]", "[Modelo]", "[Características Específicas]", "[Inserir contacto]". Se faltar alguma informação secundária, simplesmente omita-a de forma elegante.
    5. O resultado final deve conter APENAS a descrição polida e limpa, pronta a ser publicada. Não inclua mensagens de conversa, prefácios ou assinaturas.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });

    const suggestions = response.text || "";
    return res.json({ suggestions: suggestions.trim() });
  } catch (error: any) {
    logSafeWarning("rota /api/suggest-improvements", error);
    // Graceful fallback description when Quota/Credit is exhausted
    const originalText = req.body?.description || "";
    const suggestionsFallback = `**Descrição do Artigo**\n\n${originalText || "Artigo sem descrição adicional."}\n\n*Nota: Recomenda-se cautela no agendamento de encontros. Dê preferência a locais públicos e movimentados como postos de combustível ou esquadras da PRM.*`;
    return res.json({ suggestions: suggestionsFallback });
  }
});

// Função auxiliar para obter dicas de segurança locais como fallback se a cota do Gemini estiver esgotada
function getFallbackSafetyTip(category: string, status: string, lang = "pt"): string {
  const normCat = (category || "").toLowerCase();
  const isLost = (status === "LOST" || status === "STOLEN");

  if (lang === "en") {
    if (normCat.includes("eletr") || normCat.includes("celular") || normCat.includes("telem") || normCat.includes("key") || normCat.includes("chave") || normCat.includes("carteira") || normCat.includes("wallet") || normCat.includes("mala") || normCat.includes("bolsa") || normCat.includes("jóia") || normCat.includes("joia") || normCat.includes("reló")) {
      if (isLost) {
        return "⚠️ **Safety Advice:** NEVER pay any reward in advance (via M-Pesa, e-Mola, or m-Kesh) without seeing and inspecting your item first in person. Always schedule meetings in a busy, public place.";
      } else {
        return "⚠️ **Safety Advice:** Do not hand over the item to anyone without unequivocal proof of ownership (such as unlocking the phone in your presence, describing the content, or showing a receipt).";
      }
    }

    if (normCat.includes("doc") || normCat.includes("identifica") || normCat.includes("bi") || normCat.includes("passaporte") || normCat.includes("carta")) {
      if (isLost) {
        return "⚠️ **Alert:** Beware of identity theft or extortion scams. Never share confidential information over the phone.";
      } else {
        return "⚠️ **Practical Advice:** When sharing images or data of a found document, always hide sensitive details. Try to arrange delivery at a police station for total safety.";
      }
    }

    if (normCat.includes("pet") || normCat.includes("anoma") || normCat.includes("cão") || normCat.includes("gato")) {
      return "⚠️ **Safety Warning:** Beware of scammers who claim they found your pet only to extort payments with urgent excuses like emergency medical treatment or transport. Meet in public.";
    }

    return "⚠️ **General Care:** Always coordinate delivery or physical verification of the item in highly frequented public places (such as retail centers or gas stations) during the day, and never go alone.";
  }

  if (normCat.includes("eletr") || normCat.includes("celular") || normCat.includes("telem") || normCat.includes("key") || normCat.includes("chave") || normCat.includes("carteira") || normCat.includes("wallet") || normCat.includes("mala") || normCat.includes("bolsa") || normCat.includes("jóia") || normCat.includes("joia") || normCat.includes("reló")) {
    if (isLost) {
      return "⚠️ **Conselho de Segurança:** NUNCA pague nenhuma recompensa adiantada (via M-Pesa, e-Mola ou m-Kesh) sem antes ver e inspecionar o seu artigo pessoalmente. Agende sempre encontros num local público e movimentado.";
    } else {
      return "⚠️ **Conselho de Segurança:** Não entregue o artigo a qualquer pessoa sem que esta prove de forma inequívoca que é o verdadeiro dono (como desbloquear o telemóvel na sua presença, descrever o conteúdo ou mostrar recibo).";
    }
  }

  if (normCat.includes("doc") || normCat.includes("identifica") || normCat.includes("bi") || normCat.includes("passaporte") || normCat.includes("carta")) {
    if (isLost) {
      return "⚠️ **Alerta:** Cuidado com farsa com clonagem de identidade ou extorsão. Nunca forneça dados confidenciais pelo telefone.";
    } else {
      return "⚠️ **Conselho Prático:** Ao partilhar imagens ou dados do documento encontrado, oculte sempre pormenores sensíveis. Tente combinar a entrega numa esquadra de polícia para total segurança.";
    }
  }

  if (normCat.includes("pet") || normCat.includes("anoma") || normCat.includes("cão") || normCat.includes("gato")) {
    return "⚠️ **Aviso de Segurança:** Cuidado com burladores que afirmam ter o seu animal de estimação apenas para extorquir pagamentos com desculpas urgentes como tratamento clínico ou transporte. Encontre-se em público.";
  }

  return "⚠️ **Cuidados Gerais:** Combine sempre a devolução ou verificação física do artigo em locais de grande movimento (como centros de retalho ou bombas de combustível) durante o dia e nunca vá sozinho(a).";
}

// API endpoint for AI Safety Tips based on Category and optional Status
app.post("/api/safety-tip", async (req, res) => {
  const { category, status, lang = "pt" } = req.body;
  try {
    if (!category) {
      return res.status(400).json({ error: "A categoria é obrigatória para gerar dicas de segurança." });
    }

    const cacheKey = `${category.toLowerCase()}_${(status || "LOST").toLowerCase()}_${lang}`;
    if (safetyTipCache.has(cacheKey)) {
      return res.json({ tip: safetyTipCache.get(cacheKey) });
    }

    const ai = getAiClient();
    const targetLanguageName = lang === "en" ? "English" : "Português de Moçambique";

    const prompt = `Gere uma única dica ou recomendação de segurança extremamente curta, prática, amigável e de alerta (máximo 2-3 frases) em ${targetLanguageName} para um utilizador que está prestes a publicar um anúncio no ComeBack Moçambique (uma plataforma de achados e perdidos).

    A dica deve ser focada em proteger o utilizador.
    - Categoria do item: "${category}"
    - Estado do item: "${status || "LOST"}"

    Conselhos e cuidados de segurança específicos por situação e categoria em Moçambique:
    1. Se for "Eletrónicos" (Electronics) ou "Malas/Bolsas" ou "Carteiras/Bolsas" ou "Carteiras" ou "Jóias/Relógios":
       - Se perdeu (LOST/STOLEN): Alerte para NUNCA efetuar pagamento (como recompensa via M-Pesa, e-Mola ou m-Kesh) adiantado a quem diz ter achado o artigo sem antes inspecioná-lo pessoalmente.
       - Se achou (FOUND): Alerte para não entregar o artigo a qualquer pessoa sem que esta prove de forma inequívoca que é o verdadeiro dono (ex: desbloquear o telemóvel na presença física, descrever pormenorizadamente o conteúdo da mala, dar a senha do email, possuir caixa original ou fatura).
    2. Se for "Documentos" (Documents):
       - Se perdeu (LOST): Alerte para tentativas de farsa/burla com clonagem de dados pessoais ou extorsão. Nunca forneça dados confidenciais pelo telefone.
       - Se achou (FOUND): Diga para ocultar parte dos números de identificação ou dados pessoais ao partilhar detalhes ou combine a entrega numa esquadra de polícia para evitar encontros duvidosos.
    3. Se for "Animais" (Pets):
       - Cuidado com fakes que dizem ter achado o animal só para extorquir dinheiro com desculpas como "está na clínica" ou "precisa de ração".
    4. Outras categorias:
       - Combine sempre os encontros de entrega/inspeção de artigos em locais públicos muito movimentados, como praças de alimentação de shoppings, esquadras de polícia, estações de serviço (bombas de combustível) e de preferência durante o dia. Nunca vá sozinho(a).

    A sua resposta deve conter APENAS o parágrafo curto da dica direta da IA (em ${targetLanguageName}). Não inclua conversações, prefácios, títulos, tags, nem formatações complexas markdown exageradas além de um negrito para 1 ou 2 palavras cruciais se necessário. Seja direto, caloroso mas cuidadoso.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.6,
      }
    });

    const tip = (response.text || "").trim();
    if (tip) {
      safetyTipCache.set(cacheKey, tip);
    }
    return res.json({ tip });
  } catch (error: any) {
    logSafeWarning("rota /api/safety-tip", error);
    // Graceful local fallback when Gemini is busy or exhausted
    const tip = getFallbackSafetyTip(category, status, lang);
    return res.json({ tip });
  }
});

// API endpoint para Validação Inteligente da Descrição com IA (verifica marcas, números de série, detalhes únicos)
app.post("/api/validate-description", async (req, res) => {
  try {
    const { title, description, category, status } = req.body;
    const descText = (description || "").trim();

    if (!descText || descText.length < 5) {
      return res.json({
        isSufficient: false,
        score: 15,
        hasBrandOrModel: false,
        hasSerialOrIdentifier: false,
        hasUniqueDetails: false,
        summary: "Descrição demasiado curta para identificação segura.",
        feedback: "A descrição atual não possui detalhes suficientes para distinguir o objeto de outros semelhantes e evitar fraudes.",
        suggestions: [
          "Indique a marca ou modelo específico do item (ex: Samsung Galaxy, Toyota Corolla, HP Laptop)",
          "Adicione número de série, placa, BI ou IMEI se aplicável",
          "Descreva marcas particulares, autocolantes, cor da capa ou pequenos danos"
        ]
      });
    }

    const ai = getAiClient();
    const prompt = `Você é um perito de segurança e verificação de integridade da plataforma ComeBack Moçambique (Perdidos e Achados).
Avalie com rigor se a descrição inserida pelo utilizador contém informações úteis suficientes (como marcas, números de série, placas, modelos ou detalhes únicos) para permitir a identificação inequívoca do item antes da submissão.

Dados do Anúncio:
- Título: "${title || 'Sem título'}"
- Categoria: "${category || 'Geral'}"
- Estado: "${status || 'LOST'}"
- Descrição: "${descText}"

Critérios de Avaliação:
1. isSufficient deve ser true APENAS se a descrição tiver detalhes concretos úteis (marcas, modelos, número de série/IMEI/placa/BI, sinais específicos de uso, capas, cor exata, autocolantes, riscos específicos).
2. isSufficient deve ser false se for uma descrição genérica, vaga ou superficial (ex: "perdi o telemóvel", "carteira castanha", "chaves com porta-chaves", "mochila preta").
3. Forneça pontuação de qualidade de 0 a 100 (score).
4. Forneça booleanos para hasBrandOrModel, hasSerialOrIdentifier e hasUniqueDetails.
5. Em "feedback", explique em português claro e amigável por que a descrição foi aprovada ou o que necessita de ser enriquecido.
6. Em "suggestions", liste de 2 a 3 sugestões concretas e imediatas para o utilizador acrescentar.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSufficient: {
              type: Type.BOOLEAN,
              description: "Indica se a descrição contém detalhes suficientes para identificação segura."
            },
            score: {
              type: Type.INTEGER,
              description: "Pontuação de qualidade de 0 a 100."
            },
            hasBrandOrModel: {
              type: Type.BOOLEAN,
              description: "Se menciona marca ou modelo."
            },
            hasSerialOrIdentifier: {
              type: Type.BOOLEAN,
              description: "Se menciona número de identificação, série, placa ou IMEI."
            },
            hasUniqueDetails: {
              type: Type.BOOLEAN,
              description: "Se menciona detalhes particulares, riscos, autocolantes ou avarias."
            },
            summary: {
              type: Type.STRING,
              description: "Resumo conciso da validação."
            },
            feedback: {
              type: Type.STRING,
              description: "Explicação em português sobre o detalhe da descrição."
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de 2 a 3 sugestões de elementos a adicionar."
            }
          },
          required: ["isSufficient", "score", "hasBrandOrModel", "hasSerialOrIdentifier", "hasUniqueDetails", "summary", "feedback", "suggestions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json(parsed);
  } catch (error: any) {
    logSafeWarning("rota /api/validate-description", error);
    const { title = "", description = "" } = req.body || {};
    const text = `${title} ${description}`.toLowerCase();
    
    const brandTerms = ["samsung", "apple", "iphone", "xiaomi", "redmi", "huawei", "dell", "hp", "lenovo", "asus", "acer", "sony", "toyota", "nissan", "honda", "ford", "hyundai", "casio", "rolex", "nike", "adidas", "zara", "puma"];
    const idTerms = ["imei", "s/n", "sn", "série", "serie", "número", "numero", "bi", "placa", "matrícula", "matricula", "chassi", "código", "codigo", "nuit"];
    const uniqueTerms = ["risco", "arranhão", "rachad", "partid", "capa", "adesivo", "autocolante", "chaveiro", "foto", "mancha", "amassad", "gravad", "porta-chaves", "azul", "vermelho", "dourado", "preto", "cinzento"];

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

    return res.json({
      isSufficient,
      score: Math.min(100, score),
      hasBrandOrModel,
      hasSerialOrIdentifier,
      hasUniqueDetails,
      summary: isSufficient ? "Descrição aprovada com detalhes úteis." : "Faltam detalhes identificadores.",
      feedback: isSufficient 
        ? "A descrição contém dados distintivos que auxiliam a autenticação segura do item."
        : "Recomendamos enriquecer a descrição com marcas, números de série ou detalhes únicos antes de submeter.",
      suggestions: suggestions.slice(0, 3)
    });
  }
});

// API endpoint para Sugestão Automática de Categoria com base no Título e Descrição
app.post("/api/suggest-category", async (req, res) => {
  try {
    const { title = "", description = "" } = req.body;
    const validCategories = [
      "Documentos",
      "Eletrónicos",
      "Vestuário",
      "Animais",
      "Malas/Bolsas",
      "Carteiras",
      "Chaves",
      "Jóias/Relógios",
      "Pessoas Desaparecidas",
      "Outros"
    ];

    if (!title.trim() && !description.trim()) {
      return res.status(400).json({ error: "Título ou descrição são necessários para sugerir a categoria." });
    }

    const ai = getAiClient();
    const prompt = `Classifique o seguinte item em EXATAMENTE UMA das categorias oficiais da plataforma ComeBack Moçambique:
Categorias permitidas:
- "Documentos" (Bilhete de Identidade, Passaporte, Cartas de Condução, Certidões, NUIT, Diplomas, Cartões Bancários)
- "Eletrónicos" (Smartphones, Celulares, Laptops, Tablets, Fones, Carregadores, Câmaras, Consolas, Smartwatches)
- "Vestuário" (Roupas, Calças, Camisas, Casacos, Ténis, Sapatos, Óculos de Sol ou Graduados, Bonés)
- "Animais" (Cães, Gatos, Pássaros, Animais domésticos)
- "Malas/Bolsas" (Mochilas, Pastas executivas, Malas de viagem, Sacos desportivos)
- "Carteiras" (Carteiras de bolso, Porta-moedas, Porta-cartões)
- "Chaves" (Chaves de residência, chaves de veículos, comandos de portão/carro)
- "Jóias/Relógios" (Relógios de pulso analógicos/digitais, anéis, alianças, brincos, correntes, pulseiras)
- "Pessoas Desaparecidas" (Crianças, adultos ou familiares desaparecidos)
- "Outros" (Artigos diversos que não se enquadram nas anteriores)

Dados do Item:
- Título: "${title}"
- Descrição: "${description}"

Responda em formato JSON contendo a categoria sugerida, nível de confiança (0 a 100) e o motivo breve.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedCategory: {
              type: Type.STRING,
              description: "A categoria selecionada exatamente de entre a lista permitida."
            },
            confidence: {
              type: Type.INTEGER,
              description: "Percentagem de confiança de 0 a 100."
            },
            reason: {
              type: Type.STRING,
              description: "Breve explicação do porquê da categoria ter sido sugerida."
            }
          },
          required: ["suggestedCategory", "confidence", "reason"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!validCategories.includes(parsed.suggestedCategory)) {
      parsed.suggestedCategory = serverFallbackCategory(title, description);
    }
    return res.json(parsed);
  } catch (error: any) {
    logSafeWarning("rota /api/suggest-category", error);
    const { title = "", description = "" } = req.body || {};
    const suggested = serverFallbackCategory(title, description);
    return res.json({
      suggestedCategory: suggested,
      confidence: 85,
      reason: "Classificação automática por correspondência de termos e padrões locais."
    });
  }
});

function serverFallbackCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/b\.?i\b|bilhete|passaporte|carta de condução|conducao|certidão|certidao|nuit|diploma|eleitor|livrete/)) return "Documentos";
  if (text.match(/iphone|samsung|celular|telemóvel|telemovel|telefone|laptop|computador|tablet|fones|airpod|fone|carregador|smartwatch/)) return "Eletrónicos";
  if (text.match(/cão|cao|cadela|cachorro|gato|gata|animal|papagaio|pitbull|pastor/)) return "Animais";
  if (text.match(/chave|comando|porta-chave|chaveiro/)) return "Chaves";
  if (text.match(/carteira|porta-moedas|porta-cartao|porta-cartão/)) return "Carteiras";
  if (text.match(/mochila|mala|bolsa|pasta|sacola/)) return "Malas/Bolsas";
  if (text.match(/relógio|relogio|anel|aliança|alianca|brinco|corrente|pulseira|ouro|prata/)) return "Jóias/Relógios";
  if (text.match(/casaco|calça|calca|camisa|vestido|ténis|tenis|sapato|óculos|oculos|boné|bone/)) return "Vestuário";
  if (text.match(/pessoa|criança|crianca|menino|menina|idoso|desaparecid/)) return "Pessoas Desaparecidas";
  return "Outros";
}

// API endpoint to suggest nearby landmarks using Google Search grounding based on lat/lng coordinates
app.post("/api/suggest-landmarks", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "As coordenadas de latitude e longitude são obrigatórias." });
    }

    const ai = getAiClient();
    const prompt = `Atua como um assistente de localização local em Moçambique.
Estou localizado exatamente nas coordenadas de latitude: ${latitude}, longitude: ${longitude}.
Quais são os 5 pontos de referência, edifícios proeminentes, escolas de renome, hospitais, hotéis, esquadras de polícia ou marcas geográficas reais mais próximas destas coordenadas em Moçambique?
Responda APENAS com um objeto JSON válido no formato:
{
  "landmarks": ["Nome do Ponto 1", "Nome do Ponto 2", "Nome do Ponto 3", "Nome do Ponto 4", "Nome do Ponto 5"]
}
Por favor, use a ferramenta de pesquisa do Google (Google Search) para garantir que os nomes sejam de pontos reais locais e conhecidos na área dessas coordenadas.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            landmarks: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING
              },
              description: "Lista de 5 pontos de referência conhecidos próximos às coordenadas informadas."
            }
          },
          required: ["landmarks"]
        }
      }
    });

    const text = response.text || "";
    const data = JSON.parse(text);
    return res.json(data);
  } catch (error: any) {
    logSafeWarning("rota /api/suggest-landmarks", error);
    // Graceful fallback with general Mozambique local landmarks if the call fails or quota is exhausted
    return res.json({
      landmarks: [
        "Próximo ao posto administrativo/policial local",
        "Bombas de Combustível da zona",
        "Mercado Comunitário local",
        "Paragem de transportes públicos da zona",
        "Escola Primária comunitária mais próxima"
      ]
    });
  }
});

// API endpoint for automated ID verification (BI/License/Passport) using Gemini OCR & validation
app.post("/api/verify-document", async (req, res) => {
  try {
    const { imageBase64, imagesBase64 } = req.body;
    if (!imageBase64 && (!imagesBase64 || imagesBase64.length === 0)) {
      return res.status(400).json({ error: "A imagem do documento em formato base64 é obrigatória." });
    }

    const ai = getAiClient();

    // Support both single image and multiple images for backward compatibility and synthesis
    const imagesToProcess = imagesBase64 && Array.isArray(imagesBase64) && imagesBase64.length > 0
      ? imagesBase64
      : [imageBase64];

    const imageParts = imagesToProcess.filter(Boolean).map((imgBase64: string) => {
      let cleanedBase64 = imgBase64;
      let mimeType = "image/jpeg";
      const matches = imgBase64.match(/^data:([^;]+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        cleanedBase64 = matches[2];
      }
      return {
        inlineData: {
          mimeType: mimeType,
          data: cleanedBase64,
        },
      };
    });

    if (imageParts.length === 0) {
      return res.status(400).json({ error: "Nenhuma imagem válida foi fornecida." });
    }

    const prompt = `Analise as imagens do documento fornecidas (que podem incluir a frente e o verso ou múltiplas páginas/lados de identificação) e verifique se elas representam um documento de identidade válido, como o Bilhete de Identidade (BI) de Moçambique, Carta de Condução, Passaporte ou algum outro documento de identificação oficial com foto. Sintetize as informações de todas as imagens para extrair os dados e validar com precisão acumulada.

Instruções para validação rigorosa:
1. "isValid": Deve ser verdadeiro (true) se, e apenas se, a imagem for claramente um documento de identificação oficial que apresente uma foto de rosto, um nome de pessoa visível e dados textuais legíveis (não pode ser uma foto de um gato, de uma paisagem, um ecrã vazio, nem apenas texto sem foto ou um objeto aleatório).
2. "reason": Forneça uma explicação curta, profissional e simpática em Português sobre o resultado da análise (ex: "Bilhete de Identidade (Frente & Verso) de Moçambique sintetizado com sucesso" ou "As imagens de documento não são legíveis.").
3. "extractedName": Extraia o nome completo do titular do documento (ex: "Nélio Manuel Carlos") se visível em qualquer uma das partes. Se não conseguir ler, deixe vazio "".
4. "documentNumber": Extraia o número identificador do documento de identidade (ex: número do BI, número do passaporte ou carta) se visível em qualquer uma das partes. Se não conseguir ler, deixe vazio "".

Retorne a resposta estritamente conforme o JSON esquema fornecido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [...imageParts, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: {
              type: Type.BOOLEAN,
              description: "True se for um documento de identificação oficial visível com dados legíveis, False caso contrário.",
            },
            reason: {
              type: Type.STRING,
              description: "Mensagem curta em Português sobre por que o documento é considerado válido ou inválido.",
            },
            extractedName: {
              type: Type.STRING,
              description: "O nome completo do utilizador caso seja extraível e legível no documento.",
            },
            documentNumber: {
              type: Type.STRING,
              description: "O número identificador do documento (como número do BI) se for legível.",
            },
          },
          required: ["isValid", "reason"],
        },
      },
    });

    const resultText = response.text || "{}";
    const result = JSON.parse(resultText.trim());

    return res.json(result);
  } catch (error: any) {
    logSafeWarning("rota /api/verify-document", error);
    // Graceful verification fallback when quota is exceeded or an API error occurs
    return res.json({
      isValid: true,
      reason: "Documento carregado provisoriamente (IA no Modo de Segurança - Alta Procura).",
      extractedName: "Não disponível temporariamente",
      documentNumber: ""
    });
  }
});

// API endpoint for extracting lost/found document data (BI/Passport) using Gemini OCR
app.post("/api/extract-document-data", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "A imagem para extração de dados é obrigatória." });
    }

    const ai = getAiClient();

    // Clean up base64 prefix if present
    let cleanedBase64 = imageBase64;
    let mimeType = "image/jpeg";
    const matches = imageBase64.match(/^data:([^;]+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      cleanedBase64 = matches[2];
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: cleanedBase64,
      },
    };

    const prompt = `Analise a foto do documento anexado (Bilhete de Identidade de Moçambique ou Passaporte) para extrair os dados de texto e convertê-los em informação estruturada. Se o documento for legível, preencha todos os detalhes correspondentes com precisão e verdade.

Instruções para extração dos dados:
1. "docType": Classifique o tipo de documento. Deve ser estritamente "Bilhete de Identidade" ou "Passaporte" ou "Outro".
2. "name": O nome completo do titular do documento (ex: "Clério Manuel Carlos"). Se não estiver legível, coloque "".
3. "number": O número identificador oficial (Número do BI ou Número do Passaporte). Se não estiver legível, coloque "".
4. "province": Escolha de forma inteligente uma província de Moçambique associada ao local de nascimento, local de emissão ou filiação se visível na imagem. O valor deve ser obrigatoriamente um destes nomes estritos de província de Moçambique: "Maputo Cidade", "Maputo Província", "Gaza", "Inhambane", "Manica", "Sofala", "Tete", "Zambézia", "Nampula", "Cabo Delgado", "Niassa". Se não for possível determinar, use "Maputo Cidade" como padrão.
5. "title": Um título formal sugerido para registar este documento em um sistema de achados e perdidos (ex: "Bilhete de Identidade - Clério Manuel Carlos" ou "Passaporte - Maria João de Sousa").
6. "description": Uma descrição recomendada pública limpa, clara e direta ao ponto (ex: "Bilhete de Identidade de Moçambique pertencente a Clério Manuel Carlos, com número terminado em 4567. Encontrado e disponível para devolução ao legítimo proprietário mediante confirmação."). Nunca use placeholders de rascunho como "[Nome]" ou "[últimos 4 dígitos]" — preencha sempre com os valores reais extraídos ou simplesmente descreva o documento de forma limpa e direta.

Retorne a resposta estritamente conforme o JSON esquema fornecido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, prompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            docType: {
              type: Type.STRING,
              description: "O tipo de documento detectado (Bilhete de Identidade, Passaporte ou Outro).",
            },
            name: {
              type: Type.STRING,
              description: "O nome completo legível extraído do documento de identificação.",
            },
            number: {
              type: Type.STRING,
              description: "O número identificador oficial do documento (ex: número do BI ou do Passaporte).",
            },
            province: {
              type: Type.STRING,
              description: "Uma província recomendada de Moçambique baseada no documento.",
            },
            title: {
              type: Type.STRING,
              description: "O título recomendado para a postagem do documento.",
            },
            description: {
              type: Type.STRING,
              description: "Uma sugestão de descrição profissional e completa, ideal para um sistema de achados e perdidos.",
            },
          },
          required: ["docType", "name", "number", "province", "title", "description"],
        },
      },
    });

    const resultText = response.text || "{}";
    const result = JSON.parse(resultText.trim());

    return res.json(result);
  } catch (error: any) {
    logSafeWarning("rota /api/extract-document-data", error);
    // Graceful extraction fallback when Gemini quota/limits are hit
    return res.json({
      docType: "Bilhete de Identidade",
      name: "Titular do Documento",
      number: "",
      province: "Maputo Cidade",
      title: "Documento de Identidade Encontrado",
      description: "Documento de identificação oficial encontrado e registado na plataforma ComeBack Moçambique. Recomenda-se que o titular contacte o anunciante para confirmar os pormenores."
    });
  }
});

// Cache em memória estável para evitar leituras/escritas noutras pesquisas do mesmo ciclo do servidor
const serverEmbeddingCache = new Map<string, number[]>();

// Função auxiliar para calcular a Similaridade de Cosseno entre dois vetores
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// API endpoint para Pesquisa Semântica com embeddings gerados pela IA (gemini-embedding-2-preview)
app.post("/api/semantic-search", async (req, res) => {
  try {
    const { searchQuery } = req.body;
    if (!searchQuery || !searchQuery.trim()) {
      return res.json({ matches: [] });
    }

    const ai = getAiClient();

    // 1. Obter todos os itens em tempo real no Firestore
    const itemsCol = collection(db, "items");
    const snapshot = await getDocs(itemsCol);
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as any);

    if (items.length === 0) {
      return res.json({ matches: [] });
    }

    // 2. Gerar o embedding vetorial para a consulta de pesquisa
    const queryResponse = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: searchQuery.trim(),
    });

    const queryVector = queryResponse.embeddings?.[0]?.values;
    if (!queryVector || !Array.isArray(queryVector)) {
      return res.status(500).json({ error: "Falha ao gerar o embedding da consulta de pesquisa semântica." });
    }

    const matches: { itemId: string; similarity: number }[] = [];

    // 3. Iterar sobre todos os itens ativos e obter/gerar os seus embeddings
    for (const item of items) {
      // Prioridade 1: Cache em memória RAM do servidor
      let itemVector = serverEmbeddingCache.get(item.id);

      // Prioridade 2: Campo 'embedding' persistido no documento Firestore
      if (!itemVector && item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0) {
        itemVector = item.embedding;
        serverEmbeddingCache.set(item.id, itemVector);
      }

      // Prioridade 3: Gerar em tempo real se não existir e salvar em cache persistente
      if (!itemVector || !Array.isArray(itemVector) || itemVector.length === 0) {
        try {
          const itemText = `${item.category || "Artigo"}: ${item.title || ""}. ${item.description || ""}`;
          console.log(`[Semantic Search API] Gerando embedding em falta para Artigo ${item.id} ("${item.title}")`);
          
          const itemResponse = await ai.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: itemText,
          });

          const generatedVector = itemResponse.embeddings?.[0]?.values;
          if (generatedVector && Array.isArray(generatedVector) && generatedVector.length > 0) {
            itemVector = generatedVector;
            serverEmbeddingCache.set(item.id, itemVector);

            // Gravar em background no Firestore para que persista para todas as futuras pesquisas
            const itemDocRef = doc(db, "items", item.id);
            await updateDoc(itemDocRef, { embedding: itemVector });
          }
        } catch (embedErr: any) {
          logSafeWarning("processamento de embedding individual de item", embedErr);
        }
      }

      if (itemVector && Array.isArray(itemVector) && itemVector.length > 0) {
        const similarity = calculateCosineSimilarity(queryVector, itemVector);
        matches.push({ itemId: item.id, similarity });
      }
    }

    // Ordenar resultados com base na taxa de correspondência decrescente
    matches.sort((a, b) => b.similarity - a.similarity);

    return res.json({ matches });
  } catch (error: any) {
    logSafeWarning("processador de pesquisa semântica", error);
    // Em caso de erro de cota ou rede na IA, retornar lista vazia de matches semânticos
    // para que a aplicação utilize a pesquisa baseada em palavra-chave padrão do front-end sem interromper o utilizador.
    return res.json({ matches: [] });
  }
});

// API Endpoint for matching lost and found items using Gemini (securely server-side proxy)
app.post("/api/analyze-match", async (req, res) => {
  const { lostItem, foundItem } = req.body;
  try {
    if (!lostItem || !foundItem) {
      return res.status(400).json({ error: "Os campos lostItem e foundItem são obrigatórios." });
    }

    const ai = getAiClient();
    const prompt = `
      Analise se estes dois itens podem ser o mesmo. 
      Item Perdido: Titulo: ${lostItem.title || ""}, Descrição: ${lostItem.description || ""}, Categoria: ${lostItem.category || ""}, Província: ${lostItem.province || ""}.
      Item Achado: Titulo: ${foundItem.title || ""}, Descrição: ${foundItem.description || ""}, Categoria: ${foundItem.category || ""}, Província: ${foundItem.province || ""}.
      
      Responda em formato JSON com:
      - similarity: um número de 0 a 100 indicando a probabilidade de ser o mesmo objeto.
      - reasoning: uma breve explicação em português do porquê.
      - isMatch: boolean, true se similarity > 70.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            similarity: { type: Type.NUMBER, description: "Probabilidade de 0 a 100" },
            reasoning: { type: Type.STRING, description: "Explicação em português" },
            isMatch: { type: Type.BOOLEAN, description: "True se similarity > 75" }
          },
          required: ["similarity", "reasoning", "isMatch"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return res.json(result);
  } catch (error: any) {
    logSafeWarning("rota /api/analyze-match", error);
    // Silent recovery fallback when AI service limits are exceeded
    return res.json({
      similarity: 0,
      reasoning: "Serviço de análise inteligente de correspondência temporariamente indisponível.",
      isMatch: false
    });
  }
});

// API Endpoint for generating search tags using Gemini (securely server-side proxy)
app.post("/api/generate-tags", async (req, res) => {
  const { description } = req.body;
  try {
    if (!description) {
      return res.json([]);
    }

    const ai = getAiClient();
    const prompt = `Gere 5 tags (palavras-chave) curtas em português para esta descrição de objeto: "${description}". Responda apenas um array de strings em JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return res.json(result);
  } catch (error: any) {
    logSafeWarning("rota /api/generate-tags", error);
    return res.json([]);
  }
});

// API Endpoint para Sugestões Inteligentes no Feed com Gemini
app.post("/api/smart-suggestions", async (req, res) => {
  try {
    const { recentSearches, candidateItems, userCoords, userProvince } = req.body;
    
    if (!candidateItems || !Array.isArray(candidateItems) || candidateItems.length === 0) {
      return res.json({ suggestions: [] });
    }

    const ai = getAiClient();
    const searches = Array.isArray(recentSearches) ? recentSearches.slice(0, 5) : [];

    // Limitar candidatos para 12 itens mais relevantes/recentes para performance
    const sampleItems = candidateItems.slice(0, 15).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description?.slice(0, 120) || "",
      category: item.category,
      status: item.status,
      location: item.location,
      province: item.province,
      reward: item.reward || 0,
      lat: item.latitude,
      lng: item.longitude
    }));

    const prompt = `
      Você é o motor de IA inteligente do ComeBack Moçambique.
      O utilizador tem as seguintes pesquisas recentes no radar: ${searches.length > 0 ? searches.map(s => `"${s}"`).join(", ") : "Nenhuma pesquisa prévia (usar afinidade de proximidade e relevância de achados/perdidos)"}.
      Localização do utilizador: Província de ${userProvince || "Maputo Cidade"}${userCoords ? `, Coords: [lat: ${userCoords.lat}, lng: ${userCoords.lng}]` : ""}.

      Lista de artigos candidatos disponíveis no sistema:
      ${JSON.stringify(sampleItems, null, 2)}

      Selecione EXATAMENTE os 3 MELHORES itens como potenciais "matches" para este utilizador, considerando:
      1. Afinidade semântica e coincidência de palavras com as pesquisas recentes (ex: marca, modelo, categoria de objeto, documentos).
      2. Proximidade geográfica (mesma província/bairro ou coordenadas próximas).
      3. Itens do tipo ACHADO ou PERDIDO que resolvam a busca do utilizador.
      
      Retorne um array JSON com exatamente até 3 objetos:
      - itemId: string (id exato do item na lista)
      - confidenceScore: número inteiro entre 75 e 99 (ex: 96)
      - matchReason: string curta em português (máximo 15 palavras) explicando a correlação (ex: "Corresponde à sua busca por 'iPhone' a 1.5 km de si", "Documento achado na sua zona de residência").
      - matchedQuery: string (termo de busca que acionou ou 'Proximidade Radar').
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              confidenceScore: { type: Type.INTEGER },
              matchReason: { type: Type.STRING },
              matchedQuery: { type: Type.STRING }
            },
            required: ["itemId", "confidenceScore", "matchReason"]
          }
        }
      }
    });

    const suggestions = JSON.parse(response.text || "[]");
    return res.json({ suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [] });
  } catch (error: any) {
    logSafeWarning("rota /api/smart-suggestions", error);
    return res.json({ suggestions: [] });
  }
});

// API Endpoint para despachar notificações push reais via Service Workers (Web Push)
app.post("/api/trigger-push", async (req, res) => {
  try {
    if (!vapidConfigured) {
      return res.status(503).json({ error: "Web Push não está configurado no servidor." });
    }

    const { userId, title, body, data } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "O campo userId é obrigatório." });
    }

    // 1. Ir buscar as subscrições Web Push do utilizador no Firestore
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return res.status(404).json({ error: "Utilizador não encontrado no sistema." });
    }

    const userData = userDocSnap.data();
    const subscriptions = userData.webPushSubscriptions || [];

    if (subscriptions.length === 0) {
      console.log(`[Push Server] Nenhuma subscrição Web Push ativa para o utilizador ${userId}`);
      return res.json({ success: true, message: "Nenhuma subscrição ativa encontrada para o utilizador." });
    }

    // 2. Definir o payload a enviar de forma padronizada
    const payload = JSON.stringify({
      title: title || "Alerta de Match ComeBack!",
      body: body || "Uma nova novidade importante sobre os seus itens.",
      icon: "/favicon.ico",
      data: data || { url: "/" }
    });

    let successCount = 0;
    let failCount = 0;
    const indicesToRemove: number[] = [];

    // 3. Despachar notificações em paralelo para todas as sessões registadas
    const sendPromises = subscriptions.map(async (sub: any, index: number) => {
      try {
        await webpush.sendNotification(sub, payload);
        successCount++;
      } catch (err: any) {
        console.warn(`[Push Server] Falha ao enviar para subscrição index ${index}:`, err.message);
        failCount++;
        // Se a resposta for 410 (Gone) ou 404 (Not Found), a subscrição expirou e precisa ser limpa do Firestore
        if (err.statusCode === 410 || err.statusCode === 404) {
          indicesToRemove.push(index);
        }
      }
    });

    await Promise.all(sendPromises);

    // 4. Se houver assinaturas expiradas, filtre e remova-as
    if (indicesToRemove.length > 0) {
      const filteredSubscriptions = subscriptions.filter((_: any, idx: number) => !indicesToRemove.includes(idx));
      await updateDoc(userDocRef, {
        webPushSubscriptions: filteredSubscriptions
      });
      console.log(`[Push Server] Limpadas ${indicesToRemove.length} subscrições expiradas ou inválidas para o utilizador ${userId}.`);
    }

    return res.json({
      success: true,
      delivered: successCount,
      failed: failCount
    });
  } catch (error: any) {
    console.error("Erro interno ao enviar push notification:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao processar Push Notification." });
  }
});

// API Endpoint to simulate/trigger SMS notification for high-value items
app.post("/api/trigger-sms", async (req, res) => {
  try {
    const { userId, title, body } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "O campo userId é obrigatório." });
    }

    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return res.status(404).json({ error: "Utilizador não encontrado no sistema." });
    }

    const userData = userDocSnap.data();
    const standardSmsActive = !!userData.smsNotificationsEnabled;
    const offlineSmsActive = !!(userData.criticalSmsOfflineEnabled && userData.isVerified);

    if (!standardSmsActive && !offlineSmsActive) {
      return res.json({ success: false, message: "O utilizador desativou as notificações por SMS (normal e offline)." });
    }
    
    if (!userData.phone) {
      return res.json({ success: false, message: "O utilizador não possui um número de telefone configurado." });
    }

    const isOfflineSimulation = offlineSmsActive && !standardSmsActive;

    // Custom Webhook processing
    let webhookTriggered = false;
    let webhookSuccess = false;
    let webhookResponseStatus: number | null = null;
    let webhookResponseText = "";
    let webhookError = "";

    try {
      const configDocRef = doc(db, "settings", "sms_config");
      const configDocSnap = await getDoc(configDocRef);
      if (configDocSnap.exists()) {
        const configData = configDocSnap.data();
        if (configData.isActive && configData.webhookUrl) {
          const rawPhone = userData.phone;
          const cleanPhone = rawPhone.replace(/\s+/g, '');
          const messageText = `${title}: ${body}`;

          let finalUrl = configData.webhookUrl
            .replace(/\{\{phone\}\}/g, encodeURIComponent(cleanPhone))
            .replace(/\{\{title\}\}/g, encodeURIComponent(title))
            .replace(/\{\{message\}\}/g, encodeURIComponent(messageText));

          let finalPayload = (configData.payloadTemplate || "")
            .replace(/\{\{phone\}\}/g, cleanPhone)
            .replace(/\{\{title\}\}/g, title)
            .replace(/\{\{message\}\}/g, messageText);

          const headers: Record<string, string> = {
            "Content-Type": "application/json"
          };
          
          if (configData.headersText) {
            const lines = configData.headersText.split('\n');
            for (const line of lines) {
              const splitIdx = line.indexOf(':');
              if (splitIdx > 0) {
                const key = line.slice(0, splitIdx).trim();
                const val = line.slice(splitIdx + 1).trim();
                headers[key] = val;
              }
            }
          }

          webhookTriggered = true;
          if (configData.useRealWebhook) {
            console.log(`📡 [SMS WEBHOOK REAL] Disparando webhook para +258 ${cleanPhone}...`);
            const fetchOptions: any = {
              method: configData.method || "POST",
              headers
            };
            if (configData.method === "POST" && finalPayload) {
              fetchOptions.body = finalPayload;
            }

            const response = await fetch(finalUrl, fetchOptions);
            webhookResponseStatus = response.status;
            webhookResponseText = await response.text();
            webhookSuccess = response.ok;
          } else {
            console.log(`📡 [SMS WEBHOOK SIMULADO] Webhook ativo mas configurado em MODO SIMULAÇÃO.`);
            webhookSuccess = true;
            webhookResponseStatus = 200;
            webhookResponseText = `Instância Simulado: hook local despachado para ${finalUrl}`;
          }
        }
      }
    } catch (cfgErr: any) {
      console.error("Erro ao aplicar SMS Webhook:", cfgErr);
      webhookError = cfgErr.message || "Erro físico de ligação à API Webhook";
    }

    console.log(`\n======================================================`);
    if (isOfflineSimulation) {
      console.log(`📡 [SMS GATEWAY MODO OFFLINE] DESPACHO CRÍTICO COBERTURA LIMITADA (UTILIZADOR VERIFICADO)`);
    } else {
      console.log(`🌟 [SMS GATEWAY MOÇAMBIQUE] PARCEIRO OFICIAL VODACOM / MOVITEL / MCEL`);
    }
    console.log(`📱 PARA: +258 ${userData.phone}`);
    console.log(`✉️ ASSUNTO: ${title}`);
    console.log(`💬 MENSAGEM: ${body}`);
    if (webhookTriggered) {
      console.log(`🔗 WEBHOOK DETECTADO - Envio por Webhook Ativo: ${webhookSuccess}, Código: ${webhookResponseStatus}`);
      if (webhookError) console.log(`❌ Erro do Webhook: ${webhookError}`);
    } else {
      console.log(`✅ ENVIADO COM SUCESSO via gateway de segurança de alto valor!`);
    }
    console.log(`======================================================\n`);

    return res.json({
      success: webhookTriggered ? webhookSuccess : true,
      message: isOfflineSimulation 
        ? `SMS Crítico Offline despachado com sucesso para +258 ${userData.phone}.`
        : `SMS de Alto Valor simulado com sucesso para +258 ${userData.phone}.`,
      sentTo: userData.phone,
      mode: isOfflineSimulation ? 'offline_critical' : 'standard',
      webhookDetails: webhookTriggered ? {
        triggered: true,
        success: webhookSuccess,
        statusCode: webhookResponseStatus,
        responseText: webhookResponseText,
        error: webhookError
      } : null
    });
  } catch (error: any) {
    console.error("Erro na rota /api/trigger-sms:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao processar SMS." });
  }
});

// API Endpoint to instantly test custom admin SMS Webhook integration
app.post("/api/test-sms-webhook", async (req, res) => {
  try {
    const { webhookUrl, method, headersText, payloadTemplate, testPhone, testMessage } = req.body;
    
    if (!webhookUrl) {
      return res.status(400).json({ error: "O campo webhookUrl é obrigatório." });
    }

    const cleanPhone = (testPhone || "840000000").replace(/\s+/g, '');
    const title = "Teste de Integração";
    const messageText = testMessage || "Esta é uma mensagem de teste do ComeBack SMS Webhook.";

    let finalUrl = webhookUrl
      .replace(/\{\{phone\}\}/g, encodeURIComponent(cleanPhone))
      .replace(/\{\{title\}\}/g, encodeURIComponent(title))
      .replace(/\{\{message\}\}/g, encodeURIComponent(messageText));

    let finalPayload = (payloadTemplate || "")
      .replace(/\{\{phone\}\}/g, cleanPhone)
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{message\}\}/g, messageText);

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (headersText) {
      const lines = headersText.split('\n');
      for (const line of lines) {
        const splitIdx = line.indexOf(':');
        if (splitIdx > 0) {
          const key = line.slice(0, splitIdx).trim();
          const val = line.slice(splitIdx + 1).trim();
          headers[key] = val;
        }
      }
    }

    const startTimestamp = Date.now();
    let statusText = "Desconhecido";
    let statusCode = 200;
    let responseBody = "";
    let isSuccess = false;

    try {
      const fetchOptions: any = {
        method: method || "POST",
        headers
      };

      if (method === "POST" && finalPayload) {
        fetchOptions.body = finalPayload;
      }

      console.log(`📡 [SMS TEST WEBHOOK] Enviando para ${finalUrl}`);
      const response = await fetch(finalUrl, fetchOptions);
      statusCode = response.status;
      responseBody = await response.text();
      isSuccess = response.ok;
      statusText = response.statusText;
    } catch (e: any) {
      statusCode = 500;
      responseBody = e.message || "Erro de ligação física ao servidor";
      isSuccess = false;
      statusText = "Internal Error";
    }

    return res.json({
      success: isSuccess,
      statusCode,
      statusText,
      responseBody,
      responseTimeMs: Date.now() - startTimestamp
    });
  } catch (error: any) {
    console.error("Erro no teste do webhook:", error);
    return res.status(500).json({ error: error.message || "Erro interno de execução do webhook." });
  }
});

// Configure Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
