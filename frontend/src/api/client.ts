import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { components } from './schema'

// Types come from the FastAPI OpenAPI schema. Regenerate with `npm run gen:api`.
export type Day = components['schemas']['Day']
export type Fitness = components['schemas']['Fitness']
export type Sleep = components['schemas']['SleepOut']
export type Workout = components['schemas']['WorkoutOut']

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`)
  return res.json() as Promise<T>
}

/** Every day in [start, end], including days with no data. Refreshes every minute and on tab focus. */
export function useDays(start: string, end: string) {
  return useQuery({
    queryKey: ['days', start, end],
    queryFn: () => getJson<Day[]>(`/days?start=${start}&end=${end}`),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}
