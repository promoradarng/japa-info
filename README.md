# Japa Info · Japa Wise

Daily visa news and legal relocation guides for Nigerians. Live at https://japainfong.com

## How the site is built
Edit the sources, then run `python3 build.py`. It regenerates every page.

- `data/news.json` — news stories (each gets its own page at /news/<id>/)
- `content/*.html` — guide pages and About / Contact / Privacy / Disclaimer
- `assets/site.css`, `assets/calc.js` — styles and the funds calculator
- `assets/ask.js` — the "Ask Japa Info" chat button on every page; it talks to the Cloudflare Worker in `worker/ask-japa.js` (deployed at https://ask.japainfong.com)
- `images/` — photos the owner supplied (a story can use `"image": "images/x.jpg"`)

Generated files (don't edit by hand): `index.html`, `news/`, the guide folders, `404.html`, `sitemap.xml`, `robots.txt`.
Never remove `CNAME`.
