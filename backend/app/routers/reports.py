import csv
import io
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlmodel import Session, select

from app.db import get_session
from app.models import Antibiotic, AuditLog, LabResult, Patient

router = APIRouter(prefix="/reports", tags=["Reports"])

ORGANISMS = ["E. coli", "K. pneumoniae", "S. aureus", "P. aeruginosa"]
DRUGS = ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"]
ORG_MAP = {"ecoli": "E. coli", "kpneumo": "K. pneumoniae", "saureus": "S. aureus", "pseudo": "P. aeruginosa"}


@router.get("/monthly")
def monthly_report(hospital: Optional[str] = Query(None), session: Session = Depends(get_session)):
    now = datetime.now(timezone.utc)
    buf = io.StringIO()
    w = csv.writer(buf)

    patients = session.exec(select(Patient)).all()
    labs = session.exec(select(LabResult)).all()
    if hospital:
        patients = [p for p in patients if p.hospital == hospital]
        labs = [l for l in labs if l.hospital == hospital]

    w.writerow(["AMR STEWARDSHIP MONTHLY REPORT"])
    w.writerow(["Generated", now.isoformat()])
    w.writerow(["Scope", hospital or "All hospitals"])
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
    w.writerow(["Total patients", len(patients)])
    w.writerow(["Total lab results", len(labs)])
    by_hosp = defaultdict(int)
    for p in session.exec(select(Patient)).all():
        by_hosp[p.hospital or "Unknown"] += 1
    for h in sorted(by_hosp):
        w.writerow([f"Patients - {h}", by_hosp[h]])
    w.writerow([])

    # Antibiogram
    w.writerow(["== ANTIBIOGRAM (S/I/R) =="])
    org_drug = defaultdict(lambda: defaultdict(list))
    for lr in labs:
        org = ORG_MAP.get(lr.organism_id)
        if not org:
            continue
        for drug, val in (lr.susceptibility or {}).items():
            if drug in DRUGS and val in ("S", "I", "R"):
                org_drug[org][drug].append(val)

    w.writerow(["Organism"] + DRUGS)
    for org in ORGANISMS:
        row = [org]
        for drug in DRUGS:
            vals = org_drug[org][drug]
            row.append(max(set(vals), key=vals.count) if vals else "-")
        w.writerow(row)
    w.writerow([])

    # Resistance alerts summary
    w.writerow(["== RESISTANCE SUMMARY =="])
    for org in ORGANISMS:
        for drug in DRUGS:
            vals = org_drug[org][drug]
            if vals:
                r_rate = round(vals.count("R") / len(vals) * 100)
                if r_rate >= 50:
                    w.writerow([f"HIGH RESISTANCE: {org} vs {drug}", f"{r_rate}% R"])
    w.writerow([])

    # Activity log
    w.writerow(["== RECENT ACTIVITY =="])
    logs = session.exec(select(AuditLog).order_by(AuditLog.id.desc()).limit(50)).all()
    for log in logs:
        w.writerow([log.timestamp, log.username, log.action, log.details])

    filename = f"amr-report-{now:%Y-%m-%d-%H%M}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )