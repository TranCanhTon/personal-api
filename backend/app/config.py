from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    cors_origins: str = "http://localhost:5173"
    # Times in API responses are returned in this timezone
    timezone: str = "Europe/Helsinki"

    # Key that Health Auto Export and manual sync calls must send as X-API-Key
    ingest_api_key: str = ""

    # Notion
    notion_token: str = ""
    notion_todo_page_id: str = "2c53780f-eac3-80d9-b84e-da60d1faea41"
    notion_trades_database_id: str = "6f74e22a-4a2b-412e-bc6b-8f242782fc58"
    # Trading journal sync is paused for now. Only the to do list is pulled.
    notion_sync_trades: bool = False
    # How often the API pulls from Notion by itself. 0 turns it off.
    notion_sync_interval_minutes: int = 5
    notion_webhook_secret: str = ""

    # Email (Gmail SMTP with an app password). Leave smtp_user empty to turn emails off.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""  # defaults to smtp_user

    # Evening food suggestion: emailed only when I'm under a target. Times are in `timezone`.
    food_alert_time: str = "23:00"
    # Carbs and fat may drift this far under their targets before it counts as missing
    macro_tolerance_g: float = 20
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Weekly report, sent on Sundays
    weekly_report_time: str = "20:00"

    # chess.com username. Leave empty to turn the sync off.
    chess_username: str = "sooooo1"
    chess_sync_interval_minutes: int = 10

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
