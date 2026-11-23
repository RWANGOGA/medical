"""GLASS-AMC antimicrobial consumption aggregation.

Consumption is expressed in WHO DDDs and reported with the WHO AWaRe split.
When a monthly patient-day denominator is available the headline indicator is
DDD per 100 patient-days; otherwise totals are shown without a fake rate.
"""

from collections import defaultdict
from datetime import date
from typing import Iterable

from app.data.ddd import ACCESS_TARGET_PCT, DDD_SOURCE
from app.models import Antibiotic, AntibioticUse, HospitalActivity


def _parse_day(value: str) -> date | None:
    try:
        return date.fromisoformat((value or "")[:10])
    except ValueError:
        return None


def duration_of(use: AntibioticUse) -> int:
    if use.duration_days and use.duration_days > 0:
        return use.duration_days
    start, end = _parse_day(use.start_date), _parse_day(use.end_date)
    if start and end and end >= start:
        return (end - start).days + 1
    return 0


def month_of(use: AntibioticUse) -> str:
    return (use.start_date or use.created_at or "")[:7]


def ddd_of(use: AntibioticUse, drugs: dict[str, Antibiotic]) -> tuple[float, bool]:
    """Return (DDD equivalents, dose_was_estimated)."""
    days = duration_of(use)
    if days <= 0:
        return 0.0, True

    drug = drugs.get(use.antibiotic_id)
    reference = drug.ddd_value_mg if drug else None
    if use.daily_dose_mg and reference and reference > 0:
        return round(use.daily_dose_mg * days / reference, 2), False

    # No reliable dose: one DDD per day is the standard conservative fallback.
    return float(days), True


def summarise(
    uses: Iterable[AntibioticUse],
    activity: Iterable[HospitalActivity],
    antibiotics: Iterable[Antibiotic],
) -> dict:
    drugs = {drug.id: drug for drug in antibiotics}
    uses = list(uses)
    denominators = {(a.hospital, a.period): a for a in activity}

    total_ddd = 0.0
    total_days = 0
    estimated_episodes = 0
    by_aware = defaultdict(float)
    by_drug = defaultdict(float)
    by_unit = defaultdict(float)
    by_month = defaultdict(float)
    episodes_by_month = defaultdict(int)

    for use in uses:
        ddd, estimated = ddd_of(use, drugs)
        days = duration_of(use)
        total_ddd += ddd
        total_days += days
        if estimated:
            estimated_episodes += 1

        drug = drugs.get(use.antibiotic_id)
        category = drug.aware_category if drug else "Unknown"
        name = drug.generic_name if drug else use.antibiotic_id
        by_aware[category] += ddd
        by_drug[use.antibiotic_id] += ddd
        by_unit[use.unit or "Not recorded"] += ddd

        month = month_of(use)
        by_month[month] += ddd
        episodes_by_month[month] += 1

    aware_rows = []
    for category in ("Access", "Watch", "Reserve", "Unknown"):
        value = round(by_aware.get(category, 0.0), 2)
        if value == 0 and category == "Unknown":
            continue
        aware_rows.append(
            {
                "cat": category,
                "ddd": value,
                "pct": round(100 * value / total_ddd) if total_ddd else 0,
                "target": ACCESS_TARGET_PCT if category == "Access" else None,
            }
        )

    monthly_rows = []
    for month in sorted(set(by_month) | {a.period for a in denominators.values()}):
        relevant = [a for a in denominators.values() if a.period == month]
        patient_days = sum(a.patient_days for a in relevant)
        population = sum(a.population for a in relevant)
        days_in_month = 30  # GLASS-AMC uses calendar months; 30 is the standard proxy
        monthly_rows.append(
            {
                "month": month,
                "ddd": round(by_month.get(month, 0.0), 2),
                "episodes": episodes_by_month.get(month, 0),
                "patient_days": patient_days,
                "ddd_per_100_patient_days": (
                    round(100 * by_month.get(month, 0.0) / patient_days, 2)
                    if patient_days
                    else None
                ),
                "population": population,
                "ddd_per_1000_per_day": (
                    round(
                        1000 * by_month.get(month, 0.0) / (population * days_in_month),
                        4,
                    )
                    if population
                    else None
                ),
            }
        )

    drug_rows = [
        {
            "antibiotic_id": key,
            "name": drugs[key].generic_name if key in drugs else key,
            "aware_category": drugs[key].aware_category if key in drugs else "Unknown",
            "atc_code": drugs[key].atc_code if key in drugs else "",
            "ddd": round(value, 2),
            "pct": round(100 * value / total_ddd) if total_ddd else 0,
        }
        for key, value in sorted(by_drug.items(), key=lambda item: item[1], reverse=True)
    ]

    unit_rows = [
        {"unit": key, "ddd": round(value, 2)}
        for key, value in sorted(by_unit.items(), key=lambda item: item[1], reverse=True)
    ]

    monitored = len(by_month)
    covered = sum(1 for row in monthly_rows if row["patient_days"] > 0 and row["ddd"] > 0)

    return {
        "total_ddd": round(total_ddd, 2),
        "total_days_of_therapy": total_days,
        "episodes": len(uses),
        "estimated_episodes": estimated_episodes,
        "estimated_pct": round(100 * estimated_episodes / len(uses)) if uses else 0,
        "aware": aware_rows,
        "by_drug": drug_rows,
        "by_unit": unit_rows,
        "by_month": monthly_rows,
        "denominator_months": covered,
        "denominator_coverage_pct": round(100 * covered / monitored) if monitored else 0,
        "ddd_source": DDD_SOURCE,
        "method": "WHO ATC/DDD + AWaRe (GLASS-AMC)",
    }
