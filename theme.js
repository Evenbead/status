/* Evenbead colour theme toggle (ADR-0099 as amended; brand/theme/theme.ts). Light (the default) or Dark, one icon button.
   Public pages: [data-theme-toggle] buttons (type=button); the choice is kept in localStorage "eb-theme" (read before first paint by
   the inline init script) and synced across this site's open tabs.
   Signed-in app: [data-theme-form] forms (the account menu's and the drawer's toggle, Settings → Appearance's radios) post the choice
   to the person's profile; here it is applied at once and saved in the background, so the page does not reload. Without JS the form
   posts and the server renders the page in the new theme.
   Anything but "dark" (none, the retired "system", junk) is light. */
(function () {
  "use strict";
  var KEY = "eb-theme";
  var CHROME = { light: "#ffffff", dark: "#14181a" };
  var root = document.documentElement;
  function norm(t) { return t === "dark" ? "dark" : "light"; }
  function other(t) { return t === "dark" ? "light" : "dark"; }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  function apply(t) {
    t = norm(t);
    var next = other(t), label = "Switch to " + next + " theme";
    root.setAttribute("data-theme", t);
    each("[data-theme-toggle]", function (b) {
      b.setAttribute("aria-pressed", String(t === "dark"));
      b.setAttribute("aria-label", label);
      b.setAttribute("title", label);
      if (b.name === "theme") b.value = next;
    });
    each('[data-theme-form] input[type="radio"][name="theme"]', function (r) { r.checked = r.value === t; });
    each('meta[name="color-scheme"]', function (m) { m.setAttribute("content", t); });
    each('meta[name="theme-color"]', function (m) { m.setAttribute("content", CHROME[t]); });
  }
  function current() { return norm(root.getAttribute("data-theme")); }
  function store(t) { try { localStorage.setItem(KEY, t); } catch (e) { /* private mode: this page only */ } }

  // The attribute the init script (public pages) or the server (the app) set; absent: light.
  apply(current());

  // Public pages: a plain button.
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-theme-toggle]") : null;
    if (!b || b.closest("[data-theme-form]")) return;
    var t = other(current());
    apply(t);
    store(t);
  });
  window.addEventListener("storage", function (e) { if (e.key === KEY) apply(e.newValue); });

  // Signed-in app: save to the profile without leaving the page.
  function save(form, t) {
    apply(t);
    var data = new FormData(form);
    data.set("theme", t);
    var status = form.querySelector("[data-theme-status]");
    fetch(form.action, { method: "POST", body: data, credentials: "same-origin", headers: { "x-requested-with": "fetch" } })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        if (status) status.textContent = "Saved: " + (t === "dark" ? "Dark" : "Light") + ".";
      })
      .catch(function () {   // let the server answer (sign-in expired, a reload): the plain form post, with the choice in it
        if (!form.querySelector('input[name="theme"]:checked')) {
          var h = form.querySelector('input[type="hidden"][name="theme"]') || form.appendChild(Object.assign(document.createElement("input"), { type: "hidden", name: "theme" }));
          h.value = t;
        }
        form.submit();
      });
  }
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches("[data-theme-form]")) return;
    var sub = e.submitter, t;
    if (sub && sub.hasAttribute("data-theme-toggle")) t = other(current());   // the toggle: whatever the page shows now, flipped
    else t = (form.querySelector('input[name="theme"]:checked') || {}).value;
    if (t !== "light" && t !== "dark") return;
    e.preventDefault();
    save(form, t);
  });
  document.addEventListener("change", function (e) {
    var r = e.target;
    if (!r || r.name !== "theme" || r.type !== "radio" || !r.closest("[data-theme-form]")) return;
    save(r.closest("[data-theme-form]"), r.value);
  });
})();
