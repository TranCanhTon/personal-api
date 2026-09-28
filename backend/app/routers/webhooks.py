import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

from app.config import settings
from app.services.notion_runner import run_notion_sync_in_background

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def valid_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/notion")
async def notion_webhook(
    request: Request,
    background: BackgroundTasks,
    x_notion_signature: str | None = Header(default=None),
):
    body = await request.body()
    try:
        event = json.loads(body or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(400, "Body is not JSON")

    # First contact: Notion sends a one time token that you paste back into
    # the Notion webhook settings, and into NOTION_WEBHOOK_SECRET.
    if "verification_token" in event:
        logger.warning("Notion webhook verification token received: %s", event["verification_token"])
        return {"status": "verification token logged"}

    if not settings.notion_webhook_secret:
        raise HTTPException(503, "NOTION_WEBHOOK_SECRET is not configured")
    if not valid_signature(body, x_notion_signature, settings.notion_webhook_secret):
        raise HTTPException(401, "Invalid signature")

    logger.info("Notion event %s, syncing", event.get("type"))
    background.add_task(run_notion_sync_in_background)
    return {"status": "sync scheduled"}
