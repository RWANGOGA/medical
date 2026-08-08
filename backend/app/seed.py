from sqlmodel import Session, select
from app.models import Organism, Antibiotic, Patient, TreatmentProtocol

def seed_database(session: Session):
    if session.exec(select(Organism)).first():
        return

    print("🌱 Seeding database with Makerere clinical data & CDS Protocols...")

    # --- ORGANISMS ---
    organisms = [
        Organism(id="ecoli", name="Escherichia coli", type="Bacteria", gram="Gram-negative rod",
                 morphology="Gram-negative, non-spore-forming rod; facultative anaerobe.",
                 diseases=["UTI", "Bacteremia", "Neonatal meningitis"],
                 virulence_factors=["Type 1 fimbriae", "LPS endotoxin", "K1 capsule"],
                 risk_factors=["Urinary catheterization", "Diabetes", "Pregnancy"],
                 clinical_importance="Most common cause of community/hospital UTI worldwide.", resistance_rate=42),
        Organism(id="kpneumo", name="Klebsiella pneumoniae", type="Bacteria", gram="Gram-negative rod",
                 morphology="Encapsulated, non-motile gram-negative rod; mucoid colonies.",
                 diseases=["Hospital-acquired pneumonia", "UTI", "Liver abscess"],
                 virulence_factors=["Polysaccharide capsule", "Siderophores", "Biofilm"],
                 risk_factors=["ICU admission", "Mechanical ventilation"],
                 clinical_importance="Major carbapenem-resistant Enterobacterales (CRE) pathogen.", resistance_rate=58),
    ]
    for org in organisms: session.add(org)

    # --- ANTIBIOTICS (Notice the new 'tags' for CDS filtering) ---
    antibiotics = [
        Antibiotic(id="amoxi", generic_name="Amoxicillin", brand_names=["Amoxil"], drug_class="Aminopenicillin",
                   aware_category="Access", dosing_adult="500 mg PO every 8 hours.", 
                   tags=["beta-lactam", "penicillin", "aminopenicillin"]),
                   
        Antibiotic(id="ceftri", generic_name="Ceftriaxone", brand_names=["Rocephin"], drug_class="3rd-gen Cephalosporin",
                   aware_category="Watch", dosing_adult="1-2 g IV/IM once daily.", 
                   tags=["beta-lactam", "cephalosporin"]),
                   
        Antibiotic(id="merope", generic_name="Meropenem", brand_names=["Merrem"], drug_class="Carbapenem",
                   aware_category="Watch", dosing_adult="1 g IV every 8 hours.", 
                   tags=["beta-lactam", "carbapenem"]),
                   
        Antibiotic(id="cipro", generic_name="Ciprofloxacin", brand_names=["Ciproxin"], drug_class="Fluoroquinolone",
                   aware_category="Watch", dosing_adult="500 mg PO every 12 hours.", 
                   tags=["fluoroquinolone"]),
                   
        Antibiotic(id="nitro", generic_name="Nitrofurantoin", brand_names=["Macrobid"], drug_class="Nitrofuran",
                   aware_category="Access", dosing_adult="100 mg PO every 12 hours.", 
                   tags=["nitrofuran"]),
                   
        Antibiotic(id="pipetazo", generic_name="Piperacillin-tazobactam", brand_names=["Zosyn"], drug_class="Beta-lactam/BLI",
                   aware_category="Watch", dosing_adult="4.5 g IV every 6-8 hours.", 
                   tags=["beta-lactam", "penicillin"]),
    ]
    for abx in antibiotics: session.add(abx)

    # --- TREATMENT PROTOCOLS (The CDS Rules in the DB) ---
    protocols = [
        TreatmentProtocol(
            organism_id="ecoli",
            first_line=["nitro", "ceftri"],
            second_line=["pipetazo"],
            reserve=["merope"],
            duration="5-7 days uncomplicated; 10-14 days complicated/bacteremic",
            monitoring=["Clinical response at 48-72h", "Repeat culture if no improvement"]
        ),
        TreatmentProtocol(
            organism_id="kpneumo",
            first_line=["ceftri"],
            second_line=["pipetazo"],
            reserve=["merope"],
            duration="10-14 days, longer if bacteremic",
            monitoring=["Renal function", "Repeat cultures at 48-72h if unwell"]
        )
    ]
    for p in protocols: session.add(p)

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
    ]
    for pat in patients: session.add(pat)

    session.commit()
    print("✅ Database seeded successfully with CDS Protocols!")