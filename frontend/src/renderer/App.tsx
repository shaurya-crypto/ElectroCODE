import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import APISetup from './components/Setup/APISetup'
import EditorPage from './pages/EditorPage'

export default function App() {
  const { setupComplete, theme } = useAppStore()

  // Apply persisted theme on startup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  if (!setupComplete) return <APISetup />

  return <EditorPage />
}