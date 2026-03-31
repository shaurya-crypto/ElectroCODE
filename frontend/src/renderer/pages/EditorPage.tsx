import { useCallback, useRef, useEffect, useState } from 'react'
import { Files, Cpu, Settings, Bot, ChevronDown, ChevronUp, GitBranch, AlertTriangle, Circle } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { subscribeToMcp } from '../store/mcpClient'
import MenuBar from '../components/MenuBar/MenuBar'
import FileExplorer from '../components/Sidebar/FileExplorer'
import DevicePanel from '../components/Sidebar/DevicePanel'
import EditorTabs from '../components/Editor/EditorTabs'
import CodeEditor from '../components/Editor/CodeEditor'
import AIPanel from '../components/AI/AIPanel'
import TerminalPanel from '../components/Terminal/TerminalPanel'
import SettingsPanel from '../components/Settings/SettingsPanel'
import InterpreterModal from '../components/Setup/InterpreterModal'

export default function EditorPage() {
  const {
    sidebarView, setSidebarView, sidebarWidth, setSidebarWidth,
    aiPanelOpen, aiPanelWidth, setAiPanelWidth,
    terminalOpen, setTerminalOpen, terminalHeight, setTerminalHeight,
    interpreter, isConnected, selectedPort,
    tabs, activeTabId,
    settingsOpen, setSettingsOpen,
    interpreterModalOpen, setInterpreterModalOpen,
    theme,
    notification, clearNotification,
    newUntitledTab, saveTab, showNotification,
    promptConfig, resolvePrompt,
  } = useAppStore()

  // Internal Prompt State
  const [promptValue, setPromptValue] = useState('')
  useEffect(() => {
    if (promptConfig) {
      setPromptValue(promptConfig.defaultValue || '')
    }
  }, [promptConfig])

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isDirty = activeTab ? activeTab.content !== activeTab.savedContent : false

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Bind MCP Live Anomaly Detectors
  useEffect(() => {
    subscribeToMcp('anomaly_detected', (anomalyMsg) => {
      useAppStore.getState().showNotification(`Hardware Alert: ${anomalyMsg}`, 'error')
      // Auto-open AI panel to explain it
      const store = useAppStore.getState()
      if (!store.aiPanelOpen) store.toggleAiPanel()
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); newUntitledTab() }
        if (e.key === 's' && !e.shiftKey) { e.preventDefault(); if (activeTabId) { saveTab(activeTabId) } }
        if (e.key === 'b') { e.preventDefault(); setSidebarView(sidebarView ? null : 'explorer') }
        if (e.key === '`') { e.preventDefault(); setTerminalOpen(!terminalOpen) }
        if (e.key === 'a' && e.shiftKey) { e.preventDefault(); useAppStore.getState().toggleAiPanel() }
        if (e.key === ',') { e.preventDefault(); setSettingsOpen(true) }
      }
      if (e.key === 'F5') { e.preventDefault()
        const store = useAppStore.getState()
        if (store.isFlashing) {
          store.showNotification('Upload already in progress...', 'warning')
          return
        }
        if (!store.isConnected || !store.selectedPort || !store.interpreter) {
          store.showNotification('Not connected to a device. Please select a port.', 'error')
          return
        }
        if (activeTab) {
          store.setIsFlashing(true)
          store.addTerminalLine(store.activeTerminalId, `Running ${activeTab.name}...`)
          store.setTerminalOpen(true)
          
          window.electronAPI.flash({
            code: activeTab.content,
            port: store.selectedPort,
            language: store.interpreter.language,
            boardId: store.interpreter.id
          }).then(response => {
            store.setIsFlashing(false)
            if (response.success) {
              window.electronAPI.startMonitor({ port: store.selectedPort! })
            } else {
              store.addTerminalLine(store.activeTerminalId, `❌ Error: ${response.message}`)
            }
          }).catch(err => {
            store.setIsFlashing(false)
            store.addTerminalLine(store.activeTerminalId, `❌ Error: ${err.message || String(err)}`)
          })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTabId, terminalOpen, sidebarView, isConnected, activeTab])

  // Sidebar resize
  const sidebarDragging = useRef(false)
  const onSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    sidebarDragging.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (ev: MouseEvent) => {
      if (!sidebarDragging.current) return
      setSidebarWidth(startW + ev.clientX - startX)
    }
    const onUp = () => {
      sidebarDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  // AI panel resize
  const aiDragging = useRef(false)
  const onAiResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    aiDragging.current = true
    const startX = e.clientX
    const startW = aiPanelWidth
    const onMove = (ev: MouseEvent) => {
      if (!aiDragging.current) return
      setAiPanelWidth(startW - (ev.clientX - startX))
    }
    const onUp = () => {
      aiDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [aiPanelWidth])

  // Terminal resize
  const termDragging = useRef(false)
  const onTermResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    termDragging.current = true
    const startY = e.clientY
    const startH = terminalHeight
    const onMove = (ev: MouseEvent) => {
      if (!termDragging.current) return
      setTerminalHeight(startH - (ev.clientY - startY))
    }
    const onUp = () => {
      termDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [terminalHeight])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* ── Title bar (draggable) ── */}
      <div className="titlebar" style={{
        height: 30, flexShrink: 0,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 16, height: 16,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 800, color: 'white',
          }}>
            EC
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {activeTab
              ? `${activeTab.name}${isDirty ? ' \u25cf' : ''} — Electro CODE`
              : 'Electro CODE'}
          </span>
        </div>
      </div>

      {/* ── Menu bar ── */}
      <MenuBar />

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Activity bar ── */}
        <div className="activity-bar">
          {[
            { id: 'explorer', icon: <Files size={22} />, title: 'Explorer (Ctrl+B)' },
            { id: 'device',   icon: <Cpu size={22} />,   title: 'Device & Port' },
          ].map(({ id, icon, title }) => (
            <button
              key={id}
              className={`activity-btn ${sidebarView === id ? 'active' : ''}`}
              title={title}
              onClick={() => setSidebarView(sidebarView === id ? null : id as any)}
            >
              {icon}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button
            className={`activity-btn ${aiPanelOpen ? 'active' : ''}`}
            title="AI Assistant (Ctrl+Shift+A)"
            onClick={() => useAppStore.getState().toggleAiPanel()}
            style={{ marginBottom: 0 }}
          >
            <Bot size={22} />
          </button>

          <button
            className="activity-btn"
            title="Settings (Ctrl+,)"
            onClick={() => setSettingsOpen(true)}
            style={{ marginBottom: 4 }}
          >
            <Settings size={20} />
          </button>
        </div>

        {/* ── Sidebar ── */}
        {sidebarView && (
          <>
            <div
              className="sidebar"
              style={{ width: sidebarWidth }}
            >
              {sidebarView === 'explorer' && <FileExplorer />}
              {sidebarView === 'device'   && <DevicePanel />}
            </div>
            <div className="resize-x" onMouseDown={onSidebarResize} />
          </>
        )}

        {/* ── Editor + Terminal column ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Tab bar */}
          <EditorTabs />

          {/* Editor */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <CodeEditor />
          </div>

          {/* Terminal resize handle */}
          {terminalOpen && (
            <div className="resize-y" onMouseDown={onTermResize} />
          )}

          {/* Terminal */}
          <div style={{
            flexShrink: 0,
            height: terminalOpen ? terminalHeight : 0,
            borderTop: terminalOpen ? '1px solid var(--border)' : 'none',
            overflow: 'hidden',
            background: 'var(--bg-base)',
          }}>
            {terminalOpen && <TerminalPanel />}
          </div>
        </div>

        {/* AI panel resize */}
        {aiPanelOpen && <div className="resize-x" onMouseDown={onAiResize} />}

        {/* AI panel */}
        {aiPanelOpen && (
          <div style={{ width: aiPanelWidth, flexShrink: 0, overflow: 'hidden' }}>
            <AIPanel />
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="statusbar">
        {/* Left */}
        <div className="statusbar-item" onClick={() => setSidebarView(sidebarView === 'device' ? null : 'device')} title="Device">
          <Cpu size={12} />
          <span>{interpreter ? interpreter.label : 'No Interpreter'}</span>
        </div>

        <div className="statusbar-item" title="Connection">
          <Circle size={7} fill={isConnected ? '#4ec9b0' : '#666'} stroke="none" />
          <span>{isConnected ? selectedPort ?? 'Connected' : 'Not Connected'}</span>
        </div>

        {interpreter && (
          <div className="statusbar-item" title="Language">
            <span>{interpreter.langDisplay}</span>
          </div>
        )}

        {!interpreter && (
          <div className="statusbar-item" style={{ color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
            onClick={() => setInterpreterModalOpen(true)} title="Select Interpreter">
            <AlertTriangle size={11} />
            <span>Select Interpreter</span>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right */}
        {activeTab && (
          <>
            <div className="statusbar-item">
              <span>{activeTab.language.toUpperCase()}</span>
            </div>
            <div className="statusbar-item">
              <GitBranch size={11} />
              <span>main</span>
            </div>
            {isDirty && (
              <div className="statusbar-item" title="Unsaved changes">
                <span>Modified</span>
              </div>
            )}
          </>
        )}

        <div
          className="statusbar-item"
          onClick={() => setTerminalOpen(!terminalOpen)}
          title="Toggle Terminal (Ctrl+`)"
        >
          {terminalOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          <span>Terminal</span>
        </div>
      </div>

      {/* ── Overlays ── */}
      {settingsOpen && <SettingsPanel />}
      {interpreterModalOpen && <InterpreterModal />}

      {/* ── Notification ── */}
      {notification && (
        <div
          className="notification anim-fade"
          style={{
            borderLeftColor:
              notification.type === 'success' ? 'var(--green)' :
              notification.type === 'error'   ? 'var(--red)'   :
              notification.type === 'warning' ? 'var(--yellow)' :
              'var(--accent)',
          }}
          onClick={clearNotification}
        >
          {notification.msg}
        </div>
      )}

      {/* ── Prompt Modal ── */}
      {promptConfig && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="anim-fade" style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 8, width: 300, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 14 }}>{promptConfig.msg}</h3>
            <input 
              autoFocus
              value={promptValue} 
              onChange={e => setPromptValue(e.target.value)} 
              style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginBottom: 15, background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4 }}
              onKeyDown={e => {
                if (e.key === 'Enter') resolvePrompt(promptValue)
                if (e.key === 'Escape') resolvePrompt(null)
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                 onClick={() => resolvePrompt(null)} 
                 style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                 onClick={() => resolvePrompt(promptValue)} 
                 style={{ padding: '6px 12px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}