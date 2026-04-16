# Expenditure Tracker Sample App

This is a small web application for tracking expenditure with:

- TypeScript frontend
- Python backend
- Excel (`.xlsx`) file as the datastore
- Statistics and charts dashboard

## Stack

- Frontend: TypeScript source in `frontend/app.ts` with a prebuilt `frontend/app.js`
- Backend: Python standard-library HTTP server in `backend/app.py`
- Datastore: Excel workbook managed through `openpyxl`

## Run

1. Create and activate a virtual environment if you want:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Start the app:

```powershell
python backend/app.py
```

4. Open:

```text
http://127.0.0.1:8000
```

The Excel file is created automatically at `data/expenses.xlsx`.

## Features

- Add and delete expenses
- Excel-backed persistence
- KPI cards for total spend, current month, average transaction, and top category
- Monthly totals chart
- Category breakdown chart
- Recent transactions table

## Notes

- `frontend/app.ts` is the TypeScript source.
- `frontend/app.js` is checked in so the sample runs without requiring a TypeScript compiler during setup.
