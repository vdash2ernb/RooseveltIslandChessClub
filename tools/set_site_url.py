"""Point the page's canonical and share tags at a new site address.

Usage (from the project root):
  python tools/set_site_url.py https://rooseveltislandchessclub.com/
"""
import re
import sys

url = sys.argv[1].rstrip('/') + '/'
path = 'site/index.html'
html = open(path, encoding='utf-8').read()
tags = re.compile(r'(<link rel="canonical" href="|<meta property="og:url" content="|<meta property="og:image" content=")https://[^"]+?/(assets/img/og-image\.jpg)?"')
html, n = tags.subn(lambda m: f'{m.group(1)}{url}{m.group(2) or ""}"', html)
if n != 3:
    sys.exit(f'Expected 3 tags, updated {n}. Nothing written.')
open(path, 'w', encoding='utf-8').write(html)
print(f'Updated canonical, og:url and og:image to {url}')
