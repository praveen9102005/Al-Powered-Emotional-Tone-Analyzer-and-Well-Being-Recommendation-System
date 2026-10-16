
import csv
import io

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .database import Base, engine, get_db
from . import models, schemas
from .config import CORS_ORIGINS
from .security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
)
from .nlp import analyze_text


# --------------------------------------------------
# APPLICATION SETUP
# --------------------------------------------------

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MoodMentor API",
    version="1.1.0",
    description=(
        "MoodMentor text and CSV batch sentiment analysis "
        "using the VADER baseline."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,
)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_CSV_ROWS = 1000


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "project": "MoodMentor",
        "milestone": 1,
        "csv_batch_analysis": True,
    }


# --------------------------------------------------
# AUTHENTICATION HELPERS
# --------------------------------------------------

def current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if not token:
        return None

    subject = decode_token(token)

    if not subject:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )

    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account not found",
        )

    return user


def required_user(user=Depends(current_user)):
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Please sign in to continue",
        )

    return user


# --------------------------------------------------
# REGISTER
# --------------------------------------------------

@app.post(
    "/api/auth/register",
    response_model=schemas.TokenOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.RegisterIn,
    db: Session = Depends(get_db),
):
    email = payload.email.lower().strip()

    existing_user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user = models.User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    return {
        "access_token": create_access_token(str(user.id)),
        "user": user,
    }


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.post(
    "/api/auth/login",
    response_model=schemas.TokenOut,
)
def login(
    payload: schemas.LoginIn,
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(
            models.User.email == payload.email.lower().strip()
        )
        .first()
    )

    if not user or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Email or password is incorrect",
        )

    return {
        "access_token": create_access_token(str(user.id)),
        "user": user,
    }


# --------------------------------------------------
# CURRENT USER
# --------------------------------------------------

@app.get(
    "/api/auth/me",
    response_model=schemas.UserOut,
)
def me(user=Depends(required_user)):
    return user


@app.patch(
    "/api/auth/me",
    response_model=schemas.UserOut,
)
def update_me(
    payload: schemas.UserUpdateIn,
    db: Session = Depends(get_db),
    user=Depends(required_user),
):
    new_name = payload.name.strip()
    new_email = str(payload.email).lower().strip()

    existing = (
        db.query(models.User)
        .filter(
            models.User.email == new_email,
            models.User.id != user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="That email address is already used by another account.",
        )

    user.name = new_name
    user.email = new_email

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not update profile. The email may already be in use.",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save profile changes.",
        )

    return user


# --------------------------------------------------
# SINGLE TEXT ANALYSIS
# Existing feature preserved
# --------------------------------------------------

@app.post(
    "/api/analyze",
    response_model=schemas.AnalysisOut,
)
def analyze(
    payload: schemas.AnalyzeIn,
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    try:
        result = analyze_text(payload.text)

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    record = models.Analysis(
        user_id=user.id if user else None,
        source=payload.source.lower()[:30],
        original_text=payload.text.strip(),
        **result,
    )

    db.add(record)

    try:
        db.commit()
        db.refresh(record)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save the analysis result",
        )

    return record


# --------------------------------------------------
# CSV BATCH ANALYSIS
# Analyzes and saves each text row independently
# --------------------------------------------------

@app.post("/api/analyze/csv")
async def analyze_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(current_user),
):
    # Validate uploaded filename
    if (
        not file.filename
        or not file.filename.lower().endswith(".csv")
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    # Read and close the uploaded file
    content = await file.read()
    await file.close()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV file is empty.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="CSV file exceeds the 5 MB limit.",
        )

    # Decode UTF-8 CSV content
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Please upload a UTF-8 encoded CSV file.",
        )

    # Parse the CSV
    try:
        reader = csv.DictReader(io.StringIO(decoded))

        if not reader.fieldnames:
            raise HTTPException(
                status_code=400,
                detail="The CSV must contain a header row.",
            )

        # Match the text header regardless of capitalization
        columns = {
            name.strip().lower(): name
            for name in reader.fieldnames
            if name
        }

        text_column = columns.get("text")

        if not text_column:
            raise HTTPException(
                status_code=400,
                detail=(
                    "CSV must contain a column named 'text'. "
                    "Example header: text"
                ),
            )

        results = []
        records = []

        # Analyze each CSV row independently
        for row_number, row in enumerate(reader, start=2):

            if len(results) >= MAX_CSV_ROWS:
                raise HTTPException(
                    status_code=413,
                    detail=(
                        f"CSV exceeds the {MAX_CSV_ROWS}-row limit."
                    ),
                )

            text_value = (
                row.get(text_column) or ""
            ).strip()

            # Include empty rows in the output
            if not text_value:
                results.append({
                    "id": len(results) + 1,
                    "row_number": row_number,
                    "text": "",
                    "status": "error",
                    "message": "Empty text row; skipped.",
                })
                continue

            try:
                # Use the existing NLP pipeline
                analysis_result = analyze_text(text_value)

                # Save every successful analysis as its own record
                record = models.Analysis(
                    user_id=user.id if user else None,
                    source="csv",
                    original_text=text_value,
                    **analysis_result,
                )

                db.add(record)
                records.append(record)

                results.append({
                    "id": len(results) + 1,
                    "row_number": row_number,
                    "text": text_value,
                    "status": "success",
                    **analysis_result,
                })

            except ValueError as exc:
                results.append({
                    "id": len(results) + 1,
                    "row_number": row_number,
                    "text": text_value,
                    "status": "error",
                    "message": str(exc),
                })

            except RuntimeError as exc:
                results.append({
                    "id": len(results) + 1,
                    "row_number": row_number,
                    "text": text_value,
                    "status": "error",
                    "message": str(exc),
                })

        # Persist all successful rows
        try:
            db.commit()

        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to save CSV results to the database. "
                    "Check your database configuration and logs."
                ),
            )

        successful = sum(
            item["status"] == "success"
            for item in results
        )

        failed = len(results) - successful

        return {
            "filename": file.filename,
            "text_column": text_column,
            "total_rows": len(results),
            "successful": successful,
            "failed": failed,
            "results": results,
        }

    except csv.Error:
        raise HTTPException(
            status_code=400,
            detail="Could not parse the uploaded CSV file.",
        )


# --------------------------------------------------
# ANALYSIS HISTORY
# Existing feature preserved
# --------------------------------------------------

@app.get(
    "/api/history",
    response_model=list[schemas.AnalysisOut],
)
def history(
    db: Session = Depends(get_db),
    user=Depends(required_user),
):
    return (
        db.query(models.Analysis)
        .filter(models.Analysis.user_id == user.id)
        .order_by(models.Analysis.created_at.desc())
        .limit(50)
        .all()
    )
