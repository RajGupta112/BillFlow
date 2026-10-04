from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import app.models  # noqa: F401  (saare models register)
from app.api import approvals, auth, dashboard, invoices, sync, webhooks
from app.config import settings
from app.database import get_db
from app.services.sync_worker import start_worker, stop_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_worker()
    yield
    stop_worker()


app = FastAPI(title="Invoice to Tally", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(approvals.router)
app.include_router(dashboard.router)
app.include_router(sync.router)
app.include_router(webhooks.router)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}