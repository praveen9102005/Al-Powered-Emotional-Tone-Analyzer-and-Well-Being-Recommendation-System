from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class AnalyzeIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    source: str = Field(default="text", max_length=30)

class AnalysisOut(BaseModel):
    id: int
    sentiment: str
    positive: float
    neutral: float
    negative: float
    compound: float
    token_count: int
    processed_text: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
