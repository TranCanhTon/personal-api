import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { putGoals, useGoalsQuery, type GoalsApi } from '../api/client'
import { DEFAULT_GOALS, fromApi, GoalsContext, toApi, type Goals, type SaveState } from '../lib/goals'

const KEY_STORAGE = 'apiKey'
const SAVE_DELAY_MS = 600

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return '' // storage blocked: the key lasts until reload
  }
}

/** Goals live in the backend. Edits show at once, then save a moment after you stop typing. */
export function GoalsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data } = useGoalsQuery()
  const [apiKey, setKeyState] = useState(loadKey)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<Goals | null>(null)

  const goals = useMemo(() => (data ? fromApi(data) : DEFAULT_GOALS), [data])

  const save = useCallback(
    async (g: Goals, key: string) => {
      if (!key) return setSaveState('bad-key')
      setSaveState('saving')
      try {
        queryClient.setQueryData<GoalsApi>(['goals'], await putGoals(toApi(g), key))
        setSaveState('saved')
      } catch (e) {
        if (e instanceof Error && e.message === 'key') return setSaveState('bad-key') // keep the edit, the key needs fixing
        setSaveState('error')
        void queryClient.invalidateQueries({ queryKey: ['goals'] }) // fall back to what the server has
      }
    },
    [queryClient],
  )

  const setGoals = useCallback(
    (g: Goals) => {
      queryClient.setQueryData<GoalsApi>(['goals'], toApi(g))
      pending.current = g
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        pending.current = null
        void save(g, apiKey)
      }, SAVE_DELAY_MS)
    },
    [queryClient, save, apiKey],
  )

  const setApiKey = useCallback(
    (key: string) => {
      const trimmed = key.trim()
      setKeyState(trimmed)
      try {
        localStorage.setItem(KEY_STORAGE, trimmed)
      } catch {
        /* storage blocked */
      }
      // A key typed after an edit that couldn't be saved: save it now
      if (trimmed && pending.current === null && saveState === 'bad-key') void save(goals, trimmed)
    },
    [goals, save, saveState],
  )

  useEffect(() => () => clearTimeout(timer.current), [])

  return <GoalsContext.Provider value={{ goals, setGoals, saveState, hasKey: apiKey !== '', setApiKey }}>{children}</GoalsContext.Provider>
}
