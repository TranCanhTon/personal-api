import { useState, type ReactNode } from 'react'
import { GoalsContext, loadGoals, saveGoals, type Goals } from '../lib/goals'

export function GoalsProvider({ children }: { children: ReactNode }) {
  const [goals, setState] = useState<Goals>(loadGoals)
  const setGoals = (g: Goals) => {
    setState(g)
    saveGoals(g)
  }
  return <GoalsContext.Provider value={{ goals, setGoals }}>{children}</GoalsContext.Provider>
}
