"""Global AMR reference data added alongside the original core panel.

Content follows the WHO Bacterial Priority Pathogens List (2024) and WHO AWaRe
classification. It is reference material for decision support, not a substitute
for local susceptibility data or specialist advice.
"""

ORGANISMS = [
    {
        "id": "efaecium",
        "name": "Enterococcus faecium",
        "type": "Bacteria",
        "gram": "Gram-positive coccus",
        "morphology": "Gram-positive cocci in pairs and short chains; catalase-negative.",
        "diseases": ["Urinary tract infection", "Bacteremia", "Endocarditis"],
        "virulence_factors": ["Gelatinase", "Esp surface protein", "Biofilm formation"],
        "risk_factors": [
            "Prolonged hospital stay",
            "Vancomycin exposure",
            "Urinary catheters",
            "Immunosuppression",
        ],
        "clinical_importance": (
            "Vancomycin-resistant E. faecium (VREfm) is a WHO high-priority "
            "pathogen with few reliably active agents."
        ),
        "resistance_rate": 40,
    },
    {
        "id": "ecloacae",
        "name": "Enterobacter cloacae complex",
        "type": "Bacteria",
        "gram": "Gram-negative rod",
        "morphology": (
            "Motile, lactose-fermenting rod with inducible AmpC beta-lactamase."
        ),
        "diseases": [
            "Hospital-acquired pneumonia",
            "Bacteremia",
            "Urinary tract infection",
            "Wound infection",
        ],
        "virulence_factors": ["Endotoxin", "Capsule", "Biofilm"],
        "risk_factors": [
            "ICU admission",
            "Broad-spectrum cephalosporin exposure",
            "Indwelling devices",
        ],
        "clinical_importance": (
            "AmpC producers can fail on third-generation cephalosporins despite "
            "apparent susceptibility, so cefepime or a carbapenem is preferred."
        ),
        "resistance_rate": 35,
    },
    {
        "id": "abaumannii",
        "name": "Acinetobacter baumannii",
        "type": "Bacteria",
        "gram": "Gram-negative coccobacillus",
        "morphology": (
            "Non-motile, oxidase-negative coccobacillus that survives on dry "
            "hospital surfaces."
        ),
        "diseases": [
            "Ventilator-associated pneumonia",
            "Bloodstream infection",
            "Burn and wound infection",
        ],
        "virulence_factors": ["Capsule", "Outer-membrane proteins", "Biofilm"],
        "risk_factors": [
            "ICU stay",
            "Mechanical ventilation",
            "Burn injury",
            "Carbapenem exposure",
        ],
        "clinical_importance": (
            "Carbapenem-resistant A. baumannii (CRAB) is a WHO critical-priority "
            "pathogen and a major cause of ICU outbreaks."
        ),
        "resistance_rate": 70,
    },
    {
        "id": "smaltophilia",
        "name": "Stenotrophomonas maltophilia",
        "type": "Bacteria",
        "gram": "Gram-negative rod",
        "morphology": (
            "Non-fermenting, oxidase-positive rod; intrinsically multidrug-resistant."
        ),
        "diseases": [
            "Hospital-acquired pneumonia",
            "Bacteremia",
            "Device-related infection",
        ],
        "virulence_factors": ["Biofilm", "Adhesins", "Extracellular enzymes"],
        "risk_factors": [
            "Prolonged ICU stay",
            "Broad-spectrum antibiotics",
            "Mechanical ventilation",
            "Neutropenia",
        ],
        "clinical_importance": (
            "Intrinsically resistant to carbapenems; co-trimoxazole is the "
            "mainstay and fluoroquinolones are alternatives."
        ),
        "resistance_rate": 60,
    },
    {
        "id": "styphi",
        "name": "Salmonella enterica serovar Typhi",
        "type": "Bacteria",
        "gram": "Gram-negative rod",
        "morphology": "Motile, lactose-negative rod; human-restricted pathogen.",
        "diseases": ["Enteric fever", "Intestinal perforation"],
        "virulence_factors": ["Vi capsule", "Type III secretion system", "Endotoxin"],
        "risk_factors": [
            "Contaminated food or water",
            "Travel to endemic areas",
            "Poor sanitation",
        ],
        "clinical_importance": (
            "Fluoroquinolone resistance is widespread in South Asia and parts of "
            "Africa; ceftriaxone and azithromycin are common empiric choices."
        ),
        "resistance_rate": 45,
    },
    {
        "id": "shigella",
        "name": "Shigella flexneri",
        "type": "Bacteria",
        "gram": "Gram-negative rod",
        "morphology": "Non-motile, lactose-negative rod; low infectious dose.",
        "diseases": ["Bacillary dysentery"],
        "virulence_factors": ["Shiga toxin", "Type III secretion system", "Invasion plasmid"],
        "risk_factors": ["Contaminated water", "Crowding", "Poor sanitation"],
        "clinical_importance": (
            "A WHO priority pathogen; azithromycin and ceftriaxone are preferred "
            "as fluoroquinolone resistance rises."
        ),
        "resistance_rate": 50,
    },
    {
        "id": "gonorrhoeae",
        "name": "Neisseria gonorrhoeae",
        "type": "Bacteria",
        "gram": "Gram-negative diplococcus",
        "morphology": "Oxidase-positive diplococci within neutrophils.",
        "diseases": [
            "Gonorrhoea",
            "Pelvic inflammatory disease",
            "Disseminated gonococcal infection",
        ],
        "virulence_factors": ["Pili", "Opa proteins", "IgA protease"],
        "risk_factors": ["Unprotected sexual contact", "Multiple partners", "Young age"],
        "clinical_importance": (
            "A WHO high-priority pathogen; ceftriaxone-based therapy is the "
            "mainstay and azithromycin resistance is rising."
        ),
        "resistance_rate": 30,
    },
    {
        "id": "pneumoniae",
        "name": "Streptococcus pneumoniae",
        "type": "Bacteria",
        "gram": "Gram-positive diplococcus",
        "morphology": "Lancet-shaped gram-positive diplococci; optochin-sensitive.",
        "diseases": [
            "Community-acquired pneumonia",
            "Meningitis",
            "Otitis media",
            "Sinusitis",
        ],
        "virulence_factors": ["Polysaccharide capsule", "Pneumolysin", "IgA protease"],
        "risk_factors": [
            "Extremes of age",
            "Asplenia",
            "HIV infection",
            "Chronic lung disease",
        ],
        "clinical_importance": (
            "A leading cause of community pneumonia and meningitis; penicillin "
            "and macrolide resistance vary by region."
        ),
        "resistance_rate": 25,
    },
]

