import json
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlmodel import Session, select
from jose import JWTError, jwt

from app.db import get_session, engine
from app.models import ChatMessage, User
from app.services.auth import SECRET_KEY, ALGORITHM, get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])


class ConnectionManager:
    """Tracks active WebSocket connections + online doctors."""
    def __init__(self):
        self.active: Dict[int, WebSocket] = {}
        self.user_info: Dict[int, dict] = {}

    async def connect(self, user_id: int, info: dict, websocket: WebSocket):
        await websocket.accept()
        self.active[user_id] = websocket
        self.user_info[user_id] = info
        await self.broadcast_presence()

    def disconnect(self, user_id: int):
        self.active.pop(user_id, None)
        self.user_info.pop(user_id, None)

    async def broadcast_presence(self):
        online = [{"id": uid, **info} for uid, info in self.user_info.items()]
        await self._send_all({"type": "presence", "online": online})

    async def broadcast_message(self, data: dict):
        await self._send_all({"type": "message", **data})

    async def _send_all(self, payload: dict):
        text = json.dumps(payload)
        for ws in list(self.active.values()):
            try:
                await ws.send_text(text)
            except Exception:
                pass


manager = ConnectionManager()


def _user_from_token(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        return None
    with Session(engine) as session:
        return session.get(User, user_id)


@router.websocket("/ws")
async def websocket_chat(websocket: WebSocket, token: str = Query(default=None)):
    user = _user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    info = {"name": user.full_name, "role": user.role, "hospital": user.hospital}
    await manager.connect(user.id, info, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            if data.get("type") == "send":
                text = (data.get("message") or "").strip()
                audio_data = data.get("audio")  # base64 audio
                reply_to_id = data.get("reply_to_id")
                
                if not text and not audio_data:
                    continue
                
                with Session(engine) as session:
                    record = ChatMessage(
                        sender_id=user.id,
                        sender_name=user.full_name,
                        sender_role=user.role,
                        sender_hospital=user.hospital or "",
                        message=text,
                        reply_to_id=reply_to_id,
                        audio_data=audio_data,
                    )
                    session.add(record)
                    session.commit()
                    session.refresh(record)
                    
                    # Get reply context if replying
                    reply_context = None
                    if reply_to_id:
                        replied = session.get(ChatMessage, reply_to_id)
                        if replied:
                            reply_context = {
                                "id": replied.id,
                                "sender_name": replied.sender_name,
                                "message": replied.message[:100] if replied.message else "🎤 Voice message",
                            }
                    
                    await manager.broadcast_message({
                        "id": record.id,
                        "sender_id": record.sender_id,
                        "sender_name": record.sender_name,
                        "sender_role": record.sender_role,
                        "sender_hospital": record.sender_hospital,
                        "message": record.message,
                        "reply_to_id": record.reply_to_id,
                        "reply_context": reply_context,
                        "audio_data": record.audio_data,
                        "created_at": record.created_at,
                    })
    except WebSocketDisconnect:
        manager.disconnect(user.id)
        await manager.broadcast_presence()


@router.get("/messages")
def get_messages(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    msgs = session.exec(select(ChatMessage).order_by(ChatMessage.id.desc()).limit(100)).all()
    
    # Build response with reply context
    result = []
    for m in reversed(msgs):
        reply_context = None
        if m.reply_to_id:
            replied = session.get(ChatMessage, m.reply_to_id)
            if replied:
                reply_context = {
                    "id": replied.id,
                    "sender_name": replied.sender_name,
                    "message": replied.message[:100] if replied.message else "🎤 Voice message",
                }
        
        result.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": m.sender_name,
            "sender_role": m.sender_role,
            "sender_hospital": m.sender_hospital,
            "message": m.message,
            "reply_to_id": m.reply_to_id,
            "reply_context": reply_context,
            "audio_data": m.audio_data,
            "created_at": m.created_at,
        })
    
    return result


@router.get("/online")
def get_online(current_user: User = Depends(get_current_user)):
    return [{"id": uid, **info} for uid, info in manager.user_info.items()]