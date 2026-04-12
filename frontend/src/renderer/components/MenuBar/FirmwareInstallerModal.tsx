import { useState, useEffect, useCallback } from 'react'
import { X, HardDrive, Download, AlertTriangle, Check, Loader2, RefreshCw, Info } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface Volume {
  path: string
  label: string
}

type InstallStep = 'instructions' | 'configure' | 'downloading' | 'installing' | 'done' | 'error'

// ── Official firmware download URL registry ─────────────────────────────────
// These are real, direct download links from the official sources.
// The app auto-downloads the selected firmware to a local cache before flashing.

interface FirmwareEntry {
  variant: string
  version: string
  url: string
  fileName: string
}

interface FamilyConfig {
  title: string
  entries: FirmwareEntry[]
  docUrl: string
}

const FIRMWARE_REGISTRY: Record<string, FamilyConfig> = {
  micropython: {
    title: 'MicroPython',
    docUrl: 'https://micropython.org/download/',
    entries: [
      // Raspberry Pi Pico
      { variant: 'Raspberry Pi Pico', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/RPI_PICO-20260406-v1.28.0.uf2', fileName: 'RPI_PICO-v1.28.0.uf2' },
      { variant: 'Raspberry Pi Pico', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/RPI_PICO-20241129-v1.24.1.uf2', fileName: 'RPI_PICO-v1.24.1.uf2' },
      { variant: 'Raspberry Pi Pico', version: 'v1.23.0', url: 'https://micropython.org/resources/firmware/RPI_PICO-20240602-v1.23.0.uf2', fileName: 'RPI_PICO-v1.23.0.uf2' },
      { variant: 'Raspberry Pi Pico', version: 'v1.22.2', url: 'https://micropython.org/resources/firmware/RPI_PICO-20240222-v1.22.2.uf2', fileName: 'RPI_PICO-v1.22.2.uf2' },
      // Raspberry Pi Pico W
      { variant: 'Raspberry Pi Pico W', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/RPI_PICO_W-20260406-v1.28.0.uf2', fileName: 'RPI_PICO_W-v1.28.0.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/RPI_PICO_W-20241129-v1.24.1.uf2', fileName: 'RPI_PICO_W-v1.24.1.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v1.23.0', url: 'https://micropython.org/resources/firmware/RPI_PICO_W-20240602-v1.23.0.uf2', fileName: 'RPI_PICO_W-v1.23.0.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v1.22.2', url: 'https://micropython.org/resources/firmware/RPI_PICO_W-20240222-v1.22.2.uf2', fileName: 'RPI_PICO_W-v1.22.2.uf2' },
      // Raspberry Pi Pico 2
      { variant: 'Raspberry Pi Pico 2', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/RPI_PICO2-20260406-v1.28.0.uf2', fileName: 'RPI_PICO2-v1.28.0.uf2' },
      { variant: 'Raspberry Pi Pico 2', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/RPI_PICO2-20241129-v1.24.1.uf2', fileName: 'RPI_PICO2-v1.24.1.uf2' },
      // ESP32
      { variant: 'ESP32 (Generic)', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/ESP32_GENERIC-20260406-v1.28.0.bin', fileName: 'ESP32_GENERIC-v1.28.0.bin' },
      { variant: 'ESP32 (Generic)', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/ESP32_GENERIC-20241129-v1.24.1.bin', fileName: 'ESP32_GENERIC-v1.24.1.bin' },
      { variant: 'ESP32 (Generic)', version: 'v1.23.0', url: 'https://micropython.org/resources/firmware/ESP32_GENERIC-20240602-v1.23.0.bin', fileName: 'ESP32_GENERIC-v1.23.0.bin' },
      // ESP32-S3
      { variant: 'ESP32-S3', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/ESP32_GENERIC_S3-20260406-v1.28.0.bin', fileName: 'ESP32_GENERIC_S3-v1.28.0.bin' },
      { variant: 'ESP32-S3', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/ESP32_GENERIC_S3-20241129-v1.24.1.bin', fileName: 'ESP32_GENERIC_S3-v1.24.1.bin' },
      // ESP8266
      { variant: 'ESP8266', version: 'v1.28.0 (latest)', url: 'https://micropython.org/resources/firmware/ESP8266_GENERIC-20260406-v1.28.0.bin', fileName: 'ESP8266_GENERIC-v1.28.0.bin' },
      { variant: 'ESP8266', version: 'v1.24.1', url: 'https://micropython.org/resources/firmware/ESP8266_GENERIC-20241129-v1.24.1.bin', fileName: 'ESP8266_GENERIC-v1.24.1.bin' },
    ],
  },
  circuitpython: {
    title: 'CircuitPython',
    docUrl: 'https://circuitpython.org/downloads',
    entries: [
      { variant: 'Raspberry Pi Pico', version: 'v9.2.7 (latest)', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico/en_US/adafruit-circuitpython-raspberry_pi_pico-en_US-9.2.7.uf2', fileName: 'circuitpython-pico-9.2.7.uf2' },
      { variant: 'Raspberry Pi Pico', version: 'v9.2.4', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico/en_US/adafruit-circuitpython-raspberry_pi_pico-en_US-9.2.4.uf2', fileName: 'circuitpython-pico-9.2.4.uf2' },
      { variant: 'Raspberry Pi Pico', version: 'v9.1.0', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico/en_US/adafruit-circuitpython-raspberry_pi_pico-en_US-9.1.0.uf2', fileName: 'circuitpython-pico-9.1.0.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v9.2.7 (latest)', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico_w/en_US/adafruit-circuitpython-raspberry_pi_pico_w-en_US-9.2.7.uf2', fileName: 'circuitpython-pico-w-9.2.7.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v9.2.4', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico_w/en_US/adafruit-circuitpython-raspberry_pi_pico_w-en_US-9.2.4.uf2', fileName: 'circuitpython-pico-w-9.2.4.uf2' },
      { variant: 'Raspberry Pi Pico W', version: 'v9.1.0', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico_w/en_US/adafruit-circuitpython-raspberry_pi_pico_w-en_US-9.1.0.uf2', fileName: 'circuitpython-pico-w-9.1.0.uf2' },
      { variant: 'Raspberry Pi Pico 2', version: 'v9.2.7 (latest)', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico2/en_US/adafruit-circuitpython-raspberry_pi_pico2-en_US-9.2.7.uf2', fileName: 'circuitpython-pico2-9.2.7.uf2' },
      { variant: 'Raspberry Pi Pico 2', version: 'v9.2.4', url: 'https://downloads.circuitpython.org/bin/raspberry_pi_pico2/en_US/adafruit-circuitpython-raspberry_pi_pico2-en_US-9.2.4.uf2', fileName: 'circuitpython-pico2-9.2.4.uf2' },
      { variant: 'Adafruit Feather RP2040', version: 'v9.2.7 (latest)', url: 'https://downloads.circuitpython.org/bin/adafruit_feather_rp2040/en_US/adafruit-circuitpython-adafruit_feather_rp2040-en_US-9.2.7.uf2', fileName: 'circuitpython-feather-rp2040-9.2.7.uf2' },
      { variant: 'Seeed XIAO RP2040', version: 'v9.2.7 (latest)', url: 'https://downloads.circuitpython.org/bin/seeeduino_xiao_rp2040/en_US/adafruit-circuitpython-seeeduino_xiao_rp2040-en_US-9.2.7.uf2', fileName: 'circuitpython-xiao-rp2040-9.2.7.uf2' },
    ],
  },
  arduino: {
    title: 'Arduino Core',
    docUrl: 'https://www.arduino.cc/en/software',
    entries: [
      { variant: 'ESP32 (All boards)', version: 'v3.3.6 (latest)', url: 'https://github.com/espressif/arduino-esp32/releases/download/3.3.6/esp32-3.3.6.zip', fileName: 'esp32-arduino-3.3.6.zip' },
      { variant: 'ESP32 (All boards)', version: 'v3.0.7', url: 'https://github.com/espressif/arduino-esp32/releases/download/3.0.7/esp32-3.0.7.zip', fileName: 'esp32-arduino-3.0.7.zip' },
      { variant: 'RP2040 (Pico)', version: 'v5.5.1 (latest)', url: 'https://github.com/earlephilhower/arduino-pico/releases/download/5.5.1/rp2040-5.5.1.zip', fileName: 'rp2040-arduino-5.5.1.zip' },
      { variant: 'RP2040 (Pico)', version: 'v4.4.0', url: 'https://github.com/earlephilhower/arduino-pico/releases/download/4.4.0/rp2040-4.4.0.zip', fileName: 'rp2040-arduino-4.4.0.zip' },
    ],
  },
}

// ── Helper: derive unique variants & versions from the registry ──────────
function getVariants(family: string): string[] {
  const entries = FIRMWARE_REGISTRY[family]?.entries || []
  return [...new Set(entries.map(e => e.variant))]
}

function getVersions(family: string, variant: string): string[] {
  const entries = FIRMWARE_REGISTRY[family]?.entries || []
  return entries.filter(e => e.variant === variant).map(e => e.version)
}

function findEntry(family: string, variant: string, version: string): FirmwareEntry | undefined {
  return FIRMWARE_REGISTRY[family]?.entries.find(e => e.variant === variant && e.version === version)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FirmwareInstallerModal() {
  const { firmwareModalFamily, closeFirmwareModal, showNotification } = useAppStore()
  const family = firmwareModalFamily || 'micropython'
  const config = FIRMWARE_REGISTRY[family]

  const variants = getVariants(family)
  const [step, setStep] = useState<InstallStep>('instructions')
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [selectedVolume, setSelectedVolume] = useState('')
  const [selectedVariant, setSelectedVariant] = useState(variants[0])
  const [selectedVersion, setSelectedVersion] = useState(getVersions(family, variants[0])[0])
  const [loadingVolumes, setLoadingVolumes] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Update versions when variant changes
  const availableVersions = getVersions(family, selectedVariant)

  useEffect(() => {
    setStep('instructions')
    const v = getVariants(family)
    setSelectedVariant(v[0])
    setSelectedVersion(getVersions(family, v[0])[0])
    setProgress(0)
    setProgressMsg('')
    setErrorMsg('')
  }, [family])

  // When variant changes, reset version to first available
  useEffect(() => {
    const vers = getVersions(family, selectedVariant)
    if (vers.length > 0 && !vers.includes(selectedVersion)) {
      setSelectedVersion(vers[0])
    }
  }, [selectedVariant])

  const refreshVolumes = useCallback(async () => {
    setLoadingVolumes(true)
    try {
      const vols: Volume[] = await (window as any).electronAPI.listVolumes()
      setVolumes(vols)
      if (vols.length > 0 && !selectedVolume) {
        setSelectedVolume(vols[0].path)
      }
    } catch {
      setVolumes([])
    }
    setLoadingVolumes(false)
  }, [selectedVolume])

  useEffect(() => {
    if (step === 'configure') {
      refreshVolumes()
    }
  }, [step])

  // Listen for real firmware progress IPC events
  useEffect(() => {
    if (step !== 'downloading' && step !== 'installing') return

    const cleanup = (window as any).electronAPI.onFirmwareProgress((data: {
      percent: number
      message: string
      done?: boolean
      error?: string
    }) => {
      if (data.percent >= 0) setProgress(data.percent)
      setProgressMsg(data.message)

      if (data.error) {
        setErrorMsg(data.error)
        setStep('error')
      } else if (data.done) {
        setStep('done')
      }
    })

    return cleanup
  }, [step])

  const handleInstall = async () => {
    if (!selectedVolume) {
      showNotification('Please select a target volume', 'warning')
      return
    }

    const entry = findEntry(family, selectedVariant, selectedVersion)
    if (!entry) {
      showNotification('No firmware available for this selection', 'error')
      return
    }

    // Step 1: Download firmware
    setStep('downloading')
    setProgress(0)
    setProgressMsg(`Downloading ${entry.fileName}...`)

    try {
      const downloadResult = await (window as any).electronAPI.downloadFirmware({
        url: entry.url,
        fileName: entry.fileName,
      })

      if (!downloadResult.success) {
        setErrorMsg(downloadResult.message || 'Download failed')
        setStep('error')
        return
      }

      // Step 2: Copy to target volume
      setStep('installing')
      setProgress(0)
      setProgressMsg(`Copying ${entry.fileName} to device...`)

      const installResult = await (window as any).electronAPI.installFirmware({
        sourcePath: downloadResult.filePath,
        targetVolume: selectedVolume,
      })

      if (!installResult.success) {
        setErrorMsg(installResult.message || 'Installation failed')
        setStep('error')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Unexpected error')
      setStep('error')
    }
  }

  const handleClose = () => {
    closeFirmwareModal()
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9998,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const modal: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, width: 520, maxHeight: '85vh', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
  }
  const header: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
  }
  const body: React.CSSProperties = { padding: '20px', overflowY: 'auto', flex: 1 }
  const footer: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)',
  }
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', border: '1px solid var(--border)',
    borderRadius: 6, fontSize: 13, outline: 'none', cursor: 'pointer',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
    marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em',
  }
  const fieldGroup: React.CSSProperties = { marginBottom: 16 }
  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px', background: 'var(--accent)', color: '#000',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }
  const btnSecondary: React.CSSProperties = {
    padding: '8px 20px', background: 'transparent', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="anim-fade" style={modal}>

        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Download size={16} color="#000" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Install {config.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Firmware Installer</div>
            </div>
          </div>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 4, borderRadius: 4, display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={body}>

          {/* Step 1: Instructions */}
          {step === 'instructions' && (
            <div>
              <div style={{
                background: 'rgba(78, 201, 176, 0.08)',
                border: '1px solid rgba(78, 201, 176, 0.2)',
                borderRadius: 8, padding: 16, marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Info size={18} style={{ color: '#4ec9b0', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    <strong style={{ display: 'block', marginBottom: 8 }}>
                      Put your device into bootloader mode:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li style={{ marginBottom: 6 }}>
                        Some devices have to be plugged in while holding the <strong>BOOTSEL</strong> button.
                      </li>
                      <li style={{ marginBottom: 6 }}>
                        Some require double-tapping the <strong>RESET</strong> button with proper rhythm.
                      </li>
                      <li style={{ marginBottom: 6 }}>
                        Wait for a couple of seconds until the target volume appears.
                      </li>
                      <li style={{ marginBottom: 6 }}>
                        Select desired variant and version.
                      </li>
                      <li style={{ marginBottom: 6 }}>
                        Click '<strong>Install</strong>' and wait for some seconds until done.
                      </li>
                      <li>
                        Close the dialog and start programming!
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button style={btnPrimary} onClick={() => setStep('configure')}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <div>
              {/* Target Volume */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Target Volume</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select style={{ ...selectStyle, flex: 1 }} value={selectedVolume}
                    onChange={(e) => setSelectedVolume(e.target.value)}>
                    {volumes.length === 0 && <option value="">No volumes detected</option>}
                    {volumes.map((v) => (
                      <option key={v.path} value={v.path}>{v.label}</option>
                    ))}
                  </select>
                  <button onClick={refreshVolumes} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 6, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    width: 36, color: 'var(--text-muted)',
                  }} title="Refresh volumes">
                    <RefreshCw size={14} className={loadingVolumes ? 'animate-spin' : ''} />
                  </button>
                </div>
                {volumes.length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} />
                    Put your device into bootloader mode first, then click refresh
                  </div>
                )}
              </div>

              {/* Family (read-only) */}
              <div style={fieldGroup}>
                <label style={labelStyle}>{config.title} Family</label>
                <select style={selectStyle} value={family} disabled>
                  <option>{config.title}</option>
                </select>
              </div>

              {/* Variant */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Variant</label>
                <select style={selectStyle} value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value)}>
                  {variants.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Version */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Version</label>
                <select style={selectStyle} value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}>
                  {availableVersions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Selected firmware info */}
              {findEntry(family, selectedVariant, selectedVersion) && (
                <div style={{
                  background: 'var(--bg-elevated)', borderRadius: 6, padding: '8px 12px',
                  fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
                  display: 'flex', alignItems: 'center', gap: 6,
                  border: '1px solid var(--border)',
                }}>
                  <HardDrive size={12} />
                  <span>
                    File: <strong style={{ color: 'var(--text-primary)' }}>
                      {findEntry(family, selectedVariant, selectedVersion)!.fileName}
                    </strong>
                    {' — '}will be downloaded automatically
                  </span>
                </div>
              )}

              {/* Doc link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                <Info size={12} />
                <span>
                  See{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); (window as any).electronAPI.openExternal(config.docUrl) }}
                    style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>
                    official downloads
                  </a>
                  {' '}for more variants.
                </span>
              </div>
            </div>
          )}

          {/* Step 3: Downloading */}
          {step === 'downloading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Download size={40} style={{ color: 'var(--accent)', marginBottom: 20, opacity: 0.7 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
                Downloading Firmware...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {progressMsg || 'Connecting to server...'}
              </div>
              <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                {progress >= 0 ? (
                  <div style={{
                    width: `${progress}%`, height: '100%', background: 'var(--accent)',
                    borderRadius: 4, transition: 'width 0.3s ease',
                  }} />
                ) : (
                  <div style={{
                    width: '40%', height: '100%', background: 'var(--accent)',
                    borderRadius: 4, animation: 'indeterminate 1.5s infinite ease-in-out',
                  }} />
                )}
              </div>
              {progress >= 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{progress}%</div>
              )}
            </div>
          )}

          {/* Step 4: Installing (copying to volume) */}
          {step === 'installing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: 20 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
                Installing to Device...
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                {progressMsg || 'Copying firmware to drive...'}
              </div>
              <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                <div style={{
                  width: `${progress}%`, height: '100%', background: 'var(--accent)',
                  borderRadius: 4, transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{progress}%</div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(78, 201, 176, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <Check size={28} style={{ color: '#4ec9b0' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Installation Complete!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {config.title} has been installed successfully. Close this dialog and start programming!
              </div>
            </div>
          )}

          {/* Step 6: Error */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(244, 71, 71, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <AlertTriangle size={28} style={{ color: '#f44747' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Installation Failed
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                {errorMsg || 'An unexpected error occurred.'}
              </div>
              <button style={btnSecondary} onClick={() => setStep('configure')}>
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'configure' || step === 'done') && (
          <div style={footer}>
            {step === 'configure' && (
              <>
                <button style={btnSecondary} onClick={() => {
                  (window as any).electronAPI.openExternal(config.docUrl)
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Info size={13} /> Info
                  </span>
                </button>
                <div style={{ flex: 1 }} />
                <button style={btnSecondary} onClick={handleClose}>Cancel</button>
                <button
                  style={{
                    ...btnPrimary,
                    opacity: volumes.length === 0 ? 0.5 : 1,
                    pointerEvents: volumes.length === 0 ? 'none' : 'auto',
                  }}
                  onClick={handleInstall}
                >
                  <Download size={14} /> Install
                </button>
              </>
            )}
            {step === 'done' && (
              <button style={btnPrimary} onClick={handleClose}>
                <Check size={14} /> Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
