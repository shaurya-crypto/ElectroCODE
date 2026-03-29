import { useState } from 'react'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export default function UploadButton() {
  const { isConnected, selectedDevice, activeTabId, tabs, addTerminalLine } = useAppStore()
  const [state, setState] = useState<UploadState>('idle')
  const activeTab = tabs.find(t => t.id === activeTabId)

  async function handleUpload() {
    if (!isConnected || !activeTab) return
    setState('uploading')
    addTerminalLine('\x1b[36m Uploading ' + activeTab.name + '...\x1b[0m')

    // Simulate upload
    await new Promise(r => setTimeout(r, 1800))

    const success = Math.random() > 0.1 // 90% success rate in demo
    if (success) {
      setState('success')
      addTerminalLine('\x1b[32m✓ Uploaded successfully to ' + (selectedDevice ?? 'device') + '\x1b[0m')
      addTerminalLine('\x1b[90mRunning ' + activeTab.name + '...\x1b[0m')
      addTerminalLine('\x1b[36m>>> \x1b[0m')
    } else {
      setState('error')
      addTerminalLine('\x1b[31m✗ Upload failed. Check connection.\x1b[0m')
    }
    setTimeout(() => setState('idle'), 3000)
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
