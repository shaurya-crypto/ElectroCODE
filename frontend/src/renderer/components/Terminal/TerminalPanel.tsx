import { useRef, useEffect, useState, useCallback } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

// ─── ANSI Colour Map ──────────────────────────────────────────────────────────
const ANSI_FG: Record<string, string> = {
  '30': '#4a4a4a', '31': '#f44747', '32': '#4ec9b0', '33': '#cca700',
  '34': '#569cd6', '35': '#c586c0', '36': '#9cdcfe', '37': '#d4d4d4',
  '90': '#808080', '91': '#ff6b6b', '92': '#4ec9b0', '93': '#dcdcaa',
  '94': '#569cd6', '95': '#d2a8ff', '96': '#9cdcfe', '97': '#ffffff',
}
const ANSI_BG: Record<string, string> = {
  '40': '#000000', '41': '#6e0000', '42': '#006400', '43': '#6e5300',
  '44': '#00006e', '45': '#6e006e', '46': '#006e6e', '47': '#d4d4d4',
}

interface TextSegment {
  text: string
  style: React.CSSProperties
}

function parseAnsi(raw: string): TextSegment[] {
  const segments: TextSegment[] = []
  const regex = /\x1b\[([0-9;]*)m/g
  let lastIndex = 0
  let style: React.CSSProperties = {}
  let match: RegExpExecArray | null

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, match.index), style: { ...style } })
    }
    const codes = match[1] ? match[1].split(';') : ['0']
    for (const code of codes) {
      if (!code || code === '0') { style = {}; continue }
      if (code === '1')  { style = { ...style, fontWeight: 'bold' }; continue }
      if (code === '2')  { style = { ...style, opacity: 0.6 }; continue }
      if (code === '3')  { style = { ...style, fontStyle: 'italic' }; continue }
      if (code === '4')  { style = { ...style, textDecoration: 'underline' }; continue }
      if (code === '7')  { style = { ...style, filter: 'invert(1)' }; continue }
      if (ANSI_FG[code]) { style = { ...style, color: ANSI_FG[code] }; continue }
      if (ANSI_BG[code]) { style = { ...style, backgroundColor: ANSI_BG[code] }; continue }
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex), style: { ...style } })
  }
  return segments
}

// ─── Line Classifier (exactly like Thonny) ───────────────────────────────────
type LineKind =
  | 'prompt'        // >>> 
  | 'continuation'  // ...
  | 'run'           // >>> %Run
  | 'reboot'        // MPY: soft reboot / hard reset
  | 'error'         // Traceback / *Error:
  | 'info'          // MicroPython vX banner
  | 'stderr'        // (raw stderr — dim red)
  | 'normal'

function classifyLine(line: string): LineKind {
  if (/^>>>\s*%Run/.test(line))                         return 'run'
  if (/^>>>\s/.test(line) || line === '>>>')            return 'prompt'
  if (/^\.\.\.\s/.test(line) || line === '...')         return 'continuation'
  if (/MPY:\s*soft reboot|soft reboot|hard reset/i.test(line)) return 'reboot'
  if (/^(Traceback|.*Error:|.*Exception:)/.test(line))  return 'error'
  if (/^MicroPython v|^CircuitPython \d|^Type "help"/.test(line)) return 'info'
  return 'normal'
}

const LINE_COLORS: Record<LineKind, string | undefined> = {
  prompt:       '#4ec9b0',
  continuation: '#808080',
  run:          '#569cd6',
  reboot:       '#cca700',
  error:        '#f44747',
  info:         '#b5cea8',
  stderr:       '#f44747',
  normal:       undefined,
}

