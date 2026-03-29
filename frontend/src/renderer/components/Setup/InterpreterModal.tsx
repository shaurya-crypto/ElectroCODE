import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore, ALL_INTERPRETERS, Interpreter } from '../../store/useAppStore'

const FILTER_OPTIONS = ['All', 'Raspberry Pi', 'ESP', 'Arduino', 'Other']

export default function InterpreterModal() {
  const { setInterpreterModalOpen, interpreter, setInterpreter, showNotification } = useAppStore()
  const [selected, setSelected] = useState<Interpreter | null>(interpreter)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = ALL_INTERPRETERS.filter((i) => {
    const matchSearch = !search || i.label.toLowerCase().includes(search.toLowerCase()) || i.chip.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'All') return true
    if (filter === 'Raspberry Pi') return i.chip.startsWith('RP')
    if (filter === 'ESP') return i.chip.startsWith('ESP')
    if (filter === 'Arduino') return i.chip.startsWith('ATmega') || i.chip.startsWith('ATmega')
    if (filter === 'Other') return !i.chip.startsWith('RP') && !i.chip.startsWith('ESP') && !i.chip.startsWith('ATmega')
    return true
  })

  function confirm() {
    setInterpreter(selected)
    setInterpreterModalOpen(false)
    if (selected) {
      showNotification(`Interpreter set: ${selected.label} (${selected.langDisplay})`, 'success')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-header">
          <span>Select Interpreter</span>
          <button className="icon-btn" onClick={() => setInterpreterModalOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Select the board and runtime you are programming for. This sets the language mode and enables device-specific upload.
          </p>

          {/* Search */}
          <input
            className="form-input"
            placeholder="Search boards..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 10 }}
            autoFocus
          />

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 10px',
                  border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: filter === f ? 'var(--accent-dim)' : 'transparent',
                  color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  borderRadius: 'var(--radius)',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* List */}
          <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No boards match your search
              </div>
            )}
            {filtered.map((interp) => (
              <div
                key={interp.id}
                onClick={() => setSelected(interp)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: selected?.id === interp.id ? 'var(--accent-dim)' : 'transparent',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  if (selected?.id !== interp.id)
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (selected?.id !== interp.id)
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {/* Selection indicator */}
                <div style={{
                  width: 14, height: 14, border: `1px solid ${selected?.id === interp.id ? 'var(--accent)' : 'var(--border-light)'}`,
                  borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected?.id === interp.id && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: selected?.id === interp.id ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {interp.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {interp.description}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11, padding: '1px 7px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-code)',
                  }}>
                    {interp.chip}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{interp.langDisplay}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Selected info */}
          {selected && (
            <div style={{
              marginTop: 12, padding: '8px 12px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              fontSize: 12,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Selected: </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {selected.label}
              </span>
              <span style={{ color: 'var(--text-muted)' }}> — {selected.langDisplay} on {selected.chip}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => { setInterpreter(null); setInterpreterModalOpen(false) }}
          >
            Clear Selection
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setInterpreterModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={confirm}>OK</button>
          </div>
        </div>
      </div>
    </div>
  )
}