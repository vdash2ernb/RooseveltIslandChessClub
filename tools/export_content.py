"""Export rooseveltislandchessclub.com content via the WordPress REST API.

Writes to ../content:
  json/      raw API responses (pages, posts, media, categories, tags, menus, site info)
  pages/     one Markdown file per page (front matter + cleaned text + image list)
  posts/     one Markdown file per blog post
  media/     every file in the media library at original resolution
  media-index.csv
"""
import csv
import html
import json
import os
import re
import subprocess
import sys

ROOT = "https://rooseveltislandchessclub.com"
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "content")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"


def curl(url, dest=None):
    args = ["curl", "-sL", "--max-time", "120", "-A", UA, "-w", "\n%{http_code}"]
    if dest:
        args[-2:-2] = []
        r = subprocess.run(["curl", "-sL", "--max-time", "120", "-A", UA, "-o", dest, "-w", "%{http_code}", url],
                           capture_output=True, text=True)
        return r.stdout.strip() == "200"
    r = subprocess.run(args + [url], capture_output=True)
    body, _, code = r.stdout.rpartition(b"\n")
    return body if code.strip() == b"200" else None


def api_all(kind, extra=""):
    items, page = [], 1
    while True:
        body = curl(f"{ROOT}/wp-json/wp/v2/{kind}?per_page=100&page={page}{extra}")
        if not body:
            break
        batch = json.loads(body)
        if not batch:
            break
        items += batch
        if len(batch) < 100:
            break
        page += 1
    return items


def write_json(name, data):
    path = os.path.join(OUT, "json", name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def html_to_md(src):
    """Lightweight HTML -> Markdown good enough for content reference."""
    s = re.sub(r"<!--.*?-->", "", src, flags=re.S)
    s = re.sub(r"<(script|style|svg|form)[^>]*>.*?</\1>", "", s, flags=re.S | re.I)
    for n in range(1, 7):
        s = re.sub(rf"<h{n}[^>]*>(.*?)</h{n}>", lambda m, n=n: f"\n\n{'#' * n} {m.group(1).strip()}\n\n", s, flags=re.S | re.I)
    s = re.sub(r"<img[^>]*?\balt=\"([^\"]*)\"[^>]*?\bsrc=\"([^\"]+)\"[^>]*>", r"\n![\1](\2)\n", s, flags=re.I)
    s = re.sub(r"<img[^>]*?\bsrc=\"([^\"]+)\"[^>]*>", r"\n![](\1)\n", s, flags=re.I)
    s = re.sub(r"<a[^>]*?\bhref=\"([^\"]+)\"[^>]*>(.*?)</a>", lambda m: f"[{re.sub('<[^>]+>', '', m.group(2)).strip()}]({m.group(1)})", s, flags=re.S | re.I)
    s = re.sub(r"<(strong|b)>(.*?)</\1>", r"**\2**", s, flags=re.S | re.I)
    s = re.sub(r"<(em|i)>(.*?)</\1>", r"*\2*", s, flags=re.S | re.I)
    s = re.sub(r"<li[^>]*>", "\n- ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(p|div|figure|ul|ol|section|blockquote|tr)>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def write_md(folder, item, media_by_id, cats):
    title = html.unescape(item["title"]["rendered"])
    content = item["content"]["rendered"]
    images = sorted(set(re.findall(r"https?://[^\"'\s)]+/wp-content/uploads/[^\"'\s)?]+", content)))
    fm = {
        "title": title,
        "slug": item["slug"],
        "url": item["link"],
        "date": item.get("date"),
        "modified": item.get("modified"),
    }
    if item.get("categories"):
        fm["categories"] = [cats.get(c, c) for c in item["categories"]]
    if item.get("featured_media") and item["featured_media"] in media_by_id:
        fm["featured_image"] = media_by_id[item["featured_media"]]["source_url"]
    lines = ["---"] + [f"{k}: {json.dumps(v, ensure_ascii=False)}" for k, v in fm.items()] + ["---", "", f"# {title}", ""]
    excerpt = html_to_md(item.get("excerpt", {}).get("rendered", ""))
    if folder == "posts" and excerpt:
        lines += [f"> {excerpt}", ""]
    lines += [html_to_md(content), ""]
    if images:
        lines += ["", "## Images used", ""] + [f"- {u}" for u in images]
    path = os.path.join(OUT, folder, f"{item['slug']}.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    pages = api_all("pages", "&context=view")
    posts = api_all("posts", "&context=view")
    media = api_all("media")
    cats = api_all("categories")
    tags = api_all("tags")
    for name, data in [("pages", pages), ("posts", posts), ("media", media), ("categories", cats), ("tags", tags)]:
        write_json(f"{name}.json", data)
        print(f"{name}: {len(data)}")
    site = curl(f"{ROOT}/wp-json/")
    if site:
        info = json.loads(site)
        write_json("site.json", {k: info.get(k) for k in ("name", "description", "url", "home", "gmt_offset", "timezone_string", "site_logo", "site_icon", "site_icon_url")})
    for kind in ("menus", "menu-items", "navigation", "blocks", "template-parts"):
        body = curl(f"{ROOT}/wp-json/wp/v2/{kind}?per_page=100")
        if body:
            write_json(f"{kind}.json", json.loads(body))

    media_by_id = {m["id"]: m for m in media}
    cat_names = {c["id"]: html.unescape(c["name"]) for c in cats}
    for p in pages:
        write_md("pages", p, media_by_id, cat_names)
    for p in posts:
        write_md("posts", p, media_by_id, cat_names)

    mdir = os.path.join(OUT, "media")
    rows, fails = [], []
    for m in media:
        url = m["source_url"]
        if "/wp-content/uploads/" in url:
            rel = re.sub(r"^.*/wp-content/uploads/", "", url.split("?")[0])
        else:  # e.g. VideoPress files hosted elsewhere
            rel = "external/" + re.sub(r"^https?://", "", url.split("?")[0])
        rel = re.sub(r'[<>:"|?*\\]', "_", rel)
        dest = os.path.join(mdir, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest) and not curl(url, dest):
            fails.append(url)
            if os.path.exists(dest):
                os.unlink(dest)
            continue
        d = m.get("media_details") or {}
        rows.append({
            "id": m["id"], "file": "media/" + rel, "title": html.unescape(m["title"]["rendered"]),
            "alt": m.get("alt_text", ""), "caption": html_to_md(m.get("caption", {}).get("rendered", "")),
            "mime": m.get("mime_type"), "width": d.get("width"), "height": d.get("height"),
            "uploaded": m.get("date"), "attached_to_post": m.get("post"), "source_url": url,
        })
    with open(os.path.join(OUT, "media-index.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"media downloaded: {len(rows)}  failed: {len(fails)}")
    for u in fails:
        print("  FAIL", u)


if __name__ == "__main__":
    main()
