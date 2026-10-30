/* Edit vocabulary gallery: a sidebar of groups, one block per group, search + "filmed or not" filters, demos that play on
   hover (or in view on touch screens), picks collected into one prompt (picks live in the URL hash). */
(() => {
  const G = window.GALLERY, $ = (s) => document.querySelector(s);
  const byId = Object.fromEntries(G.cards.map((c) => [c.id, c]));
  const groupOf = Object.fromEntries(G.groups.map((g) => [g.id, g]));
  const sections = G.sections || [{ id: "technique", name: "" }];
  const secOf = (g) => g.section || "technique";
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const motionOK = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hoverPlay = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    rhythm: P('<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>'),
    camera: P('<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/>'),
    transition: P('<rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2"/>'),
    accent: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    look: P('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" class="fill"/>'),
    caption: P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>'),
    title: P('<path d="M5 6h14M12 6v13"/>'),
    graphic: P('<path d="M5 20V11M12 20V5M19 20v-7"/>'),
    layout: P('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h9"/>'),
    finish: P('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
    vfx: P('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    sfx: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    style: P('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5M13 4v5M18 4v5"/>'),
  };
  const icon = (id) => ICON[id] || P('<circle cx="12" cy="12" r="4"/>');

  let query = "", sound = false;
  const need = {};                                   // group id → "all" | "edit" | "shoot"
  const picks = new Set((new URLSearchParams(location.hash.slice(1)).get("pick") || "").split(",").filter((id) => byId[id]));

  $("#title").textContent = G.title; $("#intro").textContent = G.intro;
  const proj = $("#proj"); proj.value = store.get("eg-proj") || "";

  // presets
  G.presets.forEach((p) => {
    const b = document.createElement("button");
    b.className = "preset"; b.title = `Dùng cho: ${p.for}`;
    b.innerHTML = `${p.name}<small>${p.for}</small>`;
    b.onclick = () => { p.cards.forEach((id) => picks.add(id)); sync(); openTray(true); };
    $("#presets").append(b);
  });

  // sidebar: sections → groups with counts
  const nav = $("#nav"), navBtn = {};
  sections.forEach((sec) => {
    const gs = G.groups.filter((g) => secOf(g) === sec.id);
    if (sec.name) { const h = document.createElement("p"); h.className = "nav-h"; h.textContent = sec.name; nav.append(h); }
    gs.forEach((g) => {
      const b = document.createElement("button");
      b.className = "nav-g"; b.dataset.g = g.id;
      b.innerHTML = `${icon(g.id)}<span class="nm">${g.name}</span><span class="n"></span>`;
      b.onclick = () => document.getElementById(`g-${g.id}`).scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "start" });
      nav.append(b); navBtn[g.id] = b;
    });
  });

  // one block per group
  const main = $("#sections"), blocks = {};
  const els = [];
  sections.forEach((sec) => {
    const gs = G.groups.filter((g) => secOf(g) === sec.id);
    gs.forEach((g, k) => {
      const cs = G.cards.filter((c) => c.group === g.id);
      const filmed = cs.filter((c) => c.needs === "shoot").length;
      const s = document.createElement("section");
      s.className = "grp"; s.id = `g-${g.id}`; s.dataset.g = g.id;
      s.innerHTML = `
        ${k === 0 && sec.name ? `<p class="sec-band">${sec.name}</p>` : ""}
        <div class="grp-head">
          <h2><span class="ic">${icon(g.id)}</span>${g.name}<small>${g.en}</small><span class="n"></span></h2>
          <p class="lead">${g.lead}</p>
          ${filmed ? `<div class="filt" role="group" aria-label="Lọc">
            <button data-f="all">Tất cả <span></span></button>
            <button data-f="edit">Dựng được <span></span></button>
            <button data-f="shoot">Cần quay thật <span></span></button></div>` : ""}
        </div>
        <div class="grid"></div>`;
      need[g.id] = "all";
      s.querySelectorAll(".filt button").forEach((b) => (b.onclick = () => { need[g.id] = b.dataset.f; render(); }));
      const grid = s.querySelector(".grid");
      cs.forEach((c) => {
        const el = document.createElement("article");
        el.className = "card"; el.dataset.id = c.id;
        el.innerHTML = `
          <button class="media" aria-label="Xem chi tiết ${c.name}">
            <video muted loop playsinline preload="none" poster="${c.poster}" src="${c.demo}"></video>
            <span class="play" aria-hidden="true">▶</span>
            ${c.needs === "shoot" ? '<span class="tag need">Cần quay thật</span>' : ""}${c.audio ? '<span class="tag aud">🔊 Có tiếng</span>' : ""}
          </button>
          <div class="body">
            <h3>${c.name}</h3>
            <p class="en">${c.en}</p>
            <button class="pick"></button>
          </div>`;
        el.title = c.feel;
        el.querySelector(".media").onclick = () => openDialog(c);
        el.querySelector(".pick").onclick = () => toggle(c.id);
        el._hay = norm([c.name, c.en, c.feel, c.use, c.prompt, c.shoot, g.name, g.en].join(" "));
        const v = el.querySelector("video");
        if (hoverPlay && motionOK) {
          el.addEventListener("mouseenter", () => { v.muted = !sound; v.play().catch(() => {}); el.classList.add("playing"); });
          el.addEventListener("mouseleave", () => { v.pause(); el.classList.remove("playing"); });
        }
        grid.append(el); els.push(el);
      });
      main.append(s); blocks[g.id] = s;
    });
  });

  // touch screens: play what is on screen, pause the rest
  if (!hoverPlay && motionOK) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target.querySelector("video");
      if (e.isIntersecting) { v.muted = !sound; v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  // the group under the reading line is the active one in the sidebar
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    Object.values(navBtn).forEach((b) => b.removeAttribute("aria-current"));
    const b = navBtn[e.target.dataset.g]; b.setAttribute("aria-current", "true");
    const row = nav; if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: b.offsetLeft - 16, behavior: motionOK ? "smooth" : "auto" });
  }), { rootMargin: "-30% 0px -65% 0px" });
  Object.values(blocks).forEach((s) => spy.observe(s));

  $("#sound").onclick = () => {
    sound = !sound;
    $("#sound").textContent = sound ? "🔊 Tiếng: bật" : "🔇 Tiếng: tắt";
    $("#sound").setAttribute("aria-pressed", sound);
    els.forEach((el) => { el.querySelector("video").muted = !sound; });
  };

  $("#q").oninput = (e) => { query = norm(e.target.value.trim()); render(); };

  function render() {
    let total = 0;
    G.groups.forEach((g) => {
      const s = blocks[g.id]; if (!s) return;
      let shown = 0; const byKind = { all: 0, edit: 0, shoot: 0 };
      s.querySelectorAll(".card").forEach((el) => {
        const c = byId[el.dataset.id];
        const hit = !query || query.split(/\s+/).every((w) => el._hay.includes(w));
        const kind = c.needs === "shoot" ? "shoot" : "edit";
        if (hit) { byKind.all++; byKind[kind]++; }
        const show = hit && (need[g.id] === "all" || need[g.id] === kind);
        el.hidden = !show; shown += show;
      });
      s.querySelectorAll(".filt button").forEach((b) => {
        b.setAttribute("aria-pressed", need[g.id] === b.dataset.f);
        b.querySelector("span").textContent = byKind[b.dataset.f];
      });
      s.querySelector("h2 .n").textContent = byKind.all;
      navBtn[g.id].querySelector(".n").textContent = byKind.all;
      navBtn[g.id].classList.toggle("none", byKind.all === 0);
      s.hidden = byKind.all === 0; total += shown;
    });
    $("#empty").hidden = total > 0;
  }

  function toggle(id) { picks.has(id) ? picks.delete(id) : picks.add(id); sync(); }

  function compose() {
    const name = proj.value.trim() || "<tên project>";
    const lines = [G.prompt_head.replace("<tên project>", name)];
    G.groups.forEach((g) => {
      const cs = G.cards.filter((c) => c.group === g.id && picks.has(c.id));
      if (cs.length) lines.push(`${g.name}:`, ...cs.map((c) => `- ${c.prompt}`));
    });
    lines.push(G.prompt_tail);
    return lines.join("\n");
  }

  function sync() {
    els.forEach((el) => {
      const on = picks.has(el.dataset.id), b = el.querySelector(".pick");
      el.classList.toggle("on", on); b.textContent = on ? "✓ Đã thêm" : "+ Thêm vào prompt"; b.setAttribute("aria-pressed", on);
    });
    $("#count").textContent = picks.size;
    $("#tray").classList.toggle("has", picks.size > 0);
    const chips = $("#chips"); chips.innerHTML = "";
    [...picks].forEach((id) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = `${byId[id].name} ×`; b.title = "Bỏ khỏi prompt";
      b.onclick = () => toggle(id); chips.append(b);
    });
    $("#out").value = picks.size ? compose() : "Chọn kỹ thuật ở trên (hoặc một công thức có sẵn), prompt sẽ hiện ở đây.";
    history.replaceState(null, "", picks.size ? `#pick=${[...picks].join(",")}` : location.pathname);
    if (dlgCard) $("#d-pick").textContent = picks.has(dlgCard.id) ? "✓ Đã thêm (bấm để bỏ)" : "+ Thêm vào prompt";
  }

  proj.oninput = () => { store.set("eg-proj", proj.value); sync(); };

  function copy(text, flag) {
    const done = () => { if (flag) { flag.hidden = false; setTimeout(() => (flag.hidden = true), 1600); } };
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(done, () => {
      const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select();
      try { document.execCommand("copy"); done(); } catch (e) {} t.remove();
    });
  }
  $("#copy").onclick = () => picks.size && copy($("#out").value, $("#copied"));
  $("#clear").onclick = () => { picks.clear(); sync(); };

  const tray = $("#tray");
  function openTray(on) { tray.classList.toggle("open", on); $("#tray-toggle").setAttribute("aria-expanded", on); }
  $("#tray-toggle").onclick = () => openTray(!tray.classList.contains("open"));

  // detail dialog
  const dlg = $("#dlg"); let dlgCard = null;
  function openDialog(c) {
    dlgCard = c;
    const g = groupOf[c.group], sec = sections.find((s) => s.id === secOf(g));
    $("#d-group").textContent = [sec && sec.name, g.name].filter(Boolean).join(" › ");
    $("#d-name").textContent = c.name; $("#d-en").textContent = c.en;
    $("#d-feel").textContent = c.feel; $("#d-use").textContent = c.use; $("#d-avoid").textContent = c.avoid; $("#d-capcut").textContent = c.capcut;
    $("#d-shoot").textContent = c.shoot || ""; $("#d-shoot").hidden = $("#d-shoot-l").hidden = !c.shoot;
    $("#d-prompt").textContent = c.prompt;
    const v = $("#d-video"); v.poster = c.poster; v.src = c.demo; v.muted = !(sound || c.audio);   // opening is a click, so sound may start v.play().catch(() => {});
    sync(); dlg.showModal();
  }
  $("#d-pick").onclick = () => dlgCard && toggle(dlgCard.id);
  $("#d-copy").onclick = () => dlgCard && copy(dlgCard.prompt, null);
  $("#d-close").onclick = () => dlg.close();
  dlg.addEventListener("close", () => { $("#d-video").pause(); dlgCard = null; });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  render(); sync();
})();
