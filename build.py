#!/usr/bin/env python3
"""Build the Japa Info static site.

Sources (edit these):
  data/news.json      news stories
  content/*.html      guide page bodies (one <section> each)
  assets/site.css     styles   assets/calc.js  funds calculator

Run:  python3 build.py
It regenerates index.html, news/, every guide page, sitemap.xml and robots.txt.
"""
import html, json, os, re, shutil
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://japainfong.com"
NAME = "Japa Info"
TAGLINE = "Japa Wise"

COUNTRIES = {
    "UK": ("UK", "linear-gradient(135deg,#012169 0 40%,#c8102e 40% 60%,#012169 60%)"),
    "US": ("USA", "linear-gradient(180deg,#3c3b6e 0 45%,#b22234 45% 60%,#f5f5f5 60% 72%,#b22234 72%)"),
    "CA": ("Canada", "linear-gradient(90deg,#d52b1e 0 28%,#f5f5f5 28% 72%,#d52b1e 72%)"),
    "AU": ("Australia", "radial-gradient(circle at 75% 60%,#fff 0 6%,transparent 7%),#00247d"),
    "NZ": ("New Zealand", "radial-gradient(circle at 72% 40%,#cc142b 0 5%,transparent 6%),radial-gradient(circle at 80% 65%,#cc142b 0 5%,transparent 6%),#012169"),
    "IE": ("Ireland", "linear-gradient(90deg,#169b62 0 33%,#f5f5f5 33% 66%,#ff883e 66%)"),
    "FR": ("France", "linear-gradient(90deg,#002395 0 33%,#f5f5f5 33% 66%,#ed2939 66%)"),
    "IT": ("Italy", "linear-gradient(90deg,#009246 0 33%,#f5f5f5 33% 66%,#ce2b37 66%)"),
    "DE": ("Germany", "linear-gradient(180deg,#111 0 33%,#dd0000 33% 66%,#ffce00 66%)"),
    "EU": ("Europe", "radial-gradient(circle at 50% 50%,transparent 0 22%,#ffcc00 23% 27%,transparent 28%),#003399"),
    "JP": ("Japan", "radial-gradient(circle at 50% 45%,#bc002d 0 22%,#f5f5f5 23%)"),
    "KR": ("Korea", "radial-gradient(circle at 50% 45%,#cd2e3a 0 14%,#0047a0 14% 22%,#f5f5f5 23%)"),
    "NG": ("Nigeria", "linear-gradient(90deg,#008751 0 33%,#f5f5f5 33% 66%,#008751 66%)"),
}
TOPIC_CLASS = {"Rule change": "k-blue", "Students": "k-purple", "Visa denial": "k-red",
               "Fraud": "k-red", "Deportation": "k-red", "Timing": "k-green"}

# Guide pages: slug -> (content file, nav label, title, description)
GUIDES = [
    ("visa-routes", "routes", "Visa routes", "Visa routes for Nigerians: UK, Canada, Germany",
     "Which visa route fits you? Current UK student, graduate and skilled worker rules, Canada study and Express Entry, and Germany's Opportunity Card for Nigerians."),
    ("study-abroad", "schools", "Study abroad", "Affordable universities and study routes for Nigerians",
     "Lower-cost UK universities with 2026/27 fees, tuition-free Germany, Canada, Ireland, France, Italy, New Zealand, Korea and Japan options for Nigerian students."),
    ("funds-calculator", "calc", "Funds calculator", "Proof of funds calculator in naira",
     "Work out how much naira you need to show for a UK, Canada, Germany, Ireland or New Zealand visa, using today's exchange rate."),
    ("costs", "costs", "Costs", "Passport and visa costs for Nigerians",
     "Current Nigerian passport fees at home and abroad, plus UK and Germany visa fees."),
    ("when-to-apply", "timing", "When to apply", "Best time to apply for a visa from Nigeria",
     "The best time to apply for UK, Schengen, Canada, US, Australia, Japan, Korea and New Zealand student and visitor visas from Nigeria."),
    ("overstaying", "overstay", "Overstaying", "What happens if you overstay your visa",
     "Re-entry bans and penalties for overstaying in the UK, USA, Canada and Schengen countries, explained for Nigerians."),
    ("visa-scams", "scams", "Spot fake visas", "How to spot fake visa promises and japa scams",
     "Red flags of visa scams targeting Nigerians, and the official registers to check before you pay any agent, school or employer."),
]
PAGES = [  # slug, content file, title, description
    ("about", "about", "About Japa Info", "Who runs Japa Info, how we check facts, and what the site is for."),
    ("contact", "contact", "Contact Japa Info", "How to reach the Japa Info team with corrections, tips and partnership requests."),
    ("privacy", "privacy", "Privacy policy", "How Japa Info handles visitor data, cookies and advertising."),
    ("disclaimer", "disclaimer", "Disclaimer", "Japa Info is an information site, not a law firm or visa agent."),
]
NAV = [("/", "Home"), ("/news/", "News")] + [("/%s/" % g[0], g[2]) for g in GUIDES]
TOPIC_GUIDES = {
    "Rule change": ["visa-routes", "when-to-apply"], "Students": ["study-abroad", "funds-calculator"],
    "Visa denial": ["funds-calculator", "visa-scams"], "Fraud": ["visa-scams", "visa-routes"],
    "Deportation": ["overstaying", "visa-routes"], "Timing": ["when-to-apply", "funds-calculator"],
}

