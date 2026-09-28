from typing import Any, Iterator

import httpx

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


class NotionClient:
    """Tiny read only wrapper around the Notion REST API."""

    def __init__(self, token: str, timeout: float = 30.0):
        if not token:
            raise ValueError("NOTION_TOKEN is not configured")
        self._http = httpx.Client(
            base_url=NOTION_API,
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self._http.close()

    def _paginate(self, method: str, url: str, body: dict | None = None) -> Iterator[dict]:
        cursor = None
        while True:
            if method == "GET":
                params = {"page_size": 100, **({"start_cursor": cursor} if cursor else {})}
                res = self._http.get(url, params=params)
            else:
                payload = {**(body or {}), "page_size": 100, **({"start_cursor": cursor} if cursor else {})}
                res = self._http.post(url, json=payload)
            res.raise_for_status()
            data = res.json()
            yield from data.get("results", [])
            if not data.get("has_more"):
                return
            cursor = data.get("next_cursor")

    def child_databases(self, page_id: str) -> list[dict[str, Any]]:
        """Inline databases directly inside a page, as {"id", "title"}."""
        return [
            {"id": block["id"], "title": block["child_database"].get("title", "")}
            for block in self._paginate("GET", f"/blocks/{page_id}/children")
            if block.get("type") == "child_database"
        ]

    def query_database(self, database_id: str) -> list[dict[str, Any]]:
        return list(self._paginate("POST", f"/databases/{database_id}/query"))
