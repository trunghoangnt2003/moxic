import { create } from "zustand";
import type { CartItem } from "../types/game";
import { persist } from "zustand/middleware";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (gameId: string) => void;
  updateQuantity: (gameId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),

      addItem: (item) =>
        set((state) => {
          const exists = state.items.find((i) => i.gameId === item.gameId);
          // One edition per game: choosing another edition replaces the cart line.
          if (exists && (exists.editionId ?? null) !== (item.editionId ?? null)) {
            return { items: state.items.map((i) => (i.gameId === item.gameId ? { ...item, quantity: 1 } : i)) };
          }
          if (exists) {
            return {
              items: state.items.map((i) =>
                i.gameId === item.gameId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (gameId) =>
        set((state) => ({
          items: state.items.filter((i) => i.gameId !== gameId),
        })),

      updateQuantity: (gameId, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.gameId !== gameId)
              : state.items.map((i) =>
                  i.gameId === gameId ? { ...i, quantity: qty } : i,
                ),
        })),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: "moxic-cart" },
  ),
);
