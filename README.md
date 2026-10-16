# Roosevelt Island Chess Club — Site Archive

Offline copy of https://rooseveltislandchessclub.com/ (WordPress.com, theme by WordPress), captured **2026-10-15**, as source material for the website revamp.

## What's here

> `content/` and `offline-site/` are kept out of this public repo (see `.gitignore`). They live only on the local machine; run the scripts in `tools/` to rebuild them.

| Folder | Contents |
|---|---|
| `offline-site/` | Browsable copy of the live site: 24 HTML pages plus all CSS, JS, fonts and images, with links rewritten to work locally. |
| `content/pages/`, `content/posts/` | Text of every page (9) and blog post (7) as Markdown, with title, URL, dates and image lists. |
| `content/media/` | The full media library at **original resolution**: 297 files (271 JPG, 12 PNG, 1 WebP, 13 videos), ~195 MB. |
| `content/media-index.csv` | One row per media file: title, alt text, size, upload date, original URL. |
| `content/json/` | Raw WordPress API data (pages, posts, media, categories, site info), in case we want to import it directly. |
| `tools/` | The scripts that made this copy. Re-run them to refresh it. |

### Viewing the offline site

Opening `offline-site/index.html` by double-clicking mostly works, but some browsers block local fonts and scripts. For a faithful view, serve it:

```bash
python -m http.server 8765 --directory offline-site
```

Then open http://localhost:8765.

### Refreshing the copy

```bash
python tools/mirror.py offline-site
```

```bash
python tools/export_content.py content
```

## Content inventory

**Navigation:** Home · About Us (→ Contact Us, Meet Our Coaches) · CLASSES · Summer Camp

| Page | URL | What's on it |
|---|---|---|
| Home | `/` | Hero "Unlock Your Child's Chess Potential", photo sliders, latest posts |
| About Us | `/about-us/` | Short story paragraph + mission: *"To build strategic minds through the game of chess."* |
| Contact Us | `/contact-us/` | Phone +1 (917) 617-8548, richessnyc@gmail.com, 524 Main St, New York, NY 10044, contact form |
| Meet Our Coaches | `/meet-our-coaches/` | USNM Michael Ocido, GM Kazybek Nogerbek, FM Ellan Asuela, Leo Romitman (photo + bio each) |
| Classes | `/classes/` | Links to the three class pages below |
| Online Group Classes | `/online-classes/` | **Empty: no content on the live site** |
| In-Person Group Class | `/group-classes/` | Sunday semester (10 classes), Beginners 0–500, $350/semester, what's included |
| Chess Classes | `/private-classes/` | Curriculum, $30 trial class, $175 monthly tuition, Mon–Fri 4:30 and 5:45 PM |
| Columbus Day Workshop | `/camps/` | Oct 12, 2026 workshop: schedule, half/full-day options, early-bird pricing |

**Blog posts:** Welcome (default WordPress text) · Club intro (Oct 2025) · Meet Up (Oct 2025) · First Blitz Tournament (Oct 2025) · Meet Our Coaches (Nov 2025) · "Gymnasium of the mind" photo gallery (Mar 2026) · Play against the Robot (Apr 2026)

**Footer:** "Quote of the week", About blurb, Facebook / Instagram / YouTube links.

## Content issues to fix in the revamp

- **Online Group Classes** page has no content.
- **Two different emails** are used: `richessnyc@gmail.com` (Contact) and `rooseveltislandchessclub@gmail.com` (Group Classes).
- **In-Person Group Class** copy says "online chess classes".
- **Chess Classes** page says "Semester Tuition — $175 Monthly Tuition", which is contradictory. The URL slug is `private-classes`, but the content describes group classes.
- **Leo Romitman's bio** is copied from Michael's and still says "Michael focuses on…".
- Typos in GM Kazybek's bio: "Nogerber", "Kazakhtan".
- Menu says **"Summer Camp"**, but the page is the **Columbus Day Workshop**, and that date (Oct 12, 2026) has passed.
- **"Welcome to WordPress!"** placeholder post is still published.
- Site timezone is set to **Asia/Manila**, not New York. Post dates may be off.
- **None of the 297 images has alt text** (see `media-index.csv`), and many photos are uploaded as duplicates (`-1`, `-2` suffixes).
