import { X, Circle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const langIcon: Record<string, string> = {
  python: '🐍',
  javascript: '🟨',
  typescript: '🔷',
  json: '{}',
  markdown: '📝',
}

export default function Toolbar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppStore()

  return (
    <div
      className="flex items-end overflow-x-auto flex-shrink-0"
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        height: 35,
        minHeight: 35,
      }}
    >
      {tabs.length === 0 ? (
        <div className="px-4 flex items-center h-full"
          style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-code)' }}>
          No files open
        </div>
      ) : (
        tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={{ fontSize: 11 }}>{langIcon[tab.language] ?? '📄'}</span>
            <span>{tab.name}</span>
            {tab.content !== tab.savedContent && (
              <Circle
                size={6}
                fill="var(--accent)"
                stroke="none"
                style={{ flexShrink: 0 }}
              />
            )}
            <span
              className="close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              <X size={10} />
            </span>
          </div>
        ))
      )}
    </div>
  )
}
