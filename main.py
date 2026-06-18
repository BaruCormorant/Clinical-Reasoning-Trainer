from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import json
import sqlite3

APP_DIR = Path(__file__).resolve().parent
DB_PATH = APP_DIR / "clinical_reasoning.db"
CASES_PATH = APP_DIR / "cases.json"

with CASES_PATH.open("r", encoding="utf-8") as handle:
    CASES = json.load(handle)

COMMON_EXAMS = [
    "General appearance",
    "Vital signs",
    "HEENT exam",
    "Oral mucosa",
    "Neck exam",
    "Thyroid exam",
    "Lymph node exam",
    "Cardiac auscultation",
    "Lung auscultation",
    "Abdominal inspection",
    "Abdominal palpation",
    "Rebound tenderness",
    "Murphy's sign",
    "McBurney's point tenderness",
    "Rovsing sign",
    "CVA tenderness",
    "Pelvic exam",
    "Digital rectal exam",
    "Extremity edema exam",
    "Neuro strength exam",
    "Gait assessment",
    "Joint exam",
    "Skin exam",
    "Back exam",
    "Straight leg raise",
]

COMMON_LABS = [
    "CBC",
    "BMP",
    "CMP",
    "LFTs",
    "Lipase",
    "Amylase",
    "CRP",
    "ESR",
    "TSH",
    "Free T4",
    "HbA1c",
    "Troponin",
    "BNP",
    "D-dimer",
    "Urinalysis",
    "Urine culture",
    "Pregnancy test",
    "Iron studies",
    "Ferritin",
    "B12",
    "Folate",
    "CK",
    "Lactate",
    "Stool occult blood",
    "RF",
    "ANA",
    "Hydrogen breath test",
    "Testosterone",
]

COMMON_IMAGING = [
    "Chest X-ray",
    "Abdominal X-ray",
    "CT Abdomen/Pelvis",
    "CT Chest",
    "CT Head",
    "CT Angiography",
    "Abdominal Ultrasound",
    "Pelvic Ultrasound",
    "Renal Ultrasound",
    "Thyroid Ultrasound",
    "Echocardiogram",
    "MRI Brain",
    "MRI Spine",
    "Upper Endoscopy",
    "Colonoscopy",
    "HIDA Scan",
    "Neck X-ray",
    "Sinus CT",
    "ECG",
    "X-ray Hands",
]


def get_case(case_id: int) -> dict:
    for item in CASES:
        if item["id"] == case_id:
            return item
    raise HTTPException(status_code=404, detail="Case not found")

def build_options() -> dict:
    differential_set = set()
    concern_set = set()
    for item in CASES:
        differential_set.add(item["final_diagnosis"])
        concern_set.add(item["chief_concern"])
    return {
        "exam_options": COMMON_EXAMS,
        "lab_options": COMMON_LABS,
        "imaging_options": COMMON_IMAGING,
        "differential_options": sorted(differential_set),
        "chief_concerns": sorted(concern_set),
    }


class Submission(BaseModel):
    case_id: int
    differentials: list[str]
    exam_maneuvers: list[str]
    labs: list[str]
    imaging: str
    final_diagnosis: str


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER NOT NULL,
                differentials TEXT NOT NULL,
                exam_maneuvers TEXT NOT NULL,
                labs TEXT NOT NULL,
                imaging TEXT NOT NULL,
                final_diagnosis TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()


def save_submission(payload: Submission) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO submissions (case_id, differentials, exam_maneuvers, labs, imaging, final_diagnosis)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.case_id,
                ",".join(payload.differentials),
                ",".join(payload.exam_maneuvers),
                ",".join(payload.labs),
                payload.imaging,
                payload.final_diagnosis,
            ),
        )
        conn.commit()


app = FastAPI(title="Clinical Reasoning Trainer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    init_db()


@app.get("/api/cases")
async def list_cases():
    return [
        {
            "id": item["id"],
            "demographics": item["demographics"],
            "symptoms": item["symptoms"],
            "final_diagnosis": item["final_diagnosis"],
            "chief_concern": item["chief_concern"],
            "tags": item.get("tags", []),
        }
        for item in CASES
    ]

@app.get("/api/options")
async def options():
    return build_options()


@app.get("/api/cases/{case_id}")
async def case_detail(case_id: int):
    item = get_case(case_id)
    return {
        "id": item["id"],
        "chief_concern": item["chief_concern"],
        "tags": item.get("tags", []),
        "demographics": item["demographics"],
        "history": item["history"],
        "symptoms": item["symptoms"],
        "differential_diagnoses": item["differential_diagnoses"],
        "exam_results": item.get("exam_results", {}),
        "lab_results": item.get("lab_results", {}),
        "imaging_results": item.get("imaging_results", {}),
        "case_explanation": item["case_explanation"],
        "full_explanation": item.get("full_explanation", item["case_explanation"]),
    }


@app.get("/api/cases/{case_id}/reveal")
async def reveal_case(case_id: int):
    item = get_case(case_id)
    return {
        "exam_results": item.get("exam_results", {}),
        "lab_results": item.get("lab_results", {}),
        "imaging_results": item.get("imaging_results", {}),
    }


@app.post("/api/submit")
async def submit(payload: Submission):
    item = get_case(payload.case_id)
    save_submission(payload)
    return {
        "final_diagnosis": item["final_diagnosis"],
        "case_explanation": item["case_explanation"],
        "full_explanation": item.get("full_explanation", item["case_explanation"]),
    }
