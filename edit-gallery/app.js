/* Edit vocabulary gallery: filter cards, play demos in view, collect picks into one prompt (picks live in the URL hash). */
(() => {
  const G = window.GALLERY, $ = (s) => document.querySelector(s);
  const byId = Object.fromEntries(G.cards.map((c) => [c.id, c]));
  const groupOf = Object.fromEntries(G.groups.map((g) => [g.id, g]));
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const motionOK = !matchMedia("(prefers-reduced-motion: reduce)").matches;

  let group = "all", query = "", sound = false;
  const picks = new Set((new URLSearchParams(location.hash.slice(1)).get("pick") || "").split(",").filter((id) => byId[id]));

  $("#title").textContent = G.title; $("#intro").textContent = G.intro;
  const proj = $("#proj"); proj.value = store.get("eg-proj") || "";

  // group tabs
  const tabs = $("#groups");
  const tab = (id, html, cls) => {
    const b = document.createElement("button");
    b.dataset.g = id; b.innerHTML = html; if (cls) b.className = cls;
    b.onclick = () => { group = id; render(); };
    tabs.append(b);
  };
  tab("all", "Tất cả<small>All</small>");
  (G.sections || [{ id: "technique", name: "" }]).forEach((sec, k) => {
    if (k) { const br = document.createElement("span"); br.className = "br"; tabs.append(br); }   // one row per section
    if (sec.name) tab("s:" + sec.id, sec.name, "sec");
    G.groups.filter((g) => (g.section || "technique") === sec.id).forEach((g) => tab(g.id, `${g.name}<small>${g.en}</small>`));
  });

  // presets
  G.presets.forEach((p) => {
    const b = document.createElement("button");
    b.className = "preset"; b.title = `Dùng cho: ${p.for}`;
    b.innerHTML = `${p.name}<small>${p.for}</small>`;
    b.onclick = () => { p.cards.forEach((id) => picks.add(id)); sync(); openTray(true); };
    $("#presets").append(b);
  });

  // cards
  const grid = $("#grid");
  const els = G.cards.map((c) => {
    const el = document.createElement("article");
    el.className = "card"; el.dataset.id = c.id;
    el.innerHTML = `
      <button class="media" aria-label="Xem chi tiết ${c.name}">
        <video muted loop playsinline preload="none" poster="${c.poster}" src="${c.demo}"></video>
        <span class="tag">${groupOf[c.group].name}</span>${c.needs === "shoot" ? '<span class="tag need">Cần quay thật</span>' : ""}
      </button>
      <div class="body">
        <h3>${c.name}</h3>
        <p class="en">${c.en}</p>
        <p class="feel">${c.feel}</p>
        <p class="use"><b>Dùng khi:</b> ${c.use}</p>
        <button class="pick"></button>
      </div>`;
    el.querySelector(".media").onclick = () => openDialog(c);
    el.querySelector(".pick").onclick = () => toggle(c.id);
    el._hay = norm([c.name, c.en, c.feel, c.use, c.prompt, c.shoot, groupOf[c.group].name].join(" "));
    grid.append(el);
    return el;
  });

  // play what is on screen, pause the rest
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target.querySelector("video");
    if (e.isIntersecting && motionOK) { v.muted = !sound; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.5 });
  els.forEach((el) => io.observe(el));

  $("#sound").onclick = () => {
    sound = !sound;
    $("#sound").textContent = sound ? "🔊 Tiếng: bật" : "🔇 Tiếng: tắt";
    $("#sound").setAttribute("aria-pressed", sound);
    els.forEach((el) => { const v = el.querySelector("video"); v.muted = !sound; });
  };

  $("#q").oninput = (e) => { query = norm(e.target.value.trim()); render(); };

  function render() {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", b.dataset.g === group));
    $("#lead").textContent = groupOf[group] ? groupOf[group].lead : "";
    let n = 0;
    els.forEach((el) => {
      const c = byId[el.dataset.id];
      const inGroup = group === "all" || c.group === group || group === "s:" + (groupOf[c.group].section || "technique");
      const show = inGroup && (!query || query.split(/\s+/).every((w) => el._hay.includes(w)));
      el.hidden = !show; n += show;
    });
    $("#empty").hidden = n > 0;
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
      el.classList.toggle("on", on); b.textContent = on ? "✓ Đã thêm vào prompt" : "+ Thêm vào prompt"; b.setAttribute("aria-pressed", on);
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
    $("#d-group").textContent = `${groupOf[c.group].name} · ${groupOf[c.group].en}`;
    $("#d-name").textContent = c.name; $("#d-en").textContent = c.en;
    $("#d-feel").textContent = c.feel; $("#d-use").textContent = c.use; $("#d-avoid").textContent = c.avoid; $("#d-capcut").textContent = c.capcut;
    $("#d-shoot").textContent = c.shoot || ""; $("#d-shoot").hidden = $("#d-shoot-l").hidden = !c.shoot;
    $("#d-prompt").textContent = c.prompt;
    const v = $("#d-video"); v.poster = c.poster; v.src = c.demo; v.muted = !sound; v.play().catch(() => {});
    sync(); dlg.showModal();
  }
  $("#d-pick").onclick = () => dlgCard && toggle(dlgCard.id);
  $("#d-copy").onclick = () => dlgCard && copy(dlgCard.prompt, null);
  $("#d-close").onclick = () => dlg.close();
  dlg.addEventListener("close", () => { $("#d-video").pause(); dlgCard = null; });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  render(); sync();
})();
