# Launch checklist: moving rooseveltislandchessclub.com to Cloudflare

The new site is plain files in `site/`. Today it runs on GitHub Pages at
https://vdash2ernb.github.io/RooseveltIslandChessClub/. The steps below put it on Cloudflare Pages
and point the club's domain at it, with no downtime: WordPress keeps serving the old site until the
final nameserver switch.

## What we found (checked 2026-10-16)

| | |
|---|---|
| Registrar | Automattic (WordPress.com) |
| Registered | 2025-11-14 |
| **Expires** | **2026-11-14** (about four weeks away) |
| Nameservers | ns1/ns2/ns3.wordpress.com |
| Website | A records 192.0.78.184 and 192.0.78.222 (WordPress) |
| www | CNAME to the main domain |
| Email | No MX records. The club uses Gmail addresses, so moving DNS does not affect email. |
| Other | One SPF record for WordPress's mail service (`v=spf1 include:_spf.wpcloud.com ~all`). It can be removed after the move. |

## 0. Before anything else: secure the domain renewal

The domain expires on **November 14, 2026**. In WordPress.com, go to **Upgrades → Domains →
rooseveltislandchessclub.com** and make sure **auto-renew is on** with a valid card, or renew it now.
If the domain lapses, the site goes offline no matter where it is hosted.

## 1. Create the Cloudflare Pages project

1. Create a free Cloudflare account (or sign in) at dash.cloudflare.com.
2. **Workers & Pages → Create → Pages → Connect to Git**, and authorise GitHub.
3. Pick the repository **vdash2ernb/RooseveltIslandChessClub**.
4. Build settings:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `sh tools/check_scripts.sh` (stops a deploy if any script has a syntax error)
   - Build output directory: `site`
5. **Save and Deploy.** Cloudflare gives the site a `*.pages.dev` address.
6. Open that address and check: the story plays, the puzzle works, and an old address such as
   `/meet-our-coaches/` jumps to the Coaches section (that comes from `site/_redirects`).

From now on, every push to `main` deploys to Cloudflare automatically.

## 2. Add the domain to Cloudflare

1. In the Cloudflare dashboard: **Add a domain** → `rooseveltislandchessclub.com` → **Free** plan.
2. Cloudflare copies the current DNS records. Leave them for now.
3. Note the **two Cloudflare nameservers** it shows (for example `xxx.ns.cloudflare.com`).

## 3. Connect the domain to the Pages project

1. **Workers & Pages → the project → Custom domains → Set up a custom domain** →
   `rooseveltislandchessclub.com`. Cloudflare replaces the old WordPress A records with the right record.
2. Repeat for `www.rooseveltislandchessclub.com`.
3. Send `www` to the main domain: **Rules → Redirect Rules → Create rule → template
   "Redirect from WWW to root"** → Deploy.
4. In **DNS → Records**, delete any leftover A records pointing to `192.0.78.184` or `192.0.78.222`.

## 4. Switch the nameservers (the moment of launch)

1. In WordPress.com: **Upgrades → Domains → rooseveltislandchessclub.com → Name servers**.
2. Turn off "Use WordPress.com name servers" and enter the **two Cloudflare nameservers**. Save.
3. Cloudflare emails when the domain is active. This usually takes under an hour and can take up to 24.
   During that time visitors see either the old or the new site, never an error.

## 5. Point the share tags at the real domain

From the project folder:

```bash
python tools/set_site_url.py https://rooseveltislandchessclub.com/
```

Then commit and push. Cloudflare redeploys in about a minute.

## 6. Check the live site

- https://rooseveltislandchessclub.com loads with the padlock (HTTPS).
- https://www.rooseveltislandchessclub.com goes to the main domain.
- Old WordPress addresses such as `/contact-us/` and `/classes/` land on the matching section.
- Pasting the address into Facebook or Messenger shows the share image (check with
  https://developers.facebook.com/tools/debug/ and press "Scrape Again").
- On a phone: the story plays smoothly and the puzzle works by touch.

## 7. After launch

- **GitHub Pages:** turn it off so search engines see only one copy: repository **Settings → Pages →
  Unpublish site**, and delete `.github/workflows/pages.yml`.
- **WordPress.com plan:** keep it until the domain question is settled. Cancelling a plan can affect a
  domain that came free with it.
- **Optional, cheaper renewals:** transfer the domain registration to Cloudflare Registrar (renews at
  cost, about $10 a year). In WordPress.com unlock the domain and get the transfer code, then in
  Cloudflare go to **Domain Registration → Transfer Domains**. A transfer adds a year to the expiry date.
- Remove the old WordPress SPF record in Cloudflare DNS if the domain is not used for sending email.

## Content still to confirm

See `CONTENT-TODO.md`: email address, weekly class pricing, the next Sunday semester date, online
classes, Leo Romitman's bio, the next workshop, and parental consent for the photos of children.
