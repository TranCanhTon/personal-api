import { createContext, useContext } from 'react'
import type { GoalsApi } from '../api/client'

export type Goals = {
  steps: number | null
  caloriesIn: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  sleepHours: number | null
  workoutsPerWeek: number | null
}

/** Shown until the saved goals arrive. Matches the backend's defaults. */
export const DEFAULT_GOALS: Goals = {
  steps: 10_000,
  caloriesIn: 2_500,
  proteinG: 150,
  carbsG: 317,
  fatG: 70,
  sleepHours: 8,
  workoutsPerWeek: 4,
}

export function fromApi(g: GoalsApi): Goals {
  return {
    steps: g.steps ?? null,
    caloriesIn: g.calories_in ?? null,
    proteinG: g.protein_g ?? null,
    carbsG: g.carbs_g ?? null,
    fatG: g.fat_g ?? null,
    sleepHours: g.sleep_hours ?? null,
    workoutsPerWeek: g.workouts_per_week ?? null,
  }
}

export function toApi(g: Goals): GoalsApi {
  return {
    steps: g.steps,
    calories_in: g.caloriesIn,
    protein_g: g.proteinG,
    carbs_g: g.carbsG,
    fat_g: g.fatG,
    sleep_hours: g.sleepHours,
    workouts_per_week: g.workoutsPerWeek,
  }
}

/** Saving state for the Goals panel */
export type SaveState = 'idle' | 'saving' | 'saved' | 'bad-key' | 'error'

export type GoalsValue = {
  goals: Goals
  setGoals: (g: Goals) => void
  saveState: SaveState
  /** Whether an API key is stored on this device */
  hasKey: boolean
  setApiKey: (key: string) => void
}
export const GoalsContext = createContext<GoalsValue | null>(null)

export function useGoals(): GoalsValue {
  const ctx = useContext(GoalsContext)
  if (!ctx) throw new Error('useGoals must be used inside GoalsProvider')
  return ctx
}
