import Editor from '@monaco-editor/react'
import { useAppStore } from '../../store/useAppStore'
import { CheckCircle, XCircle } from 'lucide-react'
import { sendMcpEvent } from '../../store/mcpClient'

export default function CodeEditor() {
  const {
    tabs, activeTabId, updateContent, theme,
    aiSuggestion, acceptSuggestion, declineSuggestion,
  } = useAppStore()

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const monacoTheme = theme === 'dark' ? 'electrocode-dark' : 'electrocode-light'

  function defineThemes(monaco: any) {
    monaco.editor.defineTheme('electrocode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '',              foreground: 'd4d4d4' },
        { token: 'comment',      foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword',      foreground: '569cd6' },
        { token: 'string',       foreground: 'ce9178' },
        { token: 'number',       foreground: 'b5cea8' },
        { token: 'type',         foreground: '4ec9b0' },
        { token: 'function',     foreground: 'dcdcaa' },
        { token: 'variable',     foreground: '9cdcfe' },
        { token: 'operator',     foreground: 'd4d4d4' },
        { token: 'delimiter',    foreground: 'd4d4d4' },
        { token: 'constant',     foreground: '4fc1ff' },
        { token: 'tag',          foreground: '569cd6' },
        { token: 'attribute',    foreground: '9cdcfe' },
      ],
      colors: {
        'editor.background':                  '#1e1e1e',
        'editor.foreground':                  '#d4d4d4',
        'editorLineNumber.foreground':        '#858585',
        'editorLineNumber.activeForeground':  '#c6c6c6',
        'editor.lineHighlightBackground':     '#2a2d2e',
        'editor.selectionBackground':         '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorCursor.foreground':            '#aeafad',
        'editorWhitespace.foreground':        '#3b3b3b',
        'editorIndentGuide.background1':      '#404040',
        'editorIndentGuide.activeBackground1':'#707070',
        'editorBracketMatch.background':      '#0064001a',
        'editorBracketMatch.border':          '#888888',
        'scrollbar.shadow':                   '#000000',
        'scrollbarSlider.background':         '#42424266',
        'scrollbarSlider.hoverBackground':    '#686868aa',
        'scrollbarSlider.activeBackground':   '#bfbfbf66',
        'editorWidget.background':            '#252526',
        'editorWidget.border':                '#3c3c3c',
        'editorSuggestWidget.background':     '#252526',
        'editorSuggestWidget.border':         '#454545',
        'editorSuggestWidget.selectedBackground':'#062f4a',
        'editorHoverWidget.background':       '#252526',
        'editorHoverWidget.border':           '#454545',
        'input.background':                   '#3c3c3c',
        'input.border':                       '#3c3c3c',
        'input.foreground':                   '#cccccc',
        'focusBorder':                        '#0078d4',
        'minimap.background':                 '#1e1e1e',
      },
    })

    monaco.editor.defineTheme('electrocode-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '',          foreground: '383838' },
        { token: 'comment',   foreground: '008000', fontStyle: 'italic' },
        { token: 'keyword',   foreground: '0000ff' },
        { token: 'string',    foreground: 'a31515' },
        { token: 'number',    foreground: '098658' },
        { token: 'type',      foreground: '267f99' },
        { token: 'function',  foreground: '795e26' },
        { token: 'variable',  foreground: '001080' },
      ],
      colors: {
        'editor.background':                  '#ffffff',
        'editor.foreground':                  '#383838',
        'editorLineNumber.foreground':        '#237893',
        'editor.lineHighlightBackground':     '#f0f0f0',
        'editor.selectionBackground':         '#add6ff',
        'editorCursor.foreground':            '#000000',
        'scrollbarSlider.background':         '#c1c1c188',
        'editorWidget.background':            '#f3f3f3',
        'editorSuggestWidget.background':     '#f3f3f3',
        'focusBorder':                        '#0078d4',
      },
    })
  }

  if (!activeTab) {
    return (
      <div className="welcome-screen" style={{ fontSize: 13 }}>
        <div style={{
          marginBottom: 24,
          fontWeight: 700,
          fontSize: 20,
          color: 'var(--text-dim)',
          letterSpacing: '-0.01em',
        }}>
          Electro CODE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {[
            ['Ctrl+N', 'New File'],
            ['Ctrl+O', 'Open File'],
            ['Ctrl+K Ctrl+O', 'Open Folder'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-code)',
                fontSize: 11,
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                padding: '1px 6px',
                minWidth: 130,
              }}>
                {key}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* AI Suggestion bar */}
      {aiSuggestion && (
        <div className="ai-suggestion-bar">
          <span style={{ flex: 1 }}>
            AI suggestion ready — review the code below
          </span>
          <button
            onClick={acceptSuggestion}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 10px',
              background: 'rgba(78,201,176,0.15)',
              border: '1px solid rgba(78,201,176,0.4)',
              color: '#4ec9b0',
              cursor: 'pointer',
              fontSize: 12,
              borderRadius: 'var(--radius)',
            }}
          >
            <CheckCircle size={12} /> Accept
          </button>
          <button
            onClick={declineSuggestion}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 10px',
              background: 'rgba(244,71,71,0.12)',
              border: '1px solid rgba(244,71,71,0.35)',
              color: 'var(--red)',
              cursor: 'pointer',
              fontSize: 12,
              borderRadius: 'var(--radius)',
            }}
          >
            <XCircle size={12} /> Decline
          </button>
        </div>
      )}

      <Editor
        height="100%"
        language={activeTab.language}
        value={aiSuggestion ? aiSuggestion.code : activeTab.content}
        onChange={(val) => {
          const store = useAppStore.getState()
          if (!store.aiSuggestion) {
            updateContent(activeTab.id, val ?? '')
            sendMcpEvent('code_sync', {
              filePath: activeTab.filePath || activeTab.name || 'untitled',
              content: val ?? '',
              cursorLine: 0,
              cursorChar: 0,
              selectedText: ''
            })
          }
        }}
        theme={monacoTheme}
        beforeMount={defineThemes}
        options={{
          fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
          fontSize: 14,
          fontLigatures: true,
          lineHeight: 21,
          minimap: { enabled: true, scale: 1, renderCharacters: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          cursorBlinking: 'blink',
          cursorSmoothCaretAnimation: 'off',
          smoothScrolling: false,
          padding: { top: 4, bottom: 4 },
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'off',
          bracketPairColorization: { enabled: false },
          guides: { indentation: true, bracketPairs: false },
          suggest: { preview: true },
          inlineSuggest: { enabled: true },
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          renderWhitespace: 'none',
          occurrencesHighlight: 'singleFile',
          overviewRulerLanes: 2,
          hideCursorInOverviewRuler: false,
          links: true,
          readOnly: !!aiSuggestion, // lock editor when suggestion pending
        }}
      />
    </div>
  )
}