import { createContext, useContext } from 'react'

export type Goals = {
  steps: number | null
  caloriesIn: number | null
  proteinG: number | null
  sleepHours: number | null
}

export const DEFAULT_GOALS: Goals = { steps: 10_000, caloriesIn: 2_500, proteinG: 150, sleepHours: 8 }

const KEY = 'goals'

// Goals are saved in this browser only, so each device keeps its own.
export function loadGoals(): Goals {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_GOALS, ...(JSON.parse(raw) as Partial<Goals>) }
  } catch {
    /* storage blocked or bad JSON: use defaults */
  }
  return DEFAULT_GOALS
}

export function saveGoals(goals: Goals) {
  try {
    localStorage.setItem(KEY, JSON.stringify(goals))
  } catch {
    /* storage blocked: goals last until reload */
  }
}

export type GoalsValue = { goals: Goals; setGoals: (g: Goals) => void }
export const GoalsContext = createContext<GoalsValue | null>(null)

export function useGoals(): GoalsValue {
  const ctx = useContext(GoalsContext)
  if (!ctx) throw new Error('useGoals must be used inside GoalsProvider')
  return ctx
}
