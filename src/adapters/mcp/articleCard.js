export const ARTICLE_CARD_URI = 'ui://outrank/article-card-v1.html';
export const ARTICLE_CARD_MIME_TYPE = 'text/html;profile=mcp-app';
export const ARTICLE_CARD_STATUS_TOOL = 'articles_status';
export const ARTICLE_CARD_MEDIA_DOMAINS = Object.freeze(['https://cdn.outrank.so']);
const ARTICLE_CARD_STATUS_WAIT_SECONDS = 25;
const ARTICLE_CARD_DESCRIPTION =
  'Shows the article being written: live state while it is written, then the finished title and a link to open it.';

export const ARTICLE_CARD_RESOURCE_META = Object.freeze({
  ui: {
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [...ARTICLE_CARD_MEDIA_DOMAINS] },
  },
  'openai/widgetPrefersBorder': true,
  'openai/widgetDescription': ARTICLE_CARD_DESCRIPTION,
  'openai/widgetCSP': { connect_domains: [], resource_domains: [...ARTICLE_CARD_MEDIA_DOMAINS] },
});

export const ARTICLE_CARD_START_TOOL_META = Object.freeze({
  ui: { resourceUri: ARTICLE_CARD_URI, visibility: ['model', 'app'] },
  'openai/outputTemplate': ARTICLE_CARD_URI,
  'openai/widgetAccessible': true,
  'openai/toolInvocation/invoking': 'Starting your article',
  'openai/toolInvocation/invoked': 'Your article is being written',
});

export const ARTICLE_CARD_STATUS_TOOL_META = Object.freeze({
  ui: { visibility: ['model', 'app'] },
  'openai/widgetAccessible': true,
});

