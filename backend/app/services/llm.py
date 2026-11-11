"""Tool-calling LLM client for Anthropic and OpenAI-compatible APIs (HTTP via requests, injectable session)."""
from __future__ import annotations

import json
from typing import Callable, Optional


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(self, provider: str, api_key: str, model: str, base_url: str = "", session=None, timeout: int = 45):
        self.provider, self.api_key, self.model, self.base_url = provider, api_key, model, base_url.rstrip("/")
        self._session, self._timeout = session, timeout

    def _post(self, url: str, headers: dict, body: dict) -> dict:
        if self._session is None:
            import requests

            self._session = requests.Session()
        try:
            resp = self._session.post(url, headers=headers, json=body, timeout=self._timeout)
        except Exception as exc:
            raise LLMError("The AI service could not be reached.") from exc
        if resp.status_code >= 400:
            raise LLMError(f"The AI service returned an error (HTTP {resp.status_code}).")
        try:
            return resp.json()
        except ValueError as exc:
            raise LLMError("The AI service returned an unreadable response.") from exc

    def run(self, system: str, messages: list, tools: list, execute_tool: Callable[[str, dict], str], max_steps: int = 5) -> str:
        """messages: [{role, content: str}]. execute_tool(name, args) -> JSON string. Returns final text."""
        if self.provider == "anthropic":
            return self._anthropic(system, messages, tools, execute_tool, max_steps)
        if self.provider == "google":
            return self._gemini(system, messages, tools, execute_tool, max_steps)
        return self._openai(system, messages, tools, execute_tool, max_steps)

    def complete(self, system: str, user_text: str) -> str:
        return self.run(system, [{"role": "user", "content": user_text}], [], lambda n, a: "{}", 1)

    def _anthropic(self, system, messages, tools, execute_tool, max_steps):
        url = (self.base_url or "https://api.anthropic.com") + "/v1/messages"
        headers = {"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        msgs = [dict(m) for m in messages]
        for _ in range(max_steps):
            body = {"model": self.model, "max_tokens": 1024, "system": system, "messages": msgs}
            if tools:
                body["tools"] = tools
            data = self._post(url, headers, body)
            blocks = data.get("content") or []
            uses = [b for b in blocks if b.get("type") == "tool_use"]
            if uses and tools:
                msgs.append({"role": "assistant", "content": blocks})
                msgs.append({"role": "user", "content": [
                    {"type": "tool_result", "tool_use_id": u["id"], "content": execute_tool(u["name"], u.get("input") or {})} for u in uses]})
                continue
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()
        raise LLMError("The AI used too many tool steps.")

    def _openai(self, system, messages, tools, execute_tool, max_steps):
        url = (self.base_url or "https://api.openai.com/v1") + "/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        msgs = [{"role": "system", "content": system}] + [dict(m) for m in messages]
        fn_tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}} for t in tools]
        for _ in range(max_steps):
            body = {"model": self.model, "messages": msgs}
            if fn_tools:
                body["tools"] = fn_tools
            data = self._post(url, headers, body)
            try:
                msg = data["choices"][0]["message"]
            except (KeyError, IndexError, TypeError) as exc:
                raise LLMError("The AI service returned an unexpected response.") from exc
            calls = msg.get("tool_calls")
            if calls and fn_tools:
                msgs.append(msg)
                for c in calls:
                    try:
                        args = json.loads(c["function"].get("arguments") or "{}")
                    except ValueError:
                        args = {}
                    msgs.append({"role": "tool", "tool_call_id": c["id"], "content": execute_tool(c["function"]["name"], args)})
                continue
            return (msg.get("content") or "").strip()
        raise LLMError("The AI used too many tool steps.")

    def _gemini(self, system, messages, tools, execute_tool, max_steps):
        """Gemini generateContent function-calling loop; secrets stay in the backend."""
        model = self.model or "gemini-2.5-flash"
        url = (self.base_url or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
        url += f"/models/{model}:generateContent"
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                    for m in messages if m.get("content")]
        declarations = [{"name": t["name"], "description": t["description"], "parameters": t["input_schema"]} for t in tools]
        for _ in range(max_steps):
            body = {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}}
            if declarations:
                body["tools"] = [{"functionDeclarations": declarations}]
            data = self._post(url, headers, body)
            try:
                candidate = data["candidates"][0]["content"]
                parts = candidate.get("parts") or []
            except (KeyError, IndexError, TypeError) as exc:
                raise LLMError("The AI service returned an unexpected response.") from exc
            calls = [p["functionCall"] for p in parts if p.get("functionCall")]
            if calls and declarations:
                # Keep Gemini's original model turn intact for multi-step tool calling.
                contents.append(candidate)
                responses = []
                for call in calls:
                    try:
                        result = json.loads(execute_tool(call["name"], call.get("args") or "{}"))
                    except (ValueError, TypeError, KeyError):
                        result = {"error": "The requested action could not be completed."}
                    responses.append({"functionResponse": {"name": call["name"], "response": result}})
                contents.append({"role": "user", "parts": responses})
                continue
            return "".join(p.get("text", "") for p in parts if p.get("text")).strip()
        raise LLMError("The AI used too many tool steps.")


def narrative(llm: Optional[LLMClient], system: str, payload: dict, fallback: str, language_name: str = "English"):
    """Returns (text, generated_by). Falls back to rule-based text on any AI problem; never invents data."""
    if llm is None:
        return fallback, "rule-based"
    try:
        text = llm.complete(system + f" Reply in {language_name}. Use ONLY the numbers in the JSON data; never invent figures or give guarantees.",
                            json.dumps(payload, default=str))
        return (text, "llm") if text else (fallback, "rule-based")
    except LLMError:
        return fallback, "rule-based"
