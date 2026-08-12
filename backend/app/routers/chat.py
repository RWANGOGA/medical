import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlmodel import Session, select
from jose import JWTError, jwt

from app.db import engine, get_session
from app.models import ChatMessage, User
from app.services.auth import SECRET_KEY, ALGORITHM, get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])


class ConnectionManager:
    def __init__(self):
        self.active = {}

    async def connect(self, websocket: WebSocket, user: User):
        await websocket.accept()
        self.active[user.id] = {
            "ws": websocket,
            "name": user.full_name,
            "role": user.role,
            "hospital": user.hospital,
        }
        await self.broadcast_presence()

    def disconnect(self, user_id: int):
        self.active.pop(user_id, None)

    async def broadcast_presence(self):
        await self.broadcast({
            "type": "presence",
            "online": [
                {"id": uid, "name": i["name"], "role": i["role"], "hospital": i["hospital"]}
                for uid, i in self.active.items()
            ],
        })

    async def broadcast(self, payload: dict):
        dead = []
        for uid, info in self.active.items():
            try:
                await info["ws"].send_text(json.dumps(payload))
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.active.pop(uid, None)


manager = ConnectionManager()


@router.get("/messages", response_model=list)
def get_messages(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    return session.exec(select(ChatMessage).order_by(ChatMessage.id)).all()


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        await websocket.close(code=1008)
        return

    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            await websocket.close(code=1008)
            return

        await manager.connect(websocket, user)
        try:
            while True:
                data = await websocket.receive_json()
                if data.get("type") != "send":
                    continue

                message_text = (data.get("message") or "").strip()
                audio_data = data.get("audio") or None
                file_data = data.get("file_data") or None
                file_name = data.get("file_name") or None
                reply_to_id = data.get("reply_to_id") or None

                if not message_text and not audio_data and not file_data:
                    continue

                msg = ChatMessage(
                    sender_id=user.id,
                    sender_name=user.full_name,
                    sender_role=user.role,
                    sender_hospital=user.hospital,
                    message=message_text,
                    audio_data=audio_data,
                    file_data=file_data,
                    file_name=file_name,
                    reply_to_id=reply_to_id,
                )
                session.add(msg)
                session.commit()
                session.refresh(msg)

                reply_context = None
                if reply_to_id:
                    original = session.get(ChatMessage, reply_to_id)
                    if original:
                        reply_context = {"sender_name": original.sender_name, "message": original.message}

                await manager.broadcast({
                    "type": "message",
                    "id": msg.id,
                    "sender_id": msg.sender_id,
                    "sender_name": msg.sender_name,
                    "sender_role": msg.sender_role,
                    "sender_hospital": msg.sender_hospital,
                    "message": msg.message,
                    "audio_data": msg.audio_data,
                    "file_data": msg.file_data,
                    "file_name": msg.file_name,
                    "reply_to_id": msg.reply_to_id,
                    "reply_context": reply_context,
                    "created_at": msg.created_at,
                })
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(user.id)
            await manager.broadcast_presence()