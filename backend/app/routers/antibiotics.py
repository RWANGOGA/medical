from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List
import os
import json
from groq import Groq

from app.db import get_session
from app.models import Antibiotic

router = APIRouter(prefix="/antibiotics", tags=["Antibiotics"])


@router.get("/", response_model=list[Antibiotic])
def read_antibiotics(session: Session = Depends(get_session)):
    return session.exec(select(Antibiotic)).all()


# --- AI Summary models ---
class AntibioticSummary(BaseModel):
    overview: str
    when_to_use: List[str]
    cautions: List[str]
    stewardship_note: str


class SummarizeRequest(BaseModel):
    id: str


SUMMARY_SYSTEM_PROMPT = """You are a clinical pharmacologist writing a concise antibiotic reference summary for a hospital formulary app used by physicians and pharmacists.

Write in formal, precise clinical language. Be brief — this is a quick-reference summary, not a textbook chapter. No emojis, no casual tone.

Return ONLY valid JSON matching this schema — no markdown, no prose outside the JSON.

{
  "overview": "One to two sentences on the drug's class, mechanism, and role in therapy.",
  "when_to_use": ["2-4 short bullets on preferred indications"],
  "cautions": ["2-4 short bullets on key contraindications, resistance, or safety concerns"],
  "stewardship_note": "One sentence placing the drug within WHO AWaRe and antimicrobial stewardship principles."
}
"""


def _build_prompt(abx: Antibiotic) -> str:
    return (
        f"Drug: {abx.generic_name}\n"
        f"Class: {abx.drug_class}\n"
        f"WHO AWaRe category: {abx.aware_category}\n"
        f"Mechanism of action: {abx.mechanism_of_action}\n"
        f"Spectrum: {abx.spectrum}\n"
        f"Adult dosing: {abx.dosing_adult}\n"
        f"Pregnancy: {abx.pregnancy_considerations}\n"
        f"Renal adjustment: {abx.renal_adjustment}\n\n"
        "Produce the concise formulary summary following the required JSON schema."
    )


@router.post("/summarize", response_model=AntibioticSummary)
def summarize_antibiotic(payload: SummarizeRequest, session: Session = Depends(get_session)):
    abx = session.get(Antibiotic, payload.id)
    if not abx:
        raise HTTPException(status_code=404, detail="Antibiotic not found")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    # Fast model for quick summaries (gpt-oss reasons internally, needs token headroom)
    model = os.getenv("GROQ_FAST_MODEL", "openai/gpt-oss-20b")
    client = Groq(api_key=api_key)

    try:
        completion = client.chat.completions.create(
            model=model,
            temperature=0.2,
            max_completion_tokens=2000,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": _build_prompt(abx)},
            ],
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
        return AntibioticSummary(**parsed)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")