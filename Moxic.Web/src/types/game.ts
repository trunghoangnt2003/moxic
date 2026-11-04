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
  soldCount?: number;
  productType?: ProductType;
  region?: string | null;
  publisher?: string | null;
  editionCount?: number;
  rentFrom?: number | null;
  saleEndsAt?: string | null;
}

export type ProductType = "Game" | "GamePass" | "GiftCard" | "DLC" | "Bundle";

export interface GameEdition {
  id: string;
  name: string;
  includes: string[];
  originalPrice: number;
  salePrice: number;
  isDefault: boolean;
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
  /** Chosen edition (one edition per game in the cart). */
  editionId?: string | null;
  editionName?: string | null;
}

export interface GameReview {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  content: string;
  createdAt: string;
  isVerifiedPurchase?: boolean;
  badges?: string[];
  isMine?: boolean;
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
  productType: ProductType;
  region: string | null;
  publisher: string | null;
  developer: string | null;
  xboxProductId?: string | null;
  saleEndsAt?: string | null;
  editions: GameEdition[];
}

export interface GamesResponse {
  items: GameListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FacetOption {
  id: string;
  name: string;
  count: number;
}

export interface GameFacets {
  genres: FacetOption[];
  tags: FacetOption[];
  price: { min: number; max: number };
  status: { available: number; preorder: number };
  onSale: number;
  types: FacetOption[];
  regions: FacetOption[];
  publishers: FacetOption[];
  years: number[];
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
  items: { gameId: string; editionId?: string; price: number }[];
  customerPhone: string;
  customerXboxEmail: string;
  customerXboxPassword: string;
  customerZalo?: string;
  paymentMethod: "Bank" | "Crypto";
  /** Optional coupon (logged-in customers only). The server re-prices and re-validates. */
  couponCode?: string;
  /** Gift order: the recipient enters their Xbox account later via the gift link. */
  isGift?: boolean;
  giftFromName?: string;
  giftRecipientName?: string;
  giftMessage?: string;
}

export interface OrderCreateResponse {
  id: string;
  orderCode: string;
  totalAmount: number;
  discountAmount: number;
  couponCode?: string | null;
  createdAt: string;
}

export interface OrderConfirmationItem {
  gameName: string;
  price: number;
  /** Xbox Store price at purchase time. */
  listPrice?: number | null;
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
  /** Amount to transfer (already discounted). */
  totalAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  couponCode?: string | null;
  status: string;
  createdAt: string;
  paymentProofUrl?: string | null;
  paymentConfig?: PaymentConfigInfo | null;
  isGift?: boolean;
  giftToken?: string | null;
  giftRecipientName?: string | null;
  giftClaimedAt?: string | null;
  dynamicQrUrl?: string | null;
  transferContent?: string;
  autoConfirm?: boolean;
  savedAmount?: number;
  paidAt?: string | null;
  installStartedAt?: string | null;
  downloadingAt?: string | null;
  completedAt?: string | null;
}
