import { useRef } from 'react'
import { X, Circle, Play, Square, Save, HardDrive, Cpu } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { FileIcon } from '../../utils/Fileicon'

export default function EditorTabs() {
  const { 
    tabs, activeTabId, setActiveTab, closeTab, saveTab, showNotification,
    interpreter, runExecution, stopExecution,
    savePromptOpen, setSavePromptOpen, handleSaveClick, saveToLocal, saveToDevice
  } = useAppStore()

  const saveBtnRef = useRef<HTMLButtonElement>(null)

  // no need for click outside listener for a full modal with cancel button

  if (tabs.length === 0) return (
    <div
      className="tabs-bar"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}
    />
  )

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const handleRun = async () => {
    await runExecution()
  }

  const handleStop = async () => {
    await stopExecution()
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
          style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s ease' }}
        >
          <Play size={16} />
        </button>
        <button 
          className="btn-icon" 
          onClick={handleStop} 
          title="Stop Execution"
          style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s ease' }}
        >
          <Square size={16} />
        </button>
        <div style={{ position: 'relative' }}>
          <button 
            ref={saveBtnRef}
            className="btn-icon" 
            onClick={handleSaveClick} 
            title="Save / Deploy"
            style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* The Centered Save Modal Overlay */}
      {savePromptOpen && (
        <div style={{
           position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 9999,
           display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
           <div className="anim-scale-in" style={{
               background: 'var(--bg-elevated)', padding: 24, borderRadius: 'var(--radius-lg)', maxWidth: 400, width: '100%',
               boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)'
           }}>
              <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={18} color="var(--accent)" /> Save File: {activeTab?.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Where would you like to save this file?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <button onClick={saveToLocal} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--radius)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s ease',
                    color: 'var(--text-primary)', textAlign: 'left', fontWeight: 500
                 }}>
                    <HardDrive size={18} color="var(--text-primary)" />
                    <div style={{ flex: 1 }}>
                      <div>Save to Computer</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Save to a folder on your local drive</div>
                    </div>
                 </button>
                 
                 <button onClick={saveToDevice} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--radius)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s ease',
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
                 <button onClick={() => setSavePromptOpen(false)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 12px'
                 }}>Cancel</button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}