import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Protects every endpoint that writes data."""
    expected = settings.ingest_api_key
    if not expected:
        # Refuse writes entirely rather than run unprotected by accident
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "INGEST_API_KEY is not configured")
    if not x_api_key or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing API key")
