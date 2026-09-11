/**
 * Safety Analyzer Service for ComeBack Moçambique
 * Analyzes messages in real-time to detect potential fraud (pre-payment requests, SMS/OTP phishing) 
 * or aggressive, offensive, and hostile behavior.
 */

export interface SafetyAnalysisResult {
  hasDanger: boolean;
  isFraud: boolean;
  isAggressive: boolean;
  detectedTerms: string[];
  explanation: string;
}

// Fraud indicators (Portuguese/Mozambican context)
const FRAUD_PATTERNS = [
  {
    terms: [
      "adiantado", "adiantamento", "paga antes", "pagar antes", "pagamento antes", 
      "deposite antes", "depositar antes", "transferir antes", "transferência antes", 
      "taxa de entrega", "taxa de envio", "paga o frete", "pagar o frete", "paga frete", 
      "combustível", "gasolina", "frete", "adiantar", "deposite", "depositar",
      "dinheiro primeiro", "manda valor", "mandar valor", "envia valor", "enviar valor"
    ],
    explanation: "Solicitação de pagamento adiantado, taxa de entrega ou combustível. A ComeBack recomenda NUNCA fazer nenhum depósito ou transferência de dinheiro (M-Pesa, e-Mola, mKesh ou Banco) antes de ver e inspecionar o artigo pessoalmente.",
    type: "fraud_prepayment"
  },
  {
    terms: [
      "código de verificação", "código de sms", "codigo de verificação", "codigo sms",
      "meu pin", "seu pin", "sua senha", "me manda o código", "me manda o codigo",
      "digite o código", "digite o codigo", "número do cartão", "numero do cartao",
      "manda o pin", "senha do mpesa", "senha do banco", "código otp", "otp"
    ],
    explanation: "Possível tentativa de roubo de conta ou phishing. Nunca partilhe códigos de SMS, senhas de cartões, PINs do M-Pesa, e-Mola ou dados bancários com ninguém no chat.",
    type: "fraud_phishing"
  }
];

// Aggressive / Offensive language indicators
const AGGRESSIVE_PATTERNS = [
  {
    terms: [
      "burro", "idiota", "estúpido", "estupido", "ladrão", "ladrao", "golpista", 
      "vigarista", "mentiroso", "merda", "foder", "puta", "cabrão", "cabrao", 
      "porra", "caralho", "paneleiro", "corrupto", "matar", "bater", "vais ver", 
      "vou-te pegar", "vou te pegar", "vou-te bater", "vou te bater", "ameaça", 
      "ameaçar", "imbecil", "palhaço", "palhaco", "parvo", "ordinário", "ordinario",
      "filho da puta", "vai po caralho", "fode-te", "fodete", "foder-se"
    ],
    explanation: "Linguagem hostil, agressiva ou ofensiva detetada. Para sua segurança física e moral, mantenha sempre a cordialidade. Ofensas e ameaças violam os termos e podem resultar na suspensão permanente da conta.",
    type: "aggression"
  }
];

/**
 * Normalizes text to easily find patterns (removes double spaces, lowercases)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analyzes a message text for potential fraud or aggressive behavior.
 */
export function analyzeMessage(text: string | undefined | null): SafetyAnalysisResult {
  const result: SafetyAnalysisResult = {
    hasDanger: false,
    isFraud: false,
    isAggressive: false,
    detectedTerms: [],
    explanation: ""
  };

  if (!text) return result;

  const normalized = normalizeText(text);

  // 1. Check for Fraud Patterns
  for (const pattern of FRAUD_PATTERNS) {
    const matched: string[] = [];
    for (const term of pattern.terms) {
      if (normalized.includes(term)) {
        matched.push(term);
      }
    }
    if (matched.length > 0) {
      result.isFraud = true;
      result.hasDanger = true;
      result.detectedTerms.push(...matched);
      result.explanation = pattern.explanation;
      break; // stop at first match to keep it simple and clean
    }
  }

  // 2. Check for Aggressive Patterns (if fraud is not already detected, or append explanation)
  for (const pattern of AGGRESSIVE_PATTERNS) {
    const matched: string[] = [];
    for (const term of pattern.terms) {
      // Use regex or substring for flexible checks
      if (normalized.includes(term)) {
        matched.push(term);
      }
    }
    if (matched.length > 0) {
      result.isAggressive = true;
      result.hasDanger = true;
      result.detectedTerms.push(...matched);
      if (result.explanation) {
        result.explanation += "\n\n⚠️ " + pattern.explanation;
      } else {
        result.explanation = pattern.explanation;
      }
      break;
    }
  }

  // Deduplicate matched terms
  result.detectedTerms = Array.from(new Set(result.detectedTerms));

  return result;
}
