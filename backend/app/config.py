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
    notion_webhook_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
