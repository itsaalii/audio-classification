from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Request, HTTPException
from backend.app.schemas import RemoteCommandRequest, RoomStateResponse
from backend.app.services.room_manager import RoomStateManager

router = APIRouter(prefix="/api", tags=["Remote Control"])

def get_room_manager(request: Request) -> RoomStateManager:
    manager = getattr(request.app.state, "room", None)
    if not manager:
        raise HTTPException(status_code=503, detail="RoomStateManager belum diinisialisasi.")
    return manager

@router.get("/remote/state", response_model=RoomStateResponse)
async def get_remote_state(request: Request):
    """
    Mengambil snapshot state ruangan saat ini (mode monitoring, toleransi, koneksi PC Lab).
    """
    manager = get_room_manager(request)
    return manager.get_state_dict()

@router.post("/remote/command", response_model=RoomStateResponse)
async def post_remote_command(request: Request, body: RemoteCommandRequest):
    """
    Menerima perintah jarak jauh dari Admin:
    - START_MONITORING
    - STOP_MONITORING
    - UPDATE_CONFIG
    - RESET_BUFFER
    - TRIGGER_TEST_ALARM
    """
    manager = get_room_manager(request)
    updated_state = await manager.execute_command(body.action, body.params)
    return updated_state

@router.websocket("/ws/room")
async def websocket_room_endpoint(
    websocket: WebSocket,
    role: str = Query("lab", description="'lab' untuk PC Lab Display, 'admin' untuk Admin Remote Control")
):
    """
    Koneksi WebSocket persisten dua arah untuk sinkronisasi state dan telemetri audio real-time.
    """
    await websocket.accept()
    manager: RoomStateManager = getattr(websocket.app.state, "room", None)
    if not manager:
        await websocket.close(code=1011, reason="RoomStateManager uninitialized")
        return

    # Registrasi koneksi baru
    await manager.connect_client(websocket, role)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "MIC_STATUS":
                # PC Lab mengonfirmasi kesiapan mikrofon setelah One-Click Gesture
                ready = bool(data.get("ready", False))
                await manager.update_mic_status(ready)

            elif msg_type == "TELEMETRY_UPDATE":
                # Hasil inferensi per detik dari PC Lab dibroadcast ke Admin
                telemetry = data.get("data", {})
                await manager.update_telemetry(telemetry)

            elif msg_type == "ADMIN_COMMAND":
                # Perintah dikirim lewat WebSocket oleh Admin
                action = data.get("action")
                params = data.get("params")
                if action:
                    await manager.execute_command(action, params)

            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await manager.disconnect_client(websocket, role)

