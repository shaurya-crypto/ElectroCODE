import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import APISetup from './components/Setup/APISetup'
import EditorPage from './pages/EditorPage'

export default function App() {
  const {
    setupComplete, theme,
    openedFolderPath, openFolder,
    setConnected,
    showNotification
  } = useAppStore()

  // Apply persisted theme on startup
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)

    // 🔥 STARTUP MEMORY: Auto-restore last session
    if (setupComplete) {
      if (openedFolderPath) {
        openFolder(openedFolderPath);
      }

      // Stagger device connection to avoid startup port contention
      setTimeout(async () => {
        const currentStore = useAppStore.getState();
        if (currentStore.selectedPort && currentStore.interpreter) {
          // 🛡️ Safety: Don't auto-check if we somehow already started an action
          if (currentStore.isDeviceBusy) return;

          console.log(`[Auto-Init] Verifying connection to ${currentStore.selectedPort}...`);
          try {
            const check = await (window as any).electronAPI.checkChip({ port: currentStore.selectedPort });
            if (check && check.connected) {
              setConnected(true);
              showNotification(`Resumed session: ${currentStore.interpreter.label} on ${currentStore.selectedPort}`, 'info');
            } else {
              setConnected(false);
              currentStore.showErrorOverlay(check?.message ?? `Port ${currentStore.selectedPort} is busy or disconnected.`);
              console.warn(`[Auto-Init] Port ${currentStore.selectedPort} busy or disconnected.`);
            }
          } catch (e: any) {
            setConnected(false);
            currentStore.showErrorOverlay(`Fatal Error: ${e.message}`);
          }
        }
      }, 2000);
    }
  }, [])

  if (!setupComplete) return <APISetup />

  return <EditorPage />
}