import type { ProductType } from "../types/game";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  Game: "Game",
  GamePass: "Game Pass",
  GiftCard: "Gift Card",
  DLC: "DLC",
  Bundle: "Bundle",
};

/** Badge styling per product type (non-Game types are highlighted on cards). */
export const PRODUCT_TYPE_STYLES: Record<ProductType, string> = {
  Game: "bg-white/10 text-white",
  GamePass: "bg-positive/90 text-white",
  GiftCard: "bg-info/90 text-white",
  DLC: "bg-highlight/90 text-white",
  Bundle: "bg-caution/90 text-bg-base",
};
