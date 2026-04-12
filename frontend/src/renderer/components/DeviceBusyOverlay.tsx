import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function DeviceBusyOverlay() {
  const { isDeviceBusy, busyReason } = useAppStore();

  if (!isDeviceBusy) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'not-allowed', // Prevent interactions
      }}
      onClick={(e) => {
        // Block all click events from passing through
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div 
        className="anim-fade"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          maxWidth: '400px',
          textAlign: 'center'
        }}
      >
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>
            Device is Busy
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {busyReason || 'Action in progress...'}
          </p>
        </div>
      </div>
    </div>
  );
}
