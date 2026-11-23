"""GLASS / EARS-Net stratification of resistance by age, sex and ward.

A single network-wide percentage hides important differences: a paediatric
ward and an ICU can have very different resistance profiles. EARS-Net reports
by age group and sex, and GLASS encourages stratifying by care setting. This
service groups first isolates, then rebuilds the antibiogram inside each group.

Cells with fewer than 30 isolates are flagged (CLSI M39 / WHO guidance): the
percentage is shown for transparency but must not be over-interpreted.
"""

from collections import OrderedDict
from typing import Callable, Iterable

from app.models import LabResult
from app.services.antibiogram import aggregate
from app.services.surveillance import ORIGIN_LABELS

MIN_RELIABLE_N = 30

AGE_BANDS = [
    ("0-17", "0-17 years", lambda age: age is not None and age < 18),
    ("18-49", "18-49 years", lambda age: age is not None and 18 <= age < 50),
    ("50-64", "50-64 years", lambda age: age is not None and 50 <= age < 65),
    ("65+", "65 years and over", lambda age: age is not None and age >= 65),
]

UNKNOWN = ("unknown", "Not recorded")


def age_group(result: LabResult) -> tuple[str, str]:
    for key, label, matches in AGE_BANDS:
        if matches(result.age):
            return key, label
    return UNKNOWN


def sex_group(result: LabResult) -> tuple[str, str]:
    value = (getattr(result, "sex", "") or "").strip().lower()
    if value in {"m", "male"}:
        return "M", "Male"
    if value in {"f", "female"}:
        return "F", "Female"
    return UNKNOWN


def unit_group(result: LabResult) -> tuple[str, str]:
    value = (getattr(result, "unit", "") or "").strip()
    if not value:
        return UNKNOWN
    lowered = value.lower()
    if lowered in {"icu", "intensive care", "intensive care unit"}:
        return "icu", "ICU"
    for key in ("medical", "surgical", "paediatric", "pediatric", "maternity", "outpatient", "emergency"):
        if key in lowered:
            return key, value.title()
    return lowered, value.title()


def origin_group(result: LabResult) -> tuple[str, str]:
    key = (getattr(result, "infection_origin", "") or "unknown").strip().lower()
    return key, ORIGIN_LABELS.get(key, key.title())


DIMENSIONS: list[tuple[str, str, Callable[[LabResult], tuple[str, str]]]] = [
    ("age_group", "Age group", age_group),
    ("sex", "Sex", sex_group),
    ("unit", "Ward / unit", unit_group),
    ("infection_origin", "Infection origin", origin_group),
]


def _cells(isolates: list[LabResult], names: dict[str, str]) -> list[dict]:
    organisms, drugs, values = aggregate(isolates, names)
    rows = []
    for organism in organisms:
        for drug in drugs:
            entries = values[organism][drug]
            if not entries:
                continue
            s = entries.count("S")
            i = entries.count("I")
            r = entries.count("R")
            n = len(entries)
            rows.append(
                {
                    "organism": organism,
                    "drug": drug,
                    "n": n,
                    "s": s,
                    "i": i,
                    "r": r,
                    "pct_s": round(100 * s / n),
                    "pct_r": round(100 * r / n),
                    "small_sample": n < MIN_RELIABLE_N,
                }
            )
    return rows


def stratify(
    results: Iterable[LabResult], names: dict[str, str]
) -> dict:
    """Return one set of grouped antibiograms per surveillance dimension."""
    results = list(results)
    dimensions = {}
    for key, label, grouper in DIMENSIONS:
        buckets: OrderedDict[tuple[str, str], list[LabResult]] = OrderedDict()
        for result in results:
            group = grouper(result)
            buckets.setdefault(group, []).append(result)

        groups = []
        for (group_key, group_label), isolates in buckets.items():
            groups.append(
                {
                    "key": group_key,
                    "label": group_label,
                    "isolates": len(isolates),
                    "cells": _cells(isolates, names),
                }
            )
        dimensions[key] = {"label": label, "groups": groups}

    return {
        "dimensions": dimensions,
        "total_isolates": len(results),
        "min_reliable_n": MIN_RELIABLE_N,
        "method": "WHO GLASS / EARS-Net stratification (first isolates, CLSI M39 n>=30 caution)",
    }
