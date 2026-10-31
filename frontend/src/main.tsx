import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setAPIKey } from '@/api/client'
import './index.css'
import App from './App.tsx'

try {
  const response = await fetch('/api/config')
  if (response.ok) {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'apiKey' in body && typeof body.apiKey === 'string') {
      setAPIKey(body.apiKey)
    }
  }
} catch {
  // Slot and booking requests report the failure if the key never loads.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
