"""WHO ATC/DDD reference values used for antimicrobial consumption reporting.

DDD (Defined Daily Dose) is the WHO assumed average maintenance dose per day
for a drug used for its main indication in adults. Values below follow the WHO
ATC/DDD Index; verify against the current national formulary before using the
output for formal regulatory reporting.

Route codes: O = oral, IV = intravenous, IM = intramuscular.
"""

WHO_DDD = {
    "amoxi": ("J01CA04", 1000.0, "O", "Amoxicillin"),
    "ampi": ("J01CA01", 2000.0, "IV", "Ampicillin"),
    "nitro": ("J01XE01", 200.0, "O", "Nitrofurantoin"),
    "coamox": ("J01CR02", 1000.0, "O", "Amoxicillin-Clavulanate"),
    "cotrim": ("J01EE01", 1920.0, "O", "Co-trimoxazole"),
    "ceftri": ("J01DD04", 2000.0, "IV", "Ceftriaxone"),
    "merope": ("J01DH02", 3000.0, "IV", "Meropenem"),
    "cipro": ("J01MA02", 1000.0, "O", "Ciprofloxacin"),
    "pipetazo": ("J01CR05", 14000.0, "IV", "Piperacillin-tazobactam"),
    "azithro": ("J01FA10", 500.0, "O", "Azithromycin"),
    "genta": ("J01GB03", 240.0, "IV", "Gentamicin"),
    "colistin": ("J01XB01", 180.0, "IV", "Colistin"),
    "linezolid": ("J01XX08", 1200.0, "IV", "Linezolid"),
    "cloxa": ("J01CF02", 2000.0, "O", "Cloxacillin"),
    "cefaz": ("J01DB04", 3000.0, "IV", "Cefazolin"),
    "cefepime": ("J01DE01", 4000.0, "IV", "Cefepime"),
    "vanco": ("J01XA01", 2000.0, "IV", "Vancomycin"),
    "clinda": ("J01FF01", 1800.0, "O", "Clindamycin"),
    "doxy": ("J01AA02", 200.0, "O", "Doxycycline"),
    "fosfo": ("J01XX01", 3000.0, "O", "Fosfomycin"),
    "levo": ("J01MA12", 500.0, "O", "Levofloxacin"),
    "ceftaz": ("J01DD02", 4000.0, "IV", "Ceftazidime"),
    "amikacin": ("J01GB06", 1000.0, "IV", "Amikacin"),
    "tige": ("J01XA03", 100.0, "IV", "Tigecycline"),
    "spectinomycin": ("J01XX04", 4000.0, "IM", "Spectinomycin"),
}

DDD_SOURCE = "WHO ATC/DDD Index (verify against current national formulary)"

# WHO target: at least 60% of human antibiotic use should come from the Access
# group. This is the headline AWaRe indicator used in GLASS-AMC reporting.
ACCESS_TARGET_PCT = 60
