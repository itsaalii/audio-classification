import asyncio
from typing import Any, Optional
from fastapi import WebSocket

class RoomStateManager:
    """
    In-Memory Singleton untuk mengelola state ruangan lab dan koneksi WebSocket
    antara PC Lab Display (kiosk audio sensor) dan Admin Remote Control.
    """
    def __init__(self):
        self.is_monitoring: bool = False
        self.tolerance_seconds: int = 10
        self.alarm_enabled: bool = True
        self.lab_client_connected: bool = False
        self.lab_mic_ready: bool = False
        self.latest_telemetry: Optional[dict[str, Any]] = None

        self.lab_connections: set[WebSocket] = set()
        self.admin_connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    def get_state_dict(self) -> dict[str, Any]:
        """Snapshot representasi JSON dari state ruangan saat ini."""
        lab_connected = len(self.lab_connections) > 0
        return {
            "is_monitoring": self.is_monitoring,
            "tolerance_seconds": self.tolerance_seconds,
            "alarm_enabled": self.alarm_enabled,
            "lab_client_connected": lab_connected,
            "lab_mic_ready": self.lab_mic_ready if lab_connected else False,
            "admin_count": len(self.admin_connections),
            "lab_count": len(self.lab_connections),
            "latest_telemetry": self.latest_telemetry
        }

    async def _send_json_safe(self, ws: WebSocket, data: dict[str, Any]) -> bool:
        """Kirim JSON ke client dengan penanganan error jika socket terputus."""
        try:
            await ws.send_json(data)
            return True
        except Exception:
            return False

    async def broadcast_to_set(self, connections: set[WebSocket], message: dict[str, Any]):
        """Kirim pesan ke seluruh koneksi pada set tertentu dan bersihkan koneksi mati."""
        if not connections:
            return
        dead = []
        for ws in list(connections):
            success = await self._send_json_safe(ws, message)
            if not success:
                dead.append(ws)
        for ws in dead:
            connections.discard(ws)

    async def broadcast_state(self):
        """Broadcast state terbaru (STATE_SYNC) ke seluruh Admin dan PC Lab."""
        state_msg = {
            "type": "STATE_SYNC",
            "data": self.get_state_dict()
        }
        await self.broadcast_to_set(self.admin_connections, state_msg)
        await self.broadcast_to_set(self.lab_connections, state_msg)

    async def connect_client(self, ws: WebSocket, role: str):
        """Registrasi koneksi WebSocket baru berdasarkan role ('lab' atau 'admin')."""
        async with self._lock:
            if role == "lab":
                self.lab_connections.add(ws)
                self.lab_client_connected = True
            else:
                self.admin_connections.add(ws)

        # Broadcast state terbaru ke seluruh client (termasuk client yang baru terhubung)
        await self.broadcast_state()

    async def disconnect_client(self, ws: WebSocket, role: str):
        """Hapus koneksi WebSocket saat terputus dan update status kesiapan."""
        async with self._lock:
            if role == "lab":
                self.lab_connections.discard(ws)
                if not self.lab_connections:
                    self.lab_client_connected = False
                    self.lab_mic_ready = False
                    self.is_monitoring = False
            else:
                self.admin_connections.discard(ws)

        # Beritahu seluruh client sisa
        await self.broadcast_state()

    async def update_mic_status(self, ready: bool):
        """Perbarui status izin & inisialisasi mikrofon PC Lab."""
        async with self._lock:
            self.lab_mic_ready = ready
        await self.broadcast_state()

    async def update_telemetry(self, telemetry_data: dict[str, Any]):
        """
        Simpan telemetri terbaru dari PC Lab dan broadcast ke seluruh koneksi Admin
        secara real-time (sub-detik).
        """
        self.latest_telemetry = telemetry_data
        msg = {
            "type": "TELEMETRY_UPDATE",
            "data": telemetry_data
        }
        await self.broadcast_to_set(self.admin_connections, msg)
        # Juga kirim balik ke lab jika diperlukan sinkronisasi state
        await self.broadcast_to_set(self.lab_connections, msg)

    async def execute_command(self, action: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """
        Eksekusi aksi komando jarak jauh (dari Admin atau REST API):
        - START_MONITORING
        - STOP_MONITORING
        - UPDATE_CONFIG (tolerance_seconds, alarm_enabled)
        - RESET_BUFFER
        - TRIGGER_TEST_ALARM
        """
        cmd_for_lab = {
            "type": "COMMAND",
            "action": action,
            "params": params or {}
        }

        async with self._lock:
            if action == "START_MONITORING":
                self.is_monitoring = True
                await self.broadcast_to_set(self.lab_connections, cmd_for_lab)

            elif action == "STOP_MONITORING":
                self.is_monitoring = False
                await self.broadcast_to_set(self.lab_connections, cmd_for_lab)

            elif action == "UPDATE_CONFIG":
                if params:
                    if "tolerance_seconds" in params:
                        try:
                            val = int(params["tolerance_seconds"])
                            if val in [1, 4, 5, 10, 15, 20, 30]:
                                self.tolerance_seconds = val
                        except (ValueError, TypeError):
                            pass
                    if "alarm_enabled" in params:
                        self.alarm_enabled = bool(params["alarm_enabled"])

                cmd_for_lab["params"] = {
                    "tolerance_seconds": self.tolerance_seconds,
                    "alarm_enabled": self.alarm_enabled
                }
                await self.broadcast_to_set(self.lab_connections, cmd_for_lab)

            elif action == "RESET_BUFFER":
                await self.broadcast_to_set(self.lab_connections, cmd_for_lab)

            elif action == "TRIGGER_TEST_ALARM":
                await self.broadcast_to_set(self.lab_connections, cmd_for_lab)

        await self.broadcast_state()
        return self.get_state_dict()
