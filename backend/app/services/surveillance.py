"""GLASS-aligned surveillance helpers.

WHO GLASS (Global Antimicrobial Resistance and Use Surveillance System) counts
only the first isolate of a pathogen from a patient in a reporting period.
WHONET, the WHO-recommended laboratory tool, applies the same rule so that one
persistent infection cannot inflate a resistance rate. EARS-Net additionally
restricts its headline indicators to invasive isolates (blood and CSF).

These helpers make that methodology explicit and measurable in the app.
"""

from datetime import date, datetime, timezone
from typing import Iterable, Optional

# GLASS reports annually: one isolate per patient/pathogen/specimen per year.
DEDUPLICATION_WINDOW_DAYS = 365

INVASIVE_SPECIMENS = {"blood", "csf", "cerebrospinal fluid"}

ORIGINS = {"community", "hospital-onset", "healthcare-associated", "unknown"}

ORIGIN_LABELS = {
    "community": "Community-onset",
    "hospital-onset": "Hospital-onset",
    "healthcare-associated": "Healthcare-associated",
    "unknown": "Not recorded",
}


def parse_collection_date(value: str, fallback: Optional[date] = None) -> date:
    """Accept plain dates and ISO timestamps; fall back safely."""
    text = (value or "").strip()
    if text:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            pass
    return fallback or datetime.now(timezone.utc).date()


def patient_key(patient_id: Optional[int], patient_name: str, hospital: str) -> str:
    """Stable identity for deduplication without exposing names in outputs.

    A linked patient id is authoritative. Otherwise a normalised name plus
    hospital is used; unnamed isolates stay unique and are never deduplicated.
    """
    if patient_id:
        return f"pid:{patient_id}"
    name = "".join(ch for ch in (patient_name or "").lower() if ch.isalnum())
    if not name:
        return ""
    site = "".join(ch for ch in (hospital or "").lower() if ch.isalnum())
    return f"name:{name}@{site}"


def key_for_result(result) -> str:
    """Derive a key for legacy rows created before patient_key existed."""
    stored = getattr(result, "patient_key", "")
    if stored:
        return stored
    return patient_key(
        getattr(result, "patient_id", None),
        getattr(result, "patient_name", ""),
        getattr(result, "hospital", ""),
    )


def normalise_specimen(specimen: str) -> str:
    text = (specimen or "").strip().lower()
    synonyms = {
        "cerebrospinal fluid": "csf",
        "csf fluid": "csf",
        "blood culture": "blood",
        "urine sample": "urine",
        "wound": "wound swab",
    }
    return synonyms.get(text, text)


def is_invasive(specimen: str) -> bool:
    return normalise_specimen(specimen) in INVASIVE_SPECIMENS


def duplicate_of(result, candidates: Iterable) -> Optional[int]:
    """Return the id of the earlier isolate in the same GLASS episode.

    An episode is the same patient, pathogen and specimen type within the
    deduplication window. Anonymous isolates are always counted because there
    is no reliable identity to deduplicate on.
    """
    key = key_for_result(result)
    if not key:
        return None

    current_date = parse_collection_date(
        getattr(result, "collection_date", ""),
        parse_collection_date(getattr(result, "created_at", "")),
    )
    current_id = getattr(result, "id", None) or 0
    specimen = normalise_specimen(getattr(result, "specimen", ""))

    earlier = []
    for candidate in candidates:
        candidate_id = getattr(candidate, "id", None) or 0
        if candidate_id == current_id:
            continue
        if key_for_result(candidate) != key:
            continue
        if normalise_specimen(getattr(candidate, "specimen", "")) != specimen:
            continue
        candidate_date = parse_collection_date(
            getattr(candidate, "collection_date", ""),
            parse_collection_date(getattr(candidate, "created_at", "")),
        )
        delta = (current_date - candidate_date).days
        if 0 <= delta <= DEDUPLICATION_WINDOW_DAYS:
            earlier.append((candidate_date, candidate_id))

    if not earlier:
        return None
    # Earliest collection date wins; id breaks ties.
    return min(earlier)[1]


def quality_indicators(results: Iterable) -> dict:
    """Data-quality and representativeness indicators for surveillance."""
    all_results = list(results)
    first = [r for r in all_results if getattr(r, "is_first_isolate", True)]
    total = len(all_results)
    included = len(first)
    duplicates = total - included

    def pct(part: int) -> int:
        return round(100 * part / included) if included else 0

    identified = sum(1 for r in first if key_for_result(r))
    origin_known = sum(
        1
        for r in first
        if getattr(r, "infection_origin", "unknown") in ORIGINS - {"unknown"}
    )
    ast_known = sum(1 for r in first if (getattr(r, "ast_standard", "") or "").strip())
    invasive = sum(1 for r in first if is_invasive(getattr(r, "specimen", "")))
    sir_known = sum(
        1
        for r in first
        if any(v in {"S", "I", "R"} for v in (getattr(r, "susceptibility", None) or {}).values())
    )

    return {
        "total_isolates": total,
        "first_isolates": included,
        "duplicate_isolates": duplicates,
        "duplicate_pct": round(100 * duplicates / total) if total else 0,
        "identified_pct": pct(identified),
        "origin_known_pct": pct(origin_known),
        "ast_standard_pct": pct(ast_known),
        "invasive_isolates": invasive,
        "invasive_pct": pct(invasive),
        "sir_pct": pct(sir_known),
        "dedup_window_days": DEDUPLICATION_WINDOW_DAYS,
        "method": "WHO GLASS first-isolate rule; EARS-Net invasive-isolate definition",
    }
