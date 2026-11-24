/**
 * Uganda-specific clinical reference data.
 *
 * Sources: Uganda Clinical Guidelines (UCG) 2023, Ministry of Health National
 * Action Plan on Antimicrobial Resistance, WHO GLASS and Uganda National
 * Institute of Public Health (UNIPH) surveillance reports. Content is
 * deliberately short and signposts the national guideline rather than
 * replacing it.
 */

export const UGANDA_TIME_ZONE = "Africa/Kampala";

export const UGANDA_REFERRAL_HOSPITALS = [
  "Mulago National Referral Hospital",
  "Kawempe National Referral Hospital",
  "Kiruddu National Referral Hospital",
  "Mulago Specialised Women and Neonatal Hospital",
  "Butabika National Referral Hospital",
  "Uganda Cancer Institute",
  "Uganda Heart Institute",
  "Jinja Regional Referral Hospital",
  "Mbale Regional Referral Hospital",
  "Soroti Regional Referral Hospital",
  "Gulu Regional Referral Hospital",
  "Lira Regional Referral Hospital",
  "Arua Regional Referral Hospital",
  "Hoima Regional Referral Hospital",
  "Fort Portal Regional Referral Hospital",
  "Mbarara Regional Referral Hospital",
  "Masaka Regional Referral Hospital",
  "Kabale Regional Referral Hospital",
  "Moroto Regional Referral Hospital",
  "Naguru Regional Referral Hospital",
  "Entebbe Regional Referral Hospital",
  "Kayunga Regional Referral Hospital",
  "Yumbe Regional Referral Hospital",
  "Mubende Regional Referral Hospital",
  "St. Mary's Hospital Lacor",
  "Mengo Hospital",
  "Rubaga Hospital",
  "Nsambya Hospital",
  "International Hospital Kampala",
  "Nakasero Hospital",
  "Infectious Diseases Institute (IDI), Mulago",
  "Joint Clinical Research Centre (JCRC)",
  "Kampala International University Teaching Hospital",
  "Kisiizi Hospital",
  "Ishaka Adventist Hospital",
  "Kamuli Mission Hospital",
  "Mildmay Uganda",
];

/** Districts most often used in facility and surveillance reporting. */
export const UGANDA_DISTRICTS = [
  "Kampala", "Wakiso", "Mukono", "Jinja", "Buikwe", "Kayunga", "Luweero",
  "Mpigi", "Entebbe", "Masaka", "Bukomansimbi", "Kalungu", "Kyotera", "Rakai",
  "Mbarara", "Bushenyi", "Sheema", "Ntungamo", "Isingiro", "Kiruhura", "Lyantonde",
  "Kabale", "Kisoro", "Kanungu", "Rukungiri", "Rukiga", "Rubanda",
  "Fort Portal", "Kabarole", "Kasese", "Bundibugyo", "Kamwenge", "Kyenjojo",
  "Hoima", "Kikuube", "Masindi", "Buliisa", "Kiryandongo",
  "Gulu", "Omoro", "Nwoya", "Amuru", "Kitgum", "Lamwo", "Pader", "Agago",
  "Lira", "Dokolo", "Apac", "Kole", "Oyam", "Alebtong", "Amolatar",
  "Soroti", "Serere", "Kumi", "Ngora", "Katakwi", "Amuria", "Kaberamaido",
  "Mbale", "Sironko", "Bulambuli", "Manafwa", "Namisindwa", "Bududa",
  "Tororo", "Busia", "Butaleja", "Bugiri", "Namayingo", "Mayuge", "Iganga",
  "Kamuli", "Buyende", "Kaliro", "Pallisa", "Kibuku", "Butebo",
  "Moroto", "Napak", "Kotido", "Kaabong", "Abim", "Nakapiripirit", "Amudat",
  "Arua", "Nebbi", "Zombo", "Moyo", "Adjumani", "Yumbe", "Koboko", "Maracha",
  "Mubende", "Mityana", "Kassanda", "Kyegegwa", "Kiboga", "Kyankwanzi",
  "Nakasongola", "Nakaseke", "Kakumiro", "Kagadi", "Buvuma",
];

export interface UgandaGuideline {
  id: string;
  title: string;
  source: string;
  year: number;
  summary: string;
}

/**
 * First-line options from the Uganda Clinical Guidelines 2023. These are
 * deliberately concise: the full UCG chapter and the facility antibiogram
 * remain the authority for prescribing.
 */
