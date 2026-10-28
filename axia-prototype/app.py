#!/usr/bin/env python3
"""
Axia 시제품 (내 컴퓨터에서 돌아가는 레퍼런스 보관함)

- Chrome 확장 'Axia로 보내기'나 링크 붙여넣기, 파일 끌어다 놓기로 이미지를 받아요.
- 받은 이미지는 axia_data/images 에 바로 저장하고(인스타 썸네일 만료 대비), AI가 분야·태그·그룹을 붙여요.
- 태그 기준은 axia_data/court.json (Tag Lab에서 다듬은 규칙집을 여기에 덮어쓰면 그대로 반영).

실행: python3 app.py  (Windows: python app.py) → http://localhost:8770
"""
import argparse, base64, hashlib, html, json, mimetypes, queue, re, threading, time, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import axia_tagger as T

HERE = Path(__file__).resolve().parent
DATA = HERE / "axia_data"
IMG = DATA / "images"
LIB = DATA / "library.json"
SETTINGS = DATA / "settings.json"
COURT = DATA / "court.json"
LOCK = threading.Lock()
Q = queue.Queue()
STATUS = {"working": "", "note": ""}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

DEFAULT_SETTINGS = {
    "chain": [
        {"provider": "gemini", "model": "gemini-3.5-flash-lite"},
        {"provider": "gemini", "model": "gemini-3.1-flash-lite"},
        {"provider": "anthropic", "model": "claude-haiku-5-5"},
        {"provider": "openai", "model": "gpt-5.4-nano"},
    ],
    "keys": {"gemini": "", "anthropic": "", "openai": ""},
    "mode": "list",
    "size": 512,
    "auto_tag": True,
}
DEFAULT_FIELDS = ["3d", "graphic", "typography", "painting", "photo", "package", "video", "ui_ux", "architecture", "editorial", "ai_image"]


# ---------- storage ----------
def jload(p, default):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        return default


def jsave(p, obj):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(str(p) + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)


def settings():
    s = jload(SETTINGS, {})
    out = json.loads(json.dumps(DEFAULT_SETTINGS))
    out.update({k: v for k, v in s.items() if k in out})
    out["keys"] = {**DEFAULT_SETTINGS["keys"], **s.get("keys", {})}
    return out


def court():
    c = jload(COURT, None)
    if c:
        return c
    c = T.court_from_tags_txt((HERE / "tags.txt").read_text(encoding="utf-8"))
    c["fields"] = {k: T.FIELD_DEFS.get(k, "") for k in DEFAULT_FIELDS}
    jsave(COURT, c)
    return c


def library():
    return jload(LIB, {"items": {}})


def save_library(lib):
    jsave(LIB, lib)


