import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import json as _json
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, JSONResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import Antibiotic, LabResult, Patient, User
from app.routers.lab import _scope_lab_results
from app.routers.patients import _scope_to_hospital
from app.services.antibiogram import aggregate, first_isolates, modal_value, organism_names
from app.services.auth import get_current_user
from app.services.surveillance import quality_indicators

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
def report_summary(
    hospital: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """JSON version of the monthly stewardship report, for the in-app view."""
    now = datetime.now(timezone.utc)

    patients = session.exec(_scope_to_hospital(select(Patient), current_user)).all()
    labs = session.exec(_scope_lab_results(select(LabResult), current_user)).all()
    if hospital:
        patients = [p for p in patients if p.hospital == hospital]
        labs = [l for l in labs if l.hospital == hospital]

    counts = defaultdict(int)
    for abx in session.exec(select(Antibiotic)).all():
        counts[abx.aware_category] += 1

    indicators = quality_indicators(labs)
    first_labs = first_isolates(labs)
    organisms, drugs, values = aggregate(first_labs, organism_names(session))

    by_hosp = defaultdict(int)
    for p in patients:
        by_hosp[p.hospital or "Unknown"] += 1

    antibiogram = []
    for organism in organisms:
        cells = []
        for drug in drugs:
            vals = values[organism][drug]
            cells.append({
                "drug": drug,
                "n": len(vals),
                "s": vals.count("S"),
                "i": vals.count("I"),
                "r": vals.count("R"),
                "pct_s": round(vals.count("S") / len(vals) * 100) if vals else None,
                "pct_r": round(vals.count("R") / len(vals) * 100) if vals else None,
            })
        antibiogram.append({"organism": organism, "cells": cells})

    alerts = []
    for organism in organisms:
        for drug in drugs:
            vals = values[organism][drug]
            if vals:
                r_rate = round(vals.count("R") / len(vals) * 100)
                if r_rate >= 50:
                    alerts.append({"organism": organism, "drug": drug, "pct_r": r_rate})

    return {
        "generated_at": now.isoformat(),
        "scope": hospital or "All accessible hospitals",
        "workload": {
            "patients": len(patients),
            "lab_results": len(labs),
            "first_isolates": indicators["first_isolates"],
            "duplicate_isolates": indicators["duplicate_isolates"],
            "by_hospital": [{"hospital": h, "patients": by_hosp[h]} for h in sorted(by_hosp)],
        },
        "aware": [{"category": cat, "antibiotics": counts.get(cat, 0)} for cat in ("Access", "Watch", "Reserve")],
        "quality": {
            "identified_pct": indicators["identified_pct"],
            "origin_known_pct": indicators["origin_known_pct"],
            "ast_standard_pct": indicators["ast_standard_pct"],
            "invasive_pct": indicators["invasive_pct"],
            "sir_pct": indicators["sir_pct"],
            "dedup_window_days": indicators["dedup_window_days"],
        },
        "antibiogram": {"organisms": organisms, "drugs": drugs, "rows": antibiogram},
        "alerts": alerts,
    }
def monthly_report(
    hospital: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Stewardship report, limited to the data the caller may see.

    The report is aggregate (no patient identifiers) but still describes
    facility-level workload and resistance, so it is not public.
    """
    now = datetime.now(timezone.utc)
    buf = io.StringIO()
    w = csv.writer(buf)

    patients = session.exec(
        _scope_to_hospital(select(Patient), current_user)
    ).all()
    labs = session.exec(
        _scope_lab_results(select(LabResult), current_user)
    ).all()
    if hospital:
        patients = [p for p in patients if p.hospital == hospital]
        labs = [l for l in labs if l.hospital == hospital]

    w.writerow(["AMR STEWARDSHIP MONTHLY REPORT"])
    w.writerow(["Generated", now.isoformat()])
    w.writerow(["Scope", hospital or "All accessible hospitals"])
    w.writerow([])

    # AWaRe summary
    w.writerow(["== WHO AWaRe CLASSIFICATION =="])
    counts = defaultdict(int)
    for abx in session.exec(select(Antibiotic)).all():
        counts[abx.aware_category] += 1
    for cat in ("Access", "Watch", "Reserve"):
        w.writerow([cat, counts.get(cat, 0)])
    w.writerow([])

    # Workload
    w.writerow(["== WORKLOAD =="])
    indicators = quality_indicators(labs)
    first_labs = first_isolates(labs)
    w.writerow(["Total patients", len(patients)])
    w.writerow(["Total lab results", len(labs)])
    w.writerow(["First isolates counted", indicators["first_isolates"]])
    w.writerow(["Repeat isolates excluded (GLASS)", indicators["duplicate_isolates"]])
    by_hosp = defaultdict(int)
    for p in patients:
        by_hosp[p.hospital or "Unknown"] += 1
    for h in sorted(by_hosp):
        w.writerow([f"Patients - {h}", by_hosp[h]])
    w.writerow([])

    # Data quality (WHO GLASS / WHONET)
    w.writerow(["== SURVEILLANCE DATA QUALITY (WHO GLASS) =="])
    for label, key in (
        ("Isolates with a patient identity", "identified_pct"),
        ("Isolates with infection origin", "origin_known_pct"),
        ("Isolates with AST breakpoint standard", "ast_standard_pct"),
        ("Invasive isolates (blood/CSF)", "invasive_pct"),
        ("Isolates with an S/I/R result", "sir_pct"),
    ):
        w.writerow([f"{label} (%)", indicators[key]])
    w.writerow(["First-isolate window (days)", indicators["dedup_window_days"]])
    w.writerow([])

    # Antibiogram — first isolates only, so repeat cultures cannot skew %S.
    w.writerow(["== ANTIBIOGRAM (S/I/R, first isolates) =="])
    organisms, drugs, values = aggregate(first_labs, organism_names(session))

    w.writerow(["Organism"] + drugs)
    for organism in organisms:
        row = [organism]
        for drug in drugs:
            row.append(modal_value(values[organism][drug]))
        w.writerow(row)
    w.writerow([])

    # Resistance alerts summary
    w.writerow(["== RESISTANCE SUMMARY =="])
    for organism in organisms:
        for drug in drugs:
            vals = values[organism][drug]
            if vals:
                r_rate = round(vals.count("R") / len(vals) * 100)
                if r_rate >= 50:
                    w.writerow([f"HIGH RESISTANCE: {organism} vs {drug}", f"{r_rate}% R"])
    w.writerow([])

    filename = f"amr-report-{now:%Y-%m-%d-%H%M}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
