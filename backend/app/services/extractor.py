import time

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.invoice import ExtractedInvoice

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
}

PROMPT = """You are an accounts-payable assistant for an Indian company.
Read this vendor invoice and extract the fields into the given JSON schema.

Rules:
- Dates must be in YYYY-MM-DD format.
- All amounts are plain numbers in INR (no currency symbols, no commas).
- vendor_gstin is the SELLER's 15-character GSTIN, not the buyer's.
- If CGST/SGST/IGST is not shown, leave it null. Do not guess.
- total_amount is the final payable amount including tax.
- If a field is not present or unreadable, return null. Never invent values.
- confidence: your overall confidence from 0 to 1 that the extraction is correct.
"""


class ExtractionError(Exception):
    pass


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if not settings.GEMINI_API_KEY:
        raise ExtractionError("GEMINI_API_KEY .env me set nahi hai")
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def extract_invoice(file_bytes: bytes, mime_type: str) -> ExtractedInvoice:
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ExtractionError(f"Unsupported file type: {mime_type}")

    client = _get_client()
    last_error: Exception | None = None

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    PROMPT,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ExtractedInvoice,
                    temperature=0,
                ),
            )
            if response.parsed is not None:
                return response.parsed
            return ExtractedInvoice.model_validate_json(response.text)
        except Exception as exc:  # network, rate limit, bad JSON
            last_error = exc
            time.sleep(2 * (attempt + 1))

    raise ExtractionError(f"Gemini extraction failed after 3 attempts: {last_error}")