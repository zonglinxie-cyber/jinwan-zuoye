#!/usr/bin/env python3
"""今晚作业：静态页 + 看图拆题。密钥只在本机，图片不落盘。"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("JW_PORT", "8787"))
CHINA_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
INTL_BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
MODELS = ["qwen-vl-max", "qwen3-vl-plus", "qwen-vl-plus"]
MAX_IMAGE_CHARS = 2_800_000

SEE_PROMPT = """你是四年级作业录文员，不是老师，不要解题，不要补得数。
只读图上能看见的字。把印刷/打印的题目，和孩子手写的答案、竖式分开。
若图上印了标准答案，不要把它当成孩子写的。
看不清就降低 confidence，宁可少拆，不要编。

只输出 JSON，不要 markdown：
{"items":[{"stem":"题目","childAnswer":"孩子最终写下的得数或词语","work":"能看见的竖式或步骤，没有就空","subject":"math|chinese|english","confidence":0.0}]}
科目提示：%s
英语当前单元只作背景，不要超单元发挥。
最多拆 8 题。"""


def load_key() -> str:
    env = (os.environ.get("DASHSCOPE_API_KEY") or os.environ.get("TOKEN_PLAN_API_KEY") or "").strip()
    if env:
        return env
    path = Path.home() / ".dashscope_key"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip().splitlines()[0].strip()
    return ""


def cors(handler: SimpleHTTPRequestHandler) -> None:
    origin = handler.headers.get("Origin") or "*"
    handler.send_header("Access-Control-Allow-Origin", origin)
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Vary", "Origin")


def extract_json(text: str) -> dict:
    raw = (text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("model returned no json")
    return json.loads(raw[start : end + 1])


def call_vl(image: str, subject: str, key: str) -> dict:
    if not image or not image.startswith("data:image"):
        raise ValueError("need data image")
    if len(image) > MAX_IMAGE_CHARS:
        raise ValueError("image too large")
    payload = {
        "model": MODELS[0],
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": SEE_PROMPT % (subject or "unknown")},
                    {"type": "image_url", "image_url": {"url": image}},
                ],
            }
        ],
    }
    last_err = "upstream failed"
    for base in (os.environ.get("DASHSCOPE_BASE_URL", "").rstrip("/"), CHINA_BASE, INTL_BASE):
        if not base:
            continue
        for model in MODELS:
            payload["model"] = model
            req = urllib.request.Request(
                base + "/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + key,
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                text = body["choices"][0]["message"]["content"]
                if isinstance(text, list):
                    text = "".join(
                        (p.get("text") or "") if isinstance(p, dict) else str(p) for p in text
                    )
                data = extract_json(text)
                items = data.get("items") or []
                clean = []
                for it in items[:8]:
                    stem = str(it.get("stem") or "").strip()
                    if not stem:
                        continue
                    sub = it.get("subject") or subject or "math"
                    if sub not in ("math", "chinese", "english"):
                        sub = subject or "math"
                    try:
                        conf = float(it.get("confidence") or 0.6)
                    except (TypeError, ValueError):
                        conf = 0.6
                    clean.append(
                        {
                            "stem": stem[:200],
                            "childAnswer": str(it.get("childAnswer") or "").strip()[:80],
                            "work": str(it.get("work") or "").strip()[:240],
                            "subject": sub,
                            "confidence": conf,
                        }
                    )
                return {"items": clean, "model": model}
            except urllib.error.HTTPError as e:
                last_err = f"{e.code} {e.read()[:200]!r}"
                continue
            except Exception as e:
                last_err = str(e)
                continue
    raise RuntimeError(last_err)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        cors(self)
        self.end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            key = load_key()
            return self._json(200, {"ok": True, "see": bool(key), "port": PORT})
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/see":
            self.send_error(404)
            return
        key = load_key()
        if not key:
            return self._json(503, {"error": "本机没有看图密钥。设置 DASHSCOPE_API_KEY 或 ~/.dashscope_key"})
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 3_500_000:
            return self._json(413, {"error": "图片太大或空"})
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "bad json"})
        try:
            result = call_vl(body.get("image") or "", body.get("subject") or "math", key)
        except ValueError as e:
            return self._json(400, {"error": str(e)})
        except Exception as e:
            return self._json(502, {"error": "看图失败", "detail": str(e)[:180]})
        return self._json(200, result)

    def _json(self, status: int, obj: dict) -> None:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        cors(self)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    key = load_key()
    print(f"今晚作业  http://127.0.0.1:{PORT}/")
    print(f"看图拆题  {'已接上' if key else '未接上（缺密钥）'}")
    print("手机请和电脑连同一 Wi‑Fi，打开上面地址（把 127.0.0.1 换成电脑的局域网 IP）")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
