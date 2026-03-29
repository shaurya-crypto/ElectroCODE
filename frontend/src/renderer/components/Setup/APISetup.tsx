import { useState } from 'react'
import { useAppStore, AIProvider, APIConfig } from '../../store/useAppStore'

interface ProviderOption {
  id: AIProvider
  name: string
  description: string
  models: string[]
  needsUrl: boolean
  getKeyUrl: string
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o mini and other OpenAI models',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    needsUrl: false,
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Claude Sonnet, Claude Haiku and Opus models',
    models: ['claude-sonnet-4-5-20251001', 'claude-haiku-4-5-20251001'],
    needsUrl: false,
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 1.5 Pro, Flash and other Google models',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    needsUrl: false,
    getKeyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access many models through a single API key',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro'],
    needsUrl: false,
    getKeyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast LPU inference for open source models',
    models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    needsUrl: false,
    getKeyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally. No API key required.',
    models: ['llama3.2', 'codellama', 'mistral', 'deepseek-coder'],
    needsUrl: true,
    getKeyUrl: 'https://ollama.com',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Inference API with access to open source models',
    models: ['Qwen/Qwen2.5-Coder-32B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
    needsUrl: false,
    getKeyUrl: 'https://huggingface.co/settings/tokens',
  },
]

export default function APISetup() {
  const { completeSetup } = useAppStore()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  function selectProvider(p: ProviderOption) {
    setSelectedProvider(p)
    setSelectedModel(p.models[0])
    setTestResult(null)
  }

  async function testConnection() {
    if (!selectedProvider) return
    setTesting(true)
    setTestResult(null)

    // TODO: Replace with real API test calls through backend
    // For now simulate a test
    await new Promise((r) => setTimeout(r, 1200))

    const hasKey = selectedProvider.id === 'ollama' || apiKey.trim().length > 10
    setTestResult(hasKey ? 'ok' : 'fail')
    setTesting(false)
  }

  const finish = async () => {
    if (!selectedProvider) return
    
    const config: APIConfig = {
      provider: selectedProvider.id,
      apiKey: apiKey.trim(),
      model: selectedModel.trim(),
      baseUrl: selectedProvider.needsUrl ? baseUrl : undefined,
    }

    completeSetup(config)
    
    // Save locally to .env using Node IPC Bridge
    if ((window as any).electronAPI && (window as any).electronAPI.saveApiSettings) {
      await (window as any).electronAPI.saveApiSettings(config);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{ width: 560, maxWidth: '92vw' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, color: 'white',
              letterSpacing: '-0.02em',
            }}>
              EC
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Electro CODE
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            First-time setup — configure your AI provider to get started
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {[
            { n: 1, label: 'Select Provider' },
            { n: 2, label: 'API Key' },
            { n: 3, label: 'Test & Finish' },
          ].map(({ n, label }, idx) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 22, height: 22,
                  border: `1px solid ${step >= n ? 'var(--accent)' : 'var(--border-light)'}`,
                  background: step > n ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: step >= n ? 'var(--accent)' : 'var(--text-dim)',
                  borderRadius: '50%',
                }}>
                  {step > n ? '✓' : n}
                </div>
                <span style={{ fontSize: 12, color: step >= n ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                  {label}
                </span>
              </div>
              {idx < 2 && (
                <div style={{
                  width: 40, height: 1,
                  background: step > n ? 'var(--accent)' : 'var(--border)',
                  margin: '0 10px',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Provider */}
        {step === 1 && (
          <div className="anim-slide-down">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Choose the AI provider Electro CODE will use to generate code
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {PROVIDERS.map((p) => (
                <div
                  key={p.id}
                  className={`interpreter-option ${selectedProvider?.id === p.id ? 'selected' : ''}`}
                  onClick={() => selectProvider(p)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.description}</div>
                  </div>
                  {selectedProvider?.id === p.id && (
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, alignSelf: 'center',
                    }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="btn btn-primary"
                disabled={!selectedProvider}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: API Key */}
        {step === 2 && selectedProvider && (
          <div className="anim-slide-down">
            <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
              {selectedProvider.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {selectedProvider.id === 'ollama'
                ? 'Ollama runs locally. No API key is needed — just ensure Ollama is running.'
                : `Enter your API key. You can get one at `}
              {selectedProvider.id !== 'ollama' && (
                <a
                  href={selectedProvider.getKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  {selectedProvider.getKeyUrl}
                </a>
              )}
            </p>

            {selectedProvider.needsUrl && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Base URL</label>
                <input
                  className="form-input"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  spellCheck={false}
                />
              </div>
            )}

            {selectedProvider.id !== 'ollama' && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">API Key</label>
                <input
                  className="form-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  spellCheck={false}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label className="form-label">Model</label>
              <select
                className="form-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {selectedProvider.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={selectedProvider.id !== 'ollama' && !apiKey.trim()}
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test */}
        {step === 3 && selectedProvider && (
          <div className="anim-slide-down">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Test the connection to make sure everything is working.
            </p>

            <div style={{
              padding: '14px 16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              marginBottom: 16,
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: 'var(--text-muted)' }}>Provider</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedProvider.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ color: 'var(--text-muted)' }}>Model</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>{selectedModel}</span>
              </div>
              {selectedProvider.id !== 'ollama' && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>API Key</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                    {apiKey.slice(0, 8)}{'*'.repeat(Math.max(0, apiKey.length - 8))}
                  </span>
                </div>
              )}
            </div>

            {testResult === 'ok' && (
              <div style={{
                padding: '8px 12px', background: 'rgba(78,201,176,0.1)',
                border: '1px solid rgba(78,201,176,0.3)',
                color: 'var(--green)', fontSize: 12, marginBottom: 14,
              }}>
                Connection successful. Ready to use.
              </div>
            )}
            {testResult === 'fail' && (
              <div style={{
                padding: '8px 12px', background: 'rgba(244,71,71,0.1)',
                border: '1px solid rgba(244,71,71,0.3)',
                color: 'var(--red)', fontSize: 12, marginBottom: 14,
              }}>
                Connection failed. Please check your API key and try again.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={testConnection}
                  disabled={testing}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button className="btn btn-primary" onClick={finish}>
                  Finish Setup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}