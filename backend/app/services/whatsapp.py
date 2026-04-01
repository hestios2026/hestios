"""Meta WhatsApp Business API client."""
import httpx
from app.core.config import settings

GRAPH_URL = "https://graph.facebook.com/v19.0"


async def send_text_message(to: str, body: str) -> dict:
    """Send a free-form text message (valid within 24h service window)."""
    if not getattr(settings, 'WHATSAPP_TOKEN', None) or not getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None):
        raise RuntimeError("WhatsApp not configured — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{GRAPH_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": body},
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()


async def send_template_message(to: str, template_name: str, language: str, components: list) -> dict:
    """Send a pre-approved Meta template (required for proactive/outbound messages)."""
    if not getattr(settings, 'WHATSAPP_TOKEN', None):
        raise RuntimeError("WhatsApp not configured")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{GRAPH_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": language},
                    "components": components,
                },
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
