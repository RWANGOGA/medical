from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import hashlib
from groq import Groq

router = APIRouter(prefix="/guidelines", tags=["Clinical Guidelines"])


# --- Pydantic models for strict structured output ---
class Section(BaseModel):
    heading: str
    body: str
    bullets: Optional[List[str]] = None


class ExpandedGuideline(BaseModel):
    clinical_context: Section
    diagnostic_approach: Section
    first_line_therapy: Section
    alternatives: Section
    monitoring: Section
    escalation_criteria: Section
    evidence_base: Section
    key_references: List[str]


class ExpandRequest(BaseModel):
    id: str
   
    title: str
    summary: str
    source: str
    year: int


EXPANSION_SYSTEM_PROMPT = """You are a clinical reference author for a peer-reviewed antimicrobial stewardship textbook used by infectious disease physicians and hospital pharmacists.

You are expanding a brief guideline summary into a comprehensive clinical reference chapter. Your output must read like UpToDate, Sanford Guide, or IDSA official guidance — authoritative, precise, and clinically rigorous.

STYLE RULES:
- Use formal medical prose. No casual language, no emojis, no conversational tone.
- Prefer specific drug names, doses, routes, and durations over vague statements.
- Cite mechanism of action when clinically relevant.
- Include microbiological rationale (e.g., resistance mechanisms, inoculum effect, post-antibiotic effect).
- Reference established guidelines (IDSA, WHO, ESCMID, local MoH) as the evidence base.
- Use precise clinical terminology: "empirical therapy", "de-escalation", "source control", "pharmacokinetic/pharmacodynamic targets".
- Avoid hedging phrases like "might be considered" when evidence is strong.

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema — no markdown, no prose outside the JSON.

{
  "clinical_context": {"heading": "...", "body": "...", "bullets": ["..."] or null},
  "diagnostic_approach": {"heading": "...", "body": "...", "bullets": [...]},
  "first_line_therapy": {"heading": "...", "body": "...", "bullets": [...]},
  "alternatives": {"heading": "...", "body": "...", "bullets": [...]},
  "monitoring": {"heading": "...", "body": "...", "bullets": [...]},
  "escalation_criteria": {"heading": "...", "body": "...", "bullets": [...]},
  "evidence_base": {"heading": "...", "body": "...", "bullets": null},
  "key_references": ["Reference 1", "Reference 2", "Reference 3"]
}
"""


def _build_user_prompt(payload: ExpandRequest) -> str:
    return (
        f"Guideline title: {payload.title}\n"
        f"Source: {payload.source} ({payload.year})\n"
        f"Brief summary: {payload.summary}\n\n"
        "Expand this into a full clinical reference chapter following the required schema."
    )


@router.post("/expand", response_model=ExpandedGuideline)
def expand_guideline(payload: ExpandRequest):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured")

    client = Groq(api_key=api_key)
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    try:
        completion = client.chat.completions.create(
            model=model,
            temperature=0.2,  # Low temp for factual clinical content
            max_completion_tokens=4000,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXPANSION_SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(payload)},
            ],
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
        return ExpandedGuideline(**parsed)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Expansion failed: {str(e)}")