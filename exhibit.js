/* Hidden and Displayed: slide engine and image viewer.
   Works from file:// and on any static host. No network requests. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var deck = doc.querySelector(".deck");
  var slides = Array.prototype.slice.call(doc.querySelectorAll(".deck > .slide"));
  if (!deck || !slides.length) return;
  var n = slides.length, cur = -1;
  var baseTitle = doc.title;

  var prevBtn = doc.querySelector(".nav-btn.prev");
  var nextBtn = doc.querySelector(".nav-btn.next");
  var counter = doc.querySelector(".counter");
  var track = doc.querySelector(".track");
  var live = doc.querySelector("#live");

  /* ---------- Progress ticks, grouped by part ---------- */
  var ticks = [];
  if (track) {
    var lastPart = null;
    slides.forEach(function (s, i) {
      var part = s.getAttribute("data-part") || "";
      if (lastPart !== null && part !== lastPart) {
        var gap = doc.createElement("span"); gap.className = "gap"; track.appendChild(gap);
      }
      lastPart = part;
      var b = doc.createElement("button");
      b.type = "button"; b.className = "tick";
      b.setAttribute("aria-label", "Go to " + (i + 1) + ": " + (s.getAttribute("data-title") || ""));
      b.title = (i + 1) + ". " + (s.getAttribute("data-title") || "");
      b.addEventListener("click", function () { go(i); });
      track.appendChild(b); ticks.push(b);
    });
  }

  /* ---------- Images: slides are display:none until shown, so their lazy images
     do not download; the next and previous slides are fetched ahead of time ---------- */
  function loadImages(i) {
    if (i < 0 || i >= n) return;
    slides[i].querySelectorAll("img").forEach(function (img) {
      if (img.getAttribute("data-pre")) return;
      img.setAttribute("data-pre", "1");
      try { img.loading = "eager"; } catch (e) {}
      var src = img.getAttribute("src");
      if (src) { var p = new Image(); p.src = src; }
    });
  }

  /* ---------- Navigation ---------- */
  function indexFromHash() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    if (!h) return 0;
    for (var i = 0; i < n; i++) if (slides[i].id === h) return i;
    return 0;
  }
  function setHash(i) {
    var h = "#/" + slides[i].id;
    if (location.hash !== h) {
      try { history.replaceState(null, "", h); } catch (e) { location.hash = h; }
    }
  }
  function titleOf(i) { return (i >= 0 && i < n) ? (slides[i].getAttribute("data-title") || "") : ""; }

  function updateChrome() {
    var s = slides[cur];
    body.setAttribute("data-room", s.getAttribute("data-room") || "light");
    if (prevBtn) {
      prevBtn.disabled = cur === 0;
      prevBtn.querySelector(".ttl").textContent = titleOf(cur - 1);
    }
    if (nextBtn) {
      nextBtn.disabled = cur === n - 1;
      nextBtn.querySelector(".ttl").textContent = titleOf(cur + 1);
    }
    if (counter) counter.textContent = (cur + 1) + " / " + n;
    ticks.forEach(function (t, i) {
      t.classList.toggle("now", i === cur);
      t.classList.toggle("done", i < cur);
      if (i === cur) t.setAttribute("aria-current", "step"); else t.removeAttribute("aria-current");
    });
    doc.querySelectorAll(".contents a[data-go]").forEach(function (a) {
      a.setAttribute("aria-current", String(+a.getAttribute("data-go") === cur));
    });
    doc.title = (cur === 0 ? "" : titleOf(cur) + " | ") + baseTitle;
    if (live) live.textContent = "Slide " + (cur + 1) + " of " + n + ": " + titleOf(cur);
  }

  var timers = [];
  function go(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(n - 1, i));
    if (i === cur) return;
    var dir = i > cur ? 1 : -1;
    var to = slides[i], from = cur >= 0 ? slides[cur] : null;
    loadImages(i); loadImages(i + 1); loadImages(i - 1);
    timers.forEach(clearTimeout); timers = [];
    slides.forEach(function (s) {
      if (s !== to && s !== from) s.classList.remove("is-shown", "is-active", "leave-to-left", "leave-to-right", "enter-from-left", "enter-from-right");
    });
    to.classList.remove("leave-to-left", "leave-to-right");
    to.scrollTop = 0;
    var w = to.querySelector(".w-text"); if (w) w.scrollTop = 0;
    if (!from || opts.instant || reduce) {
      if (from) from.classList.remove("is-shown", "is-active", "leave-to-left", "leave-to-right");
      to.classList.add("is-shown", "is-active");
    } else {
      to.classList.add("no-anim", dir > 0 ? "enter-from-right" : "enter-from-left", "is-shown");
      void to.offsetWidth;
      to.classList.remove("no-anim", "enter-from-right", "enter-from-left");
      to.classList.add("is-active");
      from.classList.remove("is-active");
      from.classList.add(dir > 0 ? "leave-to-left" : "leave-to-right");
      timers.push(setTimeout(function () {
        from.classList.remove("is-shown", "leave-to-left", "leave-to-right");
      }, 650));
    }
    cur = i;
    setHash(i);
    updateChrome();
  }
  function next() { go(cur + 1); }
  function prev() { go(cur - 1); }

  doc.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-act],[data-go]") : null;
    if (!el) return;
    var act = el.getAttribute("data-act");
    if (el.hasAttribute("data-go")) { e.preventDefault(); closeContents(); go(+el.getAttribute("data-go")); return; }
    if (act === "next") { e.preventDefault(); next(); }
    else if (act === "prev") { e.preventDefault(); prev(); }
    else if (act === "first") { e.preventDefault(); go(0); }
    else if (act === "contents") { e.preventDefault(); openContents(); }
    else if (act === "close-contents") { e.preventDefault(); closeContents(); }
    else if (act === "present") { e.preventDefault(); togglePresent(); }
  });

  window.addEventListener("hashchange", function () {
    var i = indexFromHash();
    if (i !== cur) go(i);
  });

  /* ---------- Keyboard ---------- */
  doc.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (viewer && viewer.classList.contains("open")) return;
    if (lightbox && !lightbox.hidden) {
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      return;
    }
    if (contents && contents.classList.contains("open")) {
      if (e.key === "Escape") { e.preventDefault(); closeContents(); }
      return;
    }
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    switch (e.key) {
      case "ArrowRight": case "PageDown": e.preventDefault(); next(); break;
      case "ArrowLeft": case "PageUp": e.preventDefault(); prev(); break;
      case "Home": if (!e.shiftKey) { e.preventDefault(); go(0); } break;
      case "End": if (!e.shiftKey) { e.preventDefault(); go(n - 1); } break;
      case "Escape": if (body.classList.contains("present")) { e.preventDefault(); setPresent(false); } break;
    }
  });

  /* ---------- Swipe on touch screens ---------- */
  var sx = 0, sy = 0, st = 0;
  deck.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  deck.addEventListener("touchend", function (e) {
    if (!st || e.changedTouches.length !== 1) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    var fast = Date.now() - st < 700; st = 0;
    if (fast && Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  var lightbox = doc.querySelector(".lightbox"), lbOpener = null;

  /* ---------- Contents dialog ---------- */
  var contents = doc.querySelector(".contents");
  var contentsOpener = null;
  function openContents() {
    if (!contents) return;
    contentsOpener = doc.activeElement;
    contents.classList.add("open");
    contents.removeAttribute("hidden");
    var currentLink = contents.querySelector('a[aria-current="true"]') || contents.querySelector("a,button");
    if (currentLink) currentLink.focus();
  }
  function closeContents() {
    if (!contents || !contents.classList.contains("open")) return;
    contents.classList.remove("open");
    contents.setAttribute("hidden", "");
    if (contentsOpener && contentsOpener.focus) contentsOpener.focus();
  }
  if (contents) {
    contents.addEventListener("click", function (e) { if (e.target.classList.contains("scrim")) closeContents(); });
    contents.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = contents.querySelectorAll("a,button");
      if (!f.length) return;
      if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
  }

  /* ---------- Present mode (full screen, larger type, short labels) ---------- */
  function setPresent(on) {
    body.classList.toggle("present", on);
    var fsEl = doc.fullscreenElement || doc.webkitFullscreenElement;
    try {
      if (on && !fsEl && root.requestFullscreen) root.requestFullscreen().catch(function () {});
      if (!on && fsEl && doc.exitFullscreen) doc.exitFullscreen().catch(function () {});
    } catch (err) {}
  }
  function togglePresent() { setPresent(!body.classList.contains("present")); }
  doc.addEventListener("fullscreenchange", function () {
    if (!doc.fullscreenElement && body.classList.contains("present")) body.classList.remove("present");
  });

  /* ---------- Full-screen image viewer with zoom and pan ---------- */
  var viewer = doc.querySelector(".viewer");
  if (viewer) {
    var stage = viewer.querySelector(".viewer-stage");
    var vimg = stage.querySelector("img");
    var vtitle = viewer.querySelector(".title");
    var lastFocus = null, s = 1, x = 0, y = 0, fit = 1;
    var pointers = new Map(), pinch = null, drag = null;
    var apply = function () { vimg.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")"; };
    var clamp = function () {
      var W = stage.clientWidth, H = stage.clientHeight, w = vimg.naturalWidth * s, h = vimg.naturalHeight * s;
      x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, x));
      y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, y));
    };
    var reset = function () {
      if (!vimg.naturalWidth) return;
      fit = Math.min(stage.clientWidth / vimg.naturalWidth, stage.clientHeight / vimg.naturalHeight, 1);
      s = fit; x = 0; y = 0; clamp(); apply();
    };
    var zoomAt = function (f, cx, cy) {
      var ns = Math.max(fit, Math.min(s * f, 4)), k = ns / s;
      x = cx - (cx - x) * k; y = cy - (cy - y) * k; s = ns; clamp(); apply();
    };
    var center = function () { return [stage.clientWidth / 2, stage.clientHeight / 2]; };
    var openViewer = function (btn) {
      lastFocus = btn;
      vtitle.textContent = btn.getAttribute("data-title") || "";
      var small = btn.querySelector("img");
      vimg.alt = small ? small.alt : "";
      vimg.onload = reset;
      vimg.src = btn.getAttribute("data-full");
      viewer.classList.add("open"); viewer.setAttribute("aria-hidden", "false");
      viewer.querySelector("[data-v=close]").focus();
      if (vimg.complete && vimg.naturalWidth) reset();
    };
    var closeViewer = function () {
      viewer.classList.remove("open"); viewer.setAttribute("aria-hidden", "true");
      if (lastFocus) lastFocus.focus();
    };
    doc.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button.zoom[data-full]") : null;
      if (btn) { e.preventDefault(); openViewer(btn); }
    });
    viewer.addEventListener("click", function (e) {
      var v = e.target.getAttribute && e.target.getAttribute("data-v"), c = center();
      if (v === "close") closeViewer();
      if (v === "in") zoomAt(1.4, c[0], c[1]);
      if (v === "out") zoomAt(1 / 1.4, c[0], c[1]);
      if (v === "reset") reset();
    });
    viewer.addEventListener("keydown", function (e) {
      var c = center(), step = 80;
      if (e.key === "Escape") { e.preventDefault(); closeViewer(); }
      else if (e.key === "+" || e.key === "=") zoomAt(1.4, c[0], c[1]);
      else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.4, c[0], c[1]);
      else if (e.key === "0") reset();
      else if (e.key === "ArrowLeft") { x += step; clamp(); apply(); e.preventDefault(); }
      else if (e.key === "ArrowRight") { x -= step; clamp(); apply(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { y += step; clamp(); apply(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { y -= step; clamp(); apply(); e.preventDefault(); }
      else if (e.key === "Tab") {
        var f = viewer.querySelectorAll("button");
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    stage.addEventListener("dblclick", function (e) {
      var r = stage.getBoundingClientRect();
      if (s > fit * 1.05) reset(); else zoomAt(2.5, e.clientX - r.left, e.clientY - r.top);
    });
    stage.addEventListener("pointerdown", function (e) {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 1) { drag = [e.clientX - x, e.clientY - y]; stage.classList.add("dragging"); }
      if (pointers.size === 2) { var p = Array.from(pointers.values()); pinch = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), s: s }; }
    });
    stage.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 2 && pinch) {
        var p = Array.from(pointers.values()), r = stage.getBoundingClientRect();
        var d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        zoomAt((pinch.s * d / pinch.d) / s, (p[0][0] + p[1][0]) / 2 - r.left, (p[0][1] + p[1][1]) / 2 - r.top);
      } else if (pointers.size === 1 && drag) { x = e.clientX - drag[0]; y = e.clientY - drag[1]; clamp(); apply(); }
    });
    var up = function (e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) { drag = null; stage.classList.remove("dragging"); }
      if (pointers.size === 1) { var p = Array.from(pointers.values())[0]; drag = [p[0] - x, p[1] - y]; }
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    window.addEventListener("resize", function () { if (viewer.classList.contains("open")) reset(); });
  }

  /* ---------- Image credits: click a thumbnail to see it large; close with the X,
     a click anywhere off the image, or Escape ---------- */
  function openLightbox(btn) {
    if (!lightbox) return;
    var img = lightbox.querySelector("img");
    img.src = btn.getAttribute("data-large");
    img.alt = btn.getAttribute("data-alt") || "";
    lightbox.querySelector("figcaption").textContent = btn.getAttribute("data-caption") || "";
    lbOpener = btn;
    lightbox.hidden = false;
    lightbox.querySelector(".lb-close").focus();
  }
  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.querySelector("img").removeAttribute("src");
    if (lbOpener && lbOpener.focus) lbOpener.focus();
  }
  if (lightbox) {
    doc.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("button.thumb") : null;
      if (t) { e.preventDefault(); openLightbox(t); }
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target.tagName !== "IMG") closeLightbox();
    });
    lightbox.addEventListener("keydown", function (e) {
      if (e.key === "Tab") { e.preventDefault(); lightbox.querySelector(".lb-close").focus(); }
    });
  }

  /* ---------- Host badge: the free Netlify plan adds a fixed "Powered by Netlify"
     badge in the bottom-right corner. Make room for it so it never covers Next. ---------- */
  (function watchHostBadge() {
    var tries = 0;
    var t = setInterval(function () {
      if (doc.getElementById("nl-badge-frame")) { doc.documentElement.classList.add("has-host-badge"); clearInterval(t); }
      else if (++tries > 40) clearInterval(t);
    }, 250);
  })();

  /* ---------- Start ---------- */
  go(indexFromHash(), { instant: true });
})();
