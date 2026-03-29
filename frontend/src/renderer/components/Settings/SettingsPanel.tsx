import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore, AIProvider, APIConfig } from '../../store/useAppStore'

const NAV_ITEMS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'ai', label: 'AI & API' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'keybindings', label: 'Keyboard Shortcuts' },
]

// Provider info for settings page
export const PROVIDERS = [
  {
    id: 'openai' as AIProvider,
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    id: 'anthropic' as AIProvider,
    name: 'Anthropic (Claude)',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  {
    id: 'gemini' as AIProvider,
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  },
  {
    id: 'groq' as AIProvider,
    name: 'Groq',
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
  {
    id: 'ollama' as AIProvider,
    name: 'Ollama (Local)',
    models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'deepseek-coder'],
  },
]

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 20, borderRadius: 10,
        background: value ? 'var(--accent)' : 'var(--border-light)',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

export default function SettingsPanel() {
  const {
    setSettingsOpen, theme, setTheme,
    apiConfig, updateAPIConfig, showNotification,
    autoSave, setAutoSave,
  } = useAppStore()

  const [activeSection, setActiveSection] = useState('appearance')

  // Local state for AI settings
  const [provider, setProvider] = useState<AIProvider>(apiConfig?.provider ?? 'anthropic')
  const [apiKey, setApiKey] = useState(apiConfig?.apiKey ?? '')
  const [model, setModel] = useState(apiConfig?.model ?? '')
  const [baseUrl, setBaseUrl] = useState(apiConfig?.baseUrl ?? 'http://localhost:11434')

  // Editor prefs
  const [fontSize, setFontSize] = useState(14)
  const [tabSize, setTabSize] = useState(4)
  const [wordWrap, setWordWrap] = useState(false)
  const [minimap, setMinimap] = useState(true)
  const [ligatures, setLigatures] = useState(true)

  const saveAISettings = async () => {
    updateAPIConfig({ provider, apiKey, model, baseUrl: provider === 'ollama' ? baseUrl : undefined })
    
    // Push the secure API keys up into the Node environment .env!
    if ((window as any).electronAPI && (window as any).electronAPI.saveApiSettings) {
      await (window as any).electronAPI.saveApiSettings({ provider, apiKey, model, baseUrl });
    }
    
    showNotification('API settings saved', 'success')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 7000,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        height: 40,
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Settings</span>
        <button className="icon-btn" onClick={() => setSettingsOpen(false)}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Nav */}
        <div style={{
          width: 200, flexShrink: 0,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border)',
          padding: '8px 0',
          overflowY: 'auto',
        }}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.id}
              className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 680 }}>

          {/* ── Appearance ── */}
          {activeSection === 'appearance' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Appearance</h2>

              <div className="settings-row">
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>Color Theme</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Choose the IDE color theme</div>
                </div>
                <select
                  className="form-select"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  style={{ width: 140 }}
                >
                  <option value="dark">Dark (default)</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Editor ── */}
          {activeSection === 'editor' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Editor</h2>

              {[
                {
                  label: 'Font Size', desc: 'Editor font size in pixels',
                  control: (
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 80 }}
                      value={fontSize}
                      min={8} max={32}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                    />
                  )
                },
                {
                  label: 'Tab Size', desc: 'Number of spaces per tab',
                  control: (
                    <select
                      className="form-select"
                      style={{ width: 80 }}
                      value={tabSize}
                      onChange={(e) => setTabSize(Number(e.target.value))}
                    >
                      {[2, 4, 8].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )
                },
                {
                  label: 'Word Wrap', desc: 'Wrap long lines in the editor',
                  control: <Toggle value={wordWrap} onChange={setWordWrap} />
                },
                {
                  label: 'Minimap', desc: 'Show code overview minimap on the right',
                  control: <Toggle value={minimap} onChange={setMinimap} />
                },
                {
                  label: 'Font Ligatures', desc: 'Enable ligatures with JetBrains Mono',
                  control: <Toggle value={ligatures} onChange={setLigatures} />
                },
                {
                  label: 'Auto Save', desc: 'Automatically save files after changes',
                  control: <Toggle value={autoSave} onChange={setAutoSave} />
                },
              ].map(({ label, desc, control }) => (
                <div key={label} className="settings-row">
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  {control}
                </div>
              ))}

              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => showNotification('Editor settings applied', 'success')}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ── AI & API ── */}
          {activeSection === 'ai' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>AI & API Configuration</h2>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Provider</label>
                <select
                  className="form-select w-full bg-slate-900 border border-slate-700/50 rounded-lg px-4 py-2.5 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  value={provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as AIProvider;
                    setProvider(newProvider);
                    const defaultModel = PROVIDERS.find(p => p.id === newProvider)?.models[0] || '';
                    setModel(defaultModel);
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {provider !== 'ollama' && (
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 tracking-wide uppercase">API Key</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter ${provider} API key`}
                    spellCheck={false}
                  />
                </div>
              )}

              {provider === 'ollama' && (
                <div style={{ marginBottom: 14 }}>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 tracking-wide uppercase">Ollama Base URL</label>
                  <input
                    className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-4 py-2.5 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label className="block text-xs font-semibold text-slate-400 mb-2 tracking-wide uppercase">Model</label>
                <select
                  className="form-select w-full bg-slate-900 border border-slate-700/50 rounded-lg px-4 py-2.5 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {PROVIDERS.find(p => p.id === provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 16,
                lineHeight: 1.6,
              }}>
                API keys are stored locally in Electro CODE's settings.
                In production, these will be stored in an encrypted .env file and proxied through the local backend.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveAISettings}>Save</button>
              </div>
            </div>
          )}

          {/* ── Terminal ── */}
          {activeSection === 'terminal' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Terminal</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Terminal settings will be available when backend serial communication is connected.
              </p>
            </div>
          )}

          {/* ── Keybindings ── */}
          {activeSection === 'keybindings' && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>Keyboard Shortcuts</h2>
              {[
                ['Ctrl+N',           'New File'],
                ['Ctrl+O',           'Open File'],
                ['Ctrl+S',           'Save'],
                ['Ctrl+Shift+S',     'Save As'],
                ['Ctrl+W',           'Close Tab'],
                ['Ctrl+B',           'Toggle Sidebar'],
                ['Ctrl+`',           'Toggle Terminal'],
                ['Ctrl+Shift+A',     'Toggle AI Panel'],
                ['Ctrl+,',           'Settings'],
                ['F5',               'Run File'],
                ['F6',               'Stop'],
                ['F7',               'Upload to Device'],
                ['Ctrl+F',           'Find'],
                ['Ctrl+H',           'Replace'],
                ['Ctrl+Z',           'Undo'],
                ['Ctrl+Shift+Z',     'Redo'],
              ].map(([key, label]) => (
                <div key={key} className="settings-row">
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                  <span style={{
                    fontFamily: 'var(--font-code)',
                    fontSize: 12,
                    padding: '2px 8px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>
                    {key}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}