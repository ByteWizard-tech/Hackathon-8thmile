import numpy as np
from fastapi import FastAPI, UploadFile, File
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
import io
from pydantic import BaseModel
from typing import List

# ------------------------------------------------------------
# Correct Models (MULTI-SHIFT VERSION)
# ------------------------------------------------------------

class DriverShift(BaseModel):
    earnings: float
    hours_online: float
    bonuses_expected: float
    bonuses_received: float
    deductions: float
    tasks_completed: int

class DriverInput(BaseModel):
    shifts: List[DriverShift]


# ------------------------------------------------------------
# FastAPI App + CORS
# ------------------------------------------------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------
# CSV ANALYZE ENDPOINT
# ------------------------------------------------------------

@app.post("/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        required_cols = [
            "earnings", "hours_online", "bonuses_expected", 
            "bonuses_received", "deductions", "tasks_completed"
        ]

        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            return {
                "error": "Missing required columns",
                "missing_columns": missing
            }

        metrics = calculate_fairness_metrics(df)

        anomaly_messages = []

        if metrics["suspicious_rate_drops"] > 0:
            anomaly_messages.append(
                f"{metrics['suspicious_rate_drops']} shift(s) had earnings far below the worker's normal hourly rate."
            )

        if metrics["bonus_mismatch_count"] > 0:
            anomaly_messages.append(
                f"{metrics['bonus_mismatch_count']} instance(s) where expected bonuses were not fully received."
            )

        if metrics["total_deductions"] > 0:
            anomaly_messages.append(
                f"Total deductions amounted to ₹{metrics['total_deductions']}."
            )

        if len(anomaly_messages) == 0:
            anomaly_messages.append("No major anomalies detected. Earnings appear consistent.")

        return {
            "fairness_score": metrics["fairness_score"],
            "metrics": metrics,
            "anomalies": anomaly_messages,
            "preview": df.head().to_dict(orient="records")
        }
    
    except Exception as e:
        return {"error": "Failed to process file", "details": str(e)}


# ------------------------------------------------------------
# FORM-BASED ANALYZE (MULTI-DAY SUPPORT)
# ------------------------------------------------------------

@app.post("/analyze-form")
async def analyze_form(data: DriverInput):
    try:
        df = pd.DataFrame([shift.dict() for shift in data.shifts])

        metrics = calculate_fairness_metrics(df)

        anomaly_messages = []

        if metrics["suspicious_rate_drops"] > 0:
            anomaly_messages.append(
                f"{metrics['suspicious_rate_drops']} shift(s) had earnings far below the worker's normal hourly rate."
            )

        if metrics["bonus_mismatch_count"] > 0:
            anomaly_messages.append(
                f"{metrics['bonus_mismatch_count']} instance(s) where expected bonuses were not fully received."
            )

        if metrics["total_deductions"] > 0:
            anomaly_messages.append(
                f"Total deductions amounted to ₹{metrics['total_deductions']}."
            )

        if len(anomaly_messages) == 0:
            anomaly_messages.append("No major anomalies detected. Earnings appear consistent.")

        return {
            "fairness_score": metrics["fairness_score"],
            "metrics": metrics,
            "anomalies": anomaly_messages,
            "preview": df.to_dict(orient="records")
        }

    except Exception as e:
        return {"error": "Failed to process form input", "details": str(e)}


# ------------------------------------------------------------
# FAIRNESS ENGINE
# ------------------------------------------------------------

def calculate_fairness_metrics(df):
    metrics = {}

    df["hourly_rate"] = df["earnings"] / df["hours_online"].replace(0, 1)
    worker_avg_rate = df["hourly_rate"].mean()

    df["is_low_rate"] = df["hourly_rate"] < (worker_avg_rate * 0.80)
    metrics["suspicious_rate_drops"] = int(df["is_low_rate"].sum())

    df["bonus_diff"] = df["bonuses_expected"] - df["bonuses_received"]
    metrics["bonus_mismatch_count"] = int((df["bonus_diff"] > 0).sum())

    metrics["total_deductions"] = round(df["deductions"].sum(), 2)

    score = 100
    score -= metrics["suspicious_rate_drops"] * 10
    score -= metrics["bonus_mismatch_count"] * 5
    score -= min(int(metrics["total_deductions"] / 50), 20)

    metrics["fairness_score"] = max(score, 0)

    return metrics


# ------------------------------------------------------------
# APPEAL LETTER GENERATION
# ------------------------------------------------------------

def generate_appeal_letter(metrics):
    suspicious_drops = metrics["suspicious_rate_drops"]
    bonus_mismatch = metrics["bonus_mismatch_count"]
    total_deductions = metrics["total_deductions"]
    fairness_score = metrics["fairness_score"]

    anomalies_text = ""

    if suspicious_drops > 0:
        anomalies_text += f"- {suspicious_drops} shift(s) showed unusually low hourly earnings.\n"
    if bonus_mismatch > 0:
        anomalies_text += f"- {bonus_mismatch} instance(s) where expected bonuses were not fully credited.\n"
    if total_deductions > 0:
        anomalies_text += f"- Total deductions of ₹{total_deductions}, which appear higher than expected.\n"

    if anomalies_text == "":
        anomalies_text = "- No major anomalies detected, but I would still like clarification.\n"

    letter = f"""
To the Support Team,

I hope you are doing well. I am writing to request a review of my recent earnings.

The analysis generated a Fairness Score of **{fairness_score}/100**, and identified:

{anomalies_text}

I request your assistance in reviewing my payout details.

Thank you,
[Your Name]
"""

    return letter.strip()


# ------------------------------------------------------------
# FORM-BASED APPEAL ENDPOINT
# ------------------------------------------------------------

@app.post("/generate-appeal-form")
async def generate_appeal_form(data: DriverInput):
    df = pd.DataFrame([shift.dict() for shift in data.shifts])

    metrics = calculate_fairness_metrics(df)
    letter = generate_appeal_letter(metrics)

    return {
        "fairness_score": metrics["fairness_score"],
        "appeal_letter": letter
    }
