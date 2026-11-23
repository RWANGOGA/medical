from app.core.config import settings
from sqlmodel import Session, select
from app.models import (
    Organism, Antibiotic, Patient, TreatmentProtocol, User,
    AntibioticUse, HospitalActivity, LabResult,
)
from app.services.auth import hash_password
from app.services.surveillance import patient_key
from app.data.ddd import WHO_DDD
from app.data.global_amr import (
    ANTIBIOTICS as GLOBAL_ANTIBIOTICS,
    ORGANISMS as GLOBAL_ORGANISMS,
    PROTOCOLS as GLOBAL_PROTOCOLS,
)

def seed_database(session: Session):
    """Idempotently load reference data and demo content.

    Reference data (organisms, antibiotics, protocols) is added when missing so
    deployments can pick up new clinical content without a manual migration.
    Demo patients, lab results and users are only created once.
    """
    print("🌱 Seeding database with AMR clinical data & CDS protocols...")

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
    organisms.extend(Organism(**item) for item in GLOBAL_ORGANISMS)
    existing_organism_ids = {o.id for o in session.exec(select(Organism)).all()}
    for org in organisms:
        if org.id not in existing_organism_ids:
            session.add(org)

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

        # Anti-staphylococcal and anti-pseudomonal agents used by the CDS engine
        Antibiotic(id="cloxa", generic_name="Cloxacillin", brand_names=["Orbenin"],
                   drug_class="Penicillinase-resistant penicillin", aware_category="Access",
                   dosing_adult="500 mg-1 g PO/IV every 6 hours.",
                   tags=["beta-lactam", "penicillin", "anti-staphylococcal"]),
        Antibiotic(id="cefaz", generic_name="Cefazolin", brand_names=["Ancef"],
                   drug_class="1st-generation Cephalosporin", aware_category="Access",
                   dosing_adult="1-2 g IV every 8 hours.",
                   renal_adjustment="Reduce dose when creatinine clearance is below 35 mL/min.",
                   tags=["beta-lactam", "cephalosporin", "anti-staphylococcal"]),
        Antibiotic(id="cefepime", generic_name="Cefepime", brand_names=["Maxipime"],
                   drug_class="4th-generation Cephalosporin", aware_category="Watch",
                   dosing_adult="1-2 g IV every 8-12 hours; higher doses for Pseudomonas.",
                   renal_adjustment="Adjust dose and interval by creatinine clearance.",
                   tags=["beta-lactam", "cephalosporin"]),
        Antibiotic(id="vanco", generic_name="Vancomycin", brand_names=["Vancocin"],
                   drug_class="Glycopeptide", aware_category="Watch",
                   dosing_adult="15-20 mg/kg IV every 8-12 hours; target AUC/MIC 400-600.",
                   renal_adjustment="Dose by renal function with therapeutic drug monitoring.",
                   tags=["glycopeptide", "MRSA"]),
    ]
    antibiotics.extend(Antibiotic(**item) for item in GLOBAL_ANTIBIOTICS)
    existing_antibiotic_ids = {a.id for a in session.exec(select(Antibiotic)).all()}
    for abx in antibiotics:
        if abx.id not in existing_antibiotic_ids:
            session.add(abx)

    # Backfill WHO ATC/DDD values, including databases seeded before consumption
    # reporting existed. Safe to run on every startup.
    for drug in session.exec(select(Antibiotic)).all():
        reference = WHO_DDD.get(drug.id)
        if reference and (not drug.atc_code or not drug.ddd_value_mg):
            drug.atc_code, drug.ddd_value_mg, drug.ddd_route, _ = reference
            session.add(drug)
    session.commit()

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
        ),
        TreatmentProtocol(
            organism_id="saureus",
            first_line=["cloxa", "cefaz"],
            second_line=["coamox", "cotrim"],
            reserve=["vanco", "linezolid"],
            duration="5-7 days for uncomplicated skin infection; 14+ days for bacteremia or endocarditis",
            monitoring=["Repeat blood cultures at 48-72h if bacteremic", "Renal function and vancomycin levels", "Review need for source control"]
        ),
        TreatmentProtocol(
            organism_id="pseudo",
            first_line=["pipetazo"],
            second_line=["cefepime", "cipro"],
            reserve=["merope", "colistin"],
            duration="7-14 days depending on site and clinical response",
            monitoring=["Renal function", "Repeat culture and susceptibility at 48-72h", "Aminoglycoside levels if used"]
        ),
    ]
    protocols.extend(TreatmentProtocol(**item) for item in GLOBAL_PROTOCOLS)
    existing_protocol_organisms = {
        p.organism_id for p in session.exec(select(TreatmentProtocol)).all()
    }
    for p in protocols:
        if p.organism_id not in existing_protocol_organisms:
            session.add(p)

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
    if not session.exec(select(Patient)).first():
        for pat in patients:
            session.add(pat)

    # --- DEMO USERS (opt-in only) ---
    # Default accounts with published passwords are a security hole. Demo users
    # are created only when SEED_DEMO_USERS=true AND passwords are supplied.
    if settings.SEED_DEMO_USERS:
        if settings.SEED_DOCTOR_PASSWORD and not session.exec(
            select(User).where(User.username == "dr.demo")
        ).first():
            session.add(
                User(
                    username="dr.demo",
                    email="demo@stewardamr.org",
                    hashed_password=hash_password(settings.SEED_DOCTOR_PASSWORD),
                    full_name="Dr. Sarah Nakato",
                    role="doctor",
                    hospital="Mulago National Referral Hospital",
                    specialization="Infectious Diseases",
                )
            )
            print("Seeded demo doctor 'dr.demo'.")
        if settings.SEED_ADMIN_PASSWORD and not session.exec(
            select(User).where(User.username == "admin")
        ).first():
            session.add(
                User(
                    username="admin",
                    email="admin@stewardamr.org",
                    hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
                    full_name="System Administrator",
                    role="admin",
                    hospital="All Hospitals",
                    specialization="System Administration",
                    is_active=True,
                )
            )
            print("Seeded administrator 'admin'.")
        if not settings.SEED_DOCTOR_PASSWORD and not settings.SEED_ADMIN_PASSWORD:
            print(
                "SEED_DEMO_USERS=true but no SEED_DOCTOR_PASSWORD/SEED_ADMIN_PASSWORD "
                "was provided; skipping demo users."
            )
    
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
    if not session.exec(select(LabResult)).first():
        origin_by_specimen = {
            "Urine": "community",
            "Blood": "hospital-onset",
            "Sputum": "healthcare-associated",
            "Wound swab": "community",
        }
        unit_by_specimen = {
            "Urine": "Medical ward",
            "Blood": "ICU",
            "Sputum": "ICU",
            "Wound swab": "Surgical ward",
        }
        patient_metadata = {
            p.name: (p.age, p.sex) for p in session.exec(select(Patient)).all()
        }
        for lr in lab_results:
            lr.infection_origin = origin_by_specimen.get(lr.specimen, "unknown")
            lr.ast_standard = "EUCAST 2025"
            lr.patient_key = patient_key(None, lr.patient_name, lr.hospital)
            lr.age, lr.sex = patient_metadata.get(lr.patient_name, (None, ""))
            lr.unit = unit_by_specimen.get(lr.specimen, "")
            session.add(lr)

    # Backfill existing isolates after the stratification columns are added.
    # create_all()/ALTER TABLE cannot populate old rows, so derive age and sex
    # from the linked patient (or a normalised name match) on every startup.
    unit_by_specimen = {
        "Urine": "Medical ward",
        "Blood": "ICU",
        "Sputum": "ICU",
        "Wound swab": "Surgical ward",
    }
    all_patients = session.exec(select(Patient)).all()
    patients_by_id = {p.id: p for p in all_patients}
    patients_by_name = {p.name.strip().lower(): p for p in all_patients}
    for result in session.exec(select(LabResult)).all():
        patient = patients_by_id.get(result.patient_id) or patients_by_name.get(
            (result.patient_name or "").strip().lower()
        )
        changed = False
        if result.age is None and patient and patient.age:
            result.age = patient.age
            changed = True
        if not result.sex and patient and patient.sex:
            result.sex = patient.sex
            changed = True
        if not result.unit and result.specimen in unit_by_specimen:
            result.unit = unit_by_specimen[result.specimen]
            changed = True
        if changed:
            session.add(result)

    # --- ANTIMICROBIAL CONSUMPTION (GLASS-AMC) ---
    # A small demonstrator so the consumption dashboard is useful on first run.
    if not session.exec(select(AntibioticUse)).first():
        demo_uses = [
            ("ceftri", "Mulago National Referral Hospital", "Medical ward", "2026-01-04", 7, 2000.0),
            ("pipetazo", "Mulago National Referral Hospital", "ICU", "2026-01-09", 10, 14000.0),
            ("merope", "Mulago National Referral Hospital", "ICU", "2026-01-15", 7, 3000.0),
            ("nitro", "Mulago National Referral Hospital", "Medical ward", "2026-02-03", 5, None),
            ("ceftri", "Mulago National Referral Hospital", "Surgical ward", "2026-02-12", 6, 2000.0),
            ("amoxi", "Jinja Regional Hospital", "Medical ward", "2026-01-07", 7, None),
            ("coamox", "Jinja Regional Hospital", "Medical ward", "2026-02-11", 7, 1000.0),
            ("cipro", "Jinja Regional Hospital", "Outpatient", "2026-03-02", 5, 1000.0),
        ]
        for drug_id, hospital, unit, start, days, dose in demo_uses:
            session.add(
                AntibioticUse(
                    antibiotic_id=drug_id,
                    hospital=hospital,
                    unit=unit,
                    start_date=start,
                    end_date=start,
                    duration_days=days,
                    daily_dose_mg=dose,
                    route="IV" if drug_id in {"ceftri", "pipetazo", "merope"} else "O",
                    indication="Demo surveillance record",
                    estimated_ddd=dose is None,
                    entered_by="seed",
                )
            )

    if not session.exec(select(HospitalActivity)).first():
        denominators = {
            "Mulago National Referral Hospital": [(1800, 220), (1750, 210), (1900, 240)],
            "Jinja Regional Hospital": [(900, 120), (950, 130), (880, 115)],
        }
        for hospital, months in denominators.items():
            for index, (patient_days, admissions) in enumerate(months, start=1):
                session.add(
                    HospitalActivity(
                        hospital=hospital,
                        period=f"2026-{index:02d}",
                        patient_days=patient_days,
                        admissions=admissions,
                        entered_by="seed",
                    )
                )

    session.commit()
    print("✅ Database seeded successfully with CDS Protocols and AMC reference data!")