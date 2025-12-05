# FairPay Gig Fairness Analyzer

Helping rideshare and delivery workers audit their payouts. This repo bundles a FastAPI backend for crunching CSV/form data plus a modern, single-page frontend that visualizes fairness scores, anomalies, and generates ready-to-send appeal letters.

## 🚀 Features

- **Multi-shift fairness scoring** – submit any number of shifts; backend aggregates earnings, hours, bonuses, and deductions.
- **CSV upload parity** – `/analyze` mirrors the CSV metrics used by typical gig exports.
- **Appeal letter generator** – creates a templated escalation email using the detected anomalies.
- **Rich frontend** – responsive dashboard with dynamic shift cards, anomalies feed, and modal-based appeal preview.

## 📁 Project Structure

```
Hackathon-8thmile/
├─ fairpay-backend/        # FastAPI service exposing scoring + appeal endpoints
│  └─ main.py
├─ frontend/               # Static SPA (HTML/CSS/JS)
│  ├─ index.html
│  ├─ style.css
│  └─ script.js
└─ README.md
```

## 🧰 Tech Stack

- **Backend:** FastAPI, Pydantic, Pandas, NumPy
- **Frontend:** Vanilla HTML/CSS/JS (no build step required)
- **Server:** Uvicorn (dev) with CORS enabled for local testing

## 🛠️ Getting Started

### 1. Backend (FastAPI)

```bash
cd fairpay-backend
python -m venv .venv
.venv\Scripts\activate         # Windows (use source .venv/bin/activate on macOS/Linux)
pip install fastapi uvicorn pandas numpy python-multipart

# Run the API
uvicorn main:app --reload --port 8000
```

Key endpoints (all JSON):

| Method | Path                    | Description                                                |
| ------ | ----------------------- | ---------------------------------------------------------- |
| GET    | `/health`               | Basic readiness probe                                      |
| POST   | `/analyze`              | Accepts CSV upload with standard gig metrics               |
| POST   | `/analyze-form`         | Accepts `{ "shifts": [ ... ] }` payloads from the frontend |
| POST   | `/generate-appeal-form` | Builds an appeal letter using the same shift payload       |

Example form payload:

```json
{
  "shifts": [
    {
      "earnings": 3200,
      "hours_online": 8,
      "bonuses_expected": 500,
      "bonuses_received": 400,
      "deductions": 150,
      "tasks_completed": 14
    }
  ]
}
```

### 2. Frontend (Static SPA)

The frontend is framework-free—any static server works:

```bash
cd frontend
npx serve .              # or use VS Code Live Server / Python's http.server
```

Update `API_BASE` inside `frontend/script.js` if your backend runs on a different origin or port.

## 🧭 Usage Flow

1. Choose the number of shifts for the current day; the UI spawns collapsible cards per shift.
2. Fill earnings, hours online, bonuses, and deductions for each card.
3. Click **Analyze** to fetch `/analyze-form`; the dashboard shows the fairness score, anomaly notes, and per-shift summary.
4. (Optional) Click **Generate Appeal Letter** to open a modal with a copy-ready escalation note powered by `/generate-appeal-form`.
5. For CSV audits, hit `/analyze` via a tool like Thunder Client/Postman using the same backend.

## 🧪 Testing Ideas

- Smoke test `/health` after every deployment.
- Add unit tests around `calculate_fairness_metrics` to validate scoring weights.
- Consider frontend Cypress flows for multi-shift entry + modal handling.

## 🗺️ Roadmap

- Persist historic analyses for longitudinal comparisons.
- OAuth or magic-link auth so workers can revisit previous appeals.
- In-product CSV parsing/validation instead of manual uploads.

---

Questions or improvements? Open an issue or reach out via the hackathon channel—PRs welcome!
