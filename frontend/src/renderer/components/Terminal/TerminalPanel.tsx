import { useRef, useEffect } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const ANSI_COLORS: Record<string, string> = {
  '30': '#666666', '31': '#f44747', '32': '#4ec9b0', '33': '#cca700',
  '34': '#569cd6', '35': '#c586c0', '36': '#9cdcfe', '37': '#d4d4d4',
  '90': '#808080', '91': '#f44747', '92': '#4ec9b0', '93': '#dcdcaa',
  '94': '#569cd6', '95': '#d2a8ff', '96': '#9cdcfe', '97': '#ffffff',
}

function parseAnsi(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\x1b\[([0-9;]*)m/g
  let last = 0
  let style: React.CSSProperties = {}
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={last} style={style}>{text.slice(last, match.index)}</span>
      )
    }
    const codes = match[1].split(';')
    for (const code of codes) {
      if (!code || code === '0') { style = {}; continue }
      if (code === '1') { style = { ...style, fontWeight: 'bold' }; continue }
      if (code === '3') { style = { ...style, fontStyle: 'italic' }; continue }
      if (code === '4') { style = { ...style, textDecoration: 'underline' }; continue }
      if (ANSI_COLORS[code]) { style = { ...style, color: ANSI_COLORS[code] }; continue }
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(<span key={last} style={style}>{text.slice(last)}</span>)
  }
  return parts
}

function TerminalLine({ line }: { line: string }) {
  const nodes = parseAnsi(line)

  // Color special REPL lines
  const isPrompt = line.startsWith('>>>')
  const isRun = line.startsWith('>>> %Run')
  const isReboot = line.includes('MPY: soft reboot') || line.includes('soft reboot')
  const isError = line.includes('Error') || line.includes('Traceback')

  let lineStyle: React.CSSProperties = { lineHeight: '18px', minHeight: 18 }
  if (isRun) lineStyle.color = '#569cd6'
  else if (isReboot) lineStyle.color = '#cca700'
  else if (isError) lineStyle.color = '#f44747'
  else if (isPrompt) lineStyle.color = '#4ec9b0'

  return (
    <div style={lineStyle}>
      {nodes.length ? nodes : <span>{'\u200B'}</span>}
    </div>
  )
}

export default function TerminalPanel() {
  const {
    terminals, activeTerminalId, setActiveTerminal,
    addTerminal, closeTerminal,
    addTerminalLine, clearTerminal,
    isConnected,
  } = useAppStore()

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [activeTerminal?.lines])

  function handleCommand(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const cmd = (e.currentTarget as HTMLInputElement).value
    ;(e.currentTarget as HTMLInputElement).value = ''
    if (!cmd.trim() && cmd !== '') return

    addTerminalLine(activeTerminalId, `>>> ${cmd}`)

    if (cmd === 'help' || cmd === 'help()') {
      addTerminalLine(activeTerminalId, "Type Python commands or use 'clear' to clear the terminal")
      addTerminalLine(activeTerminalId, ">>>" )
    } else if (cmd === 'clear') {
      clearTerminal(activeTerminalId)
    } else if (cmd.trim()) {
      addTerminalLine(activeTerminalId, `... (send to device via backend serial connection)`)
      addTerminalLine(activeTerminalId, ">>>" )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Terminal tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        height: 32,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          {terminals.map((t) => (
            <div
              key={t.id}
              className={`terminal-tab ${t.id === activeTerminalId ? 'active' : ''}`}
              onClick={() => setActiveTerminal(t.id)}
            >
              <span>{t.name}</span>
              <button
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', display: 'flex', padding: 1,
                  marginLeft: 4, borderRadius: 2,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(t.id)
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', gap: 2, borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="icon-btn" title="New Terminal" onClick={addTerminal} style={{ width: 22, height: 22 }}>
            <Plus size={13} />
          </button>
          <button
            className="icon-btn"
            title="Clear Terminal"
            onClick={() => activeTerminal && clearTerminal(activeTerminal.id)}
            style={{ width: 22, height: 22 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        className="terminal-area"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {activeTerminal?.lines.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}

        {/* REPL input line */}
        {isConnected && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
            <span style={{
              color: '#4ec9b0',
              marginRight: 4,
              fontFamily: 'var(--font-code)',
              fontSize: 13,
              userSelect: 'none',
            }}>
              &gt;&gt;&gt;
            </span>
            <input
              ref={inputRef}
              type="text"
              onKeyDown={handleCommand}
              autoFocus
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                flex: 1,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-code)',
                fontSize: 13,
                lineHeight: '18px',
                caretColor: 'var(--text-primary)',
              }}
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}