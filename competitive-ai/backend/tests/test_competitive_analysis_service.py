from typing import Any

import httpx
import pytest

from src.config import settings
from src.services import competitive_analysis_service as svc


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("example.com", "example.com"),
        ("  https://www.Example.com/pricing?x=1 ", "example.com"),
        ("http://shop.example.com/", "shop.example.com"),
        ("www.example.com", "example.com"),
        ("example.com/www.thing", "example.com"),
    ],
)
def test_clean_domain(raw: str, expected: str) -> None:
    assert svc.clean_domain(raw) == expected


def test_to_meta_country() -> None:
    assert svc.to_meta_country("UK") == "GB"
    assert svc.to_meta_country("us") == "US"


def _mock_transport(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    real_client = httpx.AsyncClient

    def factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(svc.httpx, "AsyncClient", factory)


async def test_upstream_error_does_not_leak_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "spyfu_api_key", "SUPER-SECRET-KEY")
    _mock_transport(monkeypatch, lambda req: httpx.Response(403, text="forbidden"))

    with pytest.raises(svc.CompetitiveAnalysisError) as exc_info:
        await svc.fetch_ppc_competitors("example.com", "US")

    assert "SUPER-SECRET-KEY" not in str(exc_info.value)
    assert str(exc_info.value) == "Competitor data service returned HTTP 403"


async def test_network_error_does_not_leak_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "serpapi_key", "SUPER-SECRET-KEY")

    def boom(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot connect to {req.url}", request=req)

    _mock_transport(monkeypatch, boom)

    with pytest.raises(svc.CompetitiveAnalysisError) as exc_info:
        await svc.fetch_google_ad_creatives("example.com")

    assert "SUPER-SECRET-KEY" not in str(exc_info.value)


async def test_competitor_stats_skips_failed_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "spyfu_api_key", "k")

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params["domain"] == "bad.com":
            return httpx.Response(500)
        return httpx.Response(200, json={"results": [{"searchMonth": 3, "searchYear": 2026}]})

    _mock_transport(monkeypatch, handler)

    stats = await svc.fetch_competitor_stats(
        [{"domain": "good.com"}, {"domain": "bad.com"}], "US", 1
    )
    assert stats == [{"searchMonth": "March", "searchYear": 2026, "domain": "good.com"}]


async def test_competitor_stats_raises_when_all_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "spyfu_api_key", "k")
    _mock_transport(monkeypatch, lambda req: httpx.Response(500))

    with pytest.raises(svc.CompetitiveAnalysisError):
        await svc.fetch_competitor_stats([{"domain": "a.com"}, {"domain": "b.com"}], "US", 1)


async def test_facebook_uses_meta_country_and_clean_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "")  # no page lookup -> keyword fallback
    seen: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen.update(req.url.params)
        return httpx.Response(200, json={"data": []})

    _mock_transport(monkeypatch, handler)

    await svc.fetch_facebook_ad_creatives("https://www.example.com/", "UK")
    assert seen["ad_reached_countries"] == '["GB"]'
    assert seen["search_terms"] == "example.com"


PROVIDER_NAMES = ("spyfu", "serpapi", "meta", "ads library", "_KEY", "TOKEN")


@pytest.mark.parametrize(
    ("setting", "call"),
    [
        ("spyfu_api_key", lambda: svc.fetch_ppc_competitors("a.com", "US")),
        ("serpapi_key", lambda: svc.fetch_google_ad_creatives("a.com")),
        ("fb_access_token", lambda: svc.fetch_facebook_ad_creatives("a.com", "US")),
        ("search_api_key", lambda: svc.fetch_linkedin_ad_creatives("a.com", "US")),
    ],
)
async def test_errors_do_not_name_providers(
    monkeypatch: pytest.MonkeyPatch, setting: str, call: Any
) -> None:
    monkeypatch.setattr(settings, "search_api_key", "")
    # Not configured
    monkeypatch.setattr(settings, setting, "")
    with pytest.raises(svc.CompetitiveAnalysisError) as exc_info:
        await call()
    assert not any(n.lower() in str(exc_info.value).lower() for n in PROVIDER_NAMES)

    # Upstream failure
    monkeypatch.setattr(settings, setting, "k")
    _mock_transport(monkeypatch, lambda req: httpx.Response(500))
    with pytest.raises(svc.CompetitiveAnalysisError) as exc_info:
        await call()
    assert not any(n.lower() in str(exc_info.value).lower() for n in PROVIDER_NAMES)