export const UGANDA_UCG_GUIDELINES: UgandaGuideline[] = [
  {
    id: "ug-ucg-cap",
    title: "Community-acquired pneumonia (adult)",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Non-severe disease: amoxicillin 500 mg–1 g PO every 8 hours. Severe disease or hypoxia: refer and start ceftriaxone 2 g IV daily, adding a macrolide where atypical cover is needed. Review at 48–72 hours and de-escalate on culture results.",
  },
  {
    id: "ug-ucg-uti",
    title: "Uncomplicated urinary tract infection",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Nitrofurantoin 100 mg PO every 12 hours for 5 days is first-line where susceptible; avoid at term pregnancy. Use ciprofloxacin only when local E. coli resistance is below 20%. Pregnant women and pyelonephritis need ceftriaxone and culture follow-up.",
  },
  {
    id: "ug-ucg-malaria",
    title: "Malaria — test before treating",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Confirm every suspected case with a malaria rapid diagnostic test or microscopy before antibiotics or antimalarials. Uncomplicated malaria: artemether-lumefantrine (Coartem). Severe malaria: IV artesunate then full oral course. Negative RDTs should prompt a search for bacterial causes.",
  },
  {
    id: "ug-ucg-typhoid",
    title: "Enteric fever (typhoid)",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Obtain blood culture before antibiotics. Azithromycin or ceftriaxone are preferred where fluoroquinolone resistance is common; do not use ciprofloxacin empirically in areas with high MDR typhoid. Treat for 7–10 days and review for perforation.",
  },
  {
    id: "ug-ucg-sepsis",
    title: "Adult sepsis and septic shock",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Take blood cultures, give oxygen and fluids, and start ceftriaxone 2 g IV daily ± gentamicin within one hour. Escalate to a carbapenem for suspected ESBL or carbapenem-resistant infection, then de-escalate at 48–72 hours based on culture and clinical response.",
  },
  {
    id: "ug-ucg-meningitis",
    title: "Bacterial meningitis",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Adults: ceftriaxone 2 g IV every 12 hours; children: ceftriaxone 100 mg/kg/day divided every 12 hours. Add vancomycin where pneumococcal resistance is likely. Do not delay antibiotics for lumbar puncture in a sick patient; give dexamethasone with the first dose where indicated.",
  },
  {
    id: "ug-ucg-ssti",
    title: "Cellulitis and skin/soft tissue infection",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Cloxacillin or flucloxacillin is first-line for non-purulent cellulitis; incise and drain abscesses. Suspected MRSA (purulent, recurrent, healthcare exposure): clindamycin or vancomycin. Elevate the limb and mark the margin to monitor response.",
  },
  {
    id: "ug-ucg-neonatal",
    title: "Neonatal sepsis",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Ampicillin plus gentamicin is the standard empirical regimen. Add ceftriaxone when meningitis is suspected, but avoid ceftriaxone in jaundiced neonates. Reassess at 48 hours and narrow according to culture and local resistance patterns.",
  },
  {
    id: "ug-ucg-puerperal",
    title: "Puerperal sepsis",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Ampicillin + gentamicin ± metronidazole, or ceftriaxone + metronidazole, after blood and endometrial cultures. Remove retained products and involve obstetrics early; do not rely on oral antibiotics alone in severe sepsis.",
  },
  {
    id: "ug-ucg-surgical",
    title: "Surgical antimicrobial prophylaxis",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "A single pre-incision dose of cefazolin 2 g IV (or cloxacillin where appropriate) is enough for most clean and clean-contaminated surgery. Re-dose for long operations or major blood loss; do not continue prophylaxis beyond 24 hours.",
  },
  {
    id: "ug-ucg-diarrhoea",
    title: "Acute diarrhoea in children",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Oral rehydration salts and zinc are the mainstay. Antibiotics are reserved for dysentery, cholera or invasive disease; avoid routine antibiotics and anti-motility drugs. Notify suspected cholera promptly to the district surveillance team.",
  },
  {
    id: "ug-ucg-gonorrhoea",
    title: "Gonorrhoea and pelvic inflammatory disease",
    source: "Uganda Clinical Guidelines (UCG)",
    year: 2023,
    summary:
      "Ceftriaxone 500 mg–1 g IM as a single dose plus azithromycin where national STI guidance recommends combination therapy. Treat partners, test for HIV and syphilis, and culture where treatment fails because of rising ceftriaxone resistance.",
  },
];

export interface UgandaPathogen {
  name: string;
  concern: string;
  localNote: string;
}

export const UGANDA_PRIORITY_PATHOGENS: UgandaPathogen[] = [
  {
    name: "ESBL-producing E. coli & K. pneumoniae",
    concern: "Critical",
    localNote:
      "Common in referral-hospital urine, blood and wound isolates. Carbapenems for severe infection; nitrofurantoin or fosfomycin for uncomplicated UTI when susceptible.",
  },
  {
    name: "MRSA (Staphylococcus aureus)",
    concern: "High",
    localNote:
      "Cloxacillin fails. Use clindamycin for susceptible skin disease and vancomycin for invasive infection; decolonise recurrent cases.",
  },
  {
    name: "Carbapenem-resistant Acinetobacter baumannii",
    concern: "Critical",
    localNote:
      "ICU and neonatal-unit outbreaks. Colistin-based regimens plus strict infection prevention; send isolates to CPHL for confirmation.",
  },
  {
    name: "Carbapenem-resistant Pseudomonas aeruginosa",
    concern: "Critical",
    localNote:
      "Burns, ventilated patients and chronic wounds. Combination therapy guided by the facility antibiogram; avoid blind carbapenem monotherapy.",
  },
  {
    name: "Multidrug-resistant Salmonella Typhi",
    concern: "High",
    localNote:
      "Culture before treating. Azithromycin or ceftriaxone are preferred where fluoroquinolone resistance is established.",
  },
  {
    name: "Neisseria gonorrhoeae",
    concern: "High",
    localNote:
      "Rising ceftriaxone MICs regionally. Follow national STI guidance, treat partners, and culture treatment failures.",
  },
  {
    name: "Streptococcus pneumoniae",
    concern: "Medium",
    localNote:
      "Leading cause of pneumonia and meningitis. Penicillin/amoxicillin for susceptible pneumonia; ceftriaxone ± vancomycin for meningitis.",
  },
];

