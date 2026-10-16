from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .database import Base, engine, get_db
from . import models, schemas
from .config import CORS_ORIGINS
from .security import hash_password, verify_password, create_access_token, decode_token
from .nlp import analyze_text

Base.metadata.create_all(bind=engine)
app = FastAPI(title="MoodMentor API", version="1.0.0", description="Milestone 1: text ingestion and baseline VADER sentiment analysis")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

@app.get("/api/health")
def health():
    return {"status": "ok", "project": "MoodMentor", "milestone": 1}

def current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        return None
    subject = decode_token(token)
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == int(subject)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")
    return user

def required_user(user=Depends(current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to continue")
    return user

@app.post("/api/auth/register", response_model=schemas.TokenOut, status_code=201)
def register(payload: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = models.User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit(); db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    return {"access_token": create_access_token(str(user.id)), "user": user}

@app.post("/api/auth/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return {"access_token": create_access_token(str(user.id)), "user": user}

@app.get("/api/auth/me", response_model=schemas.UserOut)
def me(user=Depends(required_user)):
    return user

@app.post("/api/analyze", response_model=schemas.AnalysisOut)
def analyze(payload: schemas.AnalyzeIn, db: Session = Depends(get_db), user=Depends(current_user)):
    try:
        result = analyze_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    record = models.Analysis(user_id=user.id if user else None, source=payload.source.lower()[:30], original_text=payload.text.strip(), **result)
    db.add(record); db.commit(); db.refresh(record)
    return record

@app.get("/api/history", response_model=list[schemas.AnalysisOut])
def history(db: Session = Depends(get_db), user=Depends(required_user)):
    return db.query(models.Analysis).filter(models.Analysis.user_id == user.id).order_by(models.Analysis.created_at.desc()).limit(50).all()