const ARTICLE_CARD_SCRIPT = String.raw`
(function () {
  "use strict";
  var MEDIA_ORIGINS = __MEDIA_ORIGINS__;
  var STATUS_TOOL = __STATUS_TOOL__;
  var STATUS_WAIT_SECONDS = __STATUS_WAIT_SECONDS__;
  var MAX_POLL_MS = 45 * 60 * 1000;
  var MAX_QUEUED_MS = 5 * 60 * 1000;
  var PENDING = { queued: true, writing: true, generating_article: true };

  var state = { keywordId: null, status: null, keyword: null, title: null, description: null, imageUrl: null, articleUrl: null, listUrl: null, error: null };
  var polling = false;
  var stopped = false;
  var reported = false;
  var startedAt = Date.now();
  var root = document.getElementById("card");

  var nextId = 1;
  var waiting = {};
  function post(message) {
    try { window.parent.postMessage(message, "*"); } catch (e) {}
  }
  function request(method, params, timeoutMs) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      waiting[id] = { resolve: resolve, reject: reject };
      post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
      setTimeout(function () {
        if (waiting[id]) { delete waiting[id]; reject(new Error("The host did not answer " + method)); }
      }, timeoutMs || 90000);
    });
  }
  function notify(method, params) {
    post({ jsonrpc: "2.0", method: method, params: params || {} });
  }
  function openai() {
    return typeof window.openai === "object" && window.openai ? window.openai : null;
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var message = event.data;
    if (!message || message.jsonrpc !== "2.0") return;
    if (message.method === undefined && message.id !== undefined && waiting[message.id]) {
      var entry = waiting[message.id];
      delete waiting[message.id];
      if (message.error) entry.reject(new Error(message.error.message || "Host error"));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === "ui/notifications/tool-result") applyToolResult(message.params);
    else if (message.method === "ui/notifications/tool-input") applyToolInput(message.params);
    else if (message.method === "ui/notifications/host-context-changed") applyHostContext(message.params);
    else if (message.method === "ui/resource-teardown") {
      stopped = true;
      if (message.id !== undefined) post({ jsonrpc: "2.0", id: message.id, result: {} });
    }
  });

  function callStatusTool() {
    var args = { keyword_id: state.keywordId, wait_seconds: STATUS_WAIT_SECONDS };
    var host = openai();
    if (host && typeof host.callTool === "function") return host.callTool(STATUS_TOOL, args);
    return request("tools/call", { name: STATUS_TOOL, arguments: args }, (STATUS_WAIT_SECONDS + 45) * 1000);
  }

  function openLink(url) {
    if (!isSafeUrl(url)) return;
    var host = openai();
    if (host && typeof host.openExternal === "function") { host.openExternal({ href: url }); return; }
    request("ui/open-link", { url: url }, 15000).catch(function () { window.open(url, "_blank", "noopener"); });
  }

  function plainText(value) {
    if (typeof value === "string") return value;
    if (value && typeof value.untrusted_counterparty_text === "string") return value.untrusted_counterparty_text;
    return null;
  }

  function structuredOf(result) {
    if (!result || typeof result !== "object") return null;
    if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
    if (result.result && result.result.structuredContent) return result.result.structuredContent;
    if ("ok" in result) return result;
    var content = result.content || (result.result && result.result.content);
    if (Array.isArray(content)) {
      for (var i = 0; i < content.length; i++) {
        if (content[i] && content[i].type === "text" && typeof content[i].text === "string") {
          try { var parsed = JSON.parse(content[i].text); if (parsed && "ok" in parsed) return parsed; } catch (e) {}
        }
      }
    }
    return null;
  }

  function applyToolInput(params) {
    var args = params && params.arguments;
    if (args && typeof args.keyword_id === "string" && !state.keywordId) state.keywordId = args.keyword_id;
  }

  function applyToolResult(result) {
    var structured = structuredOf(result);
    if (!structured) return;
    if (structured.ok === false) {
      state.status = "error";
      state.error = structured.error && typeof structured.error.message === "string" ? structured.error.message : "Something went wrong.";
      render();
      return;
    }
    var data = structured.data && typeof structured.data === "object" ? structured.data : {};
    if (typeof data.keyword_id === "string") state.keywordId = data.keyword_id;
    if (typeof data.keyword === "string") state.keyword = data.keyword;
    if (typeof data.article_list_url === "string") state.listUrl = data.article_list_url;
    var next = data.state || data.status;
    if (typeof next === "string") state.status = next;
    var article = data.article && typeof data.article === "object" ? data.article : null;
    if (article) {
      state.title = plainText(article.title);
      state.description = plainText(article.meta_description);
      state.imageUrl = typeof article.image_url === "string" ? article.image_url : null;
      state.articleUrl = typeof article.editor_url === "string" ? article.editor_url : null;
    }
    state.error = null;
    render();
    if (state.status === "ready") reportReady();
    if (state.keywordId && PENDING[state.status]) poll();
  }

  function applyHostContext(context) {
    if (!context) return;
    if (context.theme === "dark" || context.theme === "light") document.documentElement.setAttribute("data-theme", context.theme);
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function poll() {
    if (polling || stopped) return;
    polling = true;
    var failures = 0;
    var deadline = Date.now() + MAX_POLL_MS;
    (function loop() {
      var gaveUp = Date.now() > deadline || (state.status === "queued" && Date.now() - startedAt > MAX_QUEUED_MS);
      if (stopped || !PENDING[state.status] || gaveUp) {
        polling = false;
        if (PENDING[state.status] && gaveUp) showRetry("Not finished yet. Check again, or open your articles in Outrank.");
        return;
      }
      callStatusTool().then(function (result) {
        failures = 0;
        applyToolResult(result);
        return sleep(PENDING[state.status] ? 1500 : 0);
      }, function () {
        failures += 1;
        if (failures >= 5) { polling = false; showRetry("Lost track of the article. Check again, or open your articles in Outrank."); return null; }
        return sleep(Math.min(30000, 4000 * failures));
      }).then(function (next) {
        if (next === null) return;
        loop();
      });
    })();
  }

  function reportReady() {
    if (reported) return;
    reported = true;
    var text = "The article " + (state.title ? '"' + state.title + '" ' : "") + "is ready." + (state.articleUrl ? " Open it in Outrank: " + state.articleUrl : "");
    request("ui/update-model-context", { content: [{ type: "text", text: text }] }, 15000).catch(function () {});
  }

  function isSafeUrl(url) {
    return typeof url === "string" && /^https:\/\//i.test(url);
  }
  function canShowImage(url) {
    if (!isSafeUrl(url)) return false;
    try { return MEDIA_ORIGINS.indexOf(new URL(url).origin) !== -1; } catch (e) { return false; }
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function button(label, primary, onClick) {
    var node = el("button", primary ? "btn primary" : "btn", label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function render() {
    root.textContent = "";
    var ready = state.status === "ready";
    var failed = state.status === "error";
    var head = el("div", "head");
    head.appendChild(el("span", "brand", "Outrank"));
    head.appendChild(el("span", "pill " + (ready ? "ok" : failed ? "bad" : "busy"), ready ? "Ready" : failed ? "Failed" : "Writing"));
    root.appendChild(head);
    root.appendChild(el("div", "title", state.title || state.keyword || "Your article"));

    if (ready) {
      if (canShowImage(state.imageUrl)) {
        var image = el("img", "cover");
        image.src = state.imageUrl;
        image.alt = "";
        root.appendChild(image);
      }
      if (state.description) root.appendChild(el("p", "meta", state.description));
      var actions = el("div", "actions");
      if (state.articleUrl) actions.appendChild(button("Open in Outrank", true, function () { openLink(state.articleUrl); }));
      root.appendChild(actions);
      return;
    }

    if (failed) {
      root.appendChild(el("p", "error", state.error || "The article could not be written."));
      return;
    }

    var bar = el("div", "bar");
    bar.appendChild(el("div", "fill indeterminate"));
    root.appendChild(bar);
    root.appendChild(el("p", "meta", state.status === "queued" ? "Waiting to start" : "Researching and writing"));
    root.appendChild(el("p", "hint", "This usually takes several minutes. This card updates on its own, so you can keep chatting."));
    if (state.listUrl) {
      var pendingActions = el("div", "actions");
      pendingActions.appendChild(button("Open your articles", false, function () { openLink(state.listUrl); }));
      root.appendChild(pendingActions);
    }
  }

  function showRetry(text) {
    render();
    var row = el("div", "actions");
    row.appendChild(el("p", "meta", text));
    row.appendChild(button("Check again", true, function () { startedAt = Date.now(); poll(); render(); }));
    root.appendChild(row);
  }

  var lastHeight = 0;
  function reportSize() {
    var height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    notify("ui/notifications/size-changed", { width: Math.ceil(document.documentElement.getBoundingClientRect().width), height: height });
    var host = openai();
    if (host && typeof host.notifyIntrinsicHeight === "function") { try { host.notifyIntrinsicHeight(height); } catch (e) {} }
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(reportSize).observe(document.documentElement);

  render();
  var host = openai();
  if (host) {
    applyHostContext({ theme: host.theme });
    if (host.toolOutput) applyToolResult(host.toolOutput);
    window.addEventListener("openai:set_globals", function (event) {
      var globals = event && event.detail && event.detail.globals;
      if (!globals) return;
      if (globals.theme) applyHostContext({ theme: globals.theme });
      if (globals.toolOutput) applyToolResult(globals.toolOutput);
    });
  }
  request("ui/initialize", {
    protocolVersion: "2026-01-26",
    appInfo: { name: "outrank-article-card", version: "1.0.0" },
    clientInfo: { name: "outrank-article-card", version: "1.0.0" },
    appCapabilities: { availableDisplayModes: ["inline"] },
    capabilities: {}
  }, 15000).then(function (result) {
    if (result && result.hostContext) applyHostContext(result.hostContext);
    notify("ui/notifications/initialized", {});
  }, function () {});
  reportSize();
})();
`
  .replace('__MEDIA_ORIGINS__', JSON.stringify(ARTICLE_CARD_MEDIA_DOMAINS))
  .replace('__STATUS_TOOL__', JSON.stringify(ARTICLE_CARD_STATUS_TOOL))
  .replace('__STATUS_WAIT_SECONDS__', String(ARTICLE_CARD_STATUS_WAIT_SECONDS));

