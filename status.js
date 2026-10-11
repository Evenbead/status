// Evenbead status page. Checks the API's health endpoint from the visitor's browser (CORS allowed for
// https://status.evenbead.com only) and shows the operator's incidents file. No dependencies; all text is set with
// textContent, never as HTML.
(function () {
  "use strict";
  var HEALTH = (document.querySelector('meta[name="eb-health-url"]') || {}).content || "https://api.evenbead.com/healthz";
  var POLL_MS = 60000, TIMEOUT_MS = 10000, RECENT_DAYS = 14;
  var STATES = {
    ok: { label: "Operational", detail: "The API, MCP server and web app are answering normally." },
    degraded: { label: "Degraded", detail: "The service is answering but reports a problem. We are looking into it." },
    down: { label: "Unreachable", detail: "Your browser could not reach the service. It may be down, or your network may be blocking it." },
  };

  function $(id) { return document.getElementById(id); }
  function fmt(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso || "") : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function show(state) {
    var box = $("current");
    box.setAttribute("data-state", state);
    $("current-label").textContent = STATES[state].label;
    $("current-detail").textContent = STATES[state].detail;
    var icons = box.querySelectorAll("[data-icon]");
    for (var i = 0; i < icons.length; i++) icons[i].hidden = icons[i].getAttribute("data-icon") !== state;
    $("checked").textContent = "Last checked " + fmt(new Date().toISOString());
  }

  function check() {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(HEALTH, { mode: "cors", cache: "no-store", credentials: "omit", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          show(res.ok && body && body.status === "ok" ? "ok" : "degraded");
        });
      })
      .catch(function () { show("down"); })
      .then(function () { clearTimeout(timer); });
  }

  var STATUS_TEXT = { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved" };
  var IMPACT_TEXT = { none: "No impact", minor: "Minor impact", major: "Major impact" };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function incidentNode(inc) {
    var li = el("li", "incident");
    li.setAttribute("data-impact", IMPACT_TEXT[inc.impact] ? inc.impact : "none");
    var head = el("div", "incident-head");
    head.appendChild(el("h3", "", String(inc.title || "Incident")));
    head.appendChild(el("span", "badge", STATUS_TEXT[inc.status] || "Update"));
    li.appendChild(head);
    var meta = (IMPACT_TEXT[inc.impact] || IMPACT_TEXT.none) + " · started " + fmt(inc.started) + (inc.resolved ? " · resolved " + fmt(inc.resolved) : "");
    li.appendChild(el("p", "meta", meta));
    var updates = Array.isArray(inc.updates) ? inc.updates.slice() : [];
    updates.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
    if (updates.length) {
      var ul = el("ul", "updates");
      for (var i = 0; i < updates.length; i++) {
        var u = el("li");
        var t = el("time", "", fmt(updates[i].time));
        t.setAttribute("datetime", String(updates[i].time || ""));
        u.appendChild(t);
        u.appendChild(el("p", "", String(updates[i].text || "")));
        ul.appendChild(u);
      }
      li.appendChild(ul);
    }
    return li;
  }

  function incidents() {
    return fetch("incidents.json", { cache: "no-store", credentials: "omit" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) {
        var list = data && Array.isArray(data.incidents) ? data.incidents.filter(function (x) { return x && typeof x === "object"; }) : [];
        var cutoff = Date.now() - RECENT_DAYS * 86400000;
        var active = list.filter(function (x) { return x.status !== "resolved"; });
        var recent = list.filter(function (x) { return x.status === "resolved" && new Date(x.resolved || x.started).getTime() >= cutoff; });
        var byStart = function (a, b) { return String(b.started).localeCompare(String(a.started)); };
        active.sort(byStart); recent.sort(byStart);
        render("active", active, "No open incidents.");
        render("recent", recent.slice(0, 10), "No incidents in the last " + RECENT_DAYS + " days.");
        $("updated").textContent = data && data.updated ? "Incidents updated " + fmt(data.updated) : "";
      })
      .catch(function () {
        render("active", [], "Incident notes could not be loaded.");
        render("recent", [], "");
      });
  }

  function render(id, items, empty) {
    var list = $(id + "-list");
    while (list.firstChild) list.removeChild(list.firstChild);
    for (var i = 0; i < items.length; i++) list.appendChild(incidentNode(items[i]));
    $(id + "-empty").textContent = items.length ? "" : empty;
    $(id + "-empty").hidden = !!items.length || !empty;
  }

  $("js-only").hidden = false;
  check();
  incidents();
  setInterval(check, POLL_MS);
  setInterval(incidents, POLL_MS * 5);
})();
