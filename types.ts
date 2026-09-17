
export enum ItemStatus {
  LOST = 'LOST',
  FOUND = 'FOUND',
  STOLEN = 'STOLEN',
  REUNITED = 'REUNITED',
  IN_TRANSIT = 'IN_TRANSIT'
}

export enum Category {
  DOCUMENTS = 'Documentos',
  ELECTRONICS = 'Eletrónicos',
  CLOTHING = 'Vestuário',
  PETS = 'Animais',
  BAGS = 'Malas/Bolsas',
  WALLETS = 'Carteiras',
  KEYS = 'Chaves',
  JEWELRY = 'Jóias/Relógios',
  PEOPLE = 'Pessoas Desaparecidas',
  OTHERS = 'Outros'
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  province?: string;
  bairro?: string;
  casa?: string;
  quarteirao?: string;
  photoURL?: string;
  isVerified: boolean;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  canVerifyDocuments?: boolean;
  verificationNote?: string;
  rating?: number;
  documentImageUrl?: string;
  createdAt: string;
  emergencyContacts?: { name: string; phone: string }[];
  smsNotificationsEnabled?: boolean;
  criticalSmsOfflineEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  chatNotificationsEnabled?: boolean;
  matchNotificationsEnabled?: boolean;
  proximityAlertsEnabled?: boolean;
  proximityRadius?: number;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  notificationSound?: string;
  livenessSelfieUrl?: string;
}

export interface InsuredPhone {
  id: string;
  userId: string;
  brand: string;
  model: string;
  imei: string;
  insuranceTier: 'basic' | 'premium' | 'ultra';
  contactNumber: string;
  currentSimNumber?: string;
  status: 'active' | 'stolen' | 'suspended' | 'investigating';
  coverageValue: number;
  registeredAt: string;
  trackingEnabled: boolean;
  simSwaps: {
    id: string;
    timestamp: string;
    oldSim: string;
    newSim: string;
    newPhoneInserted: string;
    latitude?: number;
    longitude?: number;
    sentToAuthority: boolean;
    smsSentStatus?: 'success' | 'failed' | 'pending';
  }[];
}

export interface Item {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: ItemStatus;
  location: string;
  province: string;
  reward?: number;
  date: string;
  imageUrl?: string;
  imageUrls?: string[];
  userId: string;
  ownerName?: string; // Nome de quem publicou
  ownerPhone?: string; // Telefone de quem publicou
  createdAt: string;
  latitude?: number;
  longitude?: number;
  // Propriedades para rastreamento e entrega
  transitLatitude: number;
  transitLongitude: number;
  isTrackingActive: boolean;
  deliveryLocation?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryStatus?: 'pending_confirmation' | 'confirmed' | 'denied';
  conditionCheckedByOwner?: boolean;
  conditionDetails?: string;
  ratingByFinderForOwner?: number;
  ratingByFinderForPlatform?: number;
  ratingByOwnerForFinder?: number;
  ratingByOwnerForPlatform?: number;
  negotiatedReward?: number;
  trackingLogs?: { lat: number; lng: number; timestamp: string }[];
  reunitedAt?: string;
  reunitedProofUrl?: string; // URL/Base64 da foto de prova da recuperação
  reunitedProofNotes?: string; // Notas de entrega/recuperação fornecidas
  reunitedOfflineSignature?: string;
  reunitedOfflineGeo?: { latitude: number; longitude: number; accuracy?: number; timestamp: string };
  reunitedOfflineVerified?: boolean;
  removalRequested?: boolean;
  removalRequestedAt?: string;
  sharesCount?: number;
  isPremium?: boolean;
  ownerVerified?: boolean;
  // Facebook style Paid Traffic Boost campaign fields
  isBoosted?: boolean;
  boostDays?: number;
  boostDailyBudget?: number;
  boostTotalBudget?: number;
  boostStartDate?: string;
  boostEndDate?: string;
  boostTargetProvince?: string;
  boostTargetCategory?: string;
  boostTargetStatus?: string;
  boostPaymentMethod?: 'mpesa' | 'emola' | 'card' | 'mkesh';
  boostPaymentPhone?: string;
  boostPlacement?: 'feed_and_modal' | 'feed_only';
  boostImpressions?: number;
  // Missing Person specific characteristics
  fullName?: string;
  age?: number;
  height?: string;
  bodyType?: string;
  hairCut?: string;
  trousersColor?: string;
  shirtColor?: string;
  extraDetails?: string;
  sketchData?: {
    hairStyleId: string;
    bodyStyleId: string;
    skinColorId: string;
    accessoryId: string;
  };
}

export interface Message {
  id: string;
  itemId: string;
  senderId: string;
  receiverId: string;
  text?: string;
  timestamp: string;
  type?: 'text' | 'image' | 'location';
  mediaUrl?: string;
  latitude?: number;
  longitude?: number;
  pending?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'MATCH' | 'MESSAGE' | 'REWARD' | 'DELIVERY' | 'CLAIM';
  title: string;
  description: string;
  itemId: string;
  timestamp: string;
  isRead: boolean;
}

export interface Comment {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: string;
}

export interface Review {
  id: string;
  itemId: string;
  itemTitle: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  targetUserId: string;
  itemRating: number; // 1-5
  userRating: number; // 1-5
  feedback: string;
  createdAt: string;
}

export interface MatchResult {
  similarity: number;
  reasoning: string;
  isMatch: boolean;
}

export interface SmsGatewayConfig {
  id?: string;
  webhookUrl: string;
  method: 'GET' | 'POST';
  headersText: string;
  payloadTemplate: string;
  isActive: boolean;
  useRealWebhook: boolean;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed';
  lastTestResponse?: string;
}