# ---------- adding ----------
def fetch(url, referer=None, limit=25_000_000):
    req = urllib.request.Request(url, headers={"user-agent": UA, "accept": "*/*", **({"referer": referer} if referer else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read(limit + 1)
        if len(data) > limit:
            raise ValueError("File is too large")
        return data, r.headers.get("content-type", ""), r.geturl()


def platform_of(url):
    u = (url or "").lower()
    for k in ("instagram", "pinterest", "pin.it", "behance", "dribbble", "are.na", "cosmos", "savee", "tumblr", "x.com", "twitter"):
        if k in u:
            return {"pin.it": "pinterest", "x.com": "x", "twitter": "x", "are.na": "arena"}.get(k, k)
    return urllib.parse.urlparse(url).netloc.replace("www.", "") if url else "file"


def add_image(data, *, image_url="", page_url="", title="", source=""):
    """이미지 바이트를 저장하고 보관함에 올려요. 같은 이미지는 한 번만 저장해요."""
    if len(data) < 2000:
        raise ValueError("Image is too small or empty")
    sha = hashlib.sha1(data).hexdigest()[:16]
    ext = ".png" if data[:4] == b"\x89PNG" else ".webp" if data[8:12] == b"WEBP" else ".gif" if data[:3] == b"GIF" else ".jpg"
    IMG.mkdir(parents=True, exist_ok=True)
    with LOCK:
        lib = library()
        if sha in lib["items"]:
            it = lib["items"][sha]
            if page_url and page_url not in it.get("pages", []):
                it.setdefault("pages", []).append(page_url)
                save_library(lib)
            return it, False
        (IMG / f"{sha}{ext}").write_bytes(data)
        it = {"id": sha, "file": f"{sha}{ext}", "image_url": image_url, "page_url": page_url, "pages": [page_url] if page_url else [],
              "title": title[:200], "source": source or platform_of(page_url or image_url), "added": time.strftime("%Y-%m-%d %H:%M:%S"),
              "status": "queued" if settings()["auto_tag"] else "new", "fields": [], "field": None, "tags": [], "group_name": "", "user_tags": []}
        with_colors(it)
        lib["items"][sha] = it
        save_library(lib)
    if it["status"] == "queued":
        Q.put(sha)
    return it, True


def add_from_url(image_url, page_url="", title="", source=""):
    if image_url.startswith("data:"):
        data = base64.b64decode(image_url.split(",", 1)[1])
        return add_image(data, page_url=page_url, title=title, source=source)
    data, ctype, _ = fetch(image_url, referer=page_url or None)
    if "text/html" in ctype:
        raise ValueError("That's a web page, not an image URL")
    return add_image(data, image_url=image_url, page_url=page_url, title=title, source=source)


def meta(htmltext, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']' + re.escape(prop) + r'["\'][^>]+content=["\']([^"\']+)', htmltext, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + re.escape(prop) + r'["\']', htmltext, re.I)
    return html.unescape(m.group(1)) if m else ""


# ---------- colour tags (worked out here with Pillow, no AI) ----------
COLORS = ("Red", "Orange", "Yellow", "Green", "Teal", "Blue", "Purple", "Pink", "Brown", "Black", "White", "Grey")

def colour_name(h, s, v):
    """Pillow HSV (0-255 each) → one of COLORS."""
    h, s, v = h * 360 / 255, s / 255, v / 255
    if v < 0.2: return "Black"
    if s < 0.15 or (s < 0.3 and v < 0.45): return "White" if v > 0.85 and s < 0.15 else "Grey"
    if h < 15 or h >= 345: return "Pink" if s < 0.5 and v > 0.7 else "Red"
    if h < 45: return "Brown" if v < 0.6 else "Orange"
    if h < 70: return "Yellow"
    if h < 165: return "Green"
    if h < 195: return "Teal"
    if h < 255: return "Blue"
    if h < 290: return "Purple"
    return "Pink"

def colors_of(path, share=0.12, top=3):
    """Main colours of an image as tag names: those covering at least `share` of it, biggest first."""
    try:
        from PIL import Image
        with Image.open(path) as im:
            im = im.convert("RGB"); im.thumbnail((64, 64))
            b = im.convert("HSV").tobytes()
    except Exception:
        return []  # no Pillow, or not a readable image
    count = {}
    for i in range(0, len(b), 3):
        n = colour_name(b[i], b[i + 1], b[i + 2]); count[n] = count.get(n, 0) + 1
    total = len(b) // 3
    return [n for n, c in sorted(count.items(), key=lambda x: -x[1]) if c / total >= share][:top]


def with_colors(it):
    """Put the image's main colours into its tags (replacing old colour tags)."""
    it["colors"] = colors_of(IMG / it["file"])
    it["tags"] = [t for t in it.get("tags", []) if t not in COLORS] + it["colors"]


def backfill_colors():
    """Colour tags for items saved before colour tags existed. Runs once in the background."""
    todo = [(sid, it["file"]) for sid, it in library()["items"].items() if "colors" not in it]
    done = {}
    for n, (sid, f) in enumerate(todo, 1):
        done[sid] = colors_of(IMG / f)
        if len(done) >= 50 or n == len(todo):
            with LOCK:
                lib = library()
                for sid2, cols in done.items():
                    it = lib["items"].get(sid2)
                    if it and "colors" not in it:
                        it["colors"] = cols
                        it["tags"] = [t for t in it.get("tags", []) if t not in COLORS] + cols
                save_library(lib)
            done.clear()


def image_size(path):
    """(width, height) from a JPEG/PNG/WebP header, or None. No Pillow needed."""
    import struct
    b = Path(path).read_bytes()[:512_000]
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", b[16:24])
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP" and b[12:16] == b"VP8 ":
        w, h = struct.unpack("<HH", b[26:30]); return w & 0x3FFF, h & 0x3FFF
    i = 2
    while i + 9 < len(b) and b[:2] == b"\xff\xd8":
        if b[i] != 0xFF:
            i += 1; continue
        if b[i + 1] in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", b[i + 5:i + 9]); return w, h
        i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    return None


def cropped_instagram():
    """Instagram posts whose stored image is the square centre-crop Instagram serves as a link
    preview (top/bottom of 4:5 posts cut off). The extension re-fetches these in the user's browser."""
    out = []
    for it in library()["items"].values():
        url = it.get("page_url") or ""
        if it.get("full") or not re.search(r"instagram\.com/(p|reel)/", url):
            continue
        size = image_size(IMG / it["file"])
        if size and abs(size[0] - size[1]) <= 2:
            out.append({"id": it["id"], "page_url": url})
    return out


def replace_image(item_id, image_url):
    """Swap an item's image for the original from its post. Keeps id, tags and everything else."""
    with LOCK:
        it = library()["items"].get(item_id)
    if not it:
        raise ValueError("No such item")
    if image_url.startswith("data:"):
        data = base64.b64decode(image_url.split(",", 1)[1])
    else:
        data, ctype, _ = fetch(image_url, referer=it.get("page_url") or None)
        if "text/html" in ctype:
            raise ValueError("That's a web page, not an image URL")
    if len(data) < 2000:
        raise ValueError("Image is too small or empty")
    ext = ".png" if data[:4] == b"\x89PNG" else ".webp" if data[8:12] == b"WEBP" else ".jpg"
    name = f"{item_id}-full{ext}"
    (IMG / name).write_bytes(data)
    with LOCK:
        lib = library()
        it = lib["items"].get(item_id)
        if not it:
            return
        old = it["file"]
        it.update(file=name, full=True)
        with_colors(it)
        save_library(lib)
    if old != name:
        (IMG / old).unlink(missing_ok=True)


def add_from_link(url):
    """붙여넣은 링크 처리: 이미지 주소 / 핀 / 보드 / 일반 페이지(대표 이미지)."""
    url = url.strip()
    if not re.match(r"https?://", url):
        raise ValueError("Enter a link starting with http")
    data, ctype, final = fetch(url)
    if ctype.startswith("image/"):
        return [add_image(data, image_url=url, page_url=url)]
    page = data.decode("utf-8", errors="ignore")
    is_board = "pinterest." in final and not re.search(r"/pin/\d+", final) and re.search(r"pinterest\.[^/]+/[^/]+/[^/?#]+/?", final)
    if is_board:
        found = add_pinterest_board_rss(final)
        if found:
            return found
        raise ValueError("This board can't be read from the link alone. Open the board and use the extension's 'Send this whole board'.")
    img = meta(page, "og:image") or meta(page, "twitter:image")
    if not img:
        raise ValueError("No preview image found on this page (it may need a login)")
    title = meta(page, "og:title") or meta(page, "og:description")
    img = re.sub(r"i\.pinimg\.com/\d+x/", "i.pinimg.com/originals/", img)
    try:
        return [add_from_url(img, page_url=final, title=title)]
    except Exception:
        return [add_from_url(meta(page, "og:image"), page_url=final, title=title)]


def add_pinterest_board_rss(board_url):
    """공개 보드는 RSS(최근 핀 일부)로 가져와 봐요. 막혀 있으면 빈 목록."""
    rss = board_url.split("?")[0].rstrip("/") + ".rss"
    try:
        data, ctype, _ = fetch(rss)
    except Exception:
        return []
    text = data.decode("utf-8", errors="ignore")
    out = []
    for item in re.findall(r"<item>(.*?)</item>", text, re.S)[:200]:
        link = re.search(r"<link>(.*?)</link>", item)
        img = re.search(r'<img[^>]+src="([^"]+)"', html.unescape(item))
        title = re.search(r"<title>(.*?)</title>", item, re.S)
        if img:
            src = re.sub(r"i\.pinimg\.com/\d+x/", "i.pinimg.com/736x/", img.group(1))
            try:
                out.append(add_from_url(src, page_url=link.group(1) if link else board_url, title=html.unescape(title.group(1)) if title else ""))
            except Exception:
                pass
    return out


# ---------- tagging worker ----------
def tag_worker():
    while True:
        sid = Q.get()
        try:
            with LOCK:  # read only while no one writes: a half-replaced file reads as empty and the item gets dropped
                it = library()["items"].get(sid)
            if not it or it.get("status") not in ("queued", "retry"):
                continue
            st = settings()
            STATUS["working"] = it["id"]
            data = (IMG / it["file"]).read_bytes()
            res = T.tag_with_fallback(data, court(), st["chain"], st["keys"], mode=st["mode"], size=int(st["size"]),
                                      on_retry=lambda m: STATUS.update(note=m))
            with LOCK:
                lib = library()
                it = lib["items"].get(sid)
                if not it:
                    continue
                if res.get("error"):
                    it.update(status="failed", error=str(res["error"])[:300])
                else:
                    it.update(status="tagged", fields=res["fields"], field=res["field"], tags=res["tags"], group_name=res["group_name"],
                              model=res.get("model"), tagged=time.strftime("%Y-%m-%d %H:%M:%S"), error=None,
                              tokens=[res.get("in_tokens"), res.get("out_tokens")], latency_ms=res.get("latency_ms"))
                    with_colors(it)
                save_library(lib)
        except Exception as e:
            STATUS["note"] = f"Error: {e}"
        finally:
            STATUS["working"] = ""
            STATUS["note"] = ""


def requeue(ids=None, statuses=("queued",)):
    with LOCK:
        lib = library()
        n = 0
        for it in lib["items"].values():
            if (ids and it["id"] in ids) or (not ids and it.get("status") in statuses):
                it["status"] = "queued"
                Q.put(it["id"])
                n += 1
        save_library(lib)
    return n


# ---------- HTTP ----------
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self):
        # 확장 프로그램(chrome-extension://)과 이 화면에서만 부르게 해요
        origin = self.headers.get("origin", "")
        if origin.startswith("chrome-extension://") or origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1"):
            self.send_header("access-control-allow-origin", origin)
            self.send_header("access-control-allow-headers", "content-type")
            self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")

    def send(self, obj, code=200, ctype="application/json; charset=utf-8"):
        body = obj if isinstance(obj, (bytes, bytearray)) else json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def allowed(self):
        origin = self.headers.get("origin", "")
        return not origin or origin.startswith(("chrome-extension://", "http://localhost", "http://127.0.0.1"))

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        p = u.path
        if p in ("/", "/index.html"):
            return self.send((HERE / "ui" / "index.html").read_bytes(), ctype="text/html; charset=utf-8")
        if p.startswith("/ui/"):
            f = (HERE / p.lstrip("/")).resolve()
            if (HERE / "ui") in f.parents and f.exists():
                return self.send(f.read_bytes(), ctype=mimetypes.guess_type(str(f))[0] or "application/octet-stream")
        if p.startswith("/img/"):
            f = (IMG / Path(p[5:]).name)
            if f.exists():
                return self.send(f.read_bytes(), ctype=mimetypes.guess_type(str(f))[0] or "image/jpeg")
            return self.send({"error": "not found"}, 404)
        if p == "/api/ping":
            return self.send({"ok": True, "app": "axia", "version": "0.1"})
        if p == "/api/library":
            lib = library()
            items = sorted(lib["items"].values(), key=lambda x: x["added"], reverse=True)
            return self.send({"items": items, "queue": Q.qsize(), "status": STATUS, "fields": list(court().get("fields", {}))})
        if p == "/api/cropped":  # 확장 프로그램: 잘린 인스타 이미지 목록
            return self.send({"items": cropped_instagram()})
        if p == "/api/settings":
            st = settings()
            st["keys"] = {k: bool(v) for k, v in st["keys"].items()}
            return self.send(st)
        return self.send({"error": "not found"}, 404)

    def do_POST(self):
        if not self.allowed():
            return self.send({"error": "forbidden"}, 403)
        u = urllib.parse.urlparse(self.path)
        p = u.path
        n = int(self.headers.get("content-length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            if p == "/api/upload":  # 파일 끌어다 놓기 (본문 = 이미지 바이트)
                q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
                it, new = add_image(raw, title=q.get("name", ""), source="file")
                return self.send({"ok": True, "new": new, "id": it["id"]})
            data = json.loads(raw or b"{}")
            if p == "/api/add":  # 확장 프로그램에서 한 장
                it, new = add_from_url(data["image_url"], data.get("page_url", ""), data.get("title", ""), data.get("source", ""))
                return self.send({"ok": True, "new": new, "id": it["id"]})
            if p == "/api/add_batch":  # 확장 프로그램에서 여러 장 (보드 전체 등)
                ok = new = 0
                errs = []
                for x in data.get("items", [])[:1000]:
                    try:
                        it, isnew = add_from_url(x["image_url"], x.get("page_url", ""), x.get("title", ""), x.get("source", ""))
                        ok += 1
                        new += isnew
                    except Exception as e:
                        errs.append(str(e)[:80])
                return self.send({"ok": True, "added": ok, "new": new, "failed": len(errs), "errors": errs[:5]})
            if p == "/api/add_link":
                res = add_from_link(data["url"])
                return self.send({"ok": True, "added": len(res), "new": sum(1 for _, n in res if n)})
            if p == "/api/import_json":  # 인스타 수집 확장(v0.2)에서 내보낸 JSON
                items = data.get("items", data)
                items = list(items.values()) if isinstance(items, dict) else items
                ok = new = fail = 0
                for x in items:
                    try:
                        url = x.get("thumbUrl") or x.get("thumb") or x.get("image_url")
                        page = x.get("url") or (f"https://www.instagram.com/p/{x['shortcode']}/" if x.get("shortcode") else "")
                        it, isnew = add_from_url(url, page, x.get("caption", "")[:120] if isinstance(x.get("caption"), str) else "", "instagram")
                        ok += 1
                        new += isnew
                    except Exception:
                        fail += 1
                return self.send({"ok": True, "added": ok, "new": new, "failed": fail})
            if p == "/api/settings":
                st = jload(SETTINGS, {})
                for k in ("chain", "mode", "size", "auto_tag"):
                    if k in data:
                        st[k] = data[k]
                if "keys" in data:
                    keys = st.get("keys", {})
                    for prov, v in data["keys"].items():
                        if v == "":
                            keys.pop(prov, None)
                        elif v:
                            keys[prov] = v.strip()
                    st["keys"] = keys
                jsave(SETTINGS, st)
                requeued = requeue(statuses=("failed",)) if any(data.get("keys", {}).values()) else 0
                return self.send({"ok": True, "requeued": requeued})
            if p == "/api/replace":  # 확장 프로그램: 게시물 원본 이미지로 교체
                replace_image(data["id"], data["image_url"])
                return self.send({"ok": True})
            if p == "/api/retag":
                return self.send({"ok": True, "queued": requeue(ids=data.get("ids"), statuses=tuple(data.get("statuses", ["failed"])))})
            if p == "/api/item":
                with LOCK:
                    lib = library()
                    it = lib["items"].get(data["id"])
                    if not it:
                        return self.send({"error": "No such item"}, 404)
                    if data.get("delete"):
                        (IMG / it["file"]).unlink(missing_ok=True)
                        del lib["items"][data["id"]]
                    else:
                        for k in ("user_tags", "group_name"):
                            if k in data:
                                it[k] = data[k]
                        if "fields" in data:  # 분야 여러 개; field는 첫 번째 (예전 화면·데이터 호환)
                            it["fields"] = [f for f in data["fields"] if f][:3]
                            it["field"] = it["fields"][0] if it["fields"] else None
                    save_library(lib)
                return self.send({"ok": True})
        except Exception as e:
            return self.send({"error": str(e)[:300]}, 400)
        return self.send({"error": "not found"}, 404)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8770)
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()
    IMG.mkdir(parents=True, exist_ok=True)
    court()
    for _ in range(2):
        threading.Thread(target=tag_worker, daemon=True).start()
    requeue(statuses=("queued",))
    threading.Thread(target=backfill_colors, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), H)
    url = f"http://localhost:{a.port}"
    print(f"Axia 실행 중 → {url}\n보관 위치: {DATA}\n이 창을 닫으면 Axia가 꺼져요 (Chrome 확장 '보내기'도 이 창이 켜져 있어야 돼요)")
    if not a.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n종료했어요.")


if __name__ == "__main__":
    main()