export interface UgandaBrand {
  generic: string;
  brands: string[];
}

/** Common trade names clinicians and pharmacy staff use in Uganda. */
export const UGANDA_BRAND_NAMES: UgandaBrand[] = [
  { generic: "Amoxicillin", brands: ["Amoxil", "Amoxypen"] },
  { generic: "Amoxicillin-Clavulanate", brands: ["Augmentin", "Clavamox"] },
  { generic: "Co-trimoxazole", brands: ["Septrin", "Bactrim"] },
  { generic: "Metronidazole", brands: ["Flagyl", "Metrogyl"] },
  { generic: "Ceftriaxone", brands: ["Rocephin", "Triaxon", "Cefaxone"] },
  { generic: "Ciprofloxacin", brands: ["Ciprolet", "Ciprobay"] },
  { generic: "Azithromycin", brands: ["Zithromax", "Azee"] },
  { generic: "Doxycycline", brands: ["Vibramycin", "Doxy"] },
  { generic: "Gentamicin", brands: ["Garamycin"] },
  { generic: "Cloxacillin", brands: ["Orbenin", "Cloxapen"] },
  { generic: "Cefuroxime", brands: ["Zinnat", "Ceftin"] },
  { generic: "Cefixime", brands: ["Suprax"] },
  { generic: "Meropenem", brands: ["Merrem", "Meronem"] },
  { generic: "Piperacillin-tazobactam", brands: ["Tazocin", "Zosyn"] },
  { generic: "Vancomycin", brands: ["Vancocin"] },
  { generic: "Nitrofurantoin", brands: ["Macrobid", "Nitrofur"] },
  { generic: "Artemether-lumefantrine", brands: ["Coartem"] },
  { generic: "Artesunate", brands: ["Arsumax"] },
  { generic: "Paracetamol", brands: ["Panadol"] },
];

export function brandsFor(genericName: string, backendBrands?: string[]): string[] {
  const local =
    UGANDA_BRAND_NAMES.find(
      (entry) => entry.generic.toLowerCase() === (genericName || "").toLowerCase()
    )?.brands ?? [];
  return Array.from(new Set([...(backendBrands || []), ...local])).filter(Boolean);
}

export interface UgandaResource {
  title: string;
  detail: string;
  url: string;
}

export const UGANDA_AMR_RESOURCES: UgandaResource[] = [
  {
    title: "Uganda Clinical Guidelines 2023",
    detail: "National standard treatment guidelines for all levels of care.",
    url: "https://library.health.go.ug",
  },
  {
    title: "Ministry of Health — AMR National Action Plan",
    detail: "One Health response to antimicrobial resistance in Uganda.",
    url: "https://www.health.go.ug",
  },
  {
    title: "Uganda National Institute of Public Health",
    detail: "National surveillance bulletins, including AMR and outbreak reports.",
    url: "https://uniph.go.ug",
  },
  {
    title: "Central Public Health Laboratories (CPHL)",
    detail: "National reference laboratory for culture confirmation and AMR testing.",
    url: "https://cphl.go.ug",
  },
  {
    title: "WHO GLASS",
    detail: "Global Antimicrobial Resistance and Use Surveillance System.",
    url: "https://www.who.int/initiatives/glass",
  },
];

export const UGANDA_COMMON_DIAGNOSES = [
  "Community-acquired pneumonia",
  "Hospital-acquired pneumonia",
  "Uncomplicated urinary tract infection",
  "Complicated urinary tract infection",
  "Pyelonephritis",
  "Malaria",
  "Enteric fever (typhoid)",
  "Sepsis / septic shock",
  "Bacterial meningitis",
  "Cellulitis / skin and soft tissue infection",
  "Surgical site infection",
  "Neonatal sepsis",
  "Puerperal sepsis",
  "Gastroenteritis",
  "Tuberculosis",
  "HIV-related opportunistic infection",
];

/** Specimens routinely processed by Ugandan clinical laboratories. */
export const UGANDA_LAB_SPECIMENS = [
  "Urine",
  "Blood",
  "Sputum",
  "Cerebrospinal fluid",
  "Wound swab",
  "Pus / aspirate",
  "Stool",
  "Genital swab",
  "Pleural fluid",
  "Ascitic fluid",
  "Endotracheal aspirate",
  "Catheter tip",
  "Bone / joint",
];

export function formatUgandaDateTime(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-UG", {
    timeZone: UGANDA_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatUgandaDate(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-UG", {
    timeZone: UGANDA_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
