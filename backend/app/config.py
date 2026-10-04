from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root ki .env file (backend/app/config.py se 2 level upar)
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 480
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    WEBHOOK_API_KEY: str = ""
    TALLY_URL: str = "http://localhost:9000"
    TALLY_COMPANY: str = "Demo Company"
    TALLY_PURCHASE_LEDGER: str = "Purchase Accounts"
    TALLY_CGST_LEDGER: str = "Input CGST"
    TALLY_SGST_LEDGER: str = "Input SGST"
    TALLY_IGST_LEDGER: str = "Input IGST"
    TALLY_ROUNDOFF_LEDGER: str = "Round Off"
    TALLY_VOUCHER_TYPE: str = "Purchase"
    TALLY_TIMEOUT_SECONDS: int = 15
    SYNC_POLL_SECONDS: int = 5

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()