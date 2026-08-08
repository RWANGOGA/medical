from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/dashboard", tags=["Surveillance Dashboard"])

class TrendData(BaseModel):
    year: str
    esbl_ecoli: int
    mrsa: int
    cre: int

class AntibiogramData(BaseModel):
    organisms: list[str]
    drugs: list[str]
    grid: list[list[str]]

class AwReSummary(BaseModel):
    cat: str
    count: int

@router.get("/trends", response_model=list[TrendData])
def get_trends():
    return [
        {"year": "2021", "esbl_ecoli": 28, "mrsa": 24, "cre": 6},
        {"year": "2022", "esbl_ecoli": 33, "mrsa": 27, "cre": 9},
        {"year": "2023", "esbl_ecoli": 37, "mrsa": 30, "cre": 13},
        {"year": "2024", "esbl_ecoli": 39, "mrsa": 32, "cre": 17},
        {"year": "2025", "esbl_ecoli": 41, "mrsa": 34, "cre": 21},
        {"year": "2026", "esbl_ecoli": 42, "mrsa": 35, "cre": 24},
    ]

@router.get("/antibiogram", response_model=AntibiogramData)
def get_antibiogram():
    return {
        "organisms": ["E. coli", "K. pneumoniae", "S. aureus", "P. aeruginosa"],
        "drugs": ["Ampicillin", "Ceftriaxone", "Pip-Tazo", "Meropenem", "Vancomycin"],
        "grid": [
            ["R", "I", "S", "S", "-"],
            ["R", "R", "I", "S", "-"],
            ["-", "-", "-", "-", "S"],
            ["R", "R", "I", "I", "-"],
        ]
    }

@router.get("/aware", response_model=list[AwReSummary])
def get_aware():
    return [
        {"cat": "Access", "count": 14},
        {"cat": "Watch", "count": 9},
        {"cat": "Reserve", "count": 3}
    ]