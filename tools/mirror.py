"""Offline mirror of rooseveltislandchessclub.com.

Crawls every same-site HTML page, downloads the CSS/JS/images/fonts they use
(including WordPress.com CDN hosts), and rewrites links to relative local paths
so the copy in ../offline-site opens straight from disk.
"""
import hashlib
import html
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import deque

SITE = "rooseveltislandchessclub.com"
ROOT = f"https://{SITE}/"
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "offline-site")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"

ASSET_HOSTS = re.compile(r"(^|\.)(" + re.escape(SITE) + r"|wp\.com|wordpress\.com|gstatic\.com|googleapis\.com|gravatar\.com|videopress\.com)$")
SKIP_PAGE = re.compile(r"/(wp-admin|wp-login|wp-json|xmlrpc|feed|comments/feed|wp-content|wp-includes|_static)\b|[?&](replytocom|share|like_comment|nb)=|\.(xml|xsl|php)$")
ASSET_EXT = re.compile(r"\.(css|js|mjs|png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|json)$", re.I)

pages = {}      # page url -> local rel path
assets = {}     # asset url -> local rel path (None if failed)
failed = []


def fetch(url):
    # curl rather than urllib: the WordPress.com image CDN 404s Python's client.
    import subprocess, tempfile
    for attempt in range(3):
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            body = tmp.name
        try:
            out = subprocess.run(
                ["curl", "-sL", "--max-time", "90", "-A", UA, "-o", body,
                 "-w", "%{http_code}\t%{content_type}\t%{url_effective}", url],
                capture_output=True, text=True).stdout
            code, ctype, final = (out.split("\t") + ["", "", url])[:3]
            if code == "200":
                with open(body, "rb") as f:
                    return f.read(), ctype, final
            if code in ("403", "404", "410"):
                break
        finally:
            os.unlink(body)
        time.sleep(1 + attempt)
    failed.append(url)
    return None, "", url


def norm(url, base):
    url = html.unescape(url.strip())
    if not url or url.startswith(("data:", "mailto:", "tel:", "javascript:", "#", "about:", "blob:")):
        return None
    url = urllib.parse.urljoin(base, url)
    p = urllib.parse.urlsplit(url)
    if p.scheme not in ("http", "https"):
        return None
    return urllib.parse.urlunsplit(("https", p.netloc.lower(), p.path or "/", p.query, ""))


def is_page(url):
    p = urllib.parse.urlsplit(url)
    if p.netloc not in (SITE, "www." + SITE):
        return False
    if SKIP_PAGE.search(p.path + ("?" + p.query if p.query else "")):
        return False
    return not ASSET_EXT.search(p.path)


def page_path(url):
    p = urllib.parse.urlsplit(url)
    path = p.path.strip("/")
    if p.query:
        path = (path + "/" if path else "") + "q-" + re.sub(r"[^A-Za-z0-9]+", "-", p.query).strip("-")
    return (path + "/index.html") if path else "index.html"


def asset_path(url, ctype=""):
    p = urllib.parse.urlsplit(url)
    path = urllib.parse.unquote(p.path).lstrip("/") or "index"
    path = re.sub(r'[<>:"|?*\\]', "_", path)
    root, ext = os.path.splitext(path)
    if not ext:
        guess = {"text/css": ".css", "javascript": ".js", "image/png": ".png", "image/jpeg": ".jpg",
                 "image/svg": ".svg", "image/webp": ".webp", "image/gif": ".gif", "font/woff2": ".woff2"}
        ext = next((v for k, v in guess.items() if k in ctype), "")
    if p.query:
        root += "_" + hashlib.md5(p.query.encode()).hexdigest()[:8]
    return "assets/" + p.netloc + "/" + root + ext


def rel(from_file, to_file):
    return os.path.relpath(to_file, os.path.dirname(from_file) or ".").replace(os.sep, "/")


def save(local, data):
    full = os.path.join(OUT, local)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f:
        f.write(data)


CSS_URL = re.compile(r"""url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3""")


def get_asset(url):
    if url in assets:
        return assets[url]
    host = urllib.parse.urlsplit(url).netloc
    path = urllib.parse.urlsplit(url).path
    same_site = host in (SITE, "www." + SITE)
    if (not ASSET_HOSTS.search(host) or host.startswith(("stats.", "public-api.", "widgets.", "jetpack.", "subscribe."))
            or path.endswith("/") or (same_site and not ASSET_EXT.search(path))):
        assets[url] = None
        return None
    assets[url] = None  # guard against recursion
    data, ctype, _ = fetch(url)
    if data is None:
        return None
    local = asset_path(url, ctype)
    assets[url] = local
    if local.endswith(".css") or "text/css" in ctype:
        text = data.decode("utf-8", "replace")
        text = rewrite_css(text, url, local)
        data = text.encode("utf-8")
    save(local, data)
    return local


