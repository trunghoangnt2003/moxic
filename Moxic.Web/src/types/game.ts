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
  genre: string;
  tags: string;
  status: "Available" | "Preorder";
  releaseDate?: string;
  coverImageUrl?: string;
}

export interface GameDetail {
  id: string;
  name: string;
  description: string;
  originalPrice: number;
  salePrice: number;
  genre: string;
  tags: string;
  status: "Available" | "Preorder";
  releaseDate?: string;
  media: GameMedia[];
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
}
