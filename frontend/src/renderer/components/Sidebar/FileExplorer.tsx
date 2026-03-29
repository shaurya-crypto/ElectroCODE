import { useState } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, RefreshCw, FolderOpen as OpenFolder, FilePlus
} from 'lucide-react'
import { useAppStore, FileNode } from '../../store/useAppStore'
import { FileIcon, getLanguageFromFilename } from '../../utils/Fileicon'

interface ContextMenuState {
  x: number
  y: number
  node: FileNode | null
  isDevice?: boolean
}

function ContextMenu({ state, onClose }: { state: ContextMenuState; onClose: () => void }) {
  const { showNotification, openTab, openedFolderPath, refreshLocalFolder, fetchDeviceFiles, selectedPort, newUntitledTab } = useAppStore()

  const actions = []
  
  if (state.node) {
    if (state.node.type === 'file') {
      actions.push({
        label: 'Open',
        action: async () => {
          const node = state.node
          if (!node) return
          const content = state.isDevice 
            ? await (window as any).electronAPI?.readFile?.({ port: selectedPort, filePath: node.filePath })
            : await (window as any).electronAPI?.fsReadFile?.({ filePath: node.filePath })
          openTab({
            id: (state.isDevice ? 'dev_' : '') + node.id,
            name: node.name,
            filePath: node.filePath,
            content: content || '',
            language: getLanguageFromFilename(node.name),
            source: state.isDevice ? 'device' : 'local'
          })
        }
      })
    }
    
    actions.push({
      label: 'Rename',
      action: async () => {
        const node = state.node
        if (!node) return
        const newName = window.prompt('New name:', node.name)
        if (!newName || newName === node.name) return
        
        if (state.isDevice) {
           try {
             await (window as any).electronAPI.stopMonitor()
             if (node.type === 'file') {
               const content = await (window as any).electronAPI?.readFile?.({ port: selectedPort, filePath: node.filePath })
               if (content !== null && content !== undefined) {
                 await (window as any).electronAPI?.writeFile?.({ port: selectedPort, filePath: newName, content })
                 await (window as any).electronAPI?.deleteFile?.({ port: selectedPort, filePath: node.name })
                 await fetchDeviceFiles()
                 showNotification(`Renamed to ${newName}`, 'success')
               } else showNotification('Failed to read device file for rename', 'error')
             } else {
               showNotification('Folder rename on device not supported yet', 'warning')
             }
           } catch { showNotification('Device rename failed', 'error') }
           finally { await (window as any).electronAPI.startMonitor({ port: selectedPort, baudRate: 115200 }) }
           return
        }

        const isWin = node.filePath.includes('\\')
        const lastSlash = node.filePath.lastIndexOf(isWin ? '\\' : '/')
        const dir = node.filePath.substring(0, lastSlash)
        const newPath = dir + (isWin ? '\\' : '/') + newName
        const res = await (window as any).electronAPI?.fsRename?.({ oldPath: node.filePath, newPath })
        if (res?.success) refreshLocalFolder()
        else showNotification(`Rename failed: ${res?.message}`, 'error')
      }
    })
    
    actions.push({
      label: 'Delete',
      action: async () => {
        const node = state.node
        if (!node) return
        if (!window.confirm(`Delete ${node.name}?`)) return
        
        if (state.isDevice) {
          await (window as any).electronAPI.stopMonitor()
          const res = await (window as any).electronAPI?.deleteFile?.({ port: selectedPort, filePath: node.name })
          if (res?.success) await fetchDeviceFiles()
          else showNotification(`Device delete failed: ${res?.message}`, 'error')
          await (window as any).electronAPI.startMonitor({ port: selectedPort, baudRate: 115200 })
        } else {
          const res = await (window as any).electronAPI?.fsDelete?.({ filePath: node.filePath })
          if (res?.success) refreshLocalFolder()
          else showNotification(`Delete failed: ${res?.message}`, 'error')
        }
      }
    })
    
    actions.push({
      label: 'Copy Path',
      action: () => {
        if (!state.node) return
        navigator.clipboard.writeText(state.node.filePath ?? '')
        showNotification('Path copied', 'success')
      }
    })
  } else {
    // Root level context menu (background click)
    if (!state.isDevice) {
      actions.push({
        label: 'New File',
        action: async () => {
          const base = openedFolderPath
          if (!base) { newUntitledTab(); return }
          const name = window.prompt('File name (with extension):')
          if (!name) return
          const filePath = base.replace(/\\/g, '/') + '/' + name
          const result = await (window as any).electronAPI?.createFile?.({ filePath, content: '' })
          if (result?.success) {
            await refreshLocalFolder()
            openTab({
              id: filePath,
              name: name,
              filePath: filePath,
              content: '',
              language: getLanguageFromFilename(name),
              source: 'local'
            })
          }
          else showNotification('Failed to create file', 'error')
        }
      })
      actions.push({
        label: 'New Folder',
        action: async () => {
          const base = openedFolderPath
          if (!base) { showNotification('Open a folder first', 'warning'); return }
          const name = window.prompt('Folder name:')
          if (!name) return
          const folderPath = base.replace(/\\/g, '/') + '/' + name
          const result = await (window as any).electronAPI?.createFolder?.({ folderPath })
          if (result?.success) refreshLocalFolder()
          else showNotification('Failed to create folder', 'error')
        }
      })
      actions.push({
        label: 'Open in File Explorer',
        action: () => showNotification('Not implemented', 'info')
      })
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 8998 }} onClick={onClose} />
      <div className="context-menu anim-fade" style={{ top: state.y, left: state.x, zIndex: 8999 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            className="context-item"
            onClick={() => { a.action(); onClose() }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  )
}

interface TreeRowProps {
  node: FileNode
  depth: number
  onContextMenu: (e: React.MouseEvent, node: FileNode, isDevice?: boolean) => void
  isDevice?: boolean
}

function TreeRow({ node, depth, onContextMenu, isDevice }: TreeRowProps) {
  const {
    activeTabId, openTab, toggleFolder,
    selectedFileId, setSelectedFileId,
    selectedPort, showNotification,
  } = useAppStore()

  const isExpanded = node.expanded
  const isSelected = selectedFileId === node.id

  async function handleClick() {
    setSelectedFileId(node.id)

    if (node.type === 'folder') {
      toggleFolder(node.id, isDevice)
      return
    }

    // ── File click ──
    if (isDevice) {
      if (!selectedPort) {
        showNotification('Not connected to a device', 'error')
        return
      }
      try {
        await (window as any).electronAPI.stopMonitor()
        const content = await (window as any).electronAPI?.readFile?.({
          port: selectedPort,
          filePath: node.filePath,
        })
        if (content !== null && content !== undefined) {
          openTab({
            id: 'dev_' + node.id,
            name: node.name,
            filePath: node.filePath,
            content: content,
            language: getLanguageFromFilename(node.name),
            source: 'device'
          })
        } else {
          showNotification('Failed to read file from device', 'error')
        }
      } catch {
        showNotification('Failed to read file from device', 'error')
      } finally {
        await (window as any).electronAPI.startMonitor({ port: selectedPort, baudRate: 115200 })
      }
    } else {
      // Read from local disk via fs:readFile
      let content = ''
      if (node.filePath) {
        try {
          content = await (window as any).electronAPI?.fsReadFile?.({ filePath: node.filePath }) ?? ''
        } catch {
          content = ''
        }
      } else {
        content = (node as any).content ?? `# ${node.name}\n`
      }

      openTab({
        id: node.id,
        name: node.name,
        filePath: node.filePath,
        content: content,
        language: getLanguageFromFilename(node.name),
      })
    }
  }

  return (
    <div>
      <div
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: depth * 12 + 4, paddingRight: 8 }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node, isDevice) }}
      >
        {node.type === 'folder' ? (
          <span style={{ color: 'var(--text-muted)', display: 'flex', flexShrink: 0, width: 16 }}>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span style={{ display: 'inline-block', width: 16, flexShrink: 0 }} />
        )}

        {node.type === 'folder' ? (
          <span style={{ color: '#c8a04a', display: 'flex', marginRight: 5, flexShrink: 0 }}>
            {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
        ) : (
          <span style={{ marginRight: 5, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <FileIcon filename={node.name} size={14} />
          </span>
        )}

        <span style={{
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          color: 'var(--text-primary)',
        }}>
          {node.name}
        </span>
      </div>

      {node.type === 'folder' && isExpanded && node.children?.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          onContextMenu={onContextMenu}
          isDevice={isDevice}
        />
      ))}
    </div>
  )
}

