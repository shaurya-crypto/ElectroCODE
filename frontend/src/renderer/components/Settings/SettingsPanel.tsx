import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const NAV_ITEMS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'editor', label: 'Editor' },
  { id: 'ai', label: 'AI & API' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'keybindings', label: 'Keyboard Shortcuts' },
]

// Provider info kept for settings page only (not exported)
const SETTINGS_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'anthropic', name: 'Anthropic (Claude)', models: ['claude-sonnet-4-5-20251001', 'claude-haiku-4-5-20251001'] },
  { id: 'gemini', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'deepseek-coder'] },
]

// Keep the old export name for backward compat if anything imports it
export const PROVIDERS = SETTINGS_PROVIDERS

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 'var(--radius-full)',
        background: value ? 'var(--accent)' : 'var(--border-light)',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
  const [provider, setProvider] = useState(apiConfig?.provider ?? 'anthropic')
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
    updateAPIConfig({ provider: provider as any, apiKey, model, baseUrl: provider === 'ollama' ? baseUrl : undefined })

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
      animation: 'fadeIn 0.15s ease',
    }}>
      {/* Header */}
      <div style={{
        height: 44,
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1, color: 'var(--text-primary)' }}>Settings</span>
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
          padding: '10px 0',
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', maxWidth: 680 }}>

          {/* ── Appearance ── */}
          {activeSection === 'appearance' && (
            <div className="anim-fade">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--text-primary)' }}>Appearance</h2>

              <div className="settings-row">
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 3 }}>Color Theme</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Choose the IDE color theme</div>
                </div>
                <select
                  className="form-select"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  style={{ width: 160 }}
                >
                  <option value="dark">Dark (Premium Navy)</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Editor ── */}
          {activeSection === 'editor' && (
            <div className="anim-fade">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--text-primary)' }}>Editor</h2>

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
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  {control}
                </div>
              ))}

              <div style={{ marginTop: 18 }}>
                <button className="btn btn-primary" onClick={() => showNotification('Editor settings applied', 'success')}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* ── AI & API ── */}
          {activeSection === 'ai' && (
            <div className="anim-fade">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--text-primary)' }}>AI & API Configuration</h2>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Provider</label>
                <select
                  className="form-select"
                  value={provider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    setProvider(newProvider as any);
                    const defaultModel = SETTINGS_PROVIDERS.find(p => p.id === newProvider)?.models[0] || '';
                    setModel(defaultModel);
                  }}
                >
                  {SETTINGS_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {provider !== 'ollama' && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">API Key</label>
                  <input
                    className="form-input"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter ${provider} API key`}
                    spellCheck={false}
                  />
                </div>
              )}

              {provider === 'ollama' && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Ollama Base URL</label>
                  <input
                    className="form-input"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                </div>
              )}

              <div style={{ marginBottom: 22 }}>
                <label className="form-label">Model</label>
                <select
                  className="form-select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {SETTINGS_PROVIDERS.find(p => p.id === provider)?.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div style={{
                padding: '12px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 18,
                lineHeight: 1.6,
              }}>
                API keys are stored locally in ElectroCODE's encrypted settings.
                They are proxied through the local backend and never exposed to the renderer.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveAISettings}>Save</button>
              </div>
            </div>
          )}

          {/* ── Terminal ── */}
          {activeSection === 'terminal' && (
            <div className="anim-fade">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--text-primary)' }}>Terminal</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Terminal settings will be available when backend serial communication is connected.
              </p>
            </div>
          )}

          {/* ── Keybindings ── */}
          {activeSection === 'keybindings' && (
            <div className="anim-fade">
              <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18, color: 'var(--text-primary)' }}>Keyboard Shortcuts</h2>
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
                    fontSize: 11,
                    padding: '3px 10px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: 'var(--radius-sm)',
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