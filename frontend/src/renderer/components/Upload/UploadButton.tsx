import { useState } from 'react'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export default function UploadButton() {
  const { isConnected, selectedPort, activeTabId, tabs, addTerminalLine, activeTerminalId } = useAppStore()
  const [state, setState] = useState<UploadState>('idle')
  const activeTab = tabs.find(t => t.id === activeTabId)

  async function handleUpload() {
    if (!isConnected || !activeTab) return
    setState('uploading')
    addTerminalLine(activeTerminalId, '\x1b[36m Uploading ' + activeTab.name + '...\x1b[0m')

    const win = window as any
    const port = selectedPort

    try {
      // Ask for filename
      const defaultName = activeTab.name || 'main.py'
      const fileName = await useAppStore.getState().showPrompt(`Save to ${useAppStore.getState().interpreter?.label || 'Device'} as:`, defaultName)
      
      if (!fileName) {
        setState('idle')
        return
      }

      const devPath = fileName.startsWith('/') ? fileName : `/${fileName}`
      
      const fileExists = useAppStore.getState().deviceFileTree?.[0]?.children?.some((f: any) => f.filePath === devPath || f.name === fileName.replace(/^\//, ''))
      if (fileExists) {
        addTerminalLine(activeTerminalId, `\x1b[33m⚠ Warning: File "${fileName}" already exists on device. Overwriting...\x1b[0m`)
      }

      addTerminalLine(activeTerminalId, `> Uploading ${fileName} to device...`)
      
      const result = await win.electronAPI?.writeFile?.({
        port: port,
        filePath: devPath,
        content: activeTab.content
      })
      
      if (result && result.success) {
        setState('success')
        addTerminalLine(activeTerminalId, `\x1b[32m✓ Uploaded ${fileName} to device.\x1b[0m`)
        // ensure complete tree load before touching monitor
        await useAppStore.getState().fetchDeviceFiles()
      } else {
        setState('error')
        addTerminalLine(activeTerminalId, '\x1b[31m✗ Upload failed: ' + (result?.message || 'Unknown error') + '\x1b[0m')
      }
    } catch (err: any) {
      setState('error')
      addTerminalLine(activeTerminalId, '\x1b[31m✗ Upload failed: ' + err.message + '\x1b[0m')
    } finally {
      await win.electronAPI?.startMonitor?.({ port, baudRate: 115200 })
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const disabled = !isConnected || !activeTab || state === 'uploading'

  const config = {
    idle: { bg: 'var(--accent)', color: '#000', icon: <Upload size={13} />, label: 'Upload' },
    uploading: { bg: 'rgba(0,212,255,0.2)', color: 'var(--accent)', icon: <Loader2 size={13} className="animate-spin" />, label: 'Uploading...' },
    success: { bg: 'rgba(63,185,80,0.15)', color: 'var(--green)', icon: <CheckCircle size={13} />, label: 'Uploaded!' },
    error: { bg: 'rgba(248,81,73,0.15)', color: 'var(--red)', icon: <XCircle size={13} />, label: 'Failed' },
  }[state]

  return (
    <button
      onClick={handleUpload}
      disabled={disabled}
      className="btn-glow"
      style={{
        background: disabled && state === 'idle' ? 'var(--bg-surface)' : config.bg,
        color: disabled && state === 'idle' ? 'var(--text-dim)' : config.color,
        border: state !== 'idle' ? `1px solid ${config.color}40` : 'none',
        opacity: disabled && state === 'idle' ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        minWidth: 110,
        transition: 'all 0.2s',
      }}
    >
      {config.icon}
      {config.label}
    </button>
  )
}
