import { FileCode, FileText, FileJson, File } from 'lucide-react'

export interface FileIconInfo {
  color: string
  label: string
}

const EXT_MAP: Record<string, FileIconInfo> = {
  // Python
  '.py':  { color: '#3572A5', label: 'Python' },
  // MicroPython / CircuitPython use same ext
  // JavaScript / TypeScript
  '.js':  { color: '#f1e05a', label: 'JavaScript' },
  '.jsx': { color: '#f1e05a', label: 'JavaScript React' },
  '.ts':  { color: '#3178c6', label: 'TypeScript' },
  '.tsx': { color: '#3178c6', label: 'TypeScript React' },
  // C / C++ (Arduino)
  '.c':   { color: '#555555', label: 'C' },
  '.h':   { color: '#178600', label: 'C Header' },
  '.cpp': { color: '#f34b7d', label: 'C++' },
  '.ino': { color: '#00979d', label: 'Arduino' },
  // Web
  '.html':{ color: '#e34c26', label: 'HTML' },
  '.css': { color: '#563d7c', label: 'CSS' },
  // Data
  '.json':{ color: '#292929', label: 'JSON' },
  '.yaml':{ color: '#cb171e', label: 'YAML' },
  '.yml': { color: '#cb171e', label: 'YAML' },
  '.toml':{ color: '#9c4221', label: 'TOML' },
  // Docs
  '.md':  { color: '#083fa1', label: 'Markdown' },
  '.txt': { color: '#888888', label: 'Text' },
  // Config
  '.env': { color: '#ecd53f', label: 'Env' },
  '.cfg': { color: '#6e6e6e', label: 'Config' },
  '.ini': { color: '#6e6e6e', label: 'INI' },
}

export function getFileIconInfo(filename: string): FileIconInfo {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return { color: '#8d8d8d', label: 'File' }
  const ext = filename.slice(dot).toLowerCase()
  return EXT_MAP[ext] ?? { color: '#8d8d8d', label: 'File' }
}

export function getLanguageFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return 'plaintext'
  const ext = filename.slice(dot).toLowerCase()
  const langMap: Record<string, string> = {
    '.py':   'python',
    '.js':   'javascript',
    '.jsx':  'javascript',
    '.ts':   'typescript',
    '.tsx':  'typescript',
    '.c':    'c',
    '.h':    'c',
    '.cpp':  'cpp',
    '.ino':  'cpp',
    '.html': 'html',
    '.css':  'css',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml':  'yaml',
    '.md':   'markdown',
    '.txt':  'plaintext',
  }
  return langMap[ext] ?? 'plaintext'
}

interface FileIconProps {
  filename: string
  size?: number
}

export function FileIcon({ filename, size = 14 }: FileIconProps) {
  const info = getFileIconInfo(filename)
  const dot = filename.lastIndexOf('.')
  const ext = dot !== -1 ? filename.slice(dot).toLowerCase() : ''

  const iconProps = {
    size,
    style: { color: info.color, flexShrink: 0 },
  }

  if (ext === '.json') return <FileJson {...iconProps} />
  if (ext === '.md' || ext === '.txt') return <FileText {...iconProps} />
  if (['.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.h', '.cpp', '.ino', '.html', '.css'].includes(ext)) {
    return <FileCode {...iconProps} />
  }
  return <File {...iconProps} />
}