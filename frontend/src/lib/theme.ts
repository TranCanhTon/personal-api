import { createContext, useContext } from 'react'

const TOKEN_NAMES = [
  'surface',
  'ink',
  'ink-2',
  'muted',
  'grid',
  'axis',
  'border',
  'wash',
  'calories',
  'steps',
  'steps-goal',
  'heart',
  'heart-2',
  'protein',
  'carbs',
  'fat',
  'schedule',
  'stage-deep',
  'stage-core',
  'stage-rem',
  'stage-awake',
  'fitness',
  'sleep',
  'chess',
  'win',
  'loss',
] as const

export type Tokens = Record<(typeof TOKEN_NAMES)[number], string>

/** Charts can't use CSS variables directly, so read the resolved values from index.css. */
export function readTokens(): Tokens {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKEN_NAMES.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Tokens
}

export type ThemeValue = { tokens: Tokens }
export const ThemeContext = createContext<ThemeValue | null>(null)

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
