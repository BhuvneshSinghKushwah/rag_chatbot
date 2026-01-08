import logging
from typing import Optional
from pydantic import BaseModel
import httpx

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class WebSearchResult(BaseModel):
    title: str
    url: str
    content: str
    engine: str


class WebSearchService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.base_url = self.settings.SEARXNG_BASE_URL
        self.client = httpx.AsyncClient(timeout=10.0)

    async def search(
        self,
        query: str,
        num_results: int = 5,
        categories: Optional[list[str]] = None,
    ) -> list[WebSearchResult]:
        if categories is None:
            categories = ["general"]

        try:
            response = await self.client.get(
                f"{self.base_url}/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": ",".join(categories),
                }
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("results", [])[:num_results]:
                title = item.get("title", "")
                url = item.get("url", "")
                content = item.get("content", "")
                engine = item.get("engine", "unknown")

                if title and url:
                    results.append(WebSearchResult(
                        title=title,
                        url=url,
                        content=content,
                        engine=engine
                    ))

            return results

        except httpx.TimeoutException:
            logger.warning("Web search timed out")
            return []
        except httpx.HTTPStatusError as e:
            logger.warning(f"Web search HTTP error: {e.response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return []

    async def health_check(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/healthz", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False

    def format_results(self, results: list[WebSearchResult]) -> str:
        if not results:
            return ""

        chunks = []
        for r in results:
            chunk = f"[Source: {r.url}]\nTitle: {r.title}"
            if r.content:
                chunk += f"\n{r.content}"
            chunks.append(chunk)

        return "\n\n---\n\n".join(chunks)

    def get_source_urls(self, results: list[WebSearchResult]) -> list[str]:
        return [r.url for r in results]


_web_search_service: Optional[WebSearchService] = None


def get_web_search_service() -> WebSearchService:
    global _web_search_service
    if _web_search_service is None:
        _web_search_service = WebSearchService()
    return _web_search_service
