import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowUp, X, Trash2, Copy, Check, Bot, Plus, Paperclip,
  Terminal as TerminalIcon, FileText, ChevronDown, ChevronRight,
  FolderTree, FileCode, Sparkles, CheckCircle2, XCircle,
  Clock, MessageSquare, Key,
} from 'lucide-react'
import { useAppStore, AIMessage, FileNode } from '../../store/useAppStore'
import { currentSessionId } from '../../store/mcpClient'

// ── Model List ──
interface ModelOption {
  id: string
  label: string
  isPro: boolean
}

const MODELS: ModelOption[] = [
  { id: 'kimi-k2.5',           label: 'Kimi K2.5',            isPro: false },
  { id: 'qwen3.5-35b-a3b',     label: 'Qwen3.5-35B-A3B',     isPro: false },
  { id: 'gemini-3.0-pro',      label: 'Gemini 3.0 Pro',       isPro: false },
  { id: 'gemini-3.0-flash',    label: 'Gemini 3.0 Flash',     isPro: false },
  { id: 'gemini-2.5-pro',      label: 'Gemini 2.5 Pro',       isPro: false },
  { id: 'gpt-5.2',             label: 'GPT 5.2',              isPro: true },
  { id: 'gpt-5.3-codex',       label: 'GPT-5.3 Codex',        isPro: true },
  { id: 'claude-sonnet-4.5',   label: 'Claude Sonnet 4.5',    isPro: true },
]

const SUGGESTIONS = [
  'Blink built-in LED every 500ms',
  'Read DHT22 temperature and humidity',
  'Connect to WiFi and make HTTP request',
  'Servo motor control with PWM signal',
  'I2C OLED display initialization',
  'Button interrupt with debounce',
]

// ── Helpers ──

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 6px', fontSize: 11, borderRadius: 'var(--radius-sm)',
      }}
    >
      {copied ? <Check size={11} style={{ color: 'var(--green)' }} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { setAiSuggestion, activeTabId, showNotification } = useAppStore()

  function insertToEditor() {
    if (!activeTabId) {
      showNotification('Open a file first to insert code', 'warning')
      return
    }
    setAiSuggestion({ code, language: lang, prompt: '' })
  }

  return (
    <div style={{
      margin: '8px 0',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-code)' }}>
          {lang}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={insertToEditor}
            style={{
              padding: '2px 8px',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: 'var(--accent)',
              cursor: 'pointer', fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <FileCode size={11} />
            Insert
          </button>
          <CopyButton text={code} />
        </div>
      </div>
      <pre style={{
        padding: '10px 12px', margin: 0,
        fontSize: 12, lineHeight: '18px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-code)',
        overflowX: 'auto', whiteSpace: 'pre',
        background: 'var(--bg-base)',
      }}>
        {code}
      </pre>
    </div>
  )
}

// ── AI Action Accordion (dynamic, based on real actions) ──
function ActionAccordion({ icon, label, detail, isPulsing }: {
  icon: React.ReactNode; label: string; detail?: string; isPulsing?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="agent-accordion">
      <button
        className={`agent-accordion-header ${expanded ? 'expanded' : ''}`}
        onClick={() => !isPulsing && setExpanded(!expanded)}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: isPulsing ? 'var(--accent)' : 'inherit' }}>
          {icon}
        </span>
        <span style={isPulsing ? { color: 'var(--accent)' } : undefined}>{label}</span>
        {isPulsing && (
          <span style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `pulse 1.4s ease-in-out infinite ${d}s`,
              }} />
            ))}
          </span>
        )}
        {!isPulsing && (
          <span className="accordion-chevron">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        )}
      </button>
      {expanded && detail && (
        <div className="agent-accordion-body">{detail}</div>
      )}
    </div>
  )
}

// ── Flatten file tree for @ mentions ──
function flattenFileTree(nodes: FileNode[], prefix = ''): string[] {
  const result: string[] = []
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name
    if (node.type === 'file') {
      result.push(fullPath)
    }
    if (node.children) {
      result.push(...flattenFileTree(node.children, fullPath))
    }
  }
  return result
}

