import { createContext, useContext } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Resolved = 'light' | 'dark'

const TOKEN_NAMES = [
  'surface',
  'ink',
  'ink-2',
  'muted',
  'grid',
  'axis',
  'border',
  'wash',
  'series-1',
  'series-2',
  'series-3',
  'stage-deep',
  'stage-core',
  'stage-rem',
  'stage-awake',
  'steps',
  'steps-goal',
] as const

export type Tokens = Record<(typeof TOKEN_NAMES)[number], string>

/** Charts can't use CSS variables directly, so read the resolved values from index.css. */
export function readTokens(): Tokens {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(TOKEN_NAMES.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Tokens
}

export function loadPref(): ThemePref {
  try {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* storage blocked: follow the system */
  }
  return 'system'
}

export function applyPref(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem('theme')
    else localStorage.setItem('theme', pref)
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
}

export type ThemeValue = { pref: ThemePref; setPref: (p: ThemePref) => void; resolved: Resolved; tokens: Tokens }
export const ThemeContext = createContext<ThemeValue | null>(null)

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