ANTIBIOTICS = [
    {
        "id": "ampi",
        "generic_name": "Ampicillin",
        "brand_names": ["Ampicin"],
        "drug_class": "Aminopenicillin",
        "aware_category": "Access",
        "dosing_adult": "1-2 g IV every 4-6 hours; 500 mg PO every 6 hours.",
        "renal_adjustment": "Extend the interval when creatinine clearance is below 30 mL/min.",
        "tags": ["beta-lactam", "penicillin"],
    },
    {
        "id": "clinda",
        "generic_name": "Clindamycin",
        "brand_names": ["Dalacin"],
        "drug_class": "Lincosamide",
        "aware_category": "Access",
        "dosing_adult": "300-450 mg PO every 6-8 hours; 600-900 mg IV every 8 hours.",
        "tags": ["lincosamide", "anti-staphylococcal"],
    },
    {
        "id": "doxy",
        "generic_name": "Doxycycline",
        "brand_names": ["Vibramycin"],
        "drug_class": "Tetracycline",
        "aware_category": "Access",
        "dosing_adult": "100 mg PO every 12 hours.",
        "pregnancy_considerations": "Avoid in pregnancy and in children under 8 years.",
        "tags": ["tetracycline"],
    },
    {
        "id": "fosfo",
        "generic_name": "Fosfomycin",
        "brand_names": ["Monurol"],
        "drug_class": "Phosphonic acid",
        "aware_category": "Access",
        "dosing_adult": "3 g PO as a single dose for uncomplicated cystitis.",
        "tags": ["fosfomycin"],
    },
    {
        "id": "levo",
        "generic_name": "Levofloxacin",
        "brand_names": ["Levaquin"],
        "drug_class": "Fluoroquinolone",
        "aware_category": "Watch",
        "dosing_adult": "500-750 mg PO/IV once daily.",
        "renal_adjustment": "Reduce the dose when creatinine clearance is below 50 mL/min.",
        "tags": ["fluoroquinolone"],
    },
    {
        "id": "ceftaz",
        "generic_name": "Ceftazidime",
        "brand_names": ["Fortaz"],
        "drug_class": "3rd-generation Cephalosporin",
        "aware_category": "Watch",
        "dosing_adult": "1-2 g IV every 8 hours; higher doses for Pseudomonas.",
        "renal_adjustment": "Adjust the dose and interval by creatinine clearance.",
        "tags": ["beta-lactam", "cephalosporin", "anti-pseudomonal"],
    },
    {
        "id": "amikacin",
        "generic_name": "Amikacin",
        "brand_names": ["Amikin"],
        "drug_class": "Aminoglycoside",
        "aware_category": "Watch",
        "dosing_adult": "15 mg/kg IV once daily; monitor levels.",
        "renal_adjustment": "Dose by renal function and therapeutic drug monitoring.",
        "tags": ["aminoglycoside"],
    },
    {
        "id": "tige",
        "generic_name": "Tigecycline",
        "brand_names": ["Tygacil"],
        "drug_class": "Glycylcycline",
        "aware_category": "Reserve",
        "dosing_adult": "100 mg IV loading dose, then 50 mg every 12 hours.",
        "tags": ["tetracycline", "MDR"],
    },
    {
        "id": "spectinomycin",
        "generic_name": "Spectinomycin",
        "brand_names": ["Trobicin"],
        "drug_class": "Aminocyclitol",
        "aware_category": "Watch",
        "dosing_adult": "2 g IM as a single dose for gonorrhoea.",
        "tags": ["aminocyclitol"],
    },
]

