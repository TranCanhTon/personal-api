from typing import Any

import httpx

# chess.com asks API users to say who they are in the User-Agent
USER_AGENT = "personal-api (github.com/TranCanhTon/personal-api)"


class ChessClient:
    """Tiny read only wrapper around chess.com's public API. No key needed."""

    def __init__(self, timeout: float = 30.0):
        self._http = httpx.Client(
            base_url="https://api.chess.com/pub", timeout=timeout, headers={"User-Agent": USER_AGENT}
        )

    def close(self) -> None:
        self._http.close()

    def _get(self, url: str) -> Any:
        res = self._http.get(url)
        res.raise_for_status()
        return res.json()

    def archives(self, username: str) -> list[str]:
        """URLs of every month with games, oldest first."""
        return self._get(f"/player/{username}/games/archives")["archives"]

    def month(self, archive_url: str) -> list[dict[str, Any]]:
        return self._get(archive_url)["games"]
