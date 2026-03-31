import { useState, useRef, useEffect } from 'react'
import { X, Circle, Play, Square, Save, HardDrive, Cpu } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { FileIcon } from '../../utils/Fileicon'

export default function EditorTabs() {
  const { 
    tabs, activeTabId, setActiveTab, closeTab, saveTab, showNotification,
    isConnected, selectedPort, interpreter, addTerminalLine, setTerminalOpen, 
    activeTerminalId, clearTerminal, isFlashing, setIsFlashing
  } = useAppStore()

  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const saveBtnRef = useRef<HTMLButtonElement>(null)

  // no need for click outside listener for a full modal with cancel button

  if (tabs.length === 0) return (
    <div
      className="tabs-bar"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--tab-inactive)' }}
    />
  )

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const handleRun = async () => {
    if (!isConnected || !selectedPort || !interpreter) {
      showNotification('Not connected to a device. Please select a port.', 'error')
      return
    }
    if (!activeTab || isFlashing) return
    
    clearTerminal(activeTerminalId)
    setTerminalOpen(true)
    setIsFlashing(true)

    // REPL-like headers
    addTerminalLine(activeTerminalId, `>>> %Run -c $EDITOR_CONTENT`)
    addTerminalLine(activeTerminalId, '')
    addTerminalLine(activeTerminalId, 'MPY: soft reboot')
    addTerminalLine(activeTerminalId, '')

    try {
      const response = await (window as any).electronAPI.flash({
        code: activeTab.content,
        port: selectedPort,
        language: interpreter.language,
        boardId: interpreter.id,
      })

      if (response.success) {
        // Start monitoring for live output
        await (window as any).electronAPI.startMonitor({ port: selectedPort })
      } else {
        addTerminalLine(activeTerminalId, `Traceback (most recent call last):`)
        addTerminalLine(activeTerminalId, `  ${response.message}`)
      }
    } catch (err: any) {
      addTerminalLine(activeTerminalId, `Error: ${err.message || String(err)}`)
    } finally {
      setIsFlashing(false)
      // Show prompt when execution finishes
      addTerminalLine(activeTerminalId, '')
      addTerminalLine(activeTerminalId, '>>>')
    }
  }

  const handleStop = async () => {
    if (!isConnected) return
    try {
      await (window as any).electronAPI.stopMonitor()
      addTerminalLine(activeTerminalId, '')
      addTerminalLine(activeTerminalId, 'KeyboardInterrupt')
      addTerminalLine(activeTerminalId, '>>>')
      setIsFlashing(false)
    } catch {}
  }

  const saveToDevice = async () => {
    setShowSavePrompt(false)
    if (!activeTab) return
    if (!isConnected || !selectedPort) {
      showNotification('Not connected to a device.', 'error')
      return
    }
    
    // Prompt for filename if it's the first save, or let them change it
    const defaultName = activeTab.filePath?.startsWith('/') ? activeTab.filePath.replace('/', '') : activeTab.name
    const name = await useAppStore.getState().showPrompt(`Save to ${interpreter?.label} as:`, defaultName)
    if (!name) return // Cancelled
    
    const devPath = name.startsWith('/') ? name : `/${name}`
    
    const fileExists = useAppStore.getState().deviceFileTree?.[0]?.children?.some((f: any) => f.filePath === devPath || f.name === name.replace(/^\//, ''))
    if (fileExists) {
      addTerminalLine(activeTerminalId, `\x1b[33m⚠ Warning: File "${name}" already exists on device. Overwriting...\x1b[0m`)
    }

    addTerminalLine(activeTerminalId, `> Saving ${devPath} to device...`)
    setTerminalOpen(true)
    
    // Pause serial monitor so we can safely write
    await (window as any).electronAPI.stopMonitor()
    
    const response = await (window as any).electronAPI.writeFile({
      port: selectedPort,
      filePath: devPath,
      content: activeTab.content
    })
    
    if (response.success) {
      // Update tab meta to reflect new device file path and source
      useAppStore.getState().updateTabMeta(activeTab.id, { 
        name: name.split('/').pop() || name, 
        filePath: devPath,
        source: 'device' 
      })
      saveTab(activeTab.id)
      showNotification('Saved to device', 'success')
      // Refresh tree
      useAppStore.getState().fetchDeviceFiles()
    } else {
      showNotification(`Failed: ${response.message}`, 'error')
    }
    
    // Resume monitor
    await (window as any).electronAPI.startMonitor({ port: selectedPort, baudRate: 115200 })
  }

  const saveToLocal = async () => {
    setShowSavePrompt(false)
    if (!activeTab) return

    if (activeTab.filePath && activeTab.source !== 'device') {
      try {
        await (window as any).electronAPI.createFile({ filePath: activeTab.filePath, content: activeTab.content })
        saveTab(activeTab.id)
        showNotification('Saved to computer', 'success')
      } catch(e) { showNotification('Failed to save to local', 'error')}
    } else {
      const result = await (window as any).electronAPI.saveFile({ content: activeTab.content })
      if (result?.success && result.filePath) {
        const name = result.filePath.split(/[/\\]/).pop() || 'untitled'
        useAppStore.getState().updateTabMeta(activeTab.id, { name, filePath: result.filePath })
        saveTab(activeTab.id)
        showNotification('Saved to computer', 'success')
      }
    }
  }

  const handleSaveClick = () => {
    if (!activeTab) return
    if (activeTab.source === 'device') {
       saveToDevice()
    } else if (activeTab.source === 'local' && activeTab.filePath && !activeTab.filePath.startsWith('/')) {
       saveToLocal()
    } else {
       setShowSavePrompt(!showSavePrompt)
    }
  }

  return (
    <div className="tabs-bar" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
      <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const isDirty = tab.content !== tab.savedContent

          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => {
                // Save on double-click like VS Code pins tab
                saveTab(tab.id)
                showNotification(`Saved ${tab.name}`, 'success')
              }}
            >
              <FileIcon filename={tab.name} size={13} />

              <span style={{
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
                fontStyle: !tab.filePath ? 'italic' : 'normal',
              }}>
                {tab.name}
              </span>

              {/* Dirty indicator or close button */}
              <span
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isDirty) {
                    // TODO: show save dialog
                    closeTab(tab.id)
                  } else {
                    closeTab(tab.id)
                  }
                }}
              >
                {isDirty
                  ? <Circle size={8} fill="var(--text-muted)" stroke="none" />
                  : <X size={12} color="var(--text-muted)" />
                }
              </span>
            </div>
          )
        })}
      </div>

      {/* Editor Actions Toolbar */}
      <div style={{ display: 'flex', gap: 4, padding: '0 8px', alignItems: 'center' }}>
        <button 
          className="btn-icon" 
          onClick={handleRun} 
          title="Run Current File"
          style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          <Play size={16} />
        </button>
        <button 
          className="btn-icon" 
          onClick={handleStop} 
          title="Stop Execution"
          style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4f', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          <Square size={16} />
        </button>
        <div style={{ position: 'relative' }}>
          <button 
            ref={saveBtnRef}
            className="btn-icon" 
            onClick={handleSaveClick} 
            title="Save / Deploy"
            style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* The Centered Save Modal Overlay */}
      {showSavePrompt && (
        <div style={{
           position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
           display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)'
        }}>
           <div className="anim-fade" style={{
               background: 'var(--surface)', padding: 24, borderRadius: 8, maxWidth: 400, width: '100%',
               boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid var(--border)'
           }}>
              <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={18} color="var(--accent)" /> Save File: {activeTab?.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Where would you like to save this file?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <button onClick={saveToLocal} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 6,
                    background: 'var(--tab-inactive)', border: '1px solid var(--border)', cursor: 'pointer',
                    color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500
                 }}>
                    <HardDrive size={18} color="var(--text-primary)" />
                    <div style={{ flex: 1 }}>
                      <div>Save to Computer</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Save to a folder on your local drive</div>
                    </div>
                 </button>
                 
                 <button onClick={saveToDevice} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 6,
                    background: 'var(--tab-inactive)', border: '1px solid var(--border)', cursor: 'pointer',
                    color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500
                 }}>
                    <Cpu size={18} color="var(--accent)" />
                    <div style={{ flex: 1 }}>
                      <div>Save to {interpreter?.label || 'Chip'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Deploy directly to the connected chip</div>
                    </div>
                 </button>
              </div>
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                 <button onClick={() => setShowSavePrompt(false)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 12px'
                 }}>Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}