// ── Message Renderer ──
function MessageBlock({ msg }: { msg: AIMessage }) {
  const parts = msg.content.split(/(```[\w]*\n[\s\S]*?```)/g)

  return (
    <div className={`ai-message ${msg.role}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {msg.role === 'assistant' && (
          <div style={{
            width: 22, height: 22,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Bot size={13} style={{ color: 'var(--accent)' }} />
          </div>
        )}
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--accent)',
          letterSpacing: '0.04em',
        }}>
          {msg.role === 'user' ? 'You' : 'ElectroCODE Agent'}
        </span>
      </div>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
        if (codeMatch) {
          return <CodeBlock key={i} lang={codeMatch[1] || 'python'} code={codeMatch[2].trimEnd()} />
        }
        if (!part.trim()) return null
        return (
          <div key={i} style={{
            fontSize: 13, lineHeight: 1.65,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}>{part}</div>
        )
      })}
    </div>
  )
}

// ── Dynamic Thinking Indicator ──
function ThinkingIndicator({ referencedFiles }: { referencedFiles: string[] }) {
  return (
    <div style={{ padding: '12px 16px', animation: 'fadeSlideUp 0.2s ease-out' }}>
      {/* Show real file accesses when @ files were mentioned */}
      {referencedFiles.length > 0 && (
        <ActionAccordion
          icon={<FolderTree size={13} />}
          label="Reading project context"
          detail={`Analyzing: ${referencedFiles.join(', ')}`}
        />
      )}
      {referencedFiles.map((f) => (
        <ActionAccordion
          key={f}
          icon={<FileCode size={13} />}
          label={`Read ${f}`}
          detail={`Injecting ${f} into context...`}
        />
      ))}
      <ActionAccordion
        icon={<Bot size={13} />}
        label="Thinking"
        isPulsing
      />
    </div>
  )
}

// ── Chat History Sidebar ──
function ChatHistorySidebar({
  conversations,
  currentId,
  onSwitch,
  onClose,
}: {
  conversations: { id: string; title: string; messages: AIMessage[]; timestamp: number }[]
  currentId: string | null
  onSwitch: (id: string) => void
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 240,
      background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      animation: 'slideRight 0.15s ease-out',
    }}>
      <div style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Chat History</span>
        <button className="icon-btn" onClick={onClose}><X size={13} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => { onSwitch(c.id); onClose() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: c.id === currentId ? 'var(--accent-dim)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: c.id === currentId ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 12, borderRadius: 'var(--radius-sm)',
              margin: '0 4px', width: 'calc(100% - 8px)',
              transition: 'background 0.1s ease',
            }}
          >
            <MessageSquare size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Generate 3-4 word title from first user message
function generateChatTitle(firstPrompt: string): string {
  const words = firstPrompt.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/)
  if (words.length <= 4) return words.join(' ')
  return words.slice(0, 4).join(' ')
}

function APIKeyOnboarding({ onSave }: { onSave: (key: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="ai-message assistant" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 22, height: 22,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={13} style={{ color: 'var(--accent)' }} />
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '0.04em',
        }}>
          ElectroCODE Agent
        </span>
      </div>
      
      <div style={{
        fontSize: 13, lineHeight: 1.65,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        marginBottom: 12
      }}>
        Hello! I am ready to help you wire up your Pico W and write MicroPython. To keep ElectroCODE free and lightning-fast, please connect your API key to continue.
      </div>

      <div style={{
        background: '#0F111A',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '6px 10px' }}>
          <Key size={14} style={{ color: 'var(--text-dim)' }} />
          <input 
            type="password"
            placeholder="Paste OpenAI or Gemini Key here..."
            value={val}
            onChange={e => setVal(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 12
            }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Don't have one? Get a free Gemini API key <a href="#" onClick={(e) => {
              e.preventDefault();
              (window as any).electronAPI.openExternal('https://aistudio.google.com/');
            }} style={{ color: '#6366F1', textDecoration: 'none' }}>here</a>.
          </span>
          <button 
            onClick={() => {
              if (val.trim()) onSave(val.trim());
            }}
            style={{
              background: '#6366F1', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s ease',
              opacity: val.trim() ? 1 : 0.5, fontWeight: 500
            }}
            onMouseEnter={e => { if(val.trim()) e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { if(val.trim()) e.currentTarget.style.opacity = '1'; }}
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──
// ══════════════════════════════════════════════════════════════
export default function AIPanel() {
  const {
    apiKey, setApiKey,
    conversations, currentConversationId,
    addAiMessage, clearAiMessages, newChat, switchChat,
    aiLoading, setAiLoading,
    toggleAiPanel,
    tabs, activeTabId, setAiSuggestion,
    fileTree, openedFolderPath,
    aiSuggestion, acceptSuggestion, declineSuggestion,
  } = useAppStore()

  const currentChat = conversations.find(c => c.id === currentConversationId)
  const aiMessages = currentChat ? currentChat.messages : []

  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [lastReferencedFiles, setLastReferencedFiles] = useState<string[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Flatten entire file tree for @ dropdown
  const allFiles = useMemo(() => {
    const files = flattenFileTree(fileTree)
    // Also add open tabs that might not be in tree
    tabs.forEach(t => {
      if (!files.includes(t.name)) files.push(t.name)
    })
    files.push('terminal')
    return files
  }, [fileTree, tabs])

  // Prevent duplicate empty chats
  const canCreateNewChat = useMemo(() => {
    if (!currentChat) return true
    return currentChat.messages.length > 0
  }, [currentChat])

  function handleModelChange(modelId: string) {
    setSelectedModel(modelId)
    setModelDropdownOpen(false)
    const model = MODELS.find(m => m.id === modelId)
    console.log(`[ElectroCODE] Model switched to: ${model?.label ?? modelId}`)
  }

  // @ mention logic — searches full workspace tree
  useEffect(() => {
    const lastWord = input.split(/\s/).pop() || ''
    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1).toLowerCase()
      const filtered = allFiles.filter(f => f.toLowerCase().includes(query))
      setSuggestions(filtered.slice(0, 12))
      setSuggestionIdx(0)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [input, allFiles])

  const insertSuggestion = useCallback((name: string) => {
    const words = input.split(/\s/)
    words.pop()
    const newVal = words.join(' ') + (words.length > 0 ? ' ' : '') + '@' + name + ' '
    setInput(newVal)
    setShowSuggestions(false)
    setTimeout(() => textareaRef.current?.focus(), 10)
  }, [input])

  const triggerAttach = useCallback(() => {
    setSuggestions(allFiles.slice(0, 12))
    setSuggestionIdx(0)
    setShowSuggestions(true)
    textareaRef.current?.focus()
  }, [allFiles])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  // ── Read file content for @ mentions and inject into prompt ──
  async function resolveFileContents(prompt: string): Promise<string> {
    const mentionRegex = /@([a-zA-Z0-9._\-\/]+)/g
    const matches = [...prompt.matchAll(mentionRegex)]
    const fileNames: string[] = []
    const resolved: string[] = []

    for (const match of matches) {
      const fileName = match[1]
      if (fileName === 'terminal' || fileNames.includes(fileName)) continue
      fileNames.push(fileName)

      // Try to find content from open tabs first
      const tab = tabs.find(t => t.name === fileName || t.filePath?.endsWith(fileName))
      if (tab) {
        resolved.push(`[File: ${fileName}]\n${tab.content}`)
        continue
      }

      // Try to read from disk via electronAPI
      if (openedFolderPath) {
        try {
          const fullPath = `${openedFolderPath}/${fileName}`
          const result = await (window as any).electronAPI.fsReadFile({ filePath: fullPath })
          if (result && result.content) {
            resolved.push(`[File: ${fileName}]\n${result.content}`)
          }
        } catch (e) {
          // Silently skip unresolvable files
        }
      }
    }

    setLastReferencedFiles(fileNames)
    return resolved.length > 0
      ? prompt + '\n\n--- ATTACHED FILE CONTENTS ---\n' + resolved.join('\n\n')
      : prompt
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || aiLoading) return
    setInput('')

    // Auto-name chat on first message
    if (currentChat && currentChat.messages.length === 0) {
      const store = useAppStore.getState()
      const title = generateChatTitle(text)
      const updated = store.conversations.map(c =>
        c.id === currentConversationId ? { ...c, title } : c
      )
      useAppStore.setState({ conversations: updated })
    }

    addAiMessage({ role: 'user', content: text })
    setAiLoading(true)

    // Resolve @ mentions to actual file content
    const enrichedPrompt = await resolveFileContents(text)

    const workspacePath = useAppStore.getState().openedFolderPath

    try {
      const response = await (window as any).electronAPI.generateCode({
        userPrompt: enrichedPrompt,
        sessionId: currentSessionId,
        workspacePath: workspacePath,
        mode: 'code'
      })

      if (response.error) {
        throw new Error(response.error.message || 'AI Generation failed')
      }

      if (!response.success || !response.response_text) {
        throw new Error('Invalid response from AI service')
      }

      const data = response.response_text

      if (typeof data === 'string') {
        addAiMessage({ role: 'assistant', content: data })
      } else if (data.type === 'code_update') {
        // Build a proper Markdown message with the code block embedded
        const explanation = data.explanation || 'Here are the code changes:'
        const codeBlock = data.code ? `\n\n\`\`\`python\n${data.code}\n\`\`\`` : ''
        addAiMessage({ role: 'assistant', content: explanation + codeBlock })

        if (data.code && data.code.trim().length > 0) {
          const activeLanguage = tabs.find(t => t.id === activeTabId)?.language || 'python'
          setAiSuggestion({ code: data.code, language: activeLanguage, prompt: text })
        }
      } else if (data.type === 'chat') {
        addAiMessage({ role: 'assistant', content: data.payload || 'Done.' })
      } else {
        const reply = data.payload || data.response_text || 'Completed.'
        addAiMessage({ role: 'assistant', content: reply })
      }
    } catch (err: any) {
      addAiMessage({ role: 'assistant', content: `Error: ${err.message || 'Could not reach AI service.'}` })
    } finally {
      setAiLoading(false)
      setLastReferencedFiles([])
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setSuggestionIdx(p => (p + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); setSuggestionIdx(p => (p - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); insertSuggestion(suggestions[suggestionIdx])
      } else if (e.key === 'Escape') {
        e.preventDefault(); setShowSuggestions(false)
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); send()
    }
  }

  const currentModel = MODELS.find(m => m.id === selectedModel)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      borderLeft: '1px solid var(--border)', background: 'var(--bg-base)',
      position: 'relative',
    }}>
      {/* Chat History Sidebar */}
      {showHistory && (
        <ChatHistorySidebar
          conversations={conversations}
          currentId={currentConversationId}
          onSwitch={switchChat}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Header */}
      <div className="panel-header" style={{ padding: '0 12px', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 'var(--radius-sm)',
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={15} style={{ color: 'var(--accent)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            ElectroCODE Agent
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.2 }}>
            Your AI hardware engineer
          </div>
        </div>

        <button className="icon-btn" onClick={() => setShowHistory(!showHistory)} title="Chat History">
          <Clock size={13} />
        </button>
        <button
          className="icon-btn"
          onClick={newChat}
          title="New Chat"
          disabled={!canCreateNewChat}
          style={!canCreateNewChat ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
        >
          <Plus size={14} />
        </button>
        {aiMessages.length > 0 && (
          <button className="icon-btn" onClick={clearAiMessages} title="Clear conversation">
            <Trash2 size={13} />
          </button>
        )}
        <button className="icon-btn" onClick={toggleAiPanel} title="Close panel">
          <X size={13} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {!apiKey ? (
          <div style={{ padding: '20px 16px' }}>
            <APIKeyOnboarding onSave={(key) => {
              setApiKey(key);
              addAiMessage({ role: 'assistant', content: 'Key saved securely! How can I help you with your hardware today?' });
            }} />
          </div>
        ) : aiMessages.length === 0 && (
          <div style={{ padding: '20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--radius)',
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={20} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  How can I help?
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Describe what you want to build for your device.
                </div>
              </div>
            </div>

            <div style={{
              fontSize: 10, color: 'var(--text-dim)', marginBottom: 8,
              textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
            }}>
              Suggestions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s} onClick={() => send(s)}
                  style={{
                    textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none',
                    borderLeft: '2px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.borderLeftColor = 'var(--accent)'
                    el.style.color = 'var(--text-primary)'
                    el.style.background = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.borderLeftColor = 'var(--border)'
                    el.style.color = 'var(--text-muted)'
                    el.style.background = 'none'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.map((msg) => (
          <MessageBlock key={msg.id} msg={msg} />
        ))}

        {aiLoading && <ThinkingIndicator referencedFiles={lastReferencedFiles} />}

        {/* Compact Accept/Decline buttons when suggestion is pending */}
        {aiSuggestion && (
          <div style={{
            padding: '8px 16px',
            display: 'flex', gap: 6,
            animation: 'fadeSlideUp 0.2s ease-out',
          }}>
            <button
              className="btn btn-success"
              style={{ padding: '4px 12px', fontSize: 11, flex: 1, justifyContent: 'center' }}
              onClick={acceptSuggestion}
            >
              <CheckCircle2 size={12} /> Accept All
            </button>
            <button
              className="btn btn-danger-outline"
              style={{ padding: '4px 12px', fontSize: 11, flex: 1, justifyContent: 'center' }}
              onClick={declineSuggestion}
            >
              <XCircle size={12} /> Decline All
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '10px 10px 8px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-elevated)', position: 'relative',
      }}>
        {/* @ mention autocomplete — scrollable */}
        {showSuggestions && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 10, right: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
            zIndex: 100, maxHeight: 300, overflowY: 'auto',
            animation: 'slideDown 0.15s ease-out',
          }}>
            {suggestions.map((s, i) => (
              <div
                key={s} onClick={() => insertSuggestion(s)}
                style={{
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12, cursor: 'pointer',
                  background: i === suggestionIdx ? 'var(--accent-dim)' : 'transparent',
                  color: i === suggestionIdx ? 'var(--accent)' : 'var(--text-primary)',
                  borderLeft: i === suggestionIdx ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {s === 'terminal' ? <TerminalIcon size={13} /> : <FileText size={13} />}
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div
          style={{
            border: '1px solid var(--border-light)', background: 'var(--bg-input)',
            display: 'flex', alignItems: 'flex-end', gap: 4,
            padding: '6px 8px', borderRadius: 'var(--radius)',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)'
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              e.currentTarget.style.borderColor = 'var(--border-light)'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        >
          <button onClick={triggerAttach} title="Attach files (@)"
            style={{
              width: 28, height: 28, border: 'none', background: 'none',
              color: 'var(--text-dim)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Paperclip size={15} />
          </button>
          <textarea
            ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={!apiKey}
            placeholder={!apiKey ? "Please connect API key to continue..." : "Ask ElectroCODE for help... (Type @ to mention files)"}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
              color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 13,
              lineHeight: '20px', maxHeight: 120, overflowY: 'auto',
              opacity: !apiKey ? 0.3 : 1
            }}
          />
          <button onClick={() => send()} disabled={!input.trim() || aiLoading || !apiKey}
            style={{
              width: 28, height: 28, border: 'none',
              background: (input.trim() && apiKey) ? 'var(--accent)' : 'var(--bg-surface)',
              color: (input.trim() && apiKey) ? 'white' : 'var(--text-dim)',
              cursor: (input.trim() && apiKey && !aiLoading) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowUp size={14} />
          </button>
        </div>

        {/* Footer: model selector */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 8, padding: '0 2px',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            Enter — send &middot; Shift+Enter — new line
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '2px 8px',
                cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Bot size={11} />
              <span>{currentModel?.label}</span>
              {currentModel?.isPro && <span className="model-badge-pro">Pro</span>}
              <ChevronDown size={10} />
            </button>
            {modelDropdownOpen && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden', minWidth: 200, zIndex: 200,
                animation: 'scaleIn 0.12s ease-out',
              }}>
                {MODELS.map((m) => (
                  <button
                    key={m.id} onClick={() => handleModelChange(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '7px 12px', border: 'none',
                      background: selectedModel === m.id ? 'var(--accent-dim)' : 'transparent',
                      color: selectedModel === m.id ? 'var(--accent)' : 'var(--text-primary)',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedModel !== m.id) (e.currentTarget).style.background = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (selectedModel !== m.id) (e.currentTarget).style.background = 'transparent'
                    }}
                  >
                    <span style={{ flex: 1 }}>{m.label}</span>
                    {m.isPro && <span className="model-badge-pro">Pro</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}