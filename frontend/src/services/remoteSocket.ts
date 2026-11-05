/**
 * Klien WebSocket dua arah untuk sinkronisasi state & telemetri audio real-time
 * antara antarmuka PC Lab Display dan Admin Remote Control.
 */

export interface RoomState {
  is_monitoring: boolean;
  tolerance_seconds: number;
  alarm_enabled: boolean;
  lab_client_connected: boolean;
  lab_mic_ready: boolean;
  admin_count: number;
  lab_count: number;
  latest_telemetry: TelemetryPayload | null;
}

export interface TelemetryPayload {
  timestamp: number;
  is_monitoring: boolean;
  status: 'standby' | 'kondusif' | 'berisik';
  label: 'berisik' | 'non-berisik' | 'standby';
  confidence: number;
  probabilities: {
    non_berisik: number;
    berisik: number;
  };
  rms: number;
  centroid_hz: number;
  zcr: number;
  mfccs: number[];
  db_level: number;
  led_index: number;
  window_noisy_seconds: number;
  window_total_seconds: number;
  min_required_noisy: number;
  progress_pct: number;
  alarm_cooldown_seconds: number;
  alarm_triggered: boolean;
  session_seconds: number;
  total_chunks: number;
  noisy_chunks: number;
  clean_chunks: number;
  total_alerts_count: number;
  latency_ms: number;
  recent_timeline: Array<{ time: number; noiseProb: number; label: string }>;
  audio_preview?: number[];
}

export interface RemoteCommand {
  action: 'START_MONITORING' | 'STOP_MONITORING' | 'UPDATE_CONFIG' | 'RESET_BUFFER' | 'TRIGGER_TEST_ALARM';
  params?: {
    tolerance_seconds?: number;
    alarm_enabled?: boolean;
    [key: string]: unknown;
  };
}

type StateListener = (state: RoomState) => void;
type TelemetryListener = (telemetry: TelemetryPayload) => void;
type CommandListener = (command: RemoteCommand) => void;
type ConnectionListener = (connected: boolean) => void;

class RemoteSocketClient {
  private ws: WebSocket | null = null;
  private currentRole: 'lab' | 'admin' = 'lab';
  private reconnectTimer: number | null = null;
  private isExplicitDisconnect = false;
  private isConnected = false;

  private stateListeners: Set<StateListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private commandListeners: Set<CommandListener> = new Set();
  private connectionListeners: Set<ConnectionListener> = new Set();

  /**
   * Hubungkan WebSocket sesuai role yang aktif ('lab' atau 'admin').
   */
  public connect(role: 'lab' | 'admin') {
    this.currentRole = role;
    this.isExplicitDisconnect = false;

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/api/ws/room?role=${role}`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.isConnected = true;
        this.notifyConnectionChange(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC') {
            this.notifyStateSync(msg.data as RoomState);
          } else if (msg.type === 'TELEMETRY_UPDATE') {
            this.notifyTelemetry(msg.data as TelemetryPayload);
          } else if (msg.type === 'COMMAND') {
            this.notifyCommand({
              action: msg.action,
              params: msg.params
            });
          }
        } catch (e) {
          console.error('[RemoteSocket] Parse error:', e);
        }
      };

      socket.onclose = () => {
        this.isConnected = false;
        this.notifyConnectionChange(false);
        this.ws = null;

        if (!this.isExplicitDisconnect) {
          this.reconnectTimer = window.setTimeout(() => {
            this.connect(this.currentRole);
          }, 2500);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch (e) {
      console.error('[RemoteSocket] Error initializing WebSocket:', e);
      if (!this.isExplicitDisconnect) {
        this.reconnectTimer = window.setTimeout(() => {
          this.connect(this.currentRole);
        }, 3000);
      }
    }
  }

  /**
   * Tutup koneksi secara eksplisit (misal saat unmount atau berpindah tab/role).
   */
  public disconnect() {
    this.isExplicitDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.notifyConnectionChange(false);
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Kirim status mikrofon PC Lab setelah diinisialisasi.
   */
  public sendMicStatus(ready: boolean) {
    this.sendJson({
      type: 'MIC_STATUS',
      ready
    });
  }

  /**
   * Kirim update telemetri hasil deteksi per detik dari PC Lab ke server.
   */
  public sendTelemetry(payload: TelemetryPayload) {
    this.sendJson({
      type: 'TELEMETRY_UPDATE',
      data: payload
    });
  }

  /**
   * Kirim perintah jarak jauh dari Admin via WebSocket.
   */
  public sendCommand(action: string, params?: Record<string, unknown>) {
    this.sendJson({
      type: 'ADMIN_COMMAND',
      action,
      params
    });
  }

  /**
   * Kirim perintah jarak jauh via HTTP POST sebagai fallback jika WebSocket reconnecting.
   */
  public async postCommand(action: string, params?: Record<string, unknown>): Promise<RoomState> {
    const res = await fetch('/api/remote/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params })
    });
    if (!res.ok) {
      throw new Error(`Command failed with status ${res.status}`);
    }
    return res.json();
  }

  /**
   * Ambil snapshot state ruangan via REST API.
   */
  public async fetchState(): Promise<RoomState> {
    const res = await fetch('/api/remote/state');
    if (!res.ok) {
      throw new Error(`Fetch state failed with status ${res.status}`);
    }
    return res.json();
  }

  private sendJson(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  // Listener Registrations
  public onStateSync(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onTelemetryUpdate(cb: TelemetryListener): () => void {
    this.telemetryListeners.add(cb);
    return () => this.telemetryListeners.delete(cb);
  }

  public onCommand(cb: CommandListener): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  public onConnectionChange(cb: ConnectionListener): () => void {
    this.connectionListeners.add(cb);
    cb(this.isConnected);
    return () => this.connectionListeners.delete(cb);
  }

  private notifyStateSync(state: RoomState) {
    this.stateListeners.forEach((cb) => cb(state));
  }

  private notifyTelemetry(telemetry: TelemetryPayload) {
    this.telemetryListeners.forEach((cb) => cb(telemetry));
  }

  private notifyCommand(command: RemoteCommand) {
    this.commandListeners.forEach((cb) => cb(command));
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionListeners.forEach((cb) => cb(connected));
  }
}

export const remoteSocket = new RemoteSocketClient();

