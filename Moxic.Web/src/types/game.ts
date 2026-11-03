export interface GenreTag {
  id: string;
  name: string;
}

export interface GameMedia {
  id: string;
  objectKey: string;
  isPrimary: boolean;
  displayOrder: number;
  presignedUrl?: string;
}

export interface GameListItem {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  genres: GenreTag[];
  tags: GenreTag[];
  status: "Available" | "Preorder";
  releaseDate?: string;
  coverImageUrl?: string;
}

export interface GameRating {
  source: string;
  score: number;
  maxScore: number;
  label: string;
}

export interface SystemRequirement {
  os: string;
  processor: string;
  memory: string;
  graphics: string;
  storage: string;
}

export interface CartItem {
  gameId: string;
  name: string;
  coverImageUrl: string;
  price: number;
  originalPrice: number;
  status: "Available" | "Preorder";
  quantity: number;
}

export interface GameReview {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  content: string;
  createdAt: string;
}

export interface GameDetail {
  id: string;
  name: string;
  description: string;
  originalPrice: number;
  salePrice: number;
  genres: GenreTag[];
  tags: GenreTag[];
  status: "Available" | "Preorder";
  releaseDate?: string;
  media: GameMedia[];
  ratings: GameRating[];
  systemRequirements: {
    minimum: SystemRequirement;
    recommended: SystemRequirement;
  };
  relatedGameIds: string[];
  purchaseCount: number;
  storeRating: number;
  reviews: GameReview[];
}

export interface GamesResponse {
  items: GameListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActivePaymentConfig {
  transferSyntaxTemplate: string;
  bankQrUrl?: string;
  cryptoQrUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
}

export interface OrderCreateRequest {
  items: { gameId: string; price: number }[];
  customerPhone: string;
  customerXboxEmail: string;
  customerXboxPassword: string;
  customerZalo?: string;
  paymentMethod: "Bank" | "Crypto";
}

export interface OrderCreateResponse {
  id: string;
  orderCode: string;
  totalAmount: number;
  createdAt: string;
}

export interface OrderConfirmationItem {
  gameName: string;
  price: number;
}

export interface PaymentConfigInfo {
  transferSyntaxTemplate: string;
  bankQrUrl?: string;
  cryptoQrUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
}

export interface OrderConfirmationData {
  orderCode: string;
  items: OrderConfirmationItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
  paymentProofUrl?: string | null;
  paymentConfig?: PaymentConfigInfo | null;
}
