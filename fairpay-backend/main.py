
import numpy as np
from fastapi import FastAPI, UploadFile, File
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
import io

app = FastAPI()

# Allow frontend (React) to access backend
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

@app.post("/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    try:
        # Read uploaded file
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # Ensure required columns exist
        required_cols = [
            "earnings", "hours_online", "bonuses_expected", "bonuses_received",
            "deductions", "tasks_completed"
        ]

        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            return {
                "error": "Missing required columns",
                "missing_columns": missing
            }

        # Run fairness engine
        metrics = calculate_fairness_metrics(df)

        # Convert numeric anomalies into human-readable messages
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

        # Final response
        return {
            "fairness_score": metrics["fairness_score"],
            "metrics": metrics,
            "anomalies": anomaly_messages,
            "preview": df.head().to_dict(orient="records")
        }
    
    except Exception as e:
        return {
            "error": "Failed to process file",
            "details": str(e)
        }



def calculate_fairness_metrics(df):
    metrics = {}

    # ---------------------------------------------------------
    # 1. Normalize via Hourly Rate
    # ---------------------------------------------------------
    df["hourly_rate"] = df["earnings"] / df["hours_online"].replace(0, 1)

    # Average hourly rate for benchmarking
    worker_avg_rate = df["hourly_rate"].mean()

    # Detect shifts where hourly rate is < 80% of worker's average
    df["is_low_rate"] = df["hourly_rate"] < (worker_avg_rate * 0.80)
    metrics["suspicious_rate_drops"] = int(df["is_low_rate"].sum())

    # ---------------------------------------------------------
    # 2. Bonus Mismatch
    # ---------------------------------------------------------
    df["bonus_diff"] = df["bonuses_expected"] - df["bonuses_received"]
    metrics["bonus_mismatch_count"] = int((df["bonus_diff"] > 0).sum())

    # ---------------------------------------------------------
    # 3. Total Deductions
    # ---------------------------------------------------------
    metrics["total_deductions"] = round(df["deductions"].sum(), 2)

    # ---------------------------------------------------------
    # 4. Weighted Fairness Score
    # ---------------------------------------------------------
    score = 100

    # Heavy penalty: severe underpayment compared to worker's norm
    score -= metrics["suspicious_rate_drops"] * 10

    # Medium penalty: missing bonuses
    score -= metrics["bonus_mismatch_count"] * 5

    # Light penalty: total deductions (soft cap at 20 points)
    deduction_penalty = min(int(metrics["total_deductions"] / 50), 20)
    score -= deduction_penalty

    metrics["fairness_score"] = max(score, 0)

    return metrics


def generate_appeal_letter(metrics):
    suspicious_drops = metrics.get("suspicious_rate_drops", 0)
    bonus_mismatch = metrics.get("bonus_mismatch_count", 0)
    total_deductions = metrics.get("total_deductions", 0)
    fairness_score = metrics.get("fairness_score", 0)

    anomalies_text = ""

    if suspicious_drops > 0:
        anomalies_text += f"- {suspicious_drops} shift(s) showed unusually low hourly earnings compared to my normal rate.\n"
    
    if bonus_mismatch > 0:
        anomalies_text += f"- {bonus_mismatch} instance(s) where expected bonuses were not fully credited.\n"
    
    if total_deductions > 0:
        anomalies_text += f"- Total deductions of ₹{total_deductions}, which appear higher than expected.\n"

    if anomalies_text == "":
        anomalies_text = "- No major anomalies detected, but I would still like clarification regarding my recent payout.\n"

    letter = f"""
To the Support Team,

I hope you are doing well. I am writing to request a review of my recent earnings and account activity.

An independent analysis of my work logs generated a Fairness Score of **{fairness_score}/100**, and identified the following issues:

{anomalies_text}

These irregularities may indicate unintentional calculation errors or system inconsistencies. I kindly request your assistance in reviewing my payout details and providing clarification or corrections where necessary.

Thank you for your time and support.  
Warm regards,  
[Your Name]
"""

    return letter.strip()


@app.post("/generate-appeal")
async def generate_appeal(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    metrics = calculate_fairness_metrics(df)
    letter = generate_appeal_letter(metrics)

    return {
        "fairness_score": metrics["fairness_score"],
        "appeal_letter": letter
    }