const ARTICLE_CARD_STYLE = `
:root { color-scheme: light dark; --bg: #ffffff; --fg: #101317; --muted: #5d636b; --line: #e3e6ea; --track: #edf0f3; --accent: #2f6fed; --accent-fg: #ffffff; --bad: #c0362c; --ok: #1f8a4c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #16181b; --fg: #f2f4f6; --muted: #a3a9b1; --line: #2b2f34; --track: #25292e; --accent: #6a97f5; --accent-fg: #0a1020; --bad: #ff7a6e; --ok: #4fd08a; } }
:root[data-theme="dark"] { --bg: #16181b; --fg: #f2f4f6; --muted: #a3a9b1; --line: #2b2f34; --track: #25292e; --accent: #6a97f5; --accent-fg: #0a1020; --bad: #ff7a6e; --ok: #4fd08a; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#card { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.brand { font-weight: 650; letter-spacing: -0.01em; }
.pill { font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: var(--track); color: var(--muted); }
.pill.ok { color: var(--ok); }
.pill.bad { color: var(--bad); }
.title { font-size: 16px; font-weight: 600; }
.cover { display: block; width: 100%; max-height: 240px; object-fit: cover; border-radius: 10px; }
.bar { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; }
.fill { height: 100%; border-radius: 999px; background: var(--accent); }
.fill.indeterminate { width: 30%; animation: slide 1.4s ease-in-out infinite; }
@keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(340%); } }
.meta { margin: 0; color: var(--muted); }
.hint { margin: 0; color: var(--muted); font-size: 12px; }
.error { margin: 0; color: var(--bad); }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.btn { font: inherit; font-weight: 600; padding: 7px 14px; border-radius: 9px; border: 1px solid var(--line); background: transparent; color: var(--fg); cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

export const ARTICLE_CARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outrank article</title>
<style>${ARTICLE_CARD_STYLE}</style>
</head>
<body>
<div id="card" role="region" aria-label="Outrank article"></div>
<script>${ARTICLE_CARD_SCRIPT}</script>
</body>
</html>
`;
