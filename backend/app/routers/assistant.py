import logging
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from groq import Groq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["AI Clinical Assistant"])

MAX_MESSAGES = 20
MAX_MESSAGE_CHARS = 4000

class ChatMessage(BaseModel):
    role: str          # "user" or "assistant"
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)

class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)

class ChatResponse(BaseModel):
    reply: str

SYSTEM_PROMPT = """You are the AI clinical assistant inside the "Steward AMR" antimicrobial stewardship app — a clinical decision support tool for antimicrobial resistance surveillance and treatment.

You understand this app's features:
- Organism profiles (E. coli, Klebsiella, S. aureus, Pseudomonas): morphology, diseases, virulence factors, risk factors, clinical importance.
- Resistance mechanism explainers (ESBLs, carbapenemases, MRSA mecA gene): molecular basis, affected drugs, and drugs that still work.
- Antibiotic reference library: mechanism of action, spectrum, adult/pediatric dosing, pregnancy/renal/hepatic considerations, interactions, and WHO AWaRe classification (Access / Watch / Reserve).
- Clinical Decision Support engine: tailored first-line / second-line / reserve recommendations based on patient factors (penicillin allergy, pregnancy, renal impairment, severity).
- Patient case tracking with antibiotic history timelines.
- Resistance dashboard with trends and a hospital antibiogram.

Your role:
- Answer questions about resistance mechanisms, antibiotic selection, dosing, and drug safety.
- ALWAYS explain the clinical/scientific REASONING, not just the answer.
- Reference WHO AWaRe classification where relevant.
- Flag safety concerns: pregnancy contraindications (e.g., avoid fluoroquinolones), allergy cross-reactivity (e.g., beta-lactams with penicillin allergy), and renal/hepatic dose adjustments.
- Be concise and structured for a phone screen: short paragraphs and simple lines starting with "- ".
- Output PLAIN TEXT ONLY. Never use Markdown syntax: no asterisks, no bold/italic markers, no heading hashes, no tables, no code blocks. Use plain numbering (1., 2.) for ordered steps.
- IMPORTANT: This is clinical decision support. Always remind the clinician to verify against local guidelines, the hospital antibiogram, and the full clinical picture. You are not a substitute for professional judgment.
"""

@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest):
    api_key = os.getenv("GROQ_API_KEY")

    # Graceful fallback if no key is configured yet
    if not api_key:
        return ChatResponse(
            reply="The clinical assistant is currently unavailable. Please explore the organism, antibiotic, and resistance reference data across the app, and try again later."
        )

    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=model,
            temperature=0.4,
            max_completion_tokens=2048,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + [
                {"role": m.role, "content": m.content} for m in payload.messages
            ],
        )
        reply = completion.choices[0].message.content
        return ChatResponse(reply=reply)
    except Exception:
        # Never surface provider errors (which can include request metadata) to clients.
        logger.exception("Groq assistant request failed")
        raise HTTPException(
            status_code=502,
            detail="The clinical assistant is temporarily unavailable. Please try again.",
        )