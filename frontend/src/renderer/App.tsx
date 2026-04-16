import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore'
import LoginScreen from './components/Setup/APISetup'
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

      // Stagger device connection — give 5 seconds for device to settle after app launch
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

              // Auto-fetch device files after successful connection
              setTimeout(async () => {
                try {
                  const store = useAppStore.getState();
                  if (store.isConnected && store.fetchDeviceFiles) {
                    console.log('[Auto-Init] Fetching device files...');
                    await store.fetchDeviceFiles();
                  }
                } catch (e) {
                  console.warn('[Auto-Init] Could not fetch device files:', e);
                }
              }, 1500);

              // Auto-start serial monitor for REPL
              setTimeout(async () => {
                try {
                  const store = useAppStore.getState();
                  if (store.isConnected && store.selectedPort) {
                    console.log('[Auto-Init] Starting serial monitor...');
                    await (window as any).electronAPI.startMonitor({ port: store.selectedPort });
                  }
                } catch (e) {
                  console.warn('[Auto-Init] Could not start monitor:', e);
                }
              }, 3500);
            } else {
              setConnected(false);
              currentStore.showErrorOverlay(check?.message ?? `Port ${currentStore.selectedPort} is busy or disconnected.`)
              console.warn(`[Auto-Init] Port ${currentStore.selectedPort} busy or disconnected.`);
            }
          } catch (e: any) {
            setConnected(false);
            currentStore.showErrorOverlay(`Fatal Error: ${e.message}`);
            console.warn(`[Auto-Init] Connection check failed: ${e.message}`);
          }
        }
      }, 5000);
    }
  }, [])

  if (!setupComplete) return <LoginScreen />

  return <EditorPage />
}