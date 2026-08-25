"""Assistant endpoint: with no GROQ_API_KEY configured it must return the
neutral, professional fallback message (no emojis, no crash)."""

import re

EMOJI_PATTERN = re.compile(
    "[\U0001F300-\U0001FAFF\u2600-\u27BF\u2705\u26A0\uFE0F]"
)


def test_assistant_fallback_when_ai_unavailable(client):
    res = client.post("/api/v1/assistant/chat", json={
        "messages": [{"role": "user", "content": "What is ESBL?"}],
    })
    assert res.status_code == 200
    reply = res.json()["reply"]
    assert "currently unavailable" in reply
    assert "reference data" in reply
    # Professional tone: no emojis in user-facing text
    assert not EMOJI_PATTERN.search(reply)