export default function FileExplorer() {
  const {
    fileTree, openFolder, newUntitledTab, showNotification,
    deviceFileTree, isConnected, fetchDeviceFiles,
    openedFolderPath, refreshLocalFolder, openTab,
  } = useAppStore()

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  async function handleNewFile() {
    if (!openedFolderPath) {
      // Fallback: create untitled tab
      newUntitledTab()
      return
    }
    const name = window.prompt('File name (with extension):')
    if (!name) return
    const filePath = openedFolderPath.replace(/\\/g, '/') + '/' + name
    const result = await (window as any).electronAPI?.createFile?.({ filePath, content: '' })
    if (result?.success) {
      await refreshLocalFolder()
      openTab({
        id: filePath,
        name: name,
        filePath: filePath,
        content: '',
        language: getLanguageFromFilename(name),
        source: 'local'
      })
    }
    else showNotification('Failed to create file', 'error')
  }

  async function handleNewFolder() {
    if (!openedFolderPath) {
      showNotification('Open a folder first to create folders. Use the Open Folder button.', 'warning')
      return
    }
    const name = window.prompt('Folder name:')
    if (!name) return
    const folderPath = openedFolderPath.replace(/\\/g, '/') + '/' + name
    const result = await (window as any).electronAPI?.createFolder?.({ folderPath })
    if (result?.success) await refreshLocalFolder()
    else showNotification('Failed to create folder', 'error')
  }

  function onContextMenu(e: React.MouseEvent, node: FileNode, isDevice?: boolean) {
    setContextMenu({ x: e.clientX, y: e.clientY, node, isDevice })
  }

  function onRootContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node: null, isDevice: false })
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
      }}
      onContextMenu={onRootContextMenu}
    >
      {/* Header */}
      <div className="section-header">
        <span>Explorer</span>
        <div className="section-header-actions">
          <button className="icon-btn" title="New File" onClick={handleNewFile}>
            <FilePlus size={14} />
          </button>
          <button className="icon-btn" title="New Folder" onClick={handleNewFolder}>
            <Plus size={14} />
          </button>
          <button className="icon-btn" title="Open Folder" onClick={() => openFolder('')}>
            <OpenFolder size={14} />
          </button>
          <button className="icon-btn" title="Refresh" onClick={refreshLocalFolder}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Local Files ── */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {fileTree.length === 0 ? (
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <p>No folder open.</p>
              <button
                style={{
                  marginTop: 6,
                  color: 'var(--accent)', background: 'none',
                  border: 'none', cursor: 'pointer',
                  padding: 0, fontSize: 12, textDecoration: 'underline',
                }}
                onClick={() => openFolder('')}
              >
                Open Folder
              </button>
            </div>
          ) : (
            fileTree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                onContextMenu={onContextMenu}
                isDevice={false}
              />
            ))
          )}
        </div>

        {/* ── Device Files ── */}
        {isConnected && (
          <div style={{
            borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '40%',
          }}>
            <div className="section-header" style={{ borderBottom: '1px solid var(--border)' }}>
              <span>Device Files</span>
              <div className="section-header-actions">
                <button className="icon-btn" title="Refresh device files" onClick={fetchDeviceFiles}>
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
              {deviceFileTree.length === 0 ? (
                <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  No files on device.{' '}
                  <button
                    style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}
                    onClick={fetchDeviceFiles}
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                deviceFileTree.map((node) => (
                  <TreeRow
                    key={'dev_' + node.id}
                    node={node}
                    depth={0}
                    onContextMenu={onContextMenu}
                    isDevice={true}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  )
}