import { useQuery } from "@tanstack/react-query";
import { getGames, getGameDetail } from "../lib/api";

export function useGames(params?: { page?: number; pageSize?: number; genre?: string; status?: string; search?: string; }) {
  return useQuery({
    queryKey: ["games", params],
    queryFn: () => getGames(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGameDetail(id: string) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: () => getGameDetail(id),
    enabled: !!id,
  });
}

