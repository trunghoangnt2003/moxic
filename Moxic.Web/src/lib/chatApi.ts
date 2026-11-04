import axios from "axios";
import { create } from "zustand";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

const KEY = "moxic.chatKey";
function readKey() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function saveKey(k: string) {
  try {
    localStorage.setItem(KEY, k);
  } catch {
    /* storage unavailable — chat still works for signed-in customers */
  }
}
const headers = () => {
  const k = readKey();
  return k ? { "X-Chat-Key": k } : {};
};

export interface ChatMsg {
  id: string;
  fromAdmin: boolean;
  text: string;
  orderCode: string | null;
  createdAt: string;
}

export interface ChatState {
  thread: { code: string; orderCode: string | null; name: string | null } | null;
  messages: ChatMsg[];
}

export async function getChatConfig() {
  const { data } = await api.get<{ enabled: boolean }>("/chat/config");
  return data;
}

export async function getChatMessages() {
  const { data } = await api.get<ChatState>("/chat/messages", { headers: headers() });
  return data;
}

export async function getChatUnread() {
  const { data } = await api.get<{ unread: number }>("/chat/unread", { headers: headers() });
  return data.unread;
}

export async function sendChatMessage(body: { text: string; orderCode?: string; name?: string; contact?: string }) {
  const { data } = await api.post<{ key: string | null; message: ChatMsg; live: boolean }>("/chat/messages", body, { headers: headers() });
  if (data.key) saveKey(data.key);
  return data;
}

interface ChatUi {
  open: boolean;
  orderCode: string | null;
  openChat: (orderCode?: string | null) => void;
  close: () => void;
}

/** Lets any page open the chat panel, optionally about a specific order. */
export const useChatUi = create<ChatUi>((set) => ({
  open: false,
  orderCode: null,
  openChat: (orderCode) => set((s) => ({ open: true, orderCode: orderCode ?? s.orderCode })),
  close: () => set({ open: false }),
}));
