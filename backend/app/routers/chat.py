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

    async def broadcast_to(self, user_ids: list[int], payload: dict):
        """Send payload only to specific user ids."""
        for uid in user_ids:
            info = self.active.get(uid)
            if info:
                try:
                    await info["ws"].send_text(json.dumps(payload))
                except Exception:
                    pass


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
                msg_type = data.get("type")

                if msg_type == "send":
                    await handle_send(data, user, session)
                elif msg_type == "reaction":
                    await handle_reaction(data, user, session)
                elif msg_type == "read":
                    await handle_read(data, user, session)
                elif msg_type == "edit":
                    await handle_edit(data, user, session)
                elif msg_type == "delete":
                    await handle_delete(data, user, session)
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(user.id)
            await manager.broadcast_presence()


async def handle_send(data: dict, user: User, session: Session):
    message_text = (data.get("message") or "").strip()
    audio_data = data.get("audio") or None
    file_data = data.get("file_data") or None
    file_name = data.get("file_name") or None
    reply_to_id = data.get("reply_to_id") or None

    if not message_text and not audio_data and not file_data:
        return

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
        "reactions": msg.reactions,
        "read_by": msg.read_by,
        "is_edited": msg.is_edited,
    })


async def handle_reaction(data: dict, user: User, session: Session):
    msg_id = data.get("id")
    emoji = data.get("emoji")
    if not msg_id or not emoji:
        return

    msg = session.get(ChatMessage, msg_id)
    if not msg:
        return

    reactions = list(msg.reactions or [])
    # Remove existing reaction from this user with this emoji
    reactions = [r for r in reactions if not (r.get("user_id") == user.id and r.get("emoji") == emoji)]
    # Check if user already reacted with this emoji
    already = any(r.get("user_id") == user.id and r.get("emoji") == emoji for r in (msg.reactions or []))
    if not already:
        reactions.append({"emoji": emoji, "user_id": user.id, "user_name": user.full_name})

    msg.reactions = reactions
    session.add(msg)
    session.commit()

    await manager.broadcast({
        "type": "reaction",
        "id": msg_id,
        "reactions": reactions,
    })


async def handle_read(data: dict, user: User, session: Session):
    msg_id = data.get("id")
    if not msg_id:
        return

    msg = session.get(ChatMessage, msg_id)
    if not msg:
        return

    read_by = list(msg.read_by or [])
    if user.id not in read_by:
        read_by.append(user.id)
        msg.read_by = read_by
        session.add(msg)
        session.commit()

    # Notify the sender about who read the message
    await manager.broadcast_to([msg.sender_id], {
        "type": "read",
        "id": msg_id,
        "read_by": read_by,
        "reader_name": user.full_name,
    })


async def handle_edit(data: dict, user: User, session: Session):
    msg_id = data.get("id")
    new_message = (data.get("message") or "").strip()
    if not msg_id or not new_message:
        return

    msg = session.get(ChatMessage, msg_id)
    if not msg or msg.sender_id != user.id:
        return

    msg.message = new_message
    msg.is_edited = True
    session.add(msg)
    session.commit()

    await manager.broadcast({
        "type": "edit",
        "id": msg_id,
        "message": new_message,
        "is_edited": True,
    })


async def handle_delete(data: dict, user: User, session: Session):
    msg_id = data.get("id")
    if not msg_id:
        return

    msg = session.get(ChatMessage, msg_id)
    if not msg or msg.sender_id != user.id:
        return

    msg.is_deleted = True
    msg.message = "This message was deleted"
    session.add(msg)
    session.commit()

    await manager.broadcast({
        "type": "delete",
        "id": msg_id,
    })