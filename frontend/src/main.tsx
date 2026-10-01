import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/unbounded'
import './index.css'
import { GoalsProvider } from './providers/GoalsProvider.tsx'
import { ThemeProvider } from './providers/ThemeProvider.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GoalsProvider>
          <App />
        </GoalsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