PROTOCOLS = [
    {
        "organism_id": "efaecium",
        "first_line": ["ampi"],
        "second_line": ["vanco"],
        "reserve": ["linezolid"],
        "duration": "7-14 days depending on site; 4-6 weeks for endocarditis",
        "monitoring": [
            "Repeat cultures until clearance",
            "Renal function and vancomycin levels",
            "Echocardiography if bacteremic",
        ],
    },
    {
        "organism_id": "ecloacae",
        "first_line": ["cefepime"],
        "second_line": ["cipro"],
        "reserve": ["merope"],
        "duration": "7-14 days depending on site and response",
        "monitoring": [
            "Repeat culture and susceptibility at 48-72h",
            "Renal function",
        ],
    },
    {
        "organism_id": "abaumannii",
        "first_line": ["merope"],
        "second_line": ["amikacin"],
        "reserve": ["colistin", "tige"],
        "duration": "7-14 days; longer for deep or device infection",
        "monitoring": [
            "Renal function and aminoglycoside levels",
            "Repeat culture and susceptibility",
            "Source control for devices and wounds",
        ],
    },
    {
        "organism_id": "smaltophilia",
        "first_line": ["cotrim"],
        "second_line": ["levo"],
        "reserve": ["tige"],
        "duration": "7-14 days depending on site and response",
        "monitoring": [
            "Renal function",
            "Repeat culture if no improvement",
        ],
    },
    {
        "organism_id": "styphi",
        "first_line": ["ceftri", "azithro"],
        "second_line": ["cipro"],
        "reserve": ["merope"],
        "duration": "7-14 days; 14 days for severe or disseminated disease",
        "monitoring": [
            "Blood cultures until negative",
            "Watch for intestinal perforation",
            "Review susceptibility before switching to oral therapy",
        ],
    },
    {
        "organism_id": "shigella",
        "first_line": ["cipro", "azithro"],
        "second_line": ["ceftri"],
        "reserve": ["merope"],
        "duration": "3-5 days for uncomplicated dysentery",
        "monitoring": [
            "Stool output and hydration",
            "Repeat stool culture in severe or persistent disease",
        ],
    },
    {
        "organism_id": "gonorrhoeae",
        "first_line": ["ceftri", "azithro"],
        "second_line": [],
        "reserve": ["spectinomycin"],
        "duration": "Single-dose ceftriaxone plus azithromycin; follow local guidance",
        "monitoring": [
            "Test of cure in pregnancy or persistent symptoms",
            "Partner notification and treatment",
            "Screen for other sexually transmitted infections",
        ],
    },
    {
        "organism_id": "pneumoniae",
        "first_line": ["amoxi"],
        "second_line": ["ceftri", "azithro"],
        "reserve": ["levo", "vanco"],
        "duration": "5-7 days for uncomplicated pneumonia; 10-14 days for meningitis",
        "monitoring": [
            "Clinical response at 48-72h",
            "Repeat cultures and imaging if no improvement",
            "Renal function with vancomycin",
        ],
    },
]