async def test_facebook_snapshot_url_has_no_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "SECRET-TOKEN")
    monkeypatch.setattr(settings, "search_api_key", "")
    snapshot = "https://www.facebook.com/ads/archive/render_ad/?id=42&access_token=SECRET-TOKEN"
    _mock_transport(
        monkeypatch,
        lambda req: httpx.Response(200, json={"data": [{"id": "42", "ad_snapshot_url": snapshot}]}),
    )
    ads = await svc.fetch_facebook_ad_creatives("a.com", "US")
    assert ads[0]["ad_snapshot_url"] == "https://www.facebook.com/ads/library/?id=42"
    assert ads[0]["match_type"] == "keyword"


async def test_google_creatives_drop_provider_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "serpapi_key", "k")
    _mock_transport(
        monkeypatch,
        lambda req: httpx.Response(
            200,
            json={"ad_creatives": [{"ad_creative_id": "1", "serpapi_details_link": "x"}]},
        ),
    )
    assert await svc.fetch_google_ad_creatives("a.com") == [{"ad_creative_id": "1"}]


@pytest.fixture(autouse=True)
def _clear_page_cache() -> None:
    svc._page_cache.clear()
    svc._linkedin_cache.clear()


@pytest.mark.parametrize(
    ("domain", "expected"),
    [
        ("warbyparker.com", "warbyparker"),
        ("https://www.shop.allbirds.co.uk/men", "allbirds"),
        ("chewy.com/", "chewy"),
        ("localhost", "localhost"),
    ],
)
def test_brand_query(domain: str, expected: str) -> None:
    assert svc.brand_query(domain) == expected


WARBY_PAGES = [
    {"page_id": "1377910332073474", "name": "Warbyparker", "verification": "NOT_VERIFIED",
     "likes": 1196},
    {"page_id": "308998183837", "name": "Warby Parker", "verification": "BLUE_VERIFIED",
     "likes": 760892, "page_alias": "warbyparker", "ig_username": "warbyparker"},
    {"page_id": "102117972402366", "name": "miirns.creations"},
]


def test_pick_meta_page_prefers_verified_match() -> None:
    page = svc.pick_meta_page("warbyparker", WARBY_PAGES)
    assert page == svc.MetaPage(page_id="308998183837", name="Warby Parker")


def test_pick_meta_page_rejects_non_matching() -> None:
    assert svc.pick_meta_page("acme", WARBY_PAGES) is None


async def test_facebook_searches_by_resolved_page_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "k")
    graph_params: list[dict[str, str]] = []
    lookups = 0

    def handler(req: httpx.Request) -> httpx.Response:
        nonlocal lookups
        if req.url.host == "www.searchapi.io":
            lookups += 1
            assert req.url.params["engine"] == "meta_ad_library_page_search"
            assert req.url.params["q"] == "warbyparker"
            return httpx.Response(200, json={"page_results": WARBY_PAGES})
        graph_params.append(dict(req.url.params))
        return httpx.Response(200, json={"data": [{"id": "1"}]})

    _mock_transport(monkeypatch, handler)

    ads = await svc.fetch_facebook_ad_creatives("https://www.warbyparker.com", "US")
    await svc.fetch_facebook_ad_creatives("warbyparker.com", "US")

    assert ads[0]["match_type"] == "page"
    assert len(graph_params) == 2  # no keyword fallback when the page has ads

    assert lookups == 1  # second call served from cache
    for params in graph_params:
        assert params["search_page_ids"] == '["308998183837"]'
        assert "search_terms" not in params


async def test_facebook_falls_back_to_keyword_when_lookup_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "k")
    graph_params: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "www.searchapi.io":
            return httpx.Response(500)
        graph_params.update(req.url.params)
        return httpx.Response(200, json={"data": []})

    _mock_transport(monkeypatch, handler)

    await svc.fetch_facebook_ad_creatives("warbyparker.com", "US")
    assert graph_params["search_terms"] == "warbyparker.com"
    assert "search_page_ids" not in graph_params


@pytest.mark.parametrize(("status", "expected"), [(None, "ALL"), ("ACTIVE", "ACTIVE")])
async def test_facebook_ad_status(
    monkeypatch: pytest.MonkeyPatch, status: str | None, expected: str
) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "")
    seen: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen.update(req.url.params)
        return httpx.Response(200, json={"data": []})

    _mock_transport(monkeypatch, handler)
    if status is None:
        await svc.fetch_facebook_ad_creatives("a.com", "US")
    else:
        await svc.fetch_facebook_ad_creatives("a.com", "US", status)
    assert seen["ad_active_status"] == expected


