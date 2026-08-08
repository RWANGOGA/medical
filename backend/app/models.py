from typing import List, Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON

class Organism(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str = Field(index=True)
    type: str 
    gram: str 
    morphology: str = ""
    diseases: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    virulence_factors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    risk_factors: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    clinical_importance: str = ""
    resistance_rate: int = 0

class Antibiotic(SQLModel, table=True):
    id: str = Field(primary_key=True)
    generic_name: str = Field(index=True)
    brand_names: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    drug_class: str = ""
    aware_category: str = "Access" 
    mechanism_of_action: str = ""
    spectrum: str = ""
    dosing_adult: str = ""
    dosing_pediatric: str = ""
    pregnancy_considerations: str = ""
    renal_adjustment: str = ""
    hepatic_adjustment: str = ""
    interactions: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    adverse_effects: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    # NEW: Tags allow the CDS engine to filter drugs dynamically
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON)) 

# NEW: Database-driven Treatment Protocols
class TreatmentProtocol(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organism_id: str = Field(foreign_key="organism.id", index=True)
    
    # Store lists of Antibiotic IDs
    first_line: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    second_line: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    reserve: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    
    duration: str = ""
    monitoring: List[str] = Field(default_factory=list, sa_column=Column(JSON))

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
    antibiotic_timeline: List[dict] = Field(default_factory=list, sa_column=Column(JSON))