from sqlmodel import Session, select
from app.models import Organism, Antibiotic, Patient, TreatmentProtocol, User
from app.services.auth import hash_password
from app.models import Antibiotic, Patient, Organism, LabResult

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
                Organism(id="saureus", name="Staphylococcus aureus", type="Bacteria", gram="Gram-positive coccus",
                 morphology="Gram-positive cocci in clusters.", diseases=["Skin infection", "Bacteremia", "Endocarditis"],
                 virulence_factors=["Protein A", "Alpha-toxin"], risk_factors=["Skin breaks", "IV drug use"],
                 clinical_importance="MRSA is a leading cause of hospital and community infection.", resistance_rate=35),
        Organism(id="pseudo", name="Pseudomonas aeruginosa", type="Bacteria", gram="Gram-negative rod",
                 morphology="Non-fermenting; produces pyocyanin.", diseases=["VAP", "Burn infection", "Otitis externa"],
                 virulence_factors=["Exotoxin A", "Biofilm"], risk_factors=["Ventilation", "Cystic fibrosis"],
                 clinical_importance="Intrinsically resistant; WHO critical-priority pathogen.", resistance_rate=49),
    ]
    for org in organisms: session.add(org)

    # --- ANTIBIOTICS ---
    antibiotics = [
        # ACCESS (first-line) - 4 total
        Antibiotic(id="amoxi", generic_name="Amoxicillin", brand_names=["Amoxil"], drug_class="Aminopenicillin",
                   aware_category="Access", dosing_adult="500 mg PO every 8 hours.", 
                   tags=["beta-lactam", "penicillin"]),
        Antibiotic(id="nitro", generic_name="Nitrofurantoin", brand_names=["Macrobid"], drug_class="Nitrofuran",
                   aware_category="Access", dosing_adult="100 mg PO every 12 hours.", 
                   tags=["nitrofuran"]),
        Antibiotic(id="coamox", generic_name="Amoxicillin-Clavulanate", brand_names=["Augmentin"], 
                   drug_class="Aminopenicillin + Beta-lactamase Inhibitor",
                   aware_category="Access", dosing_adult="625 mg PO every 8 hours.",
                   tags=["beta-lactam", "penicillin", "BLI"]),
        Antibiotic(id="cotrim", generic_name="Co-trimoxazole", brand_names=["Bactrim", "Septrin"], 
                   drug_class="Folate Synthesis Inhibitor",
                   aware_category="Access", dosing_adult="960 mg (DS) PO every 12 hours.",
                   tags=["sulfonamide", "folate inhibitor"]),
        
        # WATCH (requires stewardship oversight) - 6 total
        Antibiotic(id="ceftri", generic_name="Ceftriaxone", brand_names=["Rocephin"], drug_class="3rd-gen Cephalosporin",
                   aware_category="Watch", dosing_adult="1-2 g IV/IM once daily.", 
                   tags=["beta-lactam", "cephalosporin"]),
        Antibiotic(id="merope", generic_name="Meropenem", brand_names=["Merrem"], drug_class="Carbapenem",
                   aware_category="Watch", dosing_adult="1 g IV every 8 hours.", 
                   tags=["beta-lactam", "carbapenem"]),
        Antibiotic(id="cipro", generic_name="Ciprofloxacin", brand_names=["Ciproxin"], drug_class="Fluoroquinolone",
                   aware_category="Watch", dosing_adult="500 mg PO every 12 hours.", 
                   tags=["fluoroquinolone"]),
        Antibiotic(id="pipetazo", generic_name="Piperacillin-tazobactam", brand_names=["Zosyn"], drug_class="Beta-lactam/BLI",
                   aware_category="Watch", dosing_adult="4.5 g IV every 6-8 hours.", 
                   tags=["beta-lactam", "penicillin", "BLI"]),
        Antibiotic(id="azithro", generic_name="Azithromycin", brand_names=["Zithromax"], drug_class="Macrolide",
                   aware_category="Watch", dosing_adult="500 mg PO once daily.",
                   tags=["macrolide"]),
        Antibiotic(id="genta", generic_name="Gentamicin", brand_names=["Garamycin"], drug_class="Aminoglycoside",
                   aware_category="Watch", dosing_adult="5 mg/kg IV once daily.",
                   tags=["aminoglycoside"]),
        
        # RESERVE (last-resort) - 2 total
        Antibiotic(id="colistin", generic_name="Colistin", brand_names=["Coly-Mycin"], drug_class="Polymyxin",
                   aware_category="Reserve", dosing_adult="Loading dose 9 MU IV, then 3 MU every 8 hours.",
                   tags=["polymyxin", "MDR"]),
        Antibiotic(id="linezolid", generic_name="Linezolid", brand_names=["Zyvox"], drug_class="Oxazolidinone",
                   aware_category="Reserve", dosing_adult="600 mg PO/IV every 12 hours.",
                   tags=["oxazolidinone", "MRSA", "VRE"]),
    ]
    for abx in antibiotics: session.add(abx)

    # --- TREATMENT PROTOCOLS ---
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

    # --- PATIENTS (Historical data for real dashboard aggregation) ---
    patients = [
        Patient(name="Namono J.", national_id="UG-987654", hospital="Jinja Regional Hospital",
                age=34, sex="F", weight_kg=62.0, pregnancy_status="Not pregnant",
                allergies=["Penicillin — maculopapular rash"], renal_function="Normal (eGFR 95)",
                diagnosis="Complicated UTI", infection_site="Urinary tract",
                culture_results="E. coli, ESBL-positive",
                antibiotic_timeline=[
                    {"date": "2024", "drug": "Ciprofloxacin", "outcome": "fail", "note": "Symptoms persisted"},
                    {"date": "2025", "drug": "Meropenem", "outcome": "success", "note": "Culture-directed"},
                    {"date": "2026", "drug": "Meropenem", "outcome": "current", "note": "Ongoing treatment"}
                ]),
        Patient(name="Byaruhanga K.", national_id="UG-112233", hospital="Mulago National Referral Hospital",
                age=58, sex="M", weight_kg=74.0, pregnancy_status="N/A",
                renal_function="Impaired (eGFR 38)", diagnosis="Ventilator-associated pneumonia",
                infection_site="Respiratory tract", culture_results="K. pneumoniae, MDR",
                antibiotic_timeline=[
                    {"date": "2023", "drug": "Ceftriaxone", "outcome": "fail", "note": "No improvement"},
                    {"date": "2024", "drug": "Piperacillin-tazobactam", "outcome": "partial", "note": "Renal adjusted"},
                    {"date": "2025", "drug": "Meropenem", "outcome": "success", "note": "Escalated per ID"},
                    {"date": "2026", "drug": "Meropenem + Colistin", "outcome": "current", "note": "Combination therapy"}
                ]),
        Patient(name="Achieng M.", national_id="UG-445566", hospital="Mulago National Referral Hospital",
                age=28, sex="F", weight_kg=55.0, pregnancy_status="Pregnant (24 weeks)",
                renal_function="Normal", diagnosis="Uncomplicated UTI",
                infection_site="Urinary tract", culture_results="E. coli",
                antibiotic_timeline=[
                    {"date": "2026", "drug": "Nitrofurantoin", "outcome": "success", "note": "Safe in pregnancy"}
                ]),
        Patient(name="Ouma P.", national_id="UG-778899", hospital="Jinja Regional Hospital",
                age=45, sex="M", weight_kg=80.0, pregnancy_status="N/A",
                renal_function="Normal", diagnosis="Skin and soft tissue infection",
                infection_site="Skin", culture_results="S. aureus, MSSA",
                antibiotic_timeline=[
                    {"date": "2025", "drug": "Ceftriaxone", "outcome": "success", "note": "Resolved in 7 days"}
                ]),
        Patient(name="Nakato S.", national_id="UG-334455", hospital="Mulago National Referral Hospital",
                age=67, sex="F", weight_kg=68.0, pregnancy_status="N/A",
                renal_function="Normal", diagnosis="Bacteremia",
                infection_site="Blood", culture_results="E. coli, ESBL-positive",
                antibiotic_timeline=[
                    {"date": "2022", "drug": "Ciprofloxacin", "outcome": "fail", "note": "Resistant"},
                    {"date": "2023", "drug": "Ceftriaxone", "outcome": "fail", "note": "ESBL detected"},
                    {"date": "2024", "drug": "Piperacillin-tazobactam", "outcome": "partial", "note": "Partial response"},
                    {"date": "2025", "drug": "Meropenem", "outcome": "success", "note": "Cleared bacteremia"}
                ]),
        Patient(name="Mugisha D.", national_id="UG-667788", hospital="Jinja Regional Hospital",
                age=52, sex="M", weight_kg=72.0, pregnancy_status="N/A",
                renal_function="Normal", diagnosis="Hospital-acquired pneumonia",
                infection_site="Respiratory tract", culture_results="K. pneumoniae",
                antibiotic_timeline=[
                    {"date": "2024", "drug": "Ceftriaxone", "outcome": "fail", "note": "Resistant"},
                    {"date": "2025", "drug": "Meropenem", "outcome": "success", "note": "Effective"}
                ]),
        Patient(name="Tumwine R.", national_id="UG-998877", hospital="Mulago National Referral Hospital",
                age=39, sex="M", weight_kg=85.0, pregnancy_status="N/A",
                renal_function="Normal", diagnosis="Complicated UTI",
                infection_site="Urinary tract", culture_results="E. coli",
                antibiotic_timeline=[
                    {"date": "2021", "drug": "Amoxicillin", "outcome": "success", "note": "Susceptible"},
                    {"date": "2022", "drug": "Ciprofloxacin", "outcome": "success", "note": "Effective"},
                    {"date": "2023", "drug": "Ciprofloxacin", "outcome": "fail", "note": "Resistance emerged"},
                    {"date": "2024", "drug": "Ceftriaxone", "outcome": "success", "note": "Switched"}
                ]),
        Patient(name="Kato L.", national_id="UG-123456", hospital="Mulago National Referral Hospital",
                age=71, sex="F", weight_kg=60.0, pregnancy_status="N/A",
                renal_function="Impaired (eGFR 45)", diagnosis="Bacteremia",
                infection_site="Blood", culture_results="K. pneumoniae, CRE",
                antibiotic_timeline=[
                    {"date": "2025", "drug": "Meropenem", "outcome": "fail", "note": "Carbapenem-resistant"},
                    {"date": "2026", "drug": "Colistin", "outcome": "current", "note": "Last resort"}
                ]),
    ]
    for pat in patients: session.add(pat)

    # --- DEMO USER ---
    demo_doctor = User(
        username="dr.demo",
        email="demo@stewardamr.org",
        hashed_password=hash_password("steward123"),
        full_name="Dr. Sarah Nakato",
        role="doctor",
        hospital="Mulago National Referral Hospital",
        specialization="Infectious Diseases",
    )
    session.add(demo_doctor)

    # --- ADMIN USER ---
    admin_user = User(
        username="admin",
        email="admin@stewardamr.org",
        hashed_password=hash_password("admin123"),
        full_name="System Administrator",
        role="admin",
        hospital="All Hospitals",
        specialization="System Administration",
        is_active=True,
    )
    session.add(admin_user)
    
    # COMMIT HERE - organisms must be in DB before lab results reference them
    session.commit()
    
    # --- LAB RESULTS (feed the live antibiogram) ---
    lab_results = [
        LabResult(patient_name="Namono J.", organism_id="ecoli", specimen="Urine", hospital="Jinja Regional Hospital",
                  susceptibility={"Ampicillin": "R", "Ceftriaxone": "I", "Pip-Tazo": "S", "Meropenem": "S"}),
        LabResult(patient_name="Nakato S.", organism_id="ecoli", specimen="Blood", hospital="Mulago National Referral Hospital",
                  susceptibility={"Ampicillin": "R", "Ceftriaxone": "I", "Pip-Tazo": "S", "Meropenem": "S"}),
        LabResult(patient_name="Mugisha D.", organism_id="kpneumo", specimen="Sputum", hospital="Jinja Regional Hospital",
                  susceptibility={"Ampicillin": "R", "Ceftriaxone": "R", "Pip-Tazo": "I", "Meropenem": "R"}),
        LabResult(patient_name="Kato L.", organism_id="kpneumo", specimen="Blood", hospital="Mulago National Referral Hospital",
                  susceptibility={"Ampicillin": "R", "Ceftriaxone": "R", "Pip-Tazo": "I", "Meropenem": "R"}),
        LabResult(patient_name="Byaruhanga K.", organism_id="pseudo", specimen="Sputum", hospital="Mulago National Referral Hospital",
                  susceptibility={"Ampicillin": "R", "Ceftriaxone": "R", "Pip-Tazo": "I", "Meropenem": "I"}),
        LabResult(patient_name="Nabirye P.", organism_id="saureus", specimen="Wound swab", hospital="Mulago National Referral Hospital",
                  susceptibility={"Vancomycin": "S"}),
        LabResult(patient_name="Ouma P.", organism_id="saureus", specimen="Wound swab", hospital="Jinja Regional Hospital",
                  susceptibility={"Vancomycin": "S", "Ceftriaxone": "S"}),
    ]
    for lr in lab_results: session.add(lr)   

    session.commit()
    print("✅ Database seeded successfully with CDS Protocols!")