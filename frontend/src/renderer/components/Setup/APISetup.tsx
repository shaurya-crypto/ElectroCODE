import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'

// Inline Google 'G' SVG — crisp, monochrome-compatible
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginScreen() {
  const { completeSetup } = useAppStore()
  const [loading, setLoading] = useState(false)

  function handleLogin() {
    setLoading(true)

    // Open the authentication website in the system browser
    if ((window as any).electronAPI?.openExternal) {
      (window as any).electronAPI.openExternal('https://auth.electrocode.dev')
    }

    // Simulate login success with a 1.5-second timeout
    // Real deep-link OAuth callback will replace this later
    setTimeout(() => {
      completeSetup({
        provider: 'openrouter',
        apiKey: '',
        model: 'kimi-k2.5',
      })
    }, 1500)
  }

  return (
    <div className="login-screen">
      {/* Subtle grid background */}
      <div className="login-grid-bg" />

      {/* Floating ambient glow */}
      <div style={{
        position: 'absolute',
        top: '35%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <span style={{ fontSize: 22, letterSpacing: '-0.04em' }}>E</span>
        </div>

        <h1 className="login-title">ElectroCODE</h1>
        <p className="login-subtitle">
          AI-Powered IDE for Microcontrollers
        </p>

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
          style={loading ? {} : { 
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {loading ? (
            <>
              <div className="login-spinner" />
              Authenticating...
            </>
          ) : (
            <>
              <GoogleIcon size={18} />
              Continue with Google
            </>
          )}
        </button>

        <div className="login-footer">
          By continuing, you agree to the ElectroCODE Terms of Service.
        </div>
      </div>
    </div>
  )
}