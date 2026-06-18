import sqlite3
import json

# Connect to (or create) the SQLite database
conn = sqlite3.connect("cases.db")
c = conn.cursor()

# Create table for the cases
c.execute("""
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY,
    demographics TEXT,
    history TEXT,
    symptoms TEXT,
    labs TEXT,
    imaging TEXT,
    differential_diagnoses TEXT,
    correct_physical_exam TEXT,
    correct_labs TEXT,
    final_diagnosis TEXT,
    case_explanation TEXT
)
""")

# Load cases from the JSON file
with open("cases.json") as f:
    cases = json.load(f)

# Insert each case into the table
for case in cases:
    c.execute("""
    INSERT OR REPLACE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        case["id"],
        case["demographics"],
        case["history"],
        json.dumps(case["symptoms"]),
        json.dumps(case["labs"]),
        json.dumps(case["imaging"]),
        json.dumps(case["differential_diagnoses"]),
        json.dumps(case["correct_physical_exam"]),
        json.dumps(case["correct_labs"]),
        case["final_diagnosis"],
        case["case_explanation"]
    ))

# Save & close
conn.commit()
conn.close()
print("All cases inserted!")
