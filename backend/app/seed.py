from sqlmodel import Session, select
from app.models import Organism, Antibiotic, Patient

def seed_database(session: Session):
    # Check if already seeded
    if session.exec(select(Organism)).first():
        return

    print("🌱 Seeding database with Makerere clinical data...")

    # --- ORGANISMS ---
    organisms = [
        Organism(id="ecoli", name="Escherichia coli", type="Bacteria", gram="Gram-negative rod",
                 morphology="Gram-negative, non-spore-forming rod; facultative anaerobe.",
                 diseases=["UTI", "Bacteremia", "Neonatal meningitis", "Traveler's diarrhea"],
                 virulence_factors=["Type 1 fimbriae", "LPS endotoxin", "Siderophores", "K1 capsule"],
                 risk_factors=["Urinary catheterization", "Diabetes", "Pregnancy"],
                 clinical_importance="Most common cause of community/hospital UTI worldwide.",
                 resistance_rate=42),
        Organism(id="kpneumo", name="Klebsiella pneumoniae", type="Bacteria", gram="Gram-negative rod",
                 morphology="Encapsulated, non-motile gram-negative rod; mucoid colonies.",
                 diseases=["Hospital-acquired pneumonia", "UTI", "Liver abscess", "Bacteremia"],
                 virulence_factors=["Polysaccharide capsule", "Siderophores", "Biofilm"],
                 risk_factors=["ICU admission", "Mechanical ventilation", "Indwelling devices"],
                 clinical_importance="Major carbapenem-resistant Enterobacterales (CRE) pathogen.",
                 resistance_rate=58),
        Organism(id="saureus", name="Staphylococcus aureus", type="Bacteria", gram="Gram-positive coccus",
                 morphology="Gram-positive cocci in clusters; catalase/coagulase-positive.",
                 diseases=["Skin/soft tissue infection", "Bacteremia", "Endocarditis", "Osteomyelitis"],
                 virulence_factors=["Protein A", "Alpha-toxin", "PVL (CA-MRSA)", "Biofilm"],
                 risk_factors=["Skin breaks/IV drug use", "Prosthetic devices", "Nasal colonization"],
                 clinical_importance="MRSA remains a leading cause of hospital/community infection.",
                 resistance_rate=35),
        Organism(id="pseudo", name="Pseudomonas aeruginosa", type="Bacteria", gram="Gram-negative rod",
                 morphology="Aerobic, non-fermenting; produces pyocyanin (blue-green pigment).",
                 diseases=["Ventilator-associated pneumonia", "Burn wound infection", "Otitis externa"],
                 virulence_factors=["Exotoxin A", "Pyocyanin", "Biofilm", "Type III secretion"],
                 risk_factors=["Mechanical ventilation", "Cystic fibrosis", "Burns", "Neutropenia"],
                 clinical_importance="Intrinsically resistant; WHO critical-priority pathogen.",
                 resistance_rate=49)
    ]
    for org in organisms: session.add(org)

    # --- ANTIBIOTICS ---
    antibiotics = [
        Antibiotic(id="amoxi", generic_name="Amoxicillin", brand_names=["Amoxil"], drug_class="Aminopenicillin",
                   aware_category="Access", mechanism_of_action="Inhibits cell wall synthesis via PBPs.",
                   spectrum="Gram-positive cocci, some non-ESBL gram-negatives.",
                   dosing_adult="500 mg PO every 8 hours.", pregnancy_considerations="Category B — safe.",
                   renal_adjustment="Extend interval if CrCl < 30.", adverse_effects=["Diarrhea", "Rash"]),
        Antibiotic(id="ceftri", generic_name="Ceftriaxone", brand_names=["Rocephin"], drug_class="3rd-gen Cephalosporin",
                   aware_category="Watch", mechanism_of_action="High-affinity binding to PBPs.",
                   spectrum="Broad gram-negative; moderate gram-positive. Not for Pseudomonas/ESBL.",
                   dosing_adult="1-2 g IV/IM once daily.", pregnancy_considerations="Category B — safe.",
                   adverse_effects=["Biliary sludging", "Diarrhea"]),
        Antibiotic(id="merope", generic_name="Meropenem", brand_names=["Merrem"], drug_class="Carbapenem",
                   aware_category="Watch", mechanism_of_action="Broad cell-wall inhibition; stable against most ESBLs.",
                   spectrum="Very broad: ESBL gram-negatives, gram-positives, anaerobes.",
                   dosing_adult="1 g IV every 8 hours.", pregnancy_considerations="Category B.",
                   renal_adjustment="Reduce dose for CrCl < 50.", adverse_effects=["Seizures (rare)", "Diarrhea"])
    ]
    for abx in antibiotics: session.add(abx)

    # --- PATIENTS ---
    patients = [
        Patient(name="Namono J.", age=34, sex="F", weight_kg=62.0, pregnancy_status="Not pregnant",
                allergies=["Penicillin — maculopapular rash"], renal_function="Normal (eGFR 95)",
                diagnosis="Complicated UTI", infection_site="Urinary tract",
                culture_results="E. coli, ESBL-positive",
                antibiotic_timeline=[
                    {"date": "Jan 2026", "drug": "Ciprofloxacin", "outcome": "fail", "note": "Symptoms persisted"},
                    {"date": "Aug 2026", "drug": "Meropenem", "outcome": "current", "note": "Culture-directed"}
                ]),
        Patient(name="Byaruhanga K.", age=58, sex="M", weight_kg=74.0, pregnancy_status="N/A",
                renal_function="Impaired (eGFR 38)", diagnosis="Ventilator-associated pneumonia",
                infection_site="Respiratory tract", culture_results="Pseudomonas aeruginosa, MDR",
                antibiotic_timeline=[
                    {"date": "Jun 2026", "drug": "Piperacillin-tazobactam", "outcome": "partial", "note": "Renal adjusted"},
                    {"date": "Aug 2026", "drug": "Meropenem + Colistin", "outcome": "current", "note": "Escalated per ID"}
                ])
    ]
    for pat in patients: session.add(pat)

    session.commit()
    print("✅ Database seeded successfully!")