// ─── Single Line Renderer ─────────────────────────────────────────────────────
function TerminalLine({ line }: { line: string }) {
  const kind = classifyLine(line)
  const baseColor = LINE_COLORS[kind]
  const segments = parseAnsi(line)

  return (
    <div
      style={{
        lineHeight: '19px',
        minHeight: 19,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        color: baseColor,
      }}
    >
      {segments.length === 0
        ? <span>&#x200B;</span>
        : segments.map((seg, i) => (
            <span key={i} style={seg.style}>{seg.text}</span>
          ))
      }
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TerminalPanel() {
  const {
    terminals, activeTerminalId, setActiveTerminal,
    addTerminal, closeTerminal,
    addTerminalLine, clearTerminal,
    isConnected,
  } = useAppStore()

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const areaRef     = useRef<HTMLDivElement>(null)

  // Command history — exactly like Thonny / real REPL
  const [history, setHistory]     = useState<string[]>([])
  const [histIdx, setHistIdx]     = useState(-1)
  const [inputVal, setInputVal]   = useState('')
  const [savedInput, setSavedInput] = useState('')   // saved draft while browsing history

  // Auto-scroll on new lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [activeTerminal?.lines])

  // Re-focus input when switching tabs
  useEffect(() => {
    if (isConnected) inputRef.current?.focus()
  }, [activeTerminalId, isConnected])

  // ── Command submission ──────────────────────────────────────────────────────
  const submitCommand = useCallback((cmd: string) => {
    setInputVal('')
    setHistIdx(-1)
    setSavedInput('')

    if (cmd.trim() === '') {
      addTerminalLine(activeTerminalId, '>>>')
      return
    }

    // Add to history (skip duplicates at top)
    setHistory((prev) => {
      if (prev[0] === cmd) return prev
      return [cmd, ...prev].slice(0, 200)
    })

    addTerminalLine(activeTerminalId, `>>> ${cmd}`)

    // ── Built-in REPL commands that we can handle client-side ────────────────
    if (cmd === 'clear' || cmd === '%clear') {
      clearTerminal(activeTerminalId)
      return
    }

    if (cmd === 'help()' || cmd === 'help') {
      addTerminalLine(activeTerminalId, 'Welcome to MicroPython!')
      addTerminalLine(activeTerminalId, '')
      addTerminalLine(activeTerminalId, 'For online docs please visit http://docs.micropython.org/')
      addTerminalLine(activeTerminalId, '')
      addTerminalLine(activeTerminalId, 'Control commands:')
      addTerminalLine(activeTerminalId, '  CTRL-A -- on a blank line, enter raw REPL mode')
      addTerminalLine(activeTerminalId, '  CTRL-B -- on a blank line, enter normal REPL mode')
      addTerminalLine(activeTerminalId, '  CTRL-C -- interrupt a running program')
      addTerminalLine(activeTerminalId, '  CTRL-D -- on a blank line, do a soft reset of the board')
      addTerminalLine(activeTerminalId, '  CTRL-E -- on a blank line, enter paste mode')
      addTerminalLine(activeTerminalId, '')
      addTerminalLine(activeTerminalId, "For further help on a specific object, type help(obj)")
      addTerminalLine(activeTerminalId, '>>>')
      return
    }

    // ── Everything else gets forwarded to the backend serial bridge ─────────
    // The backend should respond by pushing lines back through the store.
    // Here we emit a stub response so the UI stays responsive.
    // Replace this block with your actual IPC / WebSocket send:
    //   window.electronAPI.sendCommand(cmd)   ← your bridge call
    addTerminalLine(activeTerminalId, '>>>')
  }, [activeTerminalId, addTerminalLine, clearTerminal])

  // ── Keyboard handler — matches Thonny's Shell key bindings exactly ──────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Ctrl+C — interrupt (KeyboardInterrupt)
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault()
      addTerminalLine(activeTerminalId, `>>> ${inputVal}`)
      addTerminalLine(activeTerminalId, 'Traceback (most recent call last):')
      addTerminalLine(activeTerminalId, '  ...')
      addTerminalLine(activeTerminalId, 'KeyboardInterrupt: ')
      addTerminalLine(activeTerminalId, '>>>')
      setInputVal('')
      setHistIdx(-1)
      // Send actual CTRL+C byte 0x03 to device via your bridge:
      // window.electronAPI.sendRaw('\x03')
      return
    }

    // Ctrl+D — soft reboot (only on blank line, like real MicroPython)
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault()
      if (inputVal === '') {
        addTerminalLine(activeTerminalId, 'MPY: soft reboot')
        addTerminalLine(activeTerminalId, 'MicroPython v1.23.0 on 2024-06-02; Raspberry Pi Pico with RP2040')
        addTerminalLine(activeTerminalId, 'Type "help()" for more information.')
        addTerminalLine(activeTerminalId, '>>>')
        // window.electronAPI.sendRaw('\x04')
      }
      return
    }

    // Ctrl+L — clear screen (like most terminals)
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      clearTerminal(activeTerminalId)
      return
    }

    // Enter — submit
    if (e.key === 'Enter') {
      e.preventDefault()
      submitCommand(inputVal)
      return
    }

    // Arrow Up — history back
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const newIdx = histIdx + 1
      if (newIdx >= history.length) return
      if (histIdx === -1) setSavedInput(inputVal) // save current draft
      setHistIdx(newIdx)
      setInputVal(history[newIdx])
      return
    }

    // Arrow Down — history forward
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx <= 0) {
        setHistIdx(-1)
        setInputVal(savedInput)
        return
      }
      const newIdx = histIdx - 1
      setHistIdx(newIdx)
      setInputVal(history[newIdx])
      return
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    root: {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      height: '100%',
      overflow: 'hidden',
    },
    tabBar: {
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      height: 32,
      overflow: 'hidden',
    },
    tabList: {
      display: 'flex',
      flex: 1,
      overflowX: 'auto' as const,
      overflowY: 'hidden' as const,
    },
    tabActions: {
      display: 'flex',
      alignItems: 'center',
      padding: '0 6px',
      gap: 2,
      borderLeft: '1px solid var(--border)',
      flexShrink: 0,
    },
    iconBtn: {
      width: 22, height: 22,
    },
    outputArea: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '6px 10px',
      cursor: 'text',
      fontFamily: 'var(--font-code)',
      fontSize: 13,
      color: 'var(--text-primary)',
      background: 'var(--bg-primary)',
    },
    promptRow: {
      display: 'flex',
      alignItems: 'center',
      marginTop: 2,
    },
    promptChar: {
      color: '#4ec9b0',
      marginRight: 4,
      fontFamily: 'var(--font-code)',
      fontSize: 13,
      userSelect: 'none' as const,
      flexShrink: 0,
    },
    input: {
      background: 'none',
      border: 'none',
      outline: 'none',
      flex: 1,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-code)',
      fontSize: 13,
      lineHeight: '19px',
      caretColor: 'var(--text-primary)',
      minWidth: 0,
    },
    disconnectedBanner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px 10px',
      fontSize: 12,
      color: 'var(--text-dim)',
      background: 'var(--bg-elevated)',
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
      gap: 6,
    },
  }

  return (
    <div style={s.root}>
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={s.tabBar}>
        <div style={s.tabList}>
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
                onClick={(e) => { e.stopPropagation(); closeTerminal(t.id) }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div style={s.tabActions}>
          <button className="icon-btn" title="New Terminal" onClick={addTerminal} style={s.iconBtn}>
            <Plus size={13} />
          </button>
          <button
            className="icon-btn"
            title="Clear Terminal  (Ctrl+L)"
            onClick={() => activeTerminal && clearTerminal(activeTerminal.id)}
            style={s.iconBtn}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Output area ─────────────────────────────────────────────────────── */}
      <div
        ref={areaRef}
        style={s.outputArea}
        onClick={() => isConnected && inputRef.current?.focus()}
      >
        {activeTerminal?.lines.map((line, i) => (
          <TerminalLine key={i} line={line} />
        ))}

        {/* Live REPL prompt — only shown when device is connected */}
        {isConnected ? (
          <div style={s.promptRow}>
            <span style={s.promptChar}>&gt;&gt;&gt;</span>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              onChange={(e) => {
                setInputVal(e.target.value)
                setHistIdx(-1)
              }}
              onKeyDown={handleKeyDown}
              style={s.input}
            />
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {/* ── Disconnected notice (like Thonny's grey bar) ─────────────────────── */}
      {!isConnected && (
        <div style={s.disconnectedBanner}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#666', display: 'inline-block' }} />
          Backend not connected — select a port and connect to start a REPL session
        </div>
      )}
    </div>
  )
}