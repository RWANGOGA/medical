import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from groq import Groq

from app.models import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/translate", tags=["Translate"])

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SUPPORTED = ["English", "Swahili", "Luganda", "French", "Arabic", "Spanish"]


class TranslateRequest(BaseModel):
    text: str
    target_language: str


class TranslateResponse(BaseModel):
    translated: str


@router.post("/", response_model=TranslateResponse)
def translate(
    payload: TranslateRequest,
    current_user: User = Depends(get_current_user),
):
    text = payload.text.strip()
    if not text:
        return TranslateResponse(translated="")

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a professional medical translator. Translate the following "
                        f"clinical message into {payload.target_language}. Preserve medical "
                        f"meaning accurately. Return ONLY the translated text, no explanations."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )
        return TranslateResponse(translated=response.choices[0].message.content.strip())
    except Exception:
        # On failure, return original so chat never breaks
        return TranslateResponse(translated=text)