e = lambda t: html.escape(str(t), quote=True)


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)


def fmt_date(d):
    y, m, dd = (int(x) for x in d.split("-"))
    return date(y, m, dd).strftime("%-d %b %Y")


def page(path, title, desc, body, current="", extra_head="", scripts=""):
    url = SITE + path
    full_title = title if title == NAME else "%s · %s" % (title, NAME)
    nav = "".join('<a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == current else "", e(l)) for h, l in NAV)
    guides = "".join('<a href="/%s/">%s</a>' % (g[0], e(g[2])) for g in GUIDES)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="{NAME}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="{'article' if path.startswith('/news/') and path != '/news/' else 'website'}">
<meta property="og:image" content="{SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Japa Info logo: visa news for Nigerians, japainfong.com">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{SITE}/assets/og-image.jpg">
<meta name="theme-color" content="#cf1126">
<link rel="icon" type="image/png" href="/assets/favicon-48.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@75..150,600..900&family=Familjen+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/assets/site.css">
{extra_head}</head>
<body>
<header class="masthead">
  <div class="wrap">
    <a class="brand" href="/"><span class="brand-name">Japa Info</span><span class="brand-tag">{TAGLINE}</span></a>
  </div>
</header>
<nav class="jump" aria-label="Site">
  <div class="wrap">{nav}</div>
</nav>
<main>
{body}
</main>
<footer>
  <div class="wrap">
    <div class="foot-links"><a href="/news/">News</a>{guides}</div>
    <div class="foot-links"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="/disclaimer/">Disclaimer</a></div>
    <span>Japa Info is an information site, not a law firm or visa agent. Always confirm requirements on the official immigration website of the country you are applying to before you pay anything.</span>
    <span>© {date.today().year} Japa Info · japainfong.com</span>
  </div>
</footer>
{scripts}<script src="/assets/ask.js" defer></script>
</body>
</html>
"""


def thumb(s, cls="thumb"):
    name, bg = COUNTRIES.get(s["country"], (s["country"], "var(--char)"))
    inner = ('<img class="ph" src="/%s" alt="" loading="lazy">' % e(s["image"].lstrip("/"))) if s.get("image") \
        else '<b>%s</b>' % e(name)
    style = "" if s.get("image") else ' style="background:%s"' % bg
    return '<div class="%s"%s aria-hidden="true">%s<i>%s</i></div>' % (cls, style, inner, e(s.get("topic", "")))


def story_card(s):
    name = COUNTRIES.get(s["country"], (s["country"],))[0]
    k = TOPIC_CLASS.get(s.get("topic"), "k-blue")
    return f"""<article class="story" data-country="{e(s['country'])}">
  <a class="story-link" href="/news/{e(s['id'])}/">{thumb(s)}</a>
  <div class="story-body">
    <h3><a href="/news/{e(s['id'])}/"><span class="kicker {k}">{e(s.get('kicker') or s.get('topic'))}</span>{e(s['headline'])}</a></h3>
    <p>{e(s['summary'])}</p>
    <div class="meta"><span>{e(name)} · {fmt_date(s['date'])}</span><a href="/news/{e(s['id'])}/">Read more</a></div>
  </div>
</article>"""


def main():
    news = json.loads(read("data/news.json"))
    stories = sorted(news["stories"], key=lambda s: s["date"], reverse=True)
    updated = news.get("updated", date.today().isoformat())
    lead = next((s for s in stories if s.get("lead")), stories[0] if stories else None)
    urls = [("/", updated)]

    # Remove old generated story folders
    if os.path.isdir(os.path.join(ROOT, "news")):
        shutil.rmtree(os.path.join(ROOT, "news"))

    # ---------- Home ----------
    lead_html = ""
    if lead:
        lead_html = f"""<div class="top">
  <div class="wrap">
    <span class="kicker">{e(lead.get('kicker') or lead.get('topic'))}</span>
    <h2><a href="/news/{e(lead['id'])}/">{e(lead['headline'])}</a></h2>
    <p>{e(lead['summary'])} <a href="/news/{e(lead['id'])}/">Read more</a></p>
  </div>
</div>"""
    latest = "".join(story_card(s) for s in stories[:6])
    guide_cards = "".join(f'<a class="guide" href="/{g[0]}/"><h3>{e(g[2])}</h3><p>{e(g[4])}</p></a>' for g in GUIDES)
    home_body = f"""<section class="hero">
  <div class="wrap">
    <h1>Japa news and visa guides for Nigerians</h1>
    <p>Straight talk on leaving Nigeria the legal way. Current visa rules, real costs in pounds, dollars and naira, and the scams wey dey wait for you.</p>
    <span class="updated">News updated · {fmt_date(updated)}</span>
  </div>
</section>
{lead_html}
<section id="news">
  <div class="wrap">
    <div><span class="kicker k-red">Japa news</span><h2>Wetin don change this week</h2></div>
    <div class="feed">{latest}</div>
    <a class="btn" href="/news/">See all japa news</a>
  </div>
</section>
<section>
  <div class="wrap">
    <div><span class="kicker k-blue">Guides</span><h2>Plan your japa</h2></div>
    <div class="guides">{guide_cards}</div>
  </div>
</section>"""
    write("index.html", page("/", NAME, "Daily visa news and legal japa routes for Nigerians: UK, USA, Canada, Australia, Europe, Japan and Korea rules, real costs in naira, and how to avoid visa scams.", home_body, "/"))

    # ---------- News index ----------
    seen, chips = [], ['<button type="button" class="chip" aria-pressed="true" data-c="all">All</button>']
    for s in stories:
        if s["country"] not in seen:
            seen.append(s["country"])
            chips.append('<button type="button" class="chip" aria-pressed="false" data-c="%s">%s</button>' % (e(s["country"]), e(COUNTRIES.get(s["country"], (s["country"],))[0])))
    news_body = f"""<section>
  <div class="wrap">
    <div><span class="kicker k-red">Japa news</span><h1>All japa news</h1></div>
    <p class="lede">Visa rule changes, refusals, fraud and deportation news for Nigerians at home and abroad. Updated every morning. Last update: {fmt_date(updated)}.</p>
    <div class="chips" role="group" aria-label="Filter by country">{''.join(chips)}</div>
    <div class="feed" id="feed">{''.join(story_card(s) for s in stories)}</div>
  </div>
</section>"""
    filt = """<script>
(function(){var c=document.querySelectorAll('.chip'),a=document.querySelectorAll('#feed .story');
c.forEach(function(b){b.addEventListener('click',function(){c.forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');var v=b.getAttribute('data-c');a.forEach(function(s){s.hidden=!(v==='all'||s.getAttribute('data-country')===v)})})})})();
</script>
"""
    write("news/index.html", page("/news/", "Japa news", "Daily visa and immigration news for Nigerians: rule changes, refusals, fraud alerts and deportations in the UK, US, Canada, Australia and Europe.", news_body, "/news/", scripts=filt))
    urls.append(("/news/", updated))

    # ---------- Story pages ----------
    gmap = {g[0]: g for g in GUIDES}
    for s in stories:
        name = COUNTRIES.get(s["country"], (s["country"],))[0]
        k = TOPIC_CLASS.get(s.get("topic"), "k-blue")
        related = [x for x in stories if x["id"] != s["id"] and x["country"] == s["country"]][:3]
        if len(related) < 3:
            related += [x for x in stories if x["id"] != s["id"] and x not in related][:3 - len(related)]
        rel = "".join(story_card(x) for x in related)
        g_links = "".join(f'<a class="guide" href="/{gmap[g][0]}/"><h3>{e(gmap[g][2])}</h3><p>{e(gmap[g][4])}</p></a>' for g in TOPIC_GUIDES.get(s.get("topic"), ["visa-routes", "visa-scams"]))
        src = f'<p class="source">Source: <a href="{e(s["url"])}" rel="noopener" target="_blank">{e(s.get("source") or "original report")}</a>. Always confirm details on the official government website before you act.</p>' if s.get("url") else ""
        tip = f'<div class="tip-box"><span class="kicker k-green">Japa wise</span><p>{e(s["tip"])}</p></div>' if s.get("tip") else ""
        ld = json.dumps({"@context": "https://schema.org", "@type": "NewsArticle", "headline": s["headline"],
                         "datePublished": s["date"], "dateModified": updated if s.get("lead") else s["date"],
                         "description": s["summary"], "mainEntityOfPage": f"{SITE}/news/{s['id']}/",
                         "image": SITE + "/assets/og-image.jpg", "publisher": {"@type": "Organization", "name": NAME, "logo": {"@type": "ImageObject", "url": SITE + "/assets/logo-512.png"}}}, ensure_ascii=False)
        body = f"""<article class="article">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a> › <a href="/news/">News</a> › {e(name)}</p>
    <span class="kicker {k}">{e(s.get('kicker') or s.get('topic'))}</span>
    <h1>{e(s['headline'])}</h1>
    <p class="meta"><span>{e(name)} · {e(s.get('topic',''))} · {fmt_date(s['date'])}</span></p>
    {thumb(s, 'thumb hero-thumb')}
    <p class="standfirst">{e(s['summary'])}</p>
    {tip}
    {src}
    <h2>Helpful guides</h2>
    <div class="guides">{g_links}</div>
    <h2>More japa news</h2>
    <div class="feed">{rel}</div>
  </div>
</article>"""
        write(f"news/{s['id']}/index.html", page(f"/news/{s['id']}/", s["headline"], s["summary"][:300], body, "/news/",
                                                 extra_head=f'<script type="application/ld+json">{ld}</script>\n'))
        urls.append((f"/news/{s['id']}/", s["date"]))

    # ---------- Guide pages ----------
    for slug, cfile, label, title, desc in GUIDES:
        body = read(f"content/{cfile}.html")
        scripts = '<script src="/assets/calc.js" defer></script>\n' if cfile == "calc" else ""
        write(f"{slug}/index.html", page(f"/{slug}/", title, desc, body, f"/{slug}/", scripts=scripts))
        urls.append((f"/{slug}/", updated))
    for slug, cfile, title, desc in PAGES:
        write(f"{slug}/index.html", page(f"/{slug}/", title, desc, read(f"content/{cfile}.html")))
        urls.append((f"/{slug}/", updated))

    # ---------- 404, sitemap, robots ----------
    write("404.html", page("/404.html", "Page not found", "This page does not exist.",
                           '<section><div class="wrap"><h1>Page not found</h1><p class="lede">That page doesn\'t exist or has moved.</p><a class="btn" href="/">Go to the home page</a> <a class="btn" href="/news/">Read japa news</a></div></section>'))
    sm = "".join(f"<url><loc>{SITE}{u}</loc><lastmod>{d}</lastmod></url>\n" for u, d in urls)
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + sm + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
    print("Built %d pages" % (len(urls) + 1))


if __name__ == "__main__":
    main()