async def test_facebook_falls_back_to_keyword_when_no_page_matches(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "k")
    graph_params: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "www.searchapi.io":
            # Page search returns only unrelated pages
            return httpx.Response(200, json={"page_results": WARBY_PAGES})
        graph_params.update(req.url.params)
        return httpx.Response(200, json={"data": []})

    _mock_transport(monkeypatch, handler)

    await svc.fetch_facebook_ad_creatives("https://getcalm.com", "US")
    assert graph_params["search_terms"] == "getcalm.com"
    assert "search_page_ids" not in graph_params



async def test_facebook_falls_back_to_keyword_when_page_has_no_ads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "fb_access_token", "t")
    monkeypatch.setattr(settings, "search_api_key", "k")
    graph_calls: list[dict[str, str]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "www.searchapi.io":
            return httpx.Response(200, json={"page_results": WARBY_PAGES})
        params = dict(req.url.params)
        graph_calls.append(params)
        if "search_page_ids" in params:
            return httpx.Response(200, json={"data": []})  # page has no ads
        return httpx.Response(200, json={"data": [{"id": "9", "page_name": "Other"}]})

    _mock_transport(monkeypatch, handler)

    ads = await svc.fetch_facebook_ad_creatives("warbyparker.com", "US", "ACTIVE")

    assert [("search_page_ids" in c, "search_terms" in c) for c in graph_calls] == [
        (True, False),
        (False, True),
    ]
    assert graph_calls[1]["search_terms"] == "warbyparker.com"
    assert graph_calls[1]["ad_active_status"] == "ACTIVE"
    assert ads == [
        {
            "id": "9",
            "page_name": "Other",
            "ad_snapshot_url": "https://www.facebook.com/ads/library/?id=9",
            "match_type": "keyword",
        }
    ]



LINKEDIN_ADS = [
    {"position": 1, "id": "1", "ad_type": "image",
     "advertiser": {"name": "Digitale - HubSpot Diamond Partners"},
     "content": {"headline": "partner ad"}, "link": "https://www.linkedin.com/ad-library/detail/1"},
    {"position": 2, "id": "2", "ad_type": "video", "advertiser": {"name": "HubSpot"},
     "content": {"headline": "own ad"}, "link": "https://www.linkedin.com/ad-library/detail/2"},
]


async def test_linkedin_tags_and_orders_own_ads_first(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "search_api_key", "k")
    calls: list[dict[str, str]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params["engine"] == "meta_ad_library_page_search":
            return httpx.Response(200, json={"page_results": []})  # no page -> domain label
        calls.append(dict(req.url.params))
        return httpx.Response(200, json={"ads": LINKEDIN_ADS})

    _mock_transport(monkeypatch, handler)

    ads = await svc.fetch_linkedin_ad_creatives("https://www.hubspot.com", "UK")
    again = await svc.fetch_linkedin_ad_creatives("hubspot.com", "UK")

    assert len(calls) == 1  # cached
    assert calls[0]["engine"] == "linkedin_ad_library"
    assert calls[0]["advertiser"] == "hubspot"
    assert calls[0]["country"] == "GB"
    assert [(a["id"], a["match_type"]) for a in ads] == [("2", "page"), ("1", "keyword")]
    assert all("position" not in a for a in ads)
    assert again == ads


async def test_linkedin_without_country(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "search_api_key", "k")
    seen: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params["engine"] == "meta_ad_library_page_search":
            return httpx.Response(200, json={"page_results": []})
        seen.update(req.url.params)
        return httpx.Response(200, json={"ads": []})

    _mock_transport(monkeypatch, handler)
    assert await svc.fetch_linkedin_ad_creatives("hubspot.com", None) == []
    assert "country" not in seen



async def test_linkedin_uses_resolved_page_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "search_api_key", "k")
    linkedin_params: dict[str, str] = {}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.params["engine"] == "meta_ad_library_page_search":
            return httpx.Response(200, json={"page_results": WARBY_PAGES})
        linkedin_params.update(req.url.params)
        return httpx.Response(
            200, json={"ads": [{"id": "5", "advertiser": {"name": "Warby Parker"}}]}
        )

    _mock_transport(monkeypatch, handler)
    ads = await svc.fetch_linkedin_ad_creatives("warbyparker.com", "US")

    assert linkedin_params["advertiser"] == "Warby Parker"
    assert ads[0]["match_type"] == "page"
