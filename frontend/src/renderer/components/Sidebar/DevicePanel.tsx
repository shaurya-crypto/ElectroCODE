import { RefreshCw, Circle, ChevronDownIcon } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";

export default function DevicePanel() {
  const {
    interpreter,
    setInterpreterModalOpen,
    availablePorts,
    setAvailablePorts,
    selectedPort,
    setSelectedPort,
    isConnected,
    setConnected,
    isScanning,
    setScanning,
    addTerminalLine,
    activeTerminalId,
    showNotification,
  } = useAppStore();

  async function scanPorts() {
    setScanning(true);
    const ports = (await (window as any).electronAPI?.listPorts?.()) ?? [];
    setAvailablePorts(ports);
    if (ports.length > 0 && !selectedPort) setSelectedPort(ports[0].path);
    if (ports.length === 0)
      showNotification("No devices found. Check USB connection.", "warning");
    else showNotification(`Found ${ports.length} port(s)`, "info");
    setScanning(false);
  }

  async function connect() {
    if (!interpreter) {
      showNotification(
        "Select an interpreter first (Tools > Select Interpreter)",
        "warning",
      );
      return;
    }
    if (!selectedPort) {
      showNotification("No port selected. Scan first.", "warning");
      return;
    }

    if (isConnected) {
      await (window as any).electronAPI?.stopMonitor?.();
      setConnected(false);
      addTerminalLine(activeTerminalId, `Disconnected from ${selectedPort}`);
      showNotification("Disconnected", "info");
      return;
    }

    const store = useAppStore.getState();
    if (!store.lockDevice("Checking connection")) return;

    try {
      const check = await (window as any).electronAPI.checkChip({
        port: selectedPort,
      });

      if (!check?.connected) {
        showNotification(check?.message ?? "Chip not connected", "error");
        addTerminalLine(activeTerminalId, `ERROR: ${check?.message}`);
        store.unlockDevice();
        return;
      }

      setConnected(true);
      addTerminalLine(
        activeTerminalId,
        `Connected to ${selectedPort} — ${interpreter.chip} (${interpreter.langDisplay})`,
      );
      showNotification(`Fetching device files...`, "info");
      
      // Fetch device files - this will also start the serial monitor afterwards
      await store.fetchDeviceFiles();

      showNotification(`Connected to ${selectedPort}`, "success");
    } catch (e) {
      console.error(e);
    } finally {
      store.unlockDevice();
    }
  }

  const selectedPortInfo = availablePorts.find((p) => p.path === selectedPort);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-header">Device</div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {/* Interpreter */}
        <div style={{ marginBottom: 16 }}>
          <div className="form-label">Interpreter</div>
          <button
            onClick={() => setInterpreterModalOpen(true)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-light)",
              color: interpreter ? "var(--text-primary)" : "var(--text-dim)",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "var(--radius)",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {interpreter
                ? `${interpreter.label} (${interpreter.langDisplay})`
                : "Select interpreter..."}
            </span>
            <ChevronDownIcon />
          </button>
          {interpreter && (
            <div
              style={{
                marginTop: 6,
                padding: "6px 10px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Chip</span>
                <span
                  style={{
                    fontFamily: "var(--font-code)",
                    color: "var(--text-primary)",
                  }}
                >
                  {interpreter.chip}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 3,
                }}
              >
                <span>Language</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {interpreter.langDisplay}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Port */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span className="form-label" style={{ margin: 0 }}>
              Port
            </span>
            <button
              className="icon-btn"
              onClick={scanPorts}
              disabled={isScanning}
              title="Scan for ports"
              style={{ width: 20, height: 20 }}
            >
              <RefreshCw
                size={11}
                style={{
                  animation: isScanning ? "spin 1s linear infinite" : "none",
                }}
              />
            </button>
          </div>

          {availablePorts.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              No ports found.{" "}
              <button
                onClick={scanPorts}
                style={{
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 12,
                }}
              >
                Scan
              </button>
            </div>
          ) : (
            <select
              className="form-select"
              value={selectedPort ?? ""}
              onChange={(e) => setSelectedPort(e.target.value)}
              style={{ fontFamily: "var(--font-code)" }}
            >
              <option value="" disabled>
                Select port...
              </option>
              {availablePorts.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}
                  {p.manufacturer ? ` — ${p.manufacturer}` : ""}
                </option>
              ))}
            </select>
          )}

          {selectedPortInfo && (
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-code)",
              }}
            >
              {selectedPortInfo.description}
            </div>
          )}
        </div>

        {/* Connection status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 10px",
            background: isConnected
              ? "rgba(78,201,176,0.08)"
              : "var(--bg-elevated)",
            border: `1px solid ${isConnected ? "rgba(78,201,176,0.25)" : "var(--border)"}`,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          <Circle
            size={7}
            fill={isConnected ? "var(--green)" : "var(--text-dim)"}
            stroke="none"
          />
          <span
            style={{
              color: isConnected ? "var(--green)" : "var(--text-muted)",
            }}
          >
            {isConnected ? `Connected — ${selectedPort}` : "Not connected"}
          </span>
        </div>

        {/* Connect button */}
        <button
          className={`btn ${isConnected ? "btn-secondary" : "btn-primary"}`}
          style={{ width: "100%", justifyContent: "center" }}
          onClick={connect}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </button>

        {/* Warnings */}
        {!interpreter && (
          <div
            style={{
              marginTop: 10,
              padding: "7px 10px",
              background: "rgba(204,167,0,0.08)",
              border: "1px solid rgba(204,167,0,0.25)",
              fontSize: 12,
              color: "var(--yellow)",
            }}
          >
            No interpreter selected. Go to Tools &gt; Select Interpreter.
          </div>
        )}
      </div>
    </div>
  );
}
