from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: str
    approval_limit: Decimal | None = None
    is_active: bool


class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str = Field(min_length=8)
    role: str = "uploader"
    approval_limit: Decimal | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut