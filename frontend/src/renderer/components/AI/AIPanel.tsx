import { useState, useRef, useEffect } from 'react'
import { Send, X, Trash2, Copy, Check, Bot } from 'lucide-react'
import { useAppStore, AIMessage } from '../../store/useAppStore'
import { currentSessionId } from '../../store/mcpClient'
import { PROVIDERS } from '../Settings/SettingsPanel'

const SUGGESTIONS = [
  'Blink built-in LED every 500ms',
  'Read DHT22 temperature and humidity',
  'Connect to WiFi and make HTTP request',
  'Servo motor control with PWM signal',
  'I2C OLED display initialization',
  'Button interrupt with debounce',
  'Read analog sensor and print values',
  'UART communication between two devices',
]

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
        color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3,
        padding: '2px 5px', fontSize: 11,
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
      background: 'var(--bg-elevated)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3px 10px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-code)' }}>
          {lang}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={insertToEditor}
            style={{
              padding: '1px 8px',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 11,
              borderRadius: 'var(--radius)',
            }}
          >
            Insert to Editor
          </button>
          <CopyButton text={code} />
        </div>
      </div>
      <pre style={{
        padding: '10px',
        margin: 0,
        fontSize: 12,
        lineHeight: '18px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-code)',
        overflowX: 'auto',
        whiteSpace: 'pre',
        background: 'var(--bg-base)',
      }}>
        {code}
      </pre>
    </div>
  )
}

function MessageBlock({ msg }: { msg: AIMessage }) {
  // Parse code blocks
  const parts = msg.content.split(/(```[\w]*\n[\s\S]*?```)/g)

  return (
    <div className={`ai-message ${msg.role}`}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: msg.role === 'user' ? 'var(--text-muted)' : 'var(--accent)',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {msg.role === 'user' ? 'You' : 'Electro CODE AI'}
      </div>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
        if (codeMatch) {
          return <CodeBlock key={i} lang={codeMatch[1] || 'code'} code={codeMatch[2].trimEnd()} />
        }
        return (
          <p key={i} style={{
            fontSize: 13, lineHeight: 1.6,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
          }}>
            {part}
          </p>
        )
      })}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="ai-message assistant" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 6 }}>Generating</span>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--text-dim)',
          animation: `fadeIn 0.6s ${i * 0.2}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  )
}

export default function AIPanel() {
  const {
    aiMessages, addAiMessage, clearAiMessages,
    aiLoading, setAiLoading,
    toggleAiPanel, apiConfig, updateAPIConfig,
    tabs, activeTabId, setAiSuggestion
  } = useAppStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || aiLoading) return
    setInput('')

    addAiMessage({ role: 'user', content: text })
    setAiLoading(true)

    try {
      // Hit the local MCP Server which holds full context of the code/device/serial automatically!
      const res = await fetch('http://localhost:4000/api/v1/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          intent: 'user_prompt',
          sessionId: currentSessionId,
          apiConfig: apiConfig
        }),
      })

      const json = await res.json()
      
      if (!json.success || !json.data) {
        throw new Error(json.error || 'MCP generation failed')
      }

      const data = json.data;
      
      if (data.type === 'code_update') {
        const reply = data.explanation || 'I have generated code. Review it in your editor.'
        addAiMessage({ role: 'assistant', content: reply })
        
        if (data.code && data.code.trim().length > 0) {
            const activeLanguage = tabs.find(t => t.id === activeTabId)?.language || 'python'
            setAiSuggestion({
              code: data.code,
              language: activeLanguage,
              prompt: text
            })
        } else {
            addAiMessage({ role: 'assistant', content: '> ⚠️ The AI provided an explanation but failed to generate the actual code block. Try asking it to "write the full script" explicitly.'})
        }
      } else {
        const reply = data.payload || 'No payload in response'
        addAiMessage({ role: 'assistant', content: reply })
      }

    } catch {
      addAiMessage({
        role: 'assistant',
        content: 'Error: Could not reach AI service. Check your API key in Tools > Settings.',
      })
    } finally {
      setAiLoading(false)
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-base)',
    }}>
      {/* Header */}
      <div className="panel-header">
        <span style={{ flex: 1 }}>AI Assistant</span>
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
        {aiMessages.length === 0 && (
          <div style={{ padding: '16px 14px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
              Describe what you want to build. The AI will generate code and wiring instructions for your selected device.
              Code can be inserted directly into the editor.
            </p>

            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              Suggestions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    background: 'none',
                    border: 'none',
                    borderLeft: '2px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'border-color 0.1s, color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--accent)'
                    el.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.borderColor = 'var(--border)'
                    el.style.color = 'var(--text-muted)'
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

        {aiLoading && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <div style={{
          border: '1px solid var(--border-light)',
          background: 'var(--bg-input)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          padding: '5px 6px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask AI to write code..."
            rows={1}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              lineHeight: '18px',
              maxHeight: 100,
              overflowY: 'auto',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || aiLoading}
            style={{
              width: 26, height: 26,
              border: 'none',
              background: input.trim() ? 'var(--accent)' : 'var(--bg-surface)',
              color: input.trim() ? 'white' : 'var(--text-dim)',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              borderRadius: 'var(--radius)',
            }}
          >
            <Send size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            Enter — send &nbsp;·&nbsp; Shift+Enter — new line
          </p>

          {/* Model Selector Footbar */}
          {apiConfig && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
              <Bot size={11} color="var(--text-muted)" />
              <select
                value={apiConfig.model}
                onChange={(e) => {
                  updateAPIConfig({ ...apiConfig, model: e.target.value })
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: 120,
                  textOverflow: 'ellipsis'
                }}
              >
                {PROVIDERS.find(p => p.id === apiConfig.provider)?.models.map(m => (
                  <option key={m} value={m} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}