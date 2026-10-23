/* "Ask Japa Info" chat helper widget. Talks to the Cloudflare Worker in worker/ask-japa.js. */
(function () {
  var ENDPOINT = "https://ask.japainfong.com/chat";
  var SUGGEST = [
    "How much proof of funds do I need for a UK student visa?",
    "What is Germany's Opportunity Card?",
    "How do I know if a visa agent is a scam?",
    "When should I apply for a Canada study permit?"
  ];
  var history = [];
  var busy = false;

  var css = '\
.ask-btn[hidden],.ask-panel[hidden]{display:none!important}\
.ask-btn{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:var(--green,#cf1126);color:var(--green-ink,#fff);font:600 15px var(--f-body,system-ui,sans-serif);box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}\
.ask-btn:hover{filter:brightness(1.08)}\
.ask-btn svg{width:20px;height:20px}\
.ask-panel{margin:0;padding:0;position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:51;width:min(400px,calc(100vw - 32px));height:min(600px,calc(100dvh - 32px));display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--ink,#141111);border:1px solid var(--line,#e1dcdc);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);overflow:hidden;font-family:var(--f-body,system-ui,sans-serif)}\
.ask-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:var(--green,#cf1126);color:var(--green-ink,#fff)}\
.ask-head b{font:800 17px var(--f-display,system-ui,sans-serif);letter-spacing:.01em}\
.ask-head small{display:block;font-size:12px;opacity:.9}\
.ask-x{border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}\
.ask-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f5f4f4)}\
.ask-msg{max-width:88%;padding:10px 12px;border-radius:12px;font-size:15px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}\
.ask-msg a{color:var(--blue,#2b5fb4)}\
.ask-me{align-self:flex-end;background:var(--green,#cf1126);color:var(--green-ink,#fff);border-bottom-right-radius:4px}\
.ask-bot{align-self:flex-start;background:var(--surface,#fff);border:1px solid var(--line,#e1dcdc);border-bottom-left-radius:4px}\
.ask-err{align-self:center;color:var(--stamp,#9e1020);font-size:14px;text-align:center}\
.ask-note{font-size:12px;color:var(--muted,#5e5656);line-height:1.4}\
.ask-sugg{display:flex;flex-direction:column;gap:6px}\
.ask-sugg button{text-align:left;border:1px solid var(--line,#e1dcdc);background:var(--surface,#fff);color:var(--ink,#141111);border-radius:10px;padding:8px 10px;font:14px var(--f-body,system-ui,sans-serif);cursor:pointer}\
.ask-sugg button:hover{border-color:var(--green,#cf1126)}\
.ask-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#e1dcdc);background:var(--surface,#fff)}\
.ask-form textarea{flex:1;min-width:0;resize:none;border:1px solid var(--line,#e1dcdc);border-radius:10px;padding:10px;font:15px var(--f-body,system-ui,sans-serif);background:var(--bg,#f5f4f4);color:var(--ink,#141111);max-height:120px}\
.ask-form button{border:0;border-radius:10px;padding:0 16px;background:var(--green,#cf1126);color:var(--green-ink,#fff);font:600 15px var(--f-body,system-ui,sans-serif);cursor:pointer}\
.ask-form button:disabled{opacity:.5;cursor:default}\
.ask-dots::after{content:"…";animation:askdots 1s steps(3,end) infinite}\
@keyframes askdots{0%{content:"."}33%{content:".."}66%{content:"..."}}\
@media (prefers-reduced-motion:reduce){.ask-dots::after{animation:none}}';

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // escape, then turn **bold** and site/official URLs into links
  function format(text) {
    var s = text.replace(/[&<>"]/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(https?:\/\/[^\s<)\]]+[^\s<)\].,;:!?'"])/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener nofollow">' + u.replace(/^https?:\/\//, "") + "</a>";
    });
    return s;
  }

  function init() {
    var style = el("style"); style.textContent = css; document.head.appendChild(style);

    var btn = el("button", "ask-btn");
    btn.type = "button";
    btn.setAttribute("aria-label", "Ask Japa Info a question");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>Ask Japa Info</span>';

    var panel = el("div", "ask-panel");
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Ask Japa Info");

    var head = el("div", "ask-head");
    var title = el("div"); title.appendChild(el("b", null, "Ask Japa Info")); title.appendChild(el("small", null, "Visa & relocation questions, answered"));
    var x = el("button", "ask-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Close");
    head.appendChild(title); head.appendChild(x);

    var log = el("div", "ask-log"); log.setAttribute("aria-live", "polite");
    var hello = el("div", "ask-msg ask-bot");
    hello.innerHTML = "Hello! Ask me anything about studying, working or travelling abroad from Nigeria: visa routes, proof of funds, costs, timing or how to avoid scams.";
    var note = el("p", "ask-note", "General information only, not legal advice. Rules change often, so always confirm on the official government website. Don't share passport, BVN or bank details here.");
    var sugg = el("div", "ask-sugg");
    SUGGEST.forEach(function (q) { var b = el("button", null, q); b.type = "button"; b.addEventListener("click", function () { send(q); }); sugg.appendChild(b); });
    log.appendChild(hello); log.appendChild(note); log.appendChild(sugg);

    var form = el("form", "ask-form");
    var ta = el("textarea"); ta.id = "ask-input"; ta.rows = 1; ta.maxLength = 800; ta.placeholder = "Type your question…"; ta.setAttribute("aria-label", "Your question");
    var go = el("button", null, "Send"); go.type = "submit";
    form.appendChild(ta); form.appendChild(go);

    panel.appendChild(head); panel.appendChild(log); panel.appendChild(form);
    document.body.appendChild(btn); document.body.appendChild(panel);

    function open() { panel.hidden = false; btn.hidden = true; setTimeout(function () { ta.focus(); }, 50); }
    function close() { panel.hidden = true; btn.hidden = false; btn.focus(); }
    btn.addEventListener("click", open);
    x.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit")); } });
    ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; });
    form.addEventListener("submit", function (e) { e.preventDefault(); send(ta.value); });

    function add(cls, html) { var m = el("div", "ask-msg " + cls); m.innerHTML = html; log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }

    function send(q) {
      q = (q || "").trim();
      if (!q || busy) return;
      if (sugg.parentNode) sugg.remove();
      busy = true; go.disabled = true; ta.value = ""; ta.style.height = "auto";
      add("ask-me", format(q));
      history.push({ role: "user", content: q });
      var wait = add("ask-bot", '<span class="ask-dots">Thinking</span>');
      fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-10) }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          wait.remove();
          if (res.ok && res.d.reply) { history.push({ role: "assistant", content: res.d.reply }); add("ask-bot", format(res.d.reply)); }
          else { history.pop(); add("ask-err", format(res.d.error || "Sorry, something went wrong. Please try again.")); }
        })
        .catch(function () { wait.remove(); history.pop(); add("ask-err", "Couldn't reach the assistant. Check your connection and try again."); })
        .then(function () { busy = false; go.disabled = false; ta.focus(); });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
