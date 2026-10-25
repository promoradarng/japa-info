# Japa Info · Japa Wise

Daily visa news and legal relocation guides for Nigerians. Live at https://japainfong.com

## How the site is built
Edit the sources, then run `python3 build.py`. It regenerates every page.

- `data/news.json` — news stories (each gets its own page at /news/<id>/). The latest story (newest date; for the same date, the one listed first) is always the top story, so add new stories at the top of the list
- `content/*.html` — guide pages and About / Contact / Privacy / Disclaimer
- `assets/site.css`, `assets/calc.js` — styles and the funds calculator
- `assets/ask.js` — the "Ask Japa Info" chat button on every page; it talks to the Cloudflare Worker in `worker/ask-japa.js` (deployed at https://ask.japainfong.com)
- `images/` — story photos (a story can use `"image": "images/x.jpg"`, with `"alt"` and `"credit"`); see "Photos and social media embeds" below

Generated files (don't edit by hand): `index.html`, `news/`, the guide folders, `404.html`, `sitemap.xml`, `robots.txt`.
Never remove `CNAME`.

## Photos and social media embeds

Every news story should have a picture where possible. Use the first of these that exists, and never copy a photo from a newspaper, blog or someone else's social media post into `images/`:

1. **The owner's own photo.** Never replace or remove one.
2. **Social media embed**: when a story is about a public post by an official account (an embassy, a High Commission, the Home Office, IRCC, USCIS, DHS/ICE, the Nigeria Immigration Service, NiDCOM, a minister) on X/Twitter, Instagram, TikTok, YouTube or Facebook, set `"embed"` to the URL of that original post (e.g. `https://x.com/USinNigeria/status/123`). The story page shows the real post via the platform's own embed. Only use a public post on the organisation's or person's own account.
3. **Official photo**: photos published by governments under a free licence, e.g. US federal government photos (public domain) and UK government images under the Open Government Licence.
4. **Stand-in (stock) photo**: when nothing above exists, a free generic photo that fits the story (a passport of the right country, an airport, a plane, a lecture hall, an embassy building, a courtroom). Search Openverse, which needs no key:
   `curl -A "JapaInfo/1.0" "https://api.openverse.org/v1/images/?q=<subject>&license_type=commercial&page_size=10"`
   Use only results whose `license` is `cc0`, `pdm`, `by` or `by-sa`. If the original download fails (e.g. HTTP 429), download the result's `thumbnail` URL instead.

Never use a photo that shows an identifiable person who could be mistaken for someone arrested, deported or accused in the story; for arrest and deportation stories, use a passport, airport, plane or building instead. View every downloaded image before using it. Save as `images/<id>.jpg`, about 800px wide, JPEG under ~80 KB, and set `"alt"` (plain description) and `"credit"` (e.g. `"Stock image: <creator> / Flickr, CC BY 2.0"` or `"Photo: <creator> / <source>, <licence>"`).
