/* Glanzly site script: nav, lead source, enquiry + checklist forms.
   Sets no cookies and writes nothing to browser storage, so no consent banner
   is needed (TDDDG section 25). Campaign parameters travel in the URL only and
   leave the browser only when someone submits a form. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var CFG = window.GLANZLY || {};

  // ---------- mobile nav
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "Schließen" : "Menü";
    });
  }

  // ---------- tabs (plan explorer, Kontrolliert steps). ARIA tabs pattern.
  document.querySelectorAll("[data-tabs]").forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        panel.hidden = !on;
        if (on) { panel.classList.remove("is-in"); void panel.offsetWidth; panel.classList.add("is-in"); }
      });
      root.style.setProperty("--active", tabs.indexOf(tab));
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t, false); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    root.style.setProperty("--count", tabs.length);
  });

  // ---------- lead source: carry utm_* / qr / landing page through internal links
  var CARRY = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "qr", "lp"];
  var here = new URLSearchParams(location.search);
  var carried = new URLSearchParams();
  CARRY.forEach(function (k) { if (here.get(k)) carried.set(k, here.get(k)); });
  if (carried.toString()) {
    if (!carried.get("lp")) carried.set("lp", location.pathname);
    document.querySelectorAll('a[href^="/"]').forEach(function (a) {
      var path = a.getAttribute("href").split("?")[0];
      if (/\.(pdf|svg|png|xml)$/.test(path)) return;
      var u = new URL(a.href, location.origin);
      carried.forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
      a.setAttribute("href", u.pathname + u.search + u.hash);
    });
  }
  function sourceData() {
    var ref = "direkt";
    try {
      if (document.referrer) { var r = new URL(document.referrer); ref = r.host + r.pathname; }
    } catch (e) {}
    return {
      landing_page: here.get("lp") || location.pathname, referrer: ref,
      utm_source: here.get("utm_source") || "", utm_medium: here.get("utm_medium") || "",
      utm_campaign: here.get("utm_campaign") || "", utm_content: here.get("utm_content") || "",
      qr_code: here.get("qr") || "", form_page: location.pathname
    };
  }

  // ---------- submit helper
  function collect(form) {
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = data[k] ? data[k] + ", " + v : v; });
    var src = sourceData();
    for (var k in src) data[k] = src[k];
    return data;
  }
  function asText(data, labels) {
    return Object.keys(data).filter(function (k) { return data[k] && k !== "website"; })
      .map(function (k) { return (labels[k] || k) + ": " + data[k]; }).join("\n");
  }
  function send(data, subject, labels) {
    if (CFG.endpoint) {
      return fetch(CFG.endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok && !!j.ok }; }, function () { return { ok: false }; });
      }).catch(function () { return { ok: false }; });
    }
    // No endpoint configured: hand over to the visitor's mail app, prefilled.
    window.location.href = "mailto:" + CFG.email + "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(asText(data, labels));
    return Promise.resolve({ ok: true, mailto: true });
  }

  // ---------- enquiry form (multi-step)
  var LABELS = {
    anliegen: "Anliegen", objektart: "Objektart", ort: "Ort", flaeche: "Fläche ca. (m²)",
    intervall: "Gewünschtes Intervall", start: "Gewünschter Start", aktuell: "Aktuelle Situation",
    nachricht: "Nachricht", firma: "Firma / Praxis", name: "Name", email: "E-Mail", telefon: "Telefon",
    rueckruf: "Erreichbarkeit", datenschutz: "Datenschutz akzeptiert",
    landing_page: "Einstiegsseite", referrer: "Herkunft", qr_code: "QR-Code", form_page: "Formularseite", intent_id: "CTA-ID"
  };
  var INTENTS = {
    besichtigung: { id: "A1", h: "Kostenlose Objektbesichtigung vereinbaren", btn: "Besichtigung anfragen" },
    angebot: { id: "A2", h: "Individuelles Reinigungsangebot erhalten", btn: "Angebot anfragen" },
    konzept: { id: "A6", h: "Persönliches Reinigungskonzept anfordern", btn: "Konzept anfordern" }
  };

  var form = document.getElementById("lead-form");
  if (form) {
    var intentKey = INTENTS[here.get("anliegen")] ? here.get("anliegen") : "besichtigung";
    var intent = INTENTS[intentKey];
    var radio = form.querySelector('input[name="anliegen"][value="' + intentKey + '"]');
    if (radio) radio.checked = true;
    var objekt = here.get("objekt");
    if (objekt) {
      var o = form.querySelector('input[name="objektart"][value="' + objekt + '"]');
      if (o) o.checked = true;
    }
    var applyIntent = function () {
      var checked = form.querySelector('input[name="anliegen"]:checked');
      intentKey = checked ? checked.value : "besichtigung";
      intent = INTENTS[intentKey];
      var h = document.getElementById("form-title");
      if (h) h.textContent = intent.h;
      var sb = form.querySelector("[data-submit]");
      if (sb) sb.textContent = intent.btn;
    };
    form.addEventListener("change", function (e) { if (e.target.name === "anliegen") applyIntent(); });
    applyIntent();

    var steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
    var bar = Array.prototype.slice.call(form.querySelectorAll(".form-progress li"));
    var cur = 0;
    var show = function (i) {
      steps.forEach(function (s, n) { s.hidden = n !== i; });
      bar.forEach(function (b, n) {
        b.classList.toggle("done", n < i); b.classList.toggle("current", n === i);
        if (n === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
      cur = i;
    };
    var validate = function (step) {
      var ok = true, first = null;
      step.querySelectorAll(".field-invalid").forEach(function (f) { f.classList.remove("field-invalid"); });
      step.querySelectorAll("[required]").forEach(function (el) {
        var valid = el.type === "radio"
          ? !!step.querySelector('input[name="' + el.name + '"]:checked')
          : el.type === "checkbox" ? el.checked : el.checkValidity();
        if (!valid) {
          ok = false;
          var f = el.closest(".field"); if (f) f.classList.add("field-invalid");
          if (!first) first = el;
        }
      });
      var err = step.querySelector(".form-error");
      if (err) err.hidden = ok;
      if (first) first.focus();
      return ok;
    };
    form.addEventListener("click", function (e) {
      if (e.target.matches("[data-next]")) {
        e.preventDefault();
        if (validate(steps[cur])) { show(cur + 1); steps[cur].querySelector("legend").focus(); }
      }
      if (e.target.matches("[data-back]")) { e.preventDefault(); show(cur - 1); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate(steps[cur])) return;
      var data = collect(form);
      data.intent_id = intent.id;
      var btn = form.querySelector("[data-submit]");
      var sendErr = document.getElementById("form-send-error");
      sendErr.hidden = true;
      btn.disabled = true; btn.textContent = "Wird gesendet";
      send(data, "Anfrage " + intent.id + ": " + (data.objektart || "") + " " + (data.ort || ""), LABELS)
        .then(function (r) {
          if (r.ok && r.mailto) {
            form.hidden = true;
            document.getElementById("form-mailto").hidden = false;
          } else if (r.ok) {
            location.href = "/glanzly-preview/danke/?anliegen=" + intentKey;
          } else {
            btn.disabled = false; btn.textContent = intent.btn;
            sendErr.hidden = false;
          }
        });
    });
    show(0);
  }

  // ---------- checklist download (B2)
  var cl = document.getElementById("checklist-form");
  if (cl) {
    cl.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!cl.checkValidity()) { cl.reportValidity(); return; }
      var data = collect(cl);
      data.intent_id = "B2";
      var done = function () {
        cl.hidden = true;
        document.getElementById("checklist-done").hidden = false;
        var a = document.getElementById("checklist-download");
        if (a) a.focus();
      };
      var btn = cl.querySelector("button[type=submit]");
      var err = document.getElementById("checklist-error");
      if (!CFG.endpoint) { done(); return; } // no mail-app detour just for a download
      btn.disabled = true; err.hidden = true;
      send(data, "", {}).then(function (r) {
        btn.disabled = false;
        if (r.ok) done(); else err.hidden = false;
      });
    });
  }
})();
