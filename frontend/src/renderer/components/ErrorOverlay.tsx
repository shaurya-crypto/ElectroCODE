import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function ErrorOverlay() {
  const { errorOverlay, clearErrorOverlay } = useAppStore();

  if (!errorOverlay) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div 
        className="anim-fade"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--red-dim)',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)',
          maxWidth: '450px',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <button 
          onClick={clearErrorOverlay}
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        <AlertTriangle size={42} style={{ color: 'var(--red)' }} />
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>
            Device Connection Error
          </h3>
          <div style={{ 
            fontSize: '13px', 
            color: 'var(--text-muted)', 
            background: 'var(--bg-base)', 
            padding: '12px', 
            borderRadius: '4px',
            fontFamily: 'var(--font-code)',
            textAlign: 'left',
            wordWrap: 'break-word'
          }}>
            {errorOverlay}
          </div>
        </div>
        
        <button 
          onClick={clearErrorOverlay}
          style={{
            marginTop: '8px',
            background: 'var(--red)',
            color: 'white',
            border: 'none',
            padding: '8px 24px',
            borderRadius: '4px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
