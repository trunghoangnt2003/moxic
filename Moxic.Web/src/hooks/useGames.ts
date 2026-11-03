import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getGames, getGameDetail, getFeaturedGames, getGameFacets, type GameQuery } from "../lib/api";

export function useGames(params: GameQuery = {}, options?: { enabled?: boolean; keepPrevious?: boolean }) {
  return useQuery({
    queryKey: ["games", params],
    queryFn: () => getGames(params),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
}

export function useGameFacets() {
  return useQuery({
    queryKey: ["games", "facets"],
    queryFn: getGameFacets,
    staleTime: 10 * 60 * 1000,
  });
}

export function useFeaturedGames(limit: number = 5) {
  return useQuery({
    queryKey: ["games", "featured", limit],
    queryFn: () => getFeaturedGames(limit),
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