def rewrite_css(text, base, local):
    def sub(m):
        raw = m.group(2) or m.group(4)
        u = norm(raw, base)
        if not u:
            return m.group(0)
        tgt = get_asset(u)
        if not tgt:
            return m.group(0)
        r = rel(local, tgt)
        return f'url("{r}")' if m.group(2) else f'@import "{r}"'
    return CSS_URL.sub(sub, text)


ATTR = re.compile(r"""\b(href|src|data-src|data-orig-file|data-medium-file|data-large-file|data-lazy-src|poster|action)\s*=\s*(["'])(.*?)\2""", re.I | re.S)
SRCSET = re.compile(r"""\b(srcset|data-srcset|imagesrcset)\s*=\s*(["'])(.*?)\2""", re.I | re.S)
STYLE_BLOCK = re.compile(r"(<style[^>]*>)(.*?)(</style>)", re.I | re.S)
STYLE_ATTR = re.compile(r"""\bstyle\s*=\s*(["'])(.*?)\1""", re.I | re.S)


def resolve(url, base, local, queue):
    u = norm(url, base)
    if not u:
        return None
    if is_page(u):
        u = u.replace("://www.", "://")
        if u not in pages:
            pages[u] = page_path(u)
            queue.append(u)
        target = pages[u]
        r = rel(local, target)
        frag = urllib.parse.urlsplit(html.unescape(url)).fragment
        return r + ("#" + frag if frag else "")
    tgt = get_asset(u)
    return rel(local, tgt) if tgt else None


def rewrite_html(text, base, local, queue):
    def attr(m):
        name, q, val = m.groups()
        if name.lower() == "action":
            return m.group(0)
        new = resolve(val, base, local, queue)
        return f"{name}={q}{new}{q}" if new else m.group(0)

    def srcset(m):
        name, q, val = m.groups()
        parts = []
        for item in val.split(","):
            bits = item.strip().split()
            if not bits:
                continue
            new = resolve(bits[0], base, local, queue)
            parts.append(" ".join([new or bits[0]] + bits[1:]))
        return f"{name}={q}{', '.join(parts)}{q}"

    def style_block(m):
        return m.group(1) + rewrite_css(m.group(2), base, local) + m.group(3)

    def style_attr(m):
        return f"style={m.group(1)}{rewrite_css(m.group(2), base, local)}{m.group(1)}"

    text = STYLE_BLOCK.sub(style_block, text)
    text = STYLE_ATTR.sub(style_attr, text)
    text = SRCSET.sub(srcset, text)
    text = ATTR.sub(attr, text)
    return text


def seeds():
    urls = [ROOT]
    data, _, _ = fetch(ROOT + "sitemap-1.xml")
    if data:
        urls += re.findall(r"<loc>(.*?)</loc>", data.decode("utf-8", "replace"))
    import json
    for kind in ("pages", "posts", "categories", "tags"):
        data, _, _ = fetch(f"{ROOT}wp-json/wp/v2/{kind}?per_page=100&_fields=link")
        if data:
            urls += [x["link"] for x in json.loads(data)]
    return urls


def main():
    queue = deque()
    for s in seeds():
        u = norm(s, ROOT)
        if u and is_page(u) and u not in pages:
            pages[u] = page_path(u)
            queue.append(u)
    done = 0
    while queue and done < 500:
        url = queue.popleft()
        data, ctype, final = fetch(url)
        if data is None or "html" not in ctype:
            continue
        local = pages[url]
        text = data.decode("utf-8", "replace")
        text = rewrite_html(text, final, local, queue)
        save(local, text.encode("utf-8"))
        done += 1
        print(f"[{done}] {url} -> {local}  (queue {len(queue)}, assets {len(assets)})", flush=True)
    ok = sum(1 for v in assets.values() if v)
    print(f"\nPages: {done}  Assets: {ok}  Failed: {len(failed)}")
    with open(os.path.join(OUT, "_mirror-log.txt"), "w", encoding="utf-8") as f:
        f.write("PAGES\n" + "\n".join(f"{u} -> {p}" for u, p in pages.items()))
        f.write("\n\nFAILED\n" + "\n".join(failed))


if __name__ == "__main__":
    main()
