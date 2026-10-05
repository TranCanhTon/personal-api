import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { components } from './schema'

// Types come from the FastAPI OpenAPI schema. Regenerate with `npm run gen:api`.
export type Day = components['schemas']['Day']
export type Fitness = components['schemas']['Fitness']
export type Sleep = components['schemas']['SleepOut']
export type Workout = components['schemas']['WorkoutOut']
export type GoalsApi = components['schemas']['GoalsIn']
export type Streaks = components['schemas']['Streaks']
export type Chess = components['schemas']['Chess']
export type ChessGame = components['schemas']['ChessGameOut']
export type ChessPgn = components['schemas']['ChessPgn']

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`)
  return res.json() as Promise<T>
}

/** Every day in [start, end], including days with no data. Refreshes every minute and on tab focus. */
export function useDays(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: ['days', start, end],
    queryFn: () => getJson<Day[]>(`/days?start=${start}&end=${end}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** My targets, stored in the backend so the emails and streaks use the same numbers. */
export function useGoalsQuery() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: () => getJson<GoalsApi>('/goals'),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Saving goals needs the API key, since the site is public. Throws 'key' when the key is wrong or missing. */
export async function putGoals(goals: GoalsApi, apiKey: string): Promise<GoalsApi> {
  const res = await fetch(`${API_URL}/goals`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(goals),
  })
  if (res.status === 401 || res.status === 503) throw new Error('key')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<GoalsApi>
}

/** Food logging streak (days) and gym streak (weeks), as of today. */
export function useStreaks() {
  return useQuery({
    queryKey: ['streaks'],
    queryFn: () => getJson<Streaks>('/streaks'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}

/** chess.com rating, record and openings over every saved game of a time class, plus the newest `limit` games. */
export function useChess(limit: number, enabled = true) {
  return useQuery({
    queryKey: ['chess', limit],
    queryFn: () => getJson<Chess>(`/games/chess?time_class=rapid&limit=${limit}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** The moves of one game. Fetched when a game is opened (or hovered), not with the list. */
export function chessPgnQuery(uuid: string) {
  return {
    queryKey: ['chess-pgn', uuid],
    queryFn: () => getJson<ChessPgn>(`/games/chess/${uuid}`),
    staleTime: Infinity, // a finished game never changes
  }
}

export function useChessPgn(uuid: string) {
  return useQuery(chessPgnQuery(uuid))
}
