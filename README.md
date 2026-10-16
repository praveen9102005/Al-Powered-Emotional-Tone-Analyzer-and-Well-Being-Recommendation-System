# MoodMentor — Milestone 1

AI-Powered Emotional Tone Analyzer and Well-Being Recommendation System.

## Milestone 1 scope (from the supplied PPT)
- Text input and `.txt` / `.csv` upload
- Text preprocessing: cleaning, tokenization, stop-word filtering, lemmatization
- VADER baseline sentiment: positive / negative / neutral and compound score
- Initial report and validation for empty/invalid input
- React web UI, FastAPI REST API, PostgreSQL persistence

Login and registration are included as a usable project foundation. Deep BERT/DistilBERT emotion classification, personalized recommendations, advanced analytics and deployment are later milestones, not claimed as complete here.

## Requirements
- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL 14+ (or use Docker Compose)

## Quick start (Windows PowerShell)
1. Create the database: if not using Docker, create a PostgreSQL database named `moodmentor`.
2. Start PostgreSQL with Docker (optional): from the project root run `docker compose up -d db`.
3. Backend:
   ```powershell
   cd backend
   copy .env.example .env
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   If `py` is unavailable, use `python` instead. Edit `backend/.env` to match your PostgreSQL credentials.
4. Frontend (new terminal):
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
5. Open the Vite URL printed in the terminal (usually `http://localhost:5173`). API docs: `http://localhost:8000/docs`.

## API endpoints
- `GET /api/health` — health check
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — return bearer token
- `GET /api/auth/me` — current user (Bearer token)
- `POST /api/analyze` — analyze and persist text (Bearer token optional)
- `GET /api/history` — signed-in user's analysis history (Bearer token required)

`POST /api/analyze` accepts JSON `{ "text": "...", "source": "text" }`. For CSV/TXT uploads, the frontend reads the selected file and sends its text to this endpoint. CSV files use the first column by default.

## Notes
- PostgreSQL is the intended database; SQLAlchemy creates the required tables on startup.
- Use a unique, strong `SECRET_KEY` in `.env` before deployment. The example key is for local development only.
- This is an educational milestone build, not a clinical diagnostic tool. Do not enter sensitive personal information.
- Tests: `pytest` from `backend/`.
