import pytest

from src.config import Settings


@pytest.mark.parametrize("env_name", ["SEARCH_API_KEY", "SEARCHAPI_KEY"])
def test_search_api_key_env_names(monkeypatch: pytest.MonkeyPatch, env_name: str) -> None:
    monkeypatch.delenv("SEARCH_API_KEY", raising=False)
    monkeypatch.delenv("SEARCHAPI_KEY", raising=False)
    monkeypatch.setenv(env_name, "abc")
    assert Settings(_env_file=None).search_api_key == "abc"  # type: ignore[call-arg]
