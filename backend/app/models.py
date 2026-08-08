from typing import List, Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON

# --- ORGANISM MODEL ---
class Organism(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: str # e.g., Bacteria
    gram: str # e.g., Gram-negative rod
    morphology: str = ""
    
    # Storing lists as JSON columns for simplicity
    diseases: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    virulence_factors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    risk_factors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    
    clinical_importance: str = ""
    resistance_rate: int = 0


# --- ANTIBIOTIC MODEL ---
class Antibiotic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    generic_name: str = Field(index=True)
    brand_names: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    drug_class: str = ""
    aware_category: str = "Access" # WHO AWaRe: Access, Watch, Reserve
    
    mechanism_of_action: str = ""
    spectrum: str = ""
    
    dosing_adult: str = ""
    dosing_pediatric: str = ""
    
    pregnancy_considerations: str = ""
    renal_adjustment: str = ""
    hepatic_adjustment: str = ""
    
    interactions: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    adverse_effects: List[str] = Field(default_factory=list, sa_column=Column(JSON))


# --- PATIENT MODEL ---
class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    age: int
    sex: str
    weight_kg: Optional[float] = None
    
    pregnancy_status: str = "Not pregnant"
    allergies: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    
    renal_function: str = "Normal"
    liver_function: str = "Normal"
    immunocompromised: bool = False
    
    diagnosis: str = ""
    infection_site: str = ""
    culture_results: str = ""
    
    # Timeline will store JSON objects like: 
    # [{"date": "Jan 2026", "drug": "Cipro", "outcome": "fail"}]
    antibiotic_timeline: List[dict] = Field(default_factory=list, sa_column=Column(JSON))