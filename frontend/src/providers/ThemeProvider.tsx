import { useState, type ReactNode } from 'react'
import { readTokens, ThemeContext } from '../lib/theme'

/** Dark only: the colour tokens are read once from index.css. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tokens] = useState(readTokens)
  return <ThemeContext.Provider value={{ tokens }}>{children}</ThemeContext.Provider>
}
