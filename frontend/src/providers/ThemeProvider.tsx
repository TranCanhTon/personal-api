import { useEffect, useState, type ReactNode } from 'react'
import { applyPref, loadPref, readTokens, ThemeContext, type Resolved, type ThemePref } from '../lib/theme'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(loadPref)
  const [systemDark, setSystemDark] = useState(media.matches)

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const setPref = (p: ThemePref) => {
    // Set the attribute before re-rendering so readTokens() below sees the new colours
    applyPref(p)
    setPrefState(p)
  }

  const resolved: Resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  // Re-read the colours whenever the resolved theme flips; by then the CSS variables have already switched
  const [palette, setPalette] = useState(() => ({ resolved, tokens: readTokens() }))
  if (palette.resolved !== resolved) setPalette({ resolved, tokens: readTokens() })

  return (
    <ThemeContext.Provider value={{ pref, setPref, resolved, tokens: palette.tokens }}>{children}</ThemeContext.Provider>
  )
}
