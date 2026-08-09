from typing import List, Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON
from datetime import datetime, timezone

# --- ORGANISM MODEL ---
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

# --- ANTIBIOTIC MODEL ---
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
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON)) 

# --- TREATMENT PROTOCOL MODEL ---
class TreatmentProtocol(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    organism_id: str = Field(foreign_key="organism.id", index=True)
    first_line: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    second_line: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    reserve: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    duration: str = ""
    monitoring: List[str] = Field(default_factory=list, sa_column=Column(JSON))

# --- PATIENT MODEL ---
class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    national_id: str = Field(default="", index=True)
    hospital: str = Field(default="", index=True)
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

# --- USER MODEL (AUTH) ---
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    full_name: str
    role: str = "student"  
    hospital: str = ""
    specialization: str = ""
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# --- AUDIT LOG MODEL ---
class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    username: str
    action: str          
    patient_id: Optional[int] = None
    details: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class LabResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_name: str = ""
    organism_id: str = Field(foreign_key="organism.id", index=True)
    specimen: str = ""
    hospital: str = ""
    collection_date: str = ""
    susceptibility: dict = Field(default_factory=dict, sa_column=Column(JSON))
    entered_by: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())    