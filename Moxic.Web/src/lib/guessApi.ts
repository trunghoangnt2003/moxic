import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "/api";
const api = axios.create({ baseURL: API_URL, withCredentials: true });

const KEY = "moxic.guessKey";
function guestKey() {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return "nostorage-" + Math.random().toString(36).slice(2) + Date.now();
  }
}
const headers = () => ({ "X-Guess-Key": guestKey() });

export interface GuessState {
  date: string;
  number: number;
  maxTries: number;
  nextAt: string;
  imagePath: string;
  tries: number;
  solved: boolean;
  finished: boolean;
  points: number;
  nextPoints: number;
  guesses: { id: string; name: string; correct: boolean }[];
  hints: { label: string; value: string }[];
  streak: number;
  signedIn: boolean;
  answer: { id: string; name: string; salePrice: number; originalPrice: number } | null;
  stats: { players: number; solved: number; distribution: number[] };
}

export const imageUrl = (path: string) => `${API_URL.replace(/\/$/, "")}/${path}`;

export async function getGuessToday() {
  const { data } = await api.get<GuessState>("/guess/today", { headers: headers() });
  return data;
}

export async function getGuessOptions() {
  const { data } = await api.get<{ id: string; name: string }[]>("/guess/options");
  return data;
}

export async function submitGuess(gameId: string) {
  const { data } = await api.post<{ correct: boolean; earned: number; state: GuessState }>("/guess/today", { gameId }, { headers: headers() });
  return data;
}
