(() => {
  // src/client/api-base.ts
  function resolveApiBase(override) {
    if (override) return override;
    if (typeof globalThis !== "undefined" && globalThis.location?.origin) {
      return globalThis.location.origin;
    }
    return "";
  }

  // src/client/app.ts
  var $ = (s) => document.querySelector(s);
  var $$ = (s) => Array.from(document.querySelectorAll(s));
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var D = 864e5;
  var now = () => Date.now();
  var KINDS = ["note", "favour", "hunch", "rumour", "issue"];
  var DAYS = ["sun", "mon", "tues", "wednes", "thurs", "fri", "satur"];
  var tok = sessionStorage.getItem("t") || "";
  var A = null;
  var SC = null;
  var META = null;
  var tab = "log";
  var dr = { kind: "note", when: "now", extraRows: [], files: [] };
  var imp = null;
  var pend = false;
  var es = null;
  var booting = false;
  var stockFilter = "";
  var stockViewMode = "cards";
  var activeModal = null;
  var templatesCache = [];
  var chosenTemplateId = "";
  var voiceRecorder = null;
  var voiceChunks = [];
  var voiceTimerInterval = null;
  var voiceSeconds = 0;
  var isRecordingVoice = false;
  var videoStream = null;
  var videoRecorder = null;
  var videoChunks = [];
  var videoTimerInterval = null;
  var videoSeconds = 0;
  var isVideoRecording = false;
  var API_BASE = resolveApiBase();
  async function api(m, p, b) {
    const url = (API_BASE ? API_BASE : "") + "/api/" + p;
    const r = await fetch(url, {
      method: m,
      headers: {
        "Content-Type": "application/json",
        ...tok ? { Authorization: "Bearer " + tok } : {}
      },
      body: b ? JSON.stringify(b) : void 0
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && tok) {
      if (booting) {
        tok = "";
        sessionStorage.removeItem("t");
      } else logout();
      throw new Error("Session ended. Please sign in again.");
    }
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  var fm = (n) => {
    const c = (A?.business?.currency || META?.currency || "\u20B9").trim();
    const val = Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    return c.length > 1 ? `${c} ${val}` : `${c}${val}`;
  };
  var mediaUrl = (u) => u.startsWith("/api/media/") ? (API_BASE || "") + u + "?token=" + encodeURIComponent(tok) : u;
  var numOrUndef = (v) => v === "" || v == null || !Number.isFinite(Number(v)) ? void 0 : Number(v);
  var fmt = (t) => new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  var P = (id) => A?.people?.find((p) => p.id === id) || { name: "Someone", role: "" };
  var inp = (id, ph, type = "text", val = "", extraAttr = "") => `<input id="${id}" type="${type}" placeholder="${esc(ph)}" value="${esc(val)}" aria-label="${esc(ph)}" ${extraAttr}>`;
  function logout() {
    tok = "";
    sessionStorage.removeItem("t");
    es?.close();
    es = null;
    A = null;
    tab = "log";
    activeModal = null;
    chosenTemplateId = "";
    dr = { kind: "note", when: "now", extraRows: [], files: [] };
    syncNav(false);
    boot();
  }
  async function enter(t) {
    tok = t;
    sessionStorage.setItem("t", t);
    await refresh(true);
    es?.close();
    const eventUrl = (API_BASE ? API_BASE : "") + "/api/events?token=" + t;
    es = new EventSource(eventUrl);
    es.onmessage = (msg) => {
      if (msg.data === "reset") {
        logout();
      } else {
        refresh().catch(() => {
        });
      }
    };
    syncNav(true);
  }
  function syncNav(visible) {
    const sb = $("#sidebar");
    const mobNav = $("#nav");
    const mobHdr = $("#mobileHeader");
    if (sb) sb.hidden = !visible;
    if (mobNav) mobNav.hidden = !visible;
    if (mobHdr) mobHdr.hidden = !visible;
  }
  async function boot() {
    syncNav(false);
    booting = true;
    try {
      await boot2();
    } finally {
      booting = false;
    }
  }
  async function boot2() {
    try {
      META = await api("GET", "state");
      SC = await api("GET", "schema");
      try {
        templatesCache = await api("GET", "templates");
      } catch {
        templatesCache = [];
      }
    } catch (err) {
      $("#app").innerHTML = `<div class="c"><h2>Connection Error</h2><p class="m">${esc(err.message)}</p><button class="btn" data-a="reload">Retry</button></div>`;
      return;
    }
    if (tok) {
      try {
        await enter(tok);
        return;
      } catch {
        tok = "";
      }
    }
    if (!META.setup) {
      renderOnboarding();
    } else {
      renderSignIn();
    }
  }
  var TYPE_HINT = {
    kirana: "Grocery & Daily Essentials",
    cafe: "Cafe & Bakery",
    restaurant: "Restaurant & Dining",
    barber: "Salon & Barber Studio",
    sweets: "Traditional Confectionery"
  };
  function renderOnboarding() {
    const tmpls = templatesCache.length ? templatesCache : [
      { id: "kirana", name: "Kirana & Grocery", icon: "\u{1F6D2}", description: "Grains, oils, pulses, weighing scales, and deep freezers." },
      { id: "cafe", name: "Cafe & Bakery", icon: "\u2615", description: "Coffee beans, milks, bakery goods, espresso machines, and ovens." },
      { id: "restaurant", name: "Restaurant & Dhaba", icon: "\u{1F37D}\uFE0F", description: "Pantry provisions, cooking ranges, kitchen chillers, and gas." },
      { id: "barber", name: "Salon & Barber", icon: "\u{1F488}", description: "Hair products, hydraulic chairs, clippers, and towel care." },
      { id: "sweets", name: "Sweets & Mithai", icon: "\u{1F36C}", description: "Mawa, desi ghee, mawa making kadai, and display counters." }
    ];
    $("#app").innerHTML = `
    <div style="max-width: 680px; margin: 20px auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div class="brand-seal" style="width: 48px; height: 48px; margin: 0 auto 10px; font-size: 28px;">\u092C</div>
        <h1>Welcome to Bahi</h1>
        <p class="m" style="font-size: 15px; max-width: 520px; margin: 0 auto;">
          The calm, lightweight digital bahi-khata. Keep daily notes, staff log, fast stock tracking, and know your daily breakeven without complicated accounting software.
        </p>
      </div>

      <div class="c">
        <h3>Step 1: Choose a business starter</h3>
        <p class="m">Pick a profile to load realistic starter items, machinery, and running costs. You can edit everything later.</p>
        <div class="template-grid">
          ${tmpls.map((t) => `
            <div class="tmpl-card ${chosenTemplateId === t.id ? "on" : ""}" data-a="pickTmpl" data-id="${t.id}" data-name="${esc(t.name)}">
              <div class="tmpl-icon">${t.icon || "\u{1F4E6}"}</div>
              <div class="tmpl-title">${esc(t.name)}</div>
              <div class="tmpl-desc">${esc(t.description)}</div>
            </div>
          `).join("")}
          <div class="tmpl-card ${chosenTemplateId === "custom" ? "on" : ""}" data-a="pickTmpl" data-id="custom" data-name="Custom Business">
            <div class="tmpl-icon">\u2728</div>
            <div class="tmpl-title">Custom Business</div>
            <div class="tmpl-desc">Start with a clean slate and define your own items and equipment.</div>
          </div>
        </div>
      </div>

      <div class="c">
        <h3>Step 2: Basic Shop Details</h3>
        <p class="m">Only essentials needed now. Everything else can be tailored as you go.</p>

        <label for="sb">Business / Shop Name *</label>
        ${inp("sb", "e.g. Anand Kirana & General Store")}

        <label for="st">Business Type / Category</label>
        ${inp("st", "e.g. Retail Grocery, Specialty Cafe, Family Diner", "text", TYPE_HINT[chosenTemplateId] || "")}

        <label>Currency Symbol</label>
        <div class="row" style="margin-bottom: 8px;">
          ${["\u20B9", "$", "\u20AC", "\xA3", "AED"].map((c) => `<button type="button" class="chip ${dr.currency === c || !dr.currency && c === "\u20B9" ? "on" : ""}" data-a="setCurr" data-c="${c}">${c}</button>`).join("")}
        </div>
        ${inp("sc", "Or type custom currency (default \u20B9)", "text", dr.currency || "\u20B9")}

        <label for="so">Your Name (Owner) *</label>
        ${inp("so", "e.g. Ramesh Shah")}

        <label for="sp">Owner PIN (4+ digits) *</label>
        ${inp("sp", "Choose a 4-digit PIN (e.g. 1234)", "password")}
        <p class="m" style="margin-top: -6px; margin-bottom: 12px;">
          \u{1F512} Used for fast sign-in on shop phones and tablets. Keeps owner financial figures, salaries, and profit margins private from staff.
        </p>

        ${META.code ? `<label for="sk">Setup Code</label>${inp("sk", "Enter server setup code")}` : ""}

        <div class="row" style="margin: 12px 0;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="loadStarterCheck" checked style="width: auto; margin: 0;">
            Pre-load starter inventory items, machinery, and typical overheads
          </label>
        </div>

        <button class="btn" data-a="setup" style="width: 100%; padding: 13px; font-size: 16px;">Create Business & Open Bahi</button>
      </div>
    </div>
  `;
  }
  function renderSignIn() {
    const users = META?.users || (META?.owner ? [{ name: META.owner, role: "Owner", isOwner: true }] : []);
    const owner = users.find((u) => u.isOwner);
    const defaultSelected = owner ? owner.name : users[0]?.name || "";
    $("#app").innerHTML = `
    <div style="max-width: 480px; margin: 40px auto 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div class="brand-seal" style="width: 44px; height: 44px; margin: 0 auto 10px; font-size: 26px;">\u092C</div>
        <h1>${esc(META.business || "Bahi")}</h1>
        <p class="m">${esc(META.type || "Shop Ledger")}</p>
      </div>
      <div class="c">
        <label>Select Team Member or Enter Name</label>
        ${users.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px;">
            ${users.map((u) => `
              <button type="button" class="chip ${u.name === defaultSelected ? "on" : ""}" data-a="fillUser" data-name="${esc(u.name)}" style="font-size: 12px; padding: 4px 10px;">
                ${u.isOwner ? "\u{1F451}" : "\u{1F477}"} <b>${esc(u.name)}</b> <span style="opacity: 0.7; font-size: 11px;">(${esc(u.role)})</span>
              </button>
            `).join("")}
          </div>
        ` : ""}

        <label for="ln">Name or WhatsApp Number</label>
        ${inp("ln", "Enter your name or phone", "text", defaultSelected)}

        <label for="lp" style="margin-top: 10px;">Sign-In PIN (4+ digits)</label>
        ${inp("lp", "Enter your 4-digit PIN", "password")}

        <button class="btn" data-a="login" style="width: 100%; margin-top: 14px; padding: 12px; font-size: 15px;">Sign In to Bahi</button>

        <p class="m" style="font-size: 12px; margin-top: 12px; text-align: center; line-height: 1.4;">
          \u{1F512} Staff accounts have full operational access to log operational notes, adjust inventory, record sales, and monitor equipment.
        </p>

        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); text-align: center;">
          <p class="m" style="margin-bottom: 8px;">Want to start fresh with a different business?</p>
          <button class="chip" data-a="resetPublic" style="font-size: 12px; color: var(--acc); border-color: var(--line);">Reset & Start New Business Setup</button>
        </div>
      </div>
    </div>
  `;
  }
  async function refresh(force = false) {
    A = await api("GET", "all");
    if (!force && document.activeElement?.matches?.("input,textarea,select") && !activeModal) {
      pend = true;
    } else {
      draw();
    }
  }
  function updateNavigationUI() {
    syncNav(true);
    const shopName = A?.business?.name || "Bahi";
    const shopType = A?.business?.type || "";
    const isOwner = !!A?.me?.owner;
    const userName = A?.me?.name || "User";
    const badgeEl = $("#sideShopBadge");
    if (badgeEl) {
      badgeEl.innerHTML = `
      <div class="side-shop-name">${esc(shopName)}</div>
      <div class="side-shop-type">${esc(shopType || "Shop Ledger")}</div>
    `;
    }
    const footerEl = $("#sideFooter");
    if (footerEl) {
      footerEl.innerHTML = `
      <div class="user-pill">
        <div class="user-avatar">${esc(userName.charAt(0).toUpperCase())}</div>
        <div class="user-details">
          <div class="user-name">${esc(userName)}</div>
          <div class="user-role">${isOwner ? "Owner" : "Staff"}</div>
        </div>
      </div>
      <button class="chip" data-a="logout" style="padding: 4px 8px; font-size: 11px;">Out</button>
    `;
    }
    const mobNameEl = $("#mobShopName");
    if (mobNameEl) mobNameEl.textContent = shopName;
    const mobUserEl = $("#mobUserActions");
    if (mobUserEl) {
      mobUserEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="tag" style="margin: 0;">${isOwner ? "Owner" : "Staff"}</span>
        <button class="chip" data-a="logout" style="padding: 4px 10px; font-size: 12px;">Sign out</button>
      </div>
    `;
    }
    $$("#sideNav button").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
    $$("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
  }
  function draw() {
    if (!tok || !A) return;
    updateNavigationUI();
    ["t", "ab", "dt", "rows"].forEach((k) => {
      const e = $("#" + k);
      if (e) dr[k] = e.value;
    });
    const wasOpen = new Set($$("#app details[open] > summary").map((x) => x.textContent.trim()));
    const viewFunc = { log, stock, bets, tmr, biz }[tab];
    $("#app").innerHTML = viewFunc ? viewFunc() : "<p>View not found</p>";
    $$("#app details > summary").forEach((x) => {
      if (wasOpen.has(x.textContent.trim())) x.parentElement.open = true;
    });
    if (activeModal) {
      const mc = $("#modalContainer");
      const typing = mc && !mc.hidden && (activeModal.type === "video" || mc.contains(document.activeElement) || mc.querySelector("details[open]"));
      if (!typing) renderModal();
    } else {
      const mc = $("#modalContainer");
      if (mc) mc.hidden = true;
    }
  }
  var renderEntryAttachments = (e) => {
    const files = [];
    if (Array.isArray(e.files)) {
      files.push(...e.files);
    }
    if (e.img) {
      files.push({ id: "__legacy_img", name: "Photo", type: "image/jpeg", category: "image", url: e.img, isLegacyImg: true });
    }
    if (e.aud) {
      files.push({ id: "__legacy_aud", name: "Voice Note", type: "audio/webm", category: "audio", url: e.aud, isLegacyAud: true });
    }
    if (files.length === 0) return "";
    const canEdit = !!(A?.me?.owner || e.by === A?.me?.id);
    return `
    <div class="attachment-grid">
      ${files.map((f0) => {
      const f = { ...f0, data: mediaUrl(f0.url || f0.data || "") };
      const removeBtn = canEdit ? `<button class="att-del-btn" data-a="removeEntryAttachment" data-eid="${esc(e.id)}" data-fid="${esc(f.id)}" data-legacy="${f.isLegacyImg ? "img" : f.isLegacyAud ? "aud" : ""}" title="Remove this file">\u2715</button>` : "";
      if (f.category === "image") {
        return `
            <div class="att-card">
              ${removeBtn}
              <img src="${esc(f.data)}" alt="${esc(f.name)}" style="cursor: pointer;" data-a="viewFullImage" data-src="${esc(f.data)}" title="Click to view full photo">
              <div class="att-info">\u{1F5BC}\uFE0F ${esc(f.name)}</div>
            </div>
          `;
      } else if (f.category === "audio") {
        return `
            <div class="att-card">
              ${removeBtn}
              <audio controls preload="none" src="${esc(f.data)}"></audio>
              <div class="att-info">\u{1F399}\uFE0F ${esc(f.name)}</div>
            </div>
          `;
      } else if (f.category === "video") {
        return `
            <div class="att-card">
              ${removeBtn}
              <video controls preload="none" src="${esc(f.data)}"></video>
              <div class="att-info">\u{1F4F9} ${esc(f.name)}</div>
            </div>
          `;
      } else {
        return `
            <div class="att-card" style="justify-content: center; min-height: 85px;">
              ${removeBtn}
              <div style="font-size: 26px; text-align: center;">\u{1F4C4}</div>
              <div class="att-info" style="text-align: center;">
                <a href="${esc(f.data)}" download="${esc(f.name)}" target="_blank" rel="noopener" style="color: var(--ink); text-decoration: underline;">${esc(f.name)}</a>
              </div>
            </div>
          `;
      }
    }).join("")}
    </div>
  `;
  };
  var entry = (e) => {
    const m = P(e.by);
    const canModify = !!(A?.me?.owner || e.by === A?.me?.id);
    return `
    <div class="e">
      <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px;">
        <div>
          <b>${esc(m.name)}</b> <small style="color: var(--mute);">${esc(m.role || "")}</small>
          <span class="tag">${esc(e.kind)}</span>
          ${e.an ? '<span class="tag" style="color: var(--acc); font-weight: 600;">\u{1F50D} For Analysis / Processing</span>' : ""}
          ${e.src === "whatsapp" ? '<span class="tag" style="color: #128c7e; border-color: rgba(37,211,102,0.3);">\u{1F4AC} WhatsApp</span>' : ""}
        </div>
        <small style="color: var(--mute);">${fmt(e.ev)}</small>
      </div>

      <div style="margin: 8px 0; font-size: 15px; line-height: 1.45;">${esc(e.txt)}</div>

      ${renderEntryAttachments(e)}

      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 10px;">
        <small style="color: var(--mute);">
          ${e.about ? "About " + esc(e.about) + " \xB7 " : ""}
          ${e.v ? "\u2713 Verified by " + esc(e.v.by) : "Unverified"}
          ${e.up - e.ev > 216e5 ? " \xB7 logged late" : ""}
        </small>
        <div class="row" style="margin: 0;">
          ${canModify ? `
            <button class="chip" data-a="editEntry" data-i="${esc(e.id)}" style="font-size: 12px; padding: 3px 8px;">\u270F\uFE0F Edit</button>
            <button class="chip" data-a="delEntry" data-i="${esc(e.id)}" style="font-size: 12px; padding: 3px 8px; color: var(--acc);" title="Delete note">\u{1F5D1}\uFE0F Delete</button>
          ` : ""}
          ${A.me.owner && !e.v ? `<button class="chip" data-a="confirm" data-i="${esc(e.id)}">Confirm Note</button>` : ""}
          ${e.kind === "favour" && !e.settled && canModify ? `<button class="chip" data-a="settle" data-i="${esc(e.id)}">Mark Settled</button>` : ""}
        </div>
      </div>
    </div>
  `;
  };
  var log = () => {
    dr.files = dr.files || [];
    const files = dr.files;
    return `
    <h2>Timeline & Operations Log</h2>
    <div class="c">
      <textarea id="t" rows="3" placeholder="What happened today? (Customer remark, supply delay, customer credit, staff note...) Start with /save or /analyze to flag for review.">${esc(dr.t || "")}</textarea>

      ${files.length > 0 ? `
        <div style="margin: 10px 0 6px;">
          <small style="font-weight: 600; display: block; margin-bottom: 4px;">Attached Files & Recordings (${files.length}):</small>
          <div class="attachment-grid">
            ${files.map((f) => `
              <div class="att-card">
                <button type="button" class="att-del-btn" data-a="delDraftFile" data-id="${esc(f.id)}" title="Remove this file">\u2715</button>
                ${f.category === "image" ? `
                  <img src="${esc(f.data)}" alt="${esc(f.name)}">
                  <div class="att-info">\u{1F5BC}\uFE0F ${esc(f.name)}</div>
                ` : f.category === "audio" ? `
                  <audio controls src="${esc(f.data)}"></audio>
                  <div class="att-info">\u{1F399}\uFE0F ${esc(f.name)}</div>
                ` : f.category === "video" ? `
                  <video controls src="${esc(f.data)}"></video>
                  <div class="att-info">\u{1F4F9} ${esc(f.name)}</div>
                ` : `
                  <div style="font-size: 26px; text-align: center; margin-top: 10px;">\u{1F4C4}</div>
                  <div class="att-info" style="text-align: center;">${esc(f.name)}</div>
                `}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <div class="row" style="margin: 10px 0;">
        <label class="chip" style="cursor: pointer;">
          \u{1F4C1} Upload Files
          <input type="file" multiple id="fileUploadInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" hidden>
        </label>

        <button type="button" class="chip ${isRecordingVoice ? "on" : ""}" data-a="toggleVoiceRecord">
          ${isRecordingVoice ? '<span class="recording-badge" id="voiceTimerBadge">\u{1F534} Recording (' + voiceSeconds + "s) - Tap to Stop</span>" : "\u{1F399}\uFE0F Record Voice Note"}
        </button>

        <button type="button" class="chip ${isVideoRecording ? "on" : ""}" data-a="openVideoModal">
          \u{1F4F9} Record Video
        </button>

        <button type="button" class="chip ${dr.an ? "on" : ""}" data-a="an">
          ${dr.an ? "\u2713 Flagged for Analysis" : "\u{1F50D} Mark for Analysis"}
        </button>
      </div>

      <div style="margin: 8px 0;">
        <small style="font-weight: 600; display: block; margin-bottom: 4px;">Kind of note:</small>
        <div class="row">
          ${KINDS.map((k) => `<button class="chip ${dr.kind === k ? "on" : ""}" data-a="kind" data-v="${k}">${k}</button>`).join("")}
        </div>
      </div>

      <div style="margin: 8px 0;">
        <small style="font-weight: 600; display: block; margin-bottom: 4px;">When did it happen?</small>
        <div class="row">
          ${[["now", "Just now"], ["earlier", "Earlier today"], ["yday", "Yesterday"], ["pick", "Pick time"]].map((w) => `<button class="chip ${dr.when === w[0] ? "on" : ""}" data-a="when" data-v="${w[0]}">${w[1]}</button>`).join("")}
        </div>
      </div>
      ${dr.when === "pick" ? `<input type="datetime-local" id="dt" value="${esc(dr.dt || "")}">` : ""}

      <input id="ab" placeholder="Who or what is this about? (Customer, Supplier, Driver... optional)" value="${esc(dr.ab || "")}">
      <div style="margin-top: 12px;">
        <button class="btn" data-a="post" style="padding: 10px 24px; font-size: 15px;">Post Entry</button>
      </div>
    </div>

    <div style="margin-top: 24px;">
      <h3>Past Notes</h3>
      ${A.entries.slice().sort((a, b) => b.ev - a.ev).map(entry).join("") || '<p class="m" style="padding: 20px 0;">No entries recorded yet. Add your first note above.</p>'}
    </div>
  `;
  };
  var IMP = {
    items: [["name", "Item name", ["item", "product", "name", "description"]], ["unit", "Unit", ["unit", "uom"]], ["qty", "Quantity in hand", ["qty", "quantity", "stock", "onhand"]], ["low", "Warn below", ["low", "reorder", "min"]], ["costPrice", "Cost price", ["cost", "purchase", "buying"]], ["sellPrice", "Sell price", ["sell", "mrp", "price", "rate"]]],
    moves: [["name", "Item name", ["item", "product", "name", "description"]], ["qty", "Quantity", ["qty", "quantity", "units"]], ["type", "Sold or received", ["type", "kind", "direction", "txn"]], ["price", "Price", ["price", "rate", "amount"]], ["date", "Date", ["date", "day", "time"]]]
  };
  function csv(t) {
    const r = [];
    let c = [], f = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"') {
          if (t[i + 1] === '"') {
            f += '"';
            i++;
          } else q = false;
        } else f += ch;
      } else if (ch === '"') {
        q = true;
      } else if (ch === ",") {
        c.push(f);
        f = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && t[i + 1] === "\n") i++;
        c.push(f);
        r.push(c);
        c = [];
        f = "";
      } else {
        f += ch;
      }
    }
    if (f || c.length) {
      c.push(f);
      r.push(c);
    }
    return r.filter((x) => x.some((y) => y.trim()));
  }
  function guess(kind, head) {
    const used = /* @__PURE__ */ new Set();
    const map = {};
    const n = head.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
    for (const [k, , al] of IMP[kind]) {
      let i = n.findIndex((h, j) => !used.has(j) && al.includes(h));
      if (i < 0) i = n.findIndex((h, j) => !used.has(j) && al.some((a) => h.includes(a)));
      map[k] = i;
      if (i >= 0) used.add(i);
    }
    return map;
  }
  var stock = () => {
    const allItems = A.items || [];
    const filtered = allItems.filter((i) => !stockFilter || i.name.toLowerCase().includes(stockFilter.toLowerCase()));
    const lowCount = allItems.filter((i) => i.low && (i.qty ?? 0) <= i.low).length;
    return `
    <h2>
      <span>Stock & Inventory</span>
      <span class="m" style="font-size: 13px; font-weight: normal;">${allItems.length} items ${lowCount > 0 ? `\xB7 <b style="color: var(--acc);">${lowCount} low in stock</b>` : ""}</span>
    </h2>

    <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
      <div style="flex: 1; min-width: 200px; max-width: 380px;">
        <input type="search" id="sq_search" placeholder="Search products..." value="${esc(stockFilter)}" style="margin: 0; padding: 8px 12px; font-size: 14px;">
      </div>
      <div class="row" style="margin: 0;">
        <button class="chip ${stockViewMode === "cards" ? "on" : ""}" data-a="setStockView" data-v="cards">Cards</button>
        <button class="chip ${stockViewMode === "table" ? "on" : ""}" data-a="setStockView" data-v="table">Table</button>
      </div>
    </div>

    ${stockViewMode === "cards" ? `
      <div class="stock-grid">
        ${filtered.map((i) => {
      const isLow = i.low && (i.qty ?? 0) <= i.low;
      const margin = i.sellPrice > 0 && i.costPrice != null ? Math.round((i.sellPrice - i.costPrice) / i.sellPrice * 100) : null;
      const extraKeys = i.extra ? Object.keys(i.extra) : [];
      return `
            <div class="item-card ${isLow ? "is-low" : ""}">
              <div>
                <div class="item-header">
                  <div class="item-name">${esc(i.name)}</div>
                  ${isLow ? '<span class="tag" style="background: var(--acc-light); color: var(--acc); border-color: var(--acc);">Low Stock</span>' : ""}
                </div>
                ${extraKeys.length ? `
                  <div class="item-extra-tags">
                    ${extraKeys.map((k) => `<span class="extra-tag">${esc(k)}: ${esc(i.extra[k])}</span>`).join("")}
                  </div>
                ` : ""}
              </div>

              <div class="item-stats">
                <div>
                  <div class="m" style="font-size: 11px;">IN HAND</div>
                  <div class="item-qty-val ${isLow ? "low" : ""}">${i.qty ?? 0} <small style="font-size: 12px; font-weight: normal;">${esc(i.unit || "")}</small></div>
                </div>
                <div>
                  <div class="m" style="font-size: 11px;">SELL PRICE</div>
                  <div style="font-weight: 600;">${i.sellPrice != null ? fm(i.sellPrice) : "-"}</div>
                </div>
                <div>
                  <div class="m" style="font-size: 11px;">MARGIN</div>
                  <div style="color: ${margin && margin > 25 ? "var(--green)" : "inherit"}; font-weight: 600;">${margin != null ? margin + "%" : "-"}</div>
                </div>
              </div>

              <div class="row" style="justify-content: space-between; margin: 0;">
                <button class="chip" data-a="openItemSpecs" data-id="${i.id}" style="font-size: 12px;">Specs & Edit</button>
                <div class="row" style="margin: 0;">
                  <button class="btn sm g" data-a="quickMv" data-i="${i.id}" data-d="1" title="Receive +1">+ Recv</button>
                  <button class="btn sm g" data-a="quickMv" data-i="${i.id}" data-d="-1" title="Sold -1">- Sold</button>
                </div>
              </div>
            </div>
          `;
    }).join("") || '<p class="m" style="grid-column: 1/-1; padding: 24px; text-align: center;">No items match your filter.</p>'}
      </div>
    ` : `
      <div class="sc">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>In Hand</th>
              <th>Cost</th>
              <th>Sell</th>
              <th>Margin</th>
              <th>Quick Adjust</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((i) => `
              <tr>
                <td>
                  <b>${esc(i.name)}</b>
                  ${i.extra ? `<div class="m" style="font-size: 11px;">${Object.entries(i.extra).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" \xB7 ")}</div>` : ""}
                </td>
                <td style="${i.low && (i.qty ?? 0) <= i.low ? "color: var(--acc); font-weight: 700;" : ""}">
                  ${i.qty ?? 0} ${esc(i.unit || "")}${i.low && (i.qty ?? 0) <= i.low ? " (low)" : ""}
                </td>
                <td>${i.costPrice != null ? fm(i.costPrice) : "-"}</td>
                <td>${i.sellPrice != null ? fm(i.sellPrice) : "-"}</td>
                <td>${i.sellPrice > 0 && i.costPrice != null ? Math.round((i.sellPrice - i.costPrice) / i.sellPrice * 100) + "%" : "-"}</td>
                <td>
                  <div class="row" style="margin: 0;">
                    <button class="chip" data-a="quickMv" data-i="${i.id}" data-d="1">+1</button>
                    <button class="chip" data-a="quickMv" data-i="${i.id}" data-d="-1">-1</button>
                  </div>
                </td>
              </tr>
            `).join("") || '<tr><td colspan="6" class="m">No items found.</td></tr>'}
          </tbody>
        </table>
      </div>
    `}

    <!-- Collapsible Actions: Movement Recording -->
    ${allItems.length ? `
      <details class="accordion">
        <summary>\u{1F4E6} Record Batch Stock Movement</summary>
        <div class="acc-body">
          <p class="m">Select an item and quantity to record deliveries or customer sales.</p>
          <div class="row" style="align-items: flex-end;">
            <div style="flex: 2; min-width: 200px;">
              <label for="si">Select Item</label>
              <select id="si" style="margin-bottom: 0;">
                ${allItems.map((i) => `<option value="${i.id}">${esc(i.name)} (${i.qty ?? 0} ${esc(i.unit || "")} in hand)</option>`).join("")}
              </select>
            </div>
            <div style="flex: 1; min-width: 120px;">
              <label for="sq">Quantity</label>
              <input id="sq" type="number" min="0" step="any" placeholder="Qty" style="margin-bottom: 0;">
            </div>
            <div class="row" style="margin: 0;">
              <button class="btn" data-a="mv" data-d="1">Received (+)</button>
              <button class="btn g" data-a="mv" data-d="-1">Sold / Used (-)</button>
            </div>
          </div>
        </div>
      </details>
    ` : ""}

    <!-- Collapsible Action: Add New Item -->
    <details class="accordion">
      <summary>\u2795 Add New Product Item</summary>
      <div class="acc-body">
        <div data-form="items">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            <div>
              <label>Item Name *</label>
              <input name="name" placeholder="e.g. Masala Tea Leaves (500g)">
            </div>
            <div>
              <label>Unit</label>
              <input name="unit" placeholder="kg, pcs, box, pouch, L...">
            </div>
            <div>
              <label>Quantity in Hand</label>
              <input name="qty" type="number" step="any" placeholder="0">
            </div>
            <div>
              <label>Low Stock Warning Threshold</label>
              <input name="low" type="number" step="any" placeholder="Warn when below...">
            </div>
            <div>
              <label>Cost / Buying Price</label>
              <input name="costPrice" type="number" step="any" placeholder="Cost per unit">
            </div>
            <div>
              <label>Selling / Retail Price</label>
              <input name="sellPrice" type="number" step="any" placeholder="Selling price">
            </div>
          </div>

          <div style="margin: 12px 0 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label style="font-weight: 600;">Custom Dynamic Fields (Optional)</label>
              <button type="button" class="chip" data-a="addKvRow" data-target="item_kv" style="font-size: 11px;">+ Add Custom Field</button>
            </div>
            <div id="item_kv" style="margin-top: 6px;"></div>
          </div>

          <button class="btn" data-a="addWithExtra" data-c="items" data-kv="item_kv" style="margin-top: 8px;">Save Item</button>
        </div>
      </div>
    </details>

    <!-- Collapsible Action: CSV Import -->
    ${A.me.owner ? `
      <details class="accordion">
        <summary>\u{1F4C4} Import from CSV / Billing App</summary>
        <div class="acc-body">
          <p class="m">Export a CSV file from Vyapar, Tally, Zoho, or your spreadsheet and match columns here.</p>
          <div class="row">
            <select id="ik" style="max-width: 280px; margin: 0;">
              <option value="items">Stock list (items, prices, quantities)</option>
              <option value="moves">Sales and purchases (what was sold or received)</option>
            </select>
            <label class="chip" style="margin: 0;">
              Choose CSV File
              <input type="file" accept=".csv,text/csv" id="cf" hidden>
            </label>
          </div>
          ${imp ? `
            <div style="margin-top: 14px; background: var(--card-subtle); border-radius: 8px; padding: 12px;">
              <p><b>${imp.rows.length} rows detected.</b> Map your file columns:</p>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 8px 0;">
                ${IMP[imp.kind].map(([k, l]) => `
                  <div>
                    <label>${l}</label>
                    <select data-m="${k}" style="margin: 0;">
                      <option value="-1">(Not in my file)</option>
                      ${imp.head.map((h, i) => `<option value="${i}" ${imp.map[k] === i ? "selected" : ""}>${esc(h)}</option>`).join("")}
                    </select>
                  </div>
                `).join("")}
              </div>
              <button class="btn" data-a="doimp">Import ${imp.rows.length} rows</button>
            </div>
          ` : ""}
          ${imp?.res ? `<p style="margin-top: 10px; color: var(--green);"><b>Done:</b> ${imp.res.created} new items created, ${imp.res.updated} updated, ${imp.res.skipped} skipped.</p>` : ""}
        </div>
      </details>

      <details class="accordion">
        <summary>\u{1F4F8} Page from Your Paper Bahi / Receipt Photo</summary>
        <div class="acc-body">
          <p class="m">Photograph a supplier bill or handwritten receipt, then type entries while viewing the photo.</p>
          <label class="chip">Take Photo / Upload<input type="file" accept="image/*" id="df" hidden></label>
          ${dr.doc ? `<img class="th" src="${dr.doc}" alt="Bill photo">` : ""}
          <label for="rows">Type rows (one per line, e.g. "Sugar, 20" or "Milk, 15"):</label>
          <textarea id="rows" rows="3" placeholder="Sugar, 20&#10;Toor Dal, 10">${esc(dr.rows || "")}</textarea>
          <div class="row">
            <select id="dd" style="max-width: 240px; margin: 0;">
              <option value="received">Received (purchase/stock in)</option>
              <option value="sold">Sold or used (stock out)</option>
            </select>
            <button class="btn" data-a="rows">Confirm Rows</button>
          </div>
        </div>
      </details>
    ` : ""}

    <h3 style="margin-top: 24px;">Recent Movements</h3>
    <div class="sc">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Change</th>
            <th>Price</th>
            <th>When</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${A.moves.slice(-10).reverse().map((m) => `
            <tr>
              <td><b>${esc(m.name)}</b></td>
              <td style="font-family: var(--font-mono); font-weight: 600; color: ${m.qty > 0 ? "var(--green)" : "var(--acc)"};">${m.qty > 0 ? "+" : ""}${m.qty}</td>
              <td>${m.price ? fm(m.price) : "-"}</td>
              <td class="m">${fmt(m.at)}</td>
              <td><span class="tag">${esc(m.src || "manual")}</span></td>
            </tr>
          `).join("") || '<tr><td colspan="5" class="m">No movements logged yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  };
  var bets = () => {
    const cs = A.decisions.filter((d) => d.expN > 0 && d.act != null);
    const av = cs.length ? cs.reduce((s, d) => s + (d.act - d.expN) / d.expN, 0) / cs.length * 100 : null;
    return `
    <h2>Decisions & Hypotheses</h2>
    <p class="m">Record decisions before the results are known. Review them later with actual numbers to improve your business instincts.</p>

    ${A.me.owner ? `
      <details class="accordion" open>
        <summary>\u{1F3AF} Log a New Business Bet</summary>
        <div class="acc-body">
          <label>The Decision or Bet</label>
          <textarea id="bt" rows="2" placeholder="e.g. Raise price of Special Chai from \u20B915 to \u20B920"></textarea>
          <label>Why? What makes you think this will work?</label>
          <textarea id="bw" rows="2" placeholder="e.g. Milk prices increased, and nearby shops charge \u20B920 with no drop in crowd"></textarea>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
            <div>
              <label>Expected Result</label>
              <input id="be" placeholder="e.g. Daily revenue rises by \u20B9500">
            </div>
            <div>
              <label>Expected Target Metric (Number, optional)</label>
              <input id="bn" type="number" step="any" placeholder="e.g. 500">
            </div>
            <div>
              <label>Review Date</label>
              <input id="br" type="date">
            </div>
          </div>
          <button class="btn" data-a="bet" style="margin-top: 8px;">Record Bet</button>
        </div>
      </details>
    ` : '<p class="m">Only the owner logs decision bets.</p>'}

    ${av != null ? `
      <div class="c" style="background: var(--card-subtle);">
        <b>Reviewed Accuracy:</b> Across ${cs.length} reviewed decision(s), actual results ran <b>${Math.abs(av).toFixed(0)}% ${av >= 0 ? "above" : "below"}</b> your expectations.
      </div>
    ` : ""}

    <div style="margin-top: 18px;">
      <h3>Decision Log</h3>
      ${A.decisions.slice().reverse().map((d) => `
        <div class="c">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <b>${esc(d.txt)}</b>
            <span class="tag">${d.out ? esc(d.out) : d.rev <= now() ? "Review Due" : "Pending"}</span>
          </div>
          <p class="m" style="margin: 6px 0;">
            <b>Why:</b> ${esc(d.why || "None stated")}<br>
            <b>Expected:</b> ${esc(d.exp || "-")}${d.expN ? ` (Target: ${d.expN})` : ""} \xB7
            <b>Review Date:</b> ${new Date(d.rev).toLocaleDateString("en-IN")}<br>
            ${d.snap ? `<b>Signals known then:</b> ${esc(d.snap)}` : ""}
          </p>

          ${d.out ? `
            <div style="background: var(--card-subtle); border-radius: 8px; padding: 10px; margin-top: 8px;">
              <span class="tag" style="background: var(--green-light); color: var(--green);">${esc(d.out)}</span>
              <span class="tag">Quality: ${esc(d.q || "")}</span>
              ${d.act != null ? `<b>Actual Result:</b> ${d.act} \xB7 ` : ""}
              ${d.w2 ? `<b>Outcome Notes:</b> ${esc(d.w2)}` : ""}
              ${d.l ? `<div style="margin-top: 4px;"><b>Lesson:</b> ${esc(d.l)}</div>` : ""}
            </div>
          ` : A.me.owner ? `
            <details data-f="${d.id}" style="margin-top: 10px;">
              <summary style="font-size: 13px; color: var(--acc); cursor: pointer;">${d.rev <= now() ? "\u{1F449} Review this bet now" : "Review early"}</summary>
              <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
                <select name="o">
                  <option>Worked</option>
                  <option>Partly</option>
                  <option>Failed</option>
                </select>
                <select name="q">
                  <option value="sound">Reasoning was sound</option>
                  <option value="shaky">Reasoning was shaky</option>
                  <option value="unclear">Too early or unclear</option>
                </select>
                <input name="a" type="number" step="any" placeholder="Actual number (optional)">
              </div>
              <input name="w" placeholder="What happened? (Weather, rival, price, stock-out...)">
              <input name="l" placeholder="Lesson for next time (optional)">
              <button class="btn sm" data-a="rv" data-i="${d.id}">Save Review</button>
            </details>
          ` : ""}
        </div>
      `).join("") || '<p class="m">No bets logged yet.</p>'}
    </div>
  `;
  };
  var L = (a) => a.length ? `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="m">Nothing flagged.</p>';
  var tmr = () => {
    const t = new Date(now() + D);
    const s = A.summary;
    const pats = A.entries.map((e) => ({ e, m: e.txt?.match(/every\s+(sun|mon|tues|wednes|thurs|fri|satur)day/i) })).filter((x) => x.m && x.e.about && DAYS.indexOf(x.m[1].toLowerCase()) === t.getDay()).map((x) => `${x.e.about} usually comes on this weekday (from a staff note)`);
    const sig = A.signals.filter((x) => x.on && (new Date(x.on).getTime() - now()) / D >= -1 && (new Date(x.on).getTime() - now()) / D <= 14).map((x) => `${x.src}: ${x.t} on ${x.on} (${x.c} confidence)`);
    const hs = A.entries.filter((e) => (e.kind === "hunch" || e.kind === "rumour") && now() - e.ev < 7 * D).map((e) => `${e.txt} (${e.kind}, ${P(e.by).name})`);
    const warn = [
      ...A.items.filter((i) => i.low && (i.qty ?? 0) <= i.low).map((i) => `${i.name} is low: ${i.qty} ${i.unit || ""} left`),
      ...A.entries.filter((e) => e.kind === "favour" && !e.settled && now() - e.ev > 3 * D).map((e) => `Unsettled favour: ${e.txt}`),
      ...A.decisions.filter((d) => !d.out && d.rev <= now()).map((d) => `Bet due for review: ${d.txt}`),
      ...A.entries.some((e) => now() - e.up < 2 * D) ? [] : ["Nothing logged in the last 2 days"]
    ];
    return `
    <h2>Tomorrow's Brief \xB7 ${t.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h2>

    ${s && s.fixed > 0 ? `
      <div class="c" style="background: var(--card-subtle); border-left: 4px solid var(--acc);">
        <b>Daily Breakeven Goal:</b> Running costs are approximately <b>${fm(s.perDay)}/day</b>. That is the gross profit your shop needs daily to break even.
      </div>
    ` : ""}

    <div class="c">
      <h3>Anticipated Events & Patterns</h3>
      ${L([...sig, ...pats])}
      <h3 style="margin-top: 14px;">Open Staff Hunches & Rumours</h3>
      ${L(hs)}
    </div>

    <div class="c">
      <h3>\u26A0\uFE0F What May Be Quietly Breaking</h3>
      ${L(warn)}
    </div>

    <div class="c">
      <h3>Market & External Signals</h3>
      <p class="m">Local weather, festivals, rival shop promotions, social trends.</p>
      ${A.me.owner ? `
        <details class="accordion" style="margin-bottom: 12px;">
          <summary>+ Add a Market Signal</summary>
          <div class="acc-body">
            <div data-form="signals">
              <label>Source</label>
              <select name="src">
                <option>Google Trends</option>
                <option>Weather</option>
                <option>Festival</option>
                <option>Instagram/Facebook</option>
                <option>Ads or Maps visibility</option>
                <option>Rival</option>
                <option>Other</option>
              </select>
              <label>What did you see?</label>
              <input name="t" placeholder="e.g. Heavy rain forecast tomorrow afternoon">
              <label>Confidence</label>
              <select name="c">
                <option>low</option>
                <option selected>medium</option>
                <option>high</option>
              </select>
              <label>Applies On</label>
              <input name="on" type="date">
              <button class="btn sm" data-a="add" data-c="signals">Save Signal</button>
            </div>
          </div>
        </details>
      ` : ""}
      ${L(A.signals.slice().reverse().map((x) => `${x.src}: ${x.t} (${x.c} confidence${x.on ? ", applies on " + x.on : ""})`))}
    </div>
  `;
  };
  var biz = () => {
    const o = A.me.owner;
    const s = A.summary;
    return `
    <h2>${esc(A.business.name)}</h2>
    <p class="m">${esc(A.business.type || "Shop")} \xB7 Currency: <b>${esc(A.business.currency || "\u20B9")}</b></p>

    <!-- Financial Breakeven Dashboard -->
    <div class="c">
      <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap;">
        <h3>What It Costs to Open the Doors</h3>
        <span class="m">Monthly Operating Baseline</span>
      </div>

      ${o ? s && (s.fixed > 0 || s.stockValue > 0) ? `
        <div class="dash-metrics">
          <div class="metric-card hero">
            <div class="metric-title">Monthly Fixed Cost</div>
            <div class="metric-num">${fm(s.fixed)}</div>
            <div class="metric-desc">~${fm(s.perDay)}/day needed to break even</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Staff Salaries</div>
            <div class="metric-num">${fm(s.salaries)}</div>
            <div class="metric-desc">${A.people.filter((p) => p.salary > 0).length} paid team members</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Equipment Upkeep</div>
            <div class="metric-num">${fm(s.machines)}</div>
            <div class="metric-desc">${A.machines.length} tracked machines</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Other Overheads</div>
            <div class="metric-num">${fm(s.overheads)}</div>
            <div class="metric-desc">Rent, power, licenses</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Stock Value in Hand</div>
            <div class="metric-num">${fm(s.stockValue)}</div>
            <div class="metric-desc">${A.items.length} items at cost</div>
          </div>
        </div>
      ` : `
        <div style="background: var(--card-subtle); border-radius: 8px; padding: 14px; margin: 10px 0;">
          <p><b>No operating costs configured yet.</b></p>
          <p class="m">Add your staff payroll, equipment service fees, and monthly rent/bills below. Bahi will calculate your daily breakeven profit target.</p>
        </div>
      ` : '<p class="m">Financial details and operating overheads are only visible to the shop owner.</p>'}
    </div>

    <!-- Machinery & Equipment (High-level summary + Technical Changes Window) -->
    <div class="c">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3>Machinery & Equipment</h3>
          <p class="m">Clean overview of critical shop assets. Technical specs & power ratings live in settings.</p>
        </div>
      </div>

      <div style="margin-top: 10px;">
        ${A.machines.map((m) => `
          <div class="mach-card">
            <div class="mach-info">
              <div class="mach-title">${esc(m.name)}</div>
              <div class="mach-meta">
                ${m.everyDays ? `Serviced every ${m.everyDays} days` : "No service cadence set"}
                ${o && m.maintenanceCost ? ` \xB7 ${fm(m.maintenanceCost)} / service (~${fm(m.maintenanceCost * 30 / (m.everyDays || 30))}/mo)` : ""}
              </div>
            </div>
            <div class="row" style="margin: 0;">
              <button class="btn sm g" data-a="openMachModal" data-id="${m.id}">\u2699\uFE0F Technical Specs & Settings</button>
              ${o ? `<button class="chip" data-a="del" data-c="machines" data-i="${m.id}" style="color: var(--mute);">Remove</button>` : ""}
            </div>
          </div>
        `).join("") || '<p class="m" style="padding: 12px 0;">No machines or equipment added yet.</p>'}
      </div>

      ${o ? `
        <details class="accordion" style="margin-top: 14px;">
          <summary>\u2795 Add Machinery or Equipment</summary>
          <div class="acc-body">
            <div data-form="machines">
              <label>Machine / Equipment Name *</label>
              <input name="name" placeholder="e.g. Two-Group Espresso Machine or Commercial Chiller">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                <div>
                  <label>Cost per Service / Maintenance</label>
                  <input name="maintenanceCost" type="number" step="any" placeholder="e.g. 1500">
                </div>
                <div>
                  <label>Service Cadence (Days)</label>
                  <input name="everyDays" type="number" step="any" placeholder="e.g. 60">
                </div>
                <div>
                  <label>Power Draw (kW, optional)</label>
                  <input name="powerKw" type="number" step="any" placeholder="e.g. 2.5">
                </div>
              </div>
              <label>Maintenance Notes / Technician Advice</label>
              <textarea name="notes" rows="2" placeholder="e.g. Descale boiler with citric acid; check pump pressure at 9 bars"></textarea>

              <div style="margin: 10px 0 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-weight: 600;">Custom Technical Specs (Optional)</label>
                  <button type="button" class="chip" data-a="addKvRow" data-target="mach_kv" style="font-size: 11px;">+ Add Custom Spec</button>
                </div>
                <div id="mach_kv" style="margin-top: 6px;"></div>
              </div>

              <button class="btn" data-a="addWithExtra" data-c="machines" data-kv="mach_kv" style="margin-top: 8px;">Save Equipment</button>
            </div>
          </div>
        </details>
      ` : ""}
    </div>

    <!-- People & Staff Roles -->
    <div class="c">
      <h3>People & Team</h3>
      <p class="m">Staff can sign in with their name and a PIN to log notes and record inventory movements.</p>

      <div class="sc">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Type</th>
              ${o ? "<th>Monthly Salary</th>" : ""}
              <th>Phone</th>
              ${o ? "<th>Actions</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${A.people.map((p) => `
              <tr>
                <td><b>${esc(p.name)}</b> ${p.isOwner ? '<span class="tag">Owner</span>' : ""}</td>
                <td>${esc(p.role || "-")}</td>
                <td>${esc(p.empType || "Full-time")}</td>
                ${o ? `<td>${p.salary ? fm(p.salary) : "-"}</td>` : ""}
                <td>${esc(p.phone || "-")}</td>
                ${o ? `
                  <td>
                    ${!p.isOwner ? `<button class="chip" data-a="del" data-c="people" data-i="${p.id}">Remove</button>` : '<span class="m">Owner</span>'}
                  </td>
                ` : ""}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      ${o ? `
        <details class="accordion" style="margin-top: 12px;">
          <summary>\u2795 Add Team Member</summary>
          <div class="acc-body">
            <div data-form="people">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                <div>
                  <label>Name *</label>
                  <input name="name" placeholder="Full name">
                </div>
                <div>
                  <label>Role</label>
                  <input name="role" placeholder="e.g. Cashier, Chef, Store Assistant">
                </div>
                <div>
                  <label>Employment Type</label>
                  <input name="empType" placeholder="Full-time, Part-time, Daily wages">
                </div>
                <div>
                  <label>Monthly Salary</label>
                  <input name="salary" type="number" step="any" placeholder="Salary">
                </div>
                <div>
                  <label>WhatsApp / Phone</label>
                  <input name="phone" placeholder="Phone number">
                </div>
                <div>
                  <label>Sign-in PIN (4+ digits)</label>
                  <input name="pin" type="password" placeholder="PIN for app login">
                </div>
              </div>
              <button class="btn" data-a="add" data-c="people" style="margin-top: 8px;">Add Member</button>
            </div>
          </div>
        </details>
      ` : ""}
    </div>

    <!-- Database Storage Backend Status & Render Setup -->
    <div class="c" style="border-left: 4px solid ${A.storage?.type === "postgres" && A.storage?.connected ? "var(--green)" : "#eab308"};">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3 style="margin-bottom: 2px;">Database & Storage Backend</h3>
          <p class="m" style="margin-bottom: 0;">
            ${A.storage?.type === "postgres" && A.storage?.connected ? "\u{1F7E2} <b>PostgreSQL Database Active:</b> Your data is permanently saved in PostgreSQL." : "\u{1F7E1} <b>Local JSON File Storage:</b> Currently saving to local storage. Connect a PostgreSQL database to persist data on Render."}
          </p>
        </div>
        <span class="tag" style="font-weight: 600; font-size: 12px; padding: 4px 10px;">
          ${A.storage?.type === "postgres" ? "PostgreSQL" : "JSON Storage"}
        </span>
      </div>

      <details class="accordion" style="margin-top: 12px;">
        <summary>\u2699\uFE0F How to Connect Render Database (https://buildnight.onrender.com/)</summary>
        <div class="acc-body" style="font-size: 13px; line-height: 1.6;">
          <p>To persist data on Render across restarts and deployments:</p>
          <ol style="padding-left: 20px; margin: 8px 0;">
            <li>Go to your Render Dashboard (<b>https://dashboard.render.com</b>).</li>
            <li>Click <b>New +</b> &rarr; <b>PostgreSQL</b> to create a database instance.</li>
            <li>Copy the <b>Internal Database URL</b> (starts with <code>postgres://...</code>).</li>
            <li>Navigate to your Web Service (<b>buildnight</b>) &rarr; <b>Environment</b> tab.</li>
            <li>Add environment variable: <b><code>DATABASE_URL</code></b> with your copied connection string.</li>
            <li>Click <b>Save Changes</b>. Bahi connects automatically, creates tables, and saves all data permanently!</li>
          </ol>
          <div class="code-box">DATABASE_URL=postgres://user:password@dpg-xxx:5432/bahi_db</div>
        </div>
      </details>
    </div>

    <!-- WhatsApp Business Webhook Card -->
    <div class="c" style="border-left: 4px solid #128c7e;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <h3 style="margin-bottom: 2px;">\u{1F4AC} WhatsApp Operations Webhook</h3>
          <p class="m" style="margin-bottom: 0;">Capture notes from WhatsApp business groups starting with <code>/save</code>.</p>
        </div>
        <button class="btn sm" data-a="openWaModal" style="background: #128c7e; border-color: #128c7e;">Setup & Test WhatsApp</button>
      </div>
    </div>

    <!-- Running Costs (Owner Only) -->
    ${o ? `
      <div class="c">
        <h3>Other Running Costs</h3>
        <p class="m">Rent, electricity, licenses, internet, packaging supplies.</p>
        <div class="sc">
          <table>
            <thead>
              <tr>
                <th>Cost Name</th>
                <th>Amount</th>
                <th>Cadence</th>
                <th>Monthly Impact</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${A.costs.map((c) => {
      const per = { monthly: 1, weekly: 52 / 12, daily: 30, yearly: 1 / 12 };
      const monthlyAmt = (c.amount || 0) * (per[c.period] ?? 1);
      return `
                  <tr>
                    <td><b>${esc(c.name)}</b></td>
                    <td>${fm(c.amount)}</td>
                    <td><span class="tag">${esc(c.period)}</span></td>
                    <td>~${fm(monthlyAmt)}/mo</td>
                    <td><button class="chip" data-a="del" data-c="costs" data-i="${c.id}">Remove</button></td>
                  </tr>
                `;
    }).join("") || '<tr><td colspan="5" class="m">No recurring costs added yet.</td></tr>'}
            </tbody>
          </table>
        </div>

        <details class="accordion" style="margin-top: 12px;">
          <summary>\u2795 Add Running Cost</summary>
          <div class="acc-body">
            <div data-form="costs">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                <div>
                  <label>Cost Name *</label>
                  <input name="name" placeholder="e.g. Shop Rent or Commercial Power">
                </div>
                <div>
                  <label>Amount</label>
                  <input name="amount" type="number" step="any" placeholder="Amount">
                </div>
                <div>
                  <label>Billing Cadence</label>
                  <select name="period">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <button class="btn" data-a="add" data-c="costs" style="margin-top: 8px;">Save Cost</button>
            </div>
          </div>
        </details>
      </div>

      <!-- Pre-builds & Starter Templates Drawer -->
      <div class="c">
        <h3>\u{1F4E6} Business Pre-Builds & Starter Templates</h3>
        <p class="m">Load realistic items, machines, and operating costs from tested business categories.</p>
        <div class="template-grid">
          ${(templatesCache.length ? templatesCache : [
      { id: "kirana", name: "Kirana & Grocery", icon: "\u{1F6D2}", description: "Essential staples, grains, weighing scales, deep freezer" },
      { id: "cafe", name: "Cafe & Bakery", icon: "\u2615", description: "Coffee beans, bakery goods, espresso machine, oven" },
      { id: "restaurant", name: "Restaurant & Dhaba", icon: "\u{1F37D}\uFE0F", description: "Cooking provisions, burner ranges, vertical chiller" },
      { id: "barber", name: "Salon & Barber Studio", icon: "\u{1F488}", description: "Hair products, hydraulic chairs, clippers, towel care" },
      { id: "sweets", name: "Sweets & Mithai Shop", icon: "\u{1F36C}", description: "Mawa, desi ghee, mawa making kadai, display counter" }
    ]).map((t) => `
            <div class="tmpl-card">
              <div class="tmpl-icon">${t.icon || "\u{1F4E6}"}</div>
              <div class="tmpl-title">${esc(t.name)}</div>
              <div class="tmpl-desc">${esc(t.description)}</div>
              <div class="row" style="margin-top: 10px;">
                <button class="btn sm" data-a="applyTmpl" data-id="${t.id}" data-mode="add">+ Add Items</button>
                <button class="btn sm g" data-a="applyTmpl" data-id="${t.id}" data-mode="replace">Replace All</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Danger Zone / Reset Business -->
      <div class="c" style="border-color: rgba(176, 66, 42, 0.4);">
        <h3 style="color: var(--acc);">Owner Controls</h3>
        <p class="m">Need to re-setup from scratch or test another business profile?</p>
        <button class="chip" data-a="resetBusiness" style="color: var(--acc); border-color: var(--acc); margin-top: 6px;">Reset Business & Re-run Setup</button>
      </div>
    ` : ""}
  `;
  };
  function renderModal() {
    const mc = $("#modalContainer");
    if (!mc || !activeModal) return;
    if (activeModal.type === "machine") {
      const m = A?.machines?.find((x) => x.id === activeModal.machineId);
      if (!m) {
        activeModal = null;
        mc.hidden = true;
        return;
      }
      const extraEntries = Object.entries(m.extra || {});
      mc.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <h3>${esc(m.name)}</h3>
            <div class="m" style="margin: 0;">Technical Specifications & Maintenance</div>
          </div>
          <button class="chip" data-a="closeModal" style="padding: 4px 10px;">\u2715</button>
        </div>

        <div style="background: var(--card-subtle); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <small class="m">SERVICE SCHEDULE</small>
              <div style="font-weight: 600;">Every ${m.everyDays || 30} days</div>
            </div>
            <div>
              <small class="m">COST PER SERVICE</small>
              <div style="font-weight: 600;">${m.maintenanceCost ? fm(m.maintenanceCost) : "None set"}</div>
            </div>
            <div>
              <small class="m">POWER DRAW</small>
              <div style="font-weight: 600;">${m.powerKw ? m.powerKw + " kW" : "Not rated"}</div>
            </div>
            <div>
              <small class="m">ESTIMATED POWER/DAY</small>
              <div style="font-weight: 600;">${m.powerKw ? (m.powerKw * 8).toFixed(1) + " kWh (~8 hrs)" : "-"}</div>
            </div>
          </div>
        </div>

        <h4>Maintenance & Technician Notes</h4>
        <p style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 6px 0 14px; font-size: 14px;">
          ${esc(m.notes || "No maintenance notes entered yet. You can add them below.")}
        </p>

        <h4>Technical Attributes & Specifications</h4>
        ${extraEntries.length ? `
          <div style="margin: 8px 0;">
            ${extraEntries.map(([k, v]) => `
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--line-subtle); font-size: 14px;">
                <span class="m">${esc(k)}</span>
                <span style="font-weight: 500;">${esc(v)}</span>
              </div>
            `).join("")}
          </div>
        ` : '<p class="m" style="margin: 6px 0 12px;">No custom attributes specified.</p>'}

        ${A.me ? `
          <details class="accordion" style="margin-top: 14px;">
            <summary>Edit Technical Values & Attributes</summary>
            <div class="acc-body" id="machEditForm">
              <label>Service Cadence (Days)</label>
              <input id="me_every" type="number" step="any" value="${m.everyDays || ""}">
              <label>Maintenance Cost</label>
              <input id="me_cost" type="number" step="any" value="${m.maintenanceCost || ""}">
              <label>Power Draw (kW)</label>
              <input id="me_kw" type="number" step="any" value="${m.powerKw || ""}">
              <label>Maintenance Notes</label>
              <textarea id="me_notes" rows="2">${esc(m.notes || "")}</textarea>

              <div style="margin: 10px 0 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-weight: 600;">Add / Update Custom Spec</label>
                  <button type="button" class="chip" data-a="addKvRow" data-target="me_kv" style="font-size: 11px;">+ Add Field</button>
                </div>
                <div id="me_kv"></div>
              </div>

              <button class="btn sm" data-a="saveMachEdit" data-id="${m.id}" style="margin-top: 10px;">Save Changes</button>
            </div>
          </details>
        ` : ""}

        <div style="margin-top: 18px; text-align: right;">
          <button class="chip" data-a="closeModal">Close Window</button>
        </div>
      </div>
    `;
      mc.hidden = false;
    } else if (activeModal.type === "item") {
      const item = A?.items?.find((x) => x.id === activeModal.itemId);
      if (!item) {
        activeModal = null;
        mc.hidden = true;
        return;
      }
      const extraEntries = Object.entries(item.extra || {});
      mc.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <h3>${esc(item.name)}</h3>
            <div class="m" style="margin: 0;">Item Specifications & Settings</div>
          </div>
          <button class="chip" data-a="closeModal" style="padding: 4px 10px;">\u2715</button>
        </div>

        <div style="background: var(--card-subtle); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <small class="m">IN HAND</small>
              <div style="font-weight: 600; font-size: 16px;">${item.qty ?? 0} ${esc(item.unit || "")}</div>
            </div>
            <div>
              <small class="m">LOW STOCK ALERT</small>
              <div style="font-weight: 600;">Below ${item.low ?? 0}</div>
            </div>
            <div>
              <small class="m">COST PRICE</small>
              <div style="font-weight: 600;">${item.costPrice != null ? fm(item.costPrice) : "-"}</div>
            </div>
            <div>
              <small class="m">SELLING PRICE</small>
              <div style="font-weight: 600;">${item.sellPrice != null ? fm(item.sellPrice) : "-"}</div>
            </div>
          </div>
        </div>

        <h4>Custom Attributes & Fields</h4>
        ${extraEntries.length ? `
          <div style="margin: 8px 0;">
            ${extraEntries.map(([k, v]) => `
              <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--line-subtle); font-size: 14px;">
                <span class="m">${esc(k)}</span>
                <span style="font-weight: 500;">${esc(v)}</span>
              </div>
            `).join("")}
          </div>
        ` : '<p class="m" style="margin: 6px 0 12px;">No custom attributes specified for this item.</p>'}

        ${A.me ? `
          <details class="accordion" style="margin-top: 14px;">
            <summary>Edit Item Details & Attributes</summary>
            <div class="acc-body">
              <label>Item Name</label>
              <input id="ie_name" value="${esc(item.name)}">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <label>Unit</label>
                  <input id="ie_unit" value="${esc(item.unit || "")}">
                </div>
                <div>
                  <label>Low Stock Warning Threshold</label>
                  <input id="ie_low" type="number" step="any" value="${item.low ?? ""}">
                </div>
                <div>
                  <label>Cost Price</label>
                  <input id="ie_cost" type="number" step="any" value="${item.costPrice ?? ""}">
                </div>
                <div>
                  <label>Sell Price</label>
                  <input id="ie_sell" type="number" step="any" value="${item.sellPrice ?? ""}">
                </div>
              </div>

              <div style="margin: 10px 0 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-weight: 600;">Add / Update Custom Field</label>
                  <button type="button" class="chip" data-a="addKvRow" data-target="ie_kv" style="font-size: 11px;">+ Add Field</button>
                </div>
                <div id="ie_kv"></div>
              </div>

              <div class="row" style="margin-top: 12px; justify-content: space-between;">
                <button class="btn sm" data-a="saveItemEdit" data-id="${item.id}">Save Changes</button>
                <button class="chip" data-a="del" data-c="items" data-i="${item.id}" style="color: var(--acc);">Delete Item</button>
              </div>
            </div>
          </details>
        ` : ""}

        <div style="margin-top: 18px; text-align: right;">
          <button class="chip" data-a="closeModal">Close Window</button>
        </div>
      </div>
    `;
      mc.hidden = false;
    } else if (activeModal.type === "whatsapp") {
      const origin = API_BASE || window.location.origin;
      const webhookUrl = `${origin}/api/whatsapp`;
      const isOwner = !!A?.me?.owner;
      const token = A?.business?.waVerify || "bahi_whatsapp_token";
      mc.innerHTML = `
      <div class="modal-box" style="max-width: 620px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">\u{1F4AC}</span>
            <div>
              <h3>WhatsApp Group & Operations Webhook</h3>
              <div class="m" style="margin: 0;">Automated capture of shop group messages and ledger updates</div>
            </div>
          </div>
          <button class="chip" data-a="closeModal" style="padding: 4px 10px;">\u2715</button>
        </div>

        <div style="font-size: 14px; line-height: 1.55;">
          <div style="background: rgba(37, 211, 102, 0.08); border: 1px solid rgba(37, 211, 102, 0.25); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <h4 style="color: #075e54; margin-bottom: 4px;">\u{1F680} How the WhatsApp Group Integration Works</h4>
            <p style="margin: 0; font-size: 13px; color: var(--ink);">
              Add your WhatsApp bot or Business phone number to your shop's staff group (e.g. <i>"Kirana Shop Operations"</i>).
              When team members or owners post notes starting with <b><code>/save</code></b>, Bahi automatically catches the text, flags it for <b>Analysis & Processing</b>, tags the sender, and saves it directly to your Operations Log in real-time!
            </p>
          </div>

          <label style="font-weight: 600;">1. Webhook Callback URL</label>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px;">
            <input readonly value="${esc(webhookUrl)}" style="margin: 0; font-family: var(--font-mono); font-size: 12px;">
            <button class="btn sm" data-a="copyText" data-text="${esc(webhookUrl)}">Copy URL</button>
          </div>

          <label style="font-weight: 600;">2. Webhook Verify Token</label>
          ${isOwner ? `
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 14px;">
            <input readonly value="${esc(token)}" style="margin: 0; font-family: var(--font-mono); font-size: 12px;">
            <button class="btn sm" data-a="copyText" data-text="${esc(token)}">Copy Token</button>
          </div>` : '<p class="m" style="margin-bottom: 14px;">Only the owner can see the verify token.</p>'}

          <h4 style="margin-top: 14px; margin-bottom: 6px;">Supported WhatsApp Commands</h4>
          <ul style="padding-left: 20px; font-size: 13px; color: var(--ink-subtle); margin-bottom: 16px;">
            <li><b><code>/save [text]</code></b> &rarr; Saved to Bahi and tagged <b>\u{1F50D} For Analysis / Processing</b>.</li>
            <li><b><code>/analyze [text]</code></b> &rarr; Saved and flagged for immediate management review.</li>
            <li><b><code>/issue [text]</code></b> &rarr; Logged as an urgent equipment or shop issue.</li>
            <li><b>Plain message / photo</b> &rarr; Logged as a standard operational note under sender's name.</li>
          </ul>

          <div style="border-top: 1px solid var(--line); padding-top: 14px; margin-top: 14px;">
            <h4 style="margin-bottom: 6px;">\u{1F9EA} Interactive Webhook Simulator (Test Live)</h4>
            <p class="m">Test sending a simulated WhatsApp group message to verify your timeline updates instantly:</p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
              <div>
                <label>Sender Phone (WhatsApp)</label>
                <input id="wa_test_phone" value="${esc(A?.people?.[0]?.phone || "919876543210")}" placeholder="e.g. 919876543210">
              </div>
              <div style="display: flex; align-items: center; padding-top: 18px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                  <input type="checkbox" id="wa_test_is_group" checked style="width: auto; margin: 0;">
                  Sent from Business Group
                </label>
              </div>
            </div>

            <label>Message Content (starts with /save)</label>
            <textarea id="wa_test_msg" rows="2" style="font-family: inherit; font-size: 13px;">/save Received 10 bags of basmati rice from supplier; 2 bags damaged in transit</textarea>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <button class="btn" id="wa_send_btn" data-a="sendWaTest">\u{1F680} Send Simulated WhatsApp Message</button>
              <div id="wa_test_result"></div>
            </div>
          </div>
        </div>

        <div style="margin-top: 18px; text-align: right;">
          <button class="chip" data-a="closeModal">Close Window</button>
        </div>
      </div>
    `;
      mc.hidden = false;
    } else if (activeModal.type === "video") {
      mc.innerHTML = `
      <div class="modal-box" style="max-width: 520px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">\u{1F4F9}</span>
            <div>
              <h3>Record Video Note</h3>
              <div class="m" style="margin: 0;">Record a short video clip for your shop journal</div>
            </div>
          </div>
          <button class="chip" data-a="closeVideoModal" style="padding: 4px 10px;">\u2715</button>
        </div>

        <div style="text-align: center;">
          <video id="camPreview" autoplay playsinline muted style="width: 100%; height: 260px; background: #000; border-radius: 8px; object-fit: cover;"></video>
          <div id="camError" class="m" style="color: var(--acc); font-weight: 500; margin: 8px 0;" hidden></div>
          <div id="vidTimerText" style="font-weight: 700; margin: 8px 0; font-size: 15px;">
            ${isVideoRecording ? `\u{1F534} Recording: ${videoSeconds}s` : "Camera ready"}
          </div>

          <div class="row" style="justify-content: center; margin-top: 12px; gap: 10px;">
            ${!isVideoRecording ? `
              <button class="btn" data-a="startVideoRec" style="background: var(--acc); border-color: var(--acc); padding: 10px 20px;">
                \u{1F534} Start Recording Video
              </button>
            ` : `
              <button class="btn" data-a="stopVideoRec" style="padding: 10px 20px;">
                \u23F9\uFE0F Stop & Attach Video
              </button>
            `}
          </div>

          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px;" class="m">
            Or select an existing video file from your device:
            <div style="margin-top: 6px;">
              <input type="file" id="vidUploadInput" accept="video/*" capture="environment" style="font-size: 12px;">
            </div>
          </div>
        </div>

        <div style="margin-top: 14px; text-align: right;">
          <button class="chip" data-a="closeVideoModal">Cancel</button>
        </div>
      </div>
    `;
      mc.hidden = false;
    } else if (activeModal.type === "image") {
      mc.innerHTML = `
      <div class="modal-box" style="max-width: 800px; text-align: center; padding: 16px;">
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
          <button class="chip" data-a="closeModal" style="padding: 4px 10px;">\u2715 Close</button>
        </div>
        <img src="${esc(activeModal.src)}" alt="Full photo" style="max-width: 100%; max-height: 75vh; border-radius: 8px; object-fit: contain;">
      </div>
    `;
      mc.hidden = false;
    } else if (activeModal.type === "editEntry") {
      const e = A?.entries?.find((x) => x.id === activeModal.entryId);
      if (!e) {
        activeModal = null;
        mc.hidden = true;
        return;
      }
      mc.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Edit Operations Note</h3>
          <button class="chip" data-a="closeModal" style="padding: 4px 10px;">\u2715</button>
        </div>
        <label>Note Text</label>
        <textarea id="edit_entry_txt" rows="4">${esc(e.txt || "")}</textarea>
        <label>Who or what is this about?</label>
        <input id="edit_entry_about" value="${esc(e.about || "")}">
        <div style="margin: 10px 0;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
            <input type="checkbox" id="edit_entry_an" ${e.an ? "checked" : ""} style="width: auto; margin: 0;">
            Marked for Analysis & Processing
          </label>
        </div>
        <div class="row" style="justify-content: space-between; margin-top: 14px;">
          <button class="btn" data-a="saveEntryEdit" data-id="${e.id}">Save Changes</button>
          <button class="chip" data-a="closeModal">Cancel</button>
        </div>
      </div>
    `;
      mc.hidden = false;
    }
  }
  function img(f, k) {
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => {
        const s = Math.min(1, 900 / Math.max(i.width, i.height));
        const c = document.createElement("canvas");
        c.width = i.width * s;
        c.height = i.height * s;
        c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
        dr[k] = c.toDataURL("image/jpeg", 0.7);
        draw();
      };
      i.src = r.result;
    };
    r.readAsDataURL(f);
  }
  var vals = (root) => {
    const b = {};
    if (!root) return b;
    root.querySelectorAll("[name]").forEach((i) => b[i.name] = i.value);
    return b;
  };
  var extractKvRows = (containerId) => {
    const container = $("#" + containerId);
    const extra = {};
    if (!container) return extra;
    container.querySelectorAll(".kv-row").forEach((row) => {
      const k = row.querySelector(".kv-k")?.value?.trim();
      const v = row.querySelector(".kv-v")?.value?.trim();
      if (k && v) extra[k] = v;
    });
    return extra;
  };
  var ACT = {
    pickTmpl(d) {
      chosenTemplateId = d.id;
      $$(".tmpl-card").forEach((el) => {
        el.classList.toggle("on", el.dataset.id === d.id);
      });
      const typeInp = $("#st");
      if (typeInp) typeInp.value = TYPE_HINT[d.id] || "";
    },
    setCurr(d) {
      dr.currency = d.c;
      $$('[data-a="setCurr"]').forEach((b) => b.classList.toggle("on", b.dataset.c === d.c));
      const currInp = $("#sc");
      if (currInp) currInp.value = d.c;
    },
    async setup() {
      const name = $("#sb")?.value?.trim();
      const type = $("#st")?.value?.trim();
      const currency = $("#sc")?.value?.trim() || dr.currency || "\u20B9";
      const owner = $("#so")?.value?.trim();
      const pin = $("#sp")?.value;
      const code = $("#sk")?.value;
      const loadStarter = $("#loadStarterCheck")?.checked;
      const template = loadStarter && chosenTemplateId && chosenTemplateId !== "custom" ? chosenTemplateId : void 0;
      if (!name || !owner || !pin || pin.length < 4) {
        alert("Please enter your business name, your name, and a 4+ digit PIN.");
        return;
      }
      const r = await api("POST", "setup", { name, type, currency, owner, pin, code, template });
      await enter(r.token);
    },
    async login() {
      const name = $("#ln")?.value?.trim();
      const pin = $("#lp")?.value;
      if (!name || !pin) {
        alert("Please enter your name and PIN.");
        return;
      }
      const r = await api("POST", "login", { name, pin });
      await enter(r.token);
    },
    reload() {
      location.reload();
    },
    rmKvRow(d, el) {
      el?.closest(".kv-row")?.remove();
    },
    async resetPublic() {
      if (!confirm("Reset entire business? This will permanently clear ALL data and start the setup wizard again.")) return;
      const code = META?.code ? prompt("Enter the server setup code to confirm:") : void 0;
      if (META?.code && code == null) return;
      await api("POST", "reset-public", { code });
      logout();
    },
    logout,
    kind: (d) => {
      dr.kind = d.v;
      draw();
    },
    when: (d) => {
      dr.when = d.v;
      draw();
    },
    an: () => {
      dr.an = !dr.an;
      draw();
    },
    setStockView: (d) => {
      stockViewMode = d.v;
      draw();
    },
    addKvRow(d) {
      const target = $("#" + d.target);
      if (!target) return;
      const div = document.createElement("div");
      div.className = "kv-row";
      div.innerHTML = `
      <input class="kv-k" placeholder="Attribute (e.g. Brand, Batch, Location)" style="flex: 1;">
      <input class="kv-v" placeholder="Value" style="flex: 1;">
      <button type="button" class="chip" data-a="rmKvRow" title="Remove this field" style="padding: 4px 8px;">\u2715</button>
    `;
      target.appendChild(div);
    },
    openMachModal(d) {
      activeModal = { type: "machine", machineId: d.id };
      renderModal();
    },
    openItemSpecs(d) {
      activeModal = { type: "item", itemId: d.id };
      renderModal();
    },
    closeModal() {
      activeModal = null;
      const mc = $("#modalContainer");
      if (mc) mc.hidden = true;
    },
    async saveMachEdit(d) {
      const everyDays = numOrUndef($("#me_every")?.value);
      const maintenanceCost = numOrUndef($("#me_cost")?.value);
      const powerKw = numOrUndef($("#me_kw")?.value);
      const notes = $("#me_notes")?.value?.trim();
      const extra = extractKvRows("me_kv");
      await api("PATCH", `machines/${d.id}`, { everyDays, maintenanceCost, powerKw, notes, extra });
      await refresh();
      renderModal();
    },
    async saveItemEdit(d) {
      const name = $("#ie_name")?.value?.trim();
      const unit = $("#ie_unit")?.value?.trim();
      const low = numOrUndef($("#ie_low")?.value);
      const costPrice = numOrUndef($("#ie_cost")?.value);
      const sellPrice = numOrUndef($("#ie_sell")?.value);
      const extra = extractKvRows("ie_kv");
      await api("PATCH", `items/${d.id}`, { name, unit, low, costPrice, sellPrice, extra });
      await refresh();
      renderModal();
    },
    async quickMv(d) {
      const qty = Number(d.d);
      await api("POST", "moves", { itemId: d.i, qty });
      await refresh();
    },
    delDraftFile(d) {
      dr.files = (dr.files || []).filter((f) => f.id !== d.id);
      draw();
    },
    async toggleVoiceRecord() {
      if (isRecordingVoice) {
        if (voiceRecorder && voiceRecorder.state !== "inactive") {
          voiceRecorder.stop();
        }
        isRecordingVoice = false;
        return;
      }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceChunks = [];
        voiceSeconds = 0;
        isRecordingVoice = true;
        voiceRecorder = new MediaRecorder(st);
        voiceRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) voiceChunks.push(e.data);
        };
        voiceRecorder.onstop = () => {
          st.getTracks().forEach((track) => track.stop());
          clearInterval(voiceTimerInterval);
          isRecordingVoice = false;
          const blob = new Blob(voiceChunks, { type: voiceRecorder?.mimeType || "audio/webm" });
          const reader = new FileReader();
          reader.onload = () => {
            dr.files = dr.files || [];
            const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
            dr.files.push({
              id: "aud_" + Math.random().toString(36).slice(2, 9),
              name: `Voice note (${timeStr})`,
              type: blob.type,
              category: "audio",
              size: blob.size,
              data: String(reader.result)
            });
            draw();
          };
          reader.readAsDataURL(blob);
        };
        voiceRecorder.start();
        voiceTimerInterval = setInterval(() => {
          voiceSeconds++;
          const el = $("#voiceTimerBadge");
          if (el) el.textContent = `\u{1F534} Recording (${voiceSeconds}s) - Tap to Stop`;
        }, 1e3);
        draw();
      } catch (e) {
        alert("Could not open microphone: " + e.message);
      }
    },
    async openVideoModal() {
      activeModal = { type: "video" };
      renderModal();
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });
        const videoEl = $("#camPreview");
        if (videoEl) {
          videoEl.srcObject = videoStream;
          videoEl.play();
        }
      } catch (err) {
        console.warn("Camera could not be opened:", err);
        const errBox = $("#camError");
        if (errBox) {
          errBox.textContent = "Camera not available or access denied. You can record or select a video file using the option below.";
          errBox.hidden = false;
        }
      }
    },
    closeVideoModal() {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
        videoStream = null;
      }
      if (videoRecorder && videoRecorder.state !== "inactive") {
        videoRecorder.stop();
      }
      clearInterval(videoTimerInterval);
      isVideoRecording = false;
      videoRecorder = null;
      activeModal = null;
      draw();
    },
    startVideoRec() {
      if (!videoStream) {
        alert("Camera stream not ready. Please allow camera access or choose a video file below.");
        return;
      }
      videoChunks = [];
      videoSeconds = 0;
      isVideoRecording = true;
      try {
        videoRecorder = new MediaRecorder(videoStream);
        videoRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunks.push(e.data);
        };
        videoRecorder.onstop = () => {
          clearInterval(videoTimerInterval);
          const blob = new Blob(videoChunks, { type: videoRecorder?.mimeType || "video/webm" });
          const reader = new FileReader();
          reader.onload = () => {
            dr.files = dr.files || [];
            const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
            dr.files.push({
              id: "vid_" + Math.random().toString(36).slice(2, 9),
              name: `Video note (${timeStr})`,
              type: blob.type,
              category: "video",
              size: blob.size,
              data: String(reader.result)
            });
            ACT.closeVideoModal();
          };
          reader.readAsDataURL(blob);
        };
        videoRecorder.start();
        videoTimerInterval = setInterval(() => {
          videoSeconds++;
          const timerEl = $("#vidTimerText");
          if (timerEl) timerEl.textContent = `\u{1F534} Recording: ${videoSeconds}s`;
        }, 1e3);
        renderModal();
      } catch (err) {
        alert("Could not start video recorder: " + err.message);
      }
    },
    stopVideoRec() {
      if (videoRecorder && videoRecorder.state !== "inactive") {
        videoRecorder.stop();
      }
    },
    viewFullImage(d) {
      activeModal = { type: "image", src: d.src };
      renderModal();
    },
    openWaModal() {
      activeModal = { type: "whatsapp" };
      renderModal();
    },
    async sendWaTest() {
      const phone = $("#wa_test_phone")?.value?.trim() || "+91 98765 43210";
      const text = $("#wa_test_msg")?.value?.trim();
      const isGroup = $("#wa_test_is_group")?.checked;
      if (!text) {
        alert("Please enter message text (starts with /save)");
        return;
      }
      const btn = $("#wa_send_btn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending...";
      }
      try {
        await api("POST", "whatsapp/test", { from: phone, text, isGroup });
        const resBox = $("#wa_test_result");
        if (resBox) {
          resBox.innerHTML = '<span style="color: var(--green); font-weight: 600; font-size: 13px;">\u2713 Message received & note saved!</span>';
        }
        await refresh();
      } catch (err) {
        alert("Test failed: " + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "\u{1F680} Send Simulated WhatsApp Message";
        }
      }
    },
    copyText(d) {
      if (!d.text) return;
      navigator.clipboard?.writeText(d.text).then(() => {
        alert("Copied to clipboard: " + d.text);
      }).catch(() => {
        prompt("Copy URL/Token:", d.text);
      });
    },
    fillUser(d) {
      const nameInp = $("#ln");
      if (nameInp) nameInp.value = d.name;
      $$('[data-a="fillUser"]').forEach((b) => b.classList.toggle("on", b.dataset.name === d.name));
      const pinInp = $("#lp");
      if (pinInp) pinInp.focus();
    },
    async delEntry(d) {
      if (!confirm("Are you sure you want to delete this note?")) return;
      await api("DELETE", `entries/${d.i}`);
      await refresh();
    },
    editEntry(d) {
      activeModal = { type: "editEntry", entryId: d.i };
      renderModal();
    },
    async saveEntryEdit(d) {
      const txt = $("#edit_entry_txt")?.value?.trim();
      const about = $("#edit_entry_about")?.value?.trim();
      const an = $("#edit_entry_an")?.checked;
      await api("PATCH", `entries/${d.id}`, { txt, about, an });
      activeModal = null;
      await refresh();
    },
    async removeEntryAttachment(d) {
      if (!confirm("Remove this attachment?")) return;
      if (d.legacy === "img") {
        await api("PATCH", `entries/${d.eid}`, { removeImg: true });
      } else if (d.legacy === "aud") {
        await api("PATCH", `entries/${d.eid}`, { removeAud: true });
      } else {
        await api("PATCH", `entries/${d.eid}`, { removeFileId: d.fid });
      }
      await refresh();
    },
    async post() {
      let t = $("#t")?.value || "";
      let an = dr.an;
      let kind = dr.kind;
      const m = t.match(/^\/(save|analy[sz]e|sent)\s*/i);
      const iss = t.match(/^\/issue\s*/i);
      if (m) {
        an = true;
        t = t.slice(m[0].length);
      } else if (iss) {
        kind = "issue";
        t = t.slice(iss[0].length);
      }
      t = t.trim();
      let ev = now();
      if (dr.when === "earlier") ev -= 3 * 36e5;
      if (dr.when === "yday") ev -= D;
      if (dr.when === "pick" && $("#dt")?.value) ev = new Date($("#dt").value).getTime();
      const files = dr.files || [];
      if (!t && files.length === 0) {
        alert("Please write a note or attach files/recordings.");
        return;
      }
      await api("POST", "entries", {
        txt: t,
        kind,
        about: $("#ab")?.value?.trim(),
        ev,
        an,
        files
      });
      dr = { kind: "note", when: "now", files: [] };
      ["t", "ab", "dt"].forEach((k) => {
        const el = $("#" + k);
        if (el) el.value = "";
      });
      await refresh(true);
    },
    async confirm(d) {
      await api("POST", `entries/${d.i}/confirm`);
      await refresh();
    },
    async settle(d) {
      await api("PATCH", `entries/${d.i}`, { settled: true });
      await refresh();
    },
    async add(d) {
      const formEl = document.querySelector(`[data-form="${d.c}"]`);
      await api("POST", d.c, vals(formEl));
      await refresh();
    },
    async addWithExtra(d) {
      const formEl = document.querySelector(`[data-form="${d.c}"]`);
      const b = vals(formEl);
      const extra = extractKvRows(d.kv);
      if (Object.keys(extra).length) b.extra = extra;
      await api("POST", d.c, b);
      await refresh();
    },
    async del(d) {
      if (confirm("Are you sure you want to remove this?")) {
        await api("DELETE", `${d.c}/${d.i}`);
        if (activeModal && (activeModal.itemId === d.i || activeModal.machineId === d.i)) {
          activeModal = null;
        }
        await refresh();
      }
    },
    async mv(d) {
      const q = +$("#sq")?.value;
      if (!q || q <= 0) {
        alert("Please enter a valid positive quantity.");
        return;
      }
      await api("POST", "moves", { itemId: $("#si")?.value, qty: +d.d * q });
      const sqInp = $("#sq");
      if (sqInp) sqInp.value = "";
      await refresh();
    },
    async doimp() {
      const m = {};
      document.querySelectorAll("[data-m]").forEach((s) => m[s.dataset.m] = +s.value);
      const rows = imp.rows.map((r) => {
        const o = {};
        for (const k in m) if (m[k] >= 0) o[k] = r[m[k]];
        return o;
      });
      const res = await api("POST", "import/" + imp.kind, { rows });
      imp = { ...imp, res };
      await refresh();
    },
    async rows() {
      const rows = ($("#rows")?.value || "").split("\n").map((l) => l.match(/^(.+?)[,:\-\s]+(\d+(\.\d+)?)\s*\w*$/)).filter(Boolean).map((m) => ({ name: m[1].trim(), qty: m[2], type: $("#dd")?.value }));
      if (!rows.length) throw new Error("Type rows like: Sugar, 20");
      await api("POST", "import/moves", { rows });
      dr.doc = null;
      dr.rows = "";
      const rb = $("#rows");
      if (rb) rb.value = "";
      await refresh(true);
    },
    async bet() {
      const t = $("#bt")?.value?.trim();
      const brVal = $("#br")?.value;
      if (!t || !brVal) throw new Error("Please enter your bet description and a review date.");
      const snap = (A.signals || []).slice(-5).map((s) => `${s.src}: ${s.t}`).join("; ");
      await api("POST", "decisions", {
        txt: t,
        why: $("#bw")?.value?.trim(),
        exp: $("#be")?.value?.trim(),
        expN: numOrUndef($("#bn")?.value),
        rev: new Date(brVal).getTime(),
        snap
      });
      await refresh();
    },
    async rv(d) {
      const b = vals(document.querySelector(`[data-f="${d.i}"]`));
      await api("PATCH", `decisions/${d.i}`, { out: b.o, q: b.q, act: numOrUndef(b.a), w2: b.w, l: b.l });
      await refresh();
    },
    async applyTmpl(d) {
      if (d.mode === "replace" && !confirm("Replace current inventory, equipment, and costs with this starter template?")) return;
      await api("POST", "apply-template", { templateId: d.id, mode: d.mode });
      await refresh();
    },
    async resetBusiness() {
      if (confirm("Reset entire business? This will remove all items, machines, notes, and records so you can set up fresh.")) {
        try {
          await api("POST", "reset-business");
        } catch (e) {
          console.warn("reset-business error:", e);
        }
        logout();
      }
    }
  };
  function dismissModal() {
    if (!activeModal) return;
    if (activeModal.type === "video") ACT.closeVideoModal();
    else ACT.closeModal();
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismissModal();
    if (e.key === "Enter" && !e.shiftKey && e.target?.tagName === "INPUT") {
      if (e.target.id === "ln" || e.target.id === "lp") {
        e.preventDefault();
        ACT.login().catch((x) => alert(x.message));
      } else if (["sb", "st", "sc", "so", "sp", "sk"].includes(e.target.id)) {
        e.preventDefault();
        ACT.setup().catch((x) => alert(x.message));
      }
    }
  });
  document.addEventListener("click", async (e) => {
    if (e.target?.id === "modalContainer") return dismissModal();
    const b = e.target.closest("[data-a],[data-t]");
    if (!b) return;
    if (b.dataset.t) {
      tab = b.dataset.t;
      draw();
      return;
    }
    try {
      if (ACT[b.dataset.a]) await ACT[b.dataset.a](b.dataset, b);
    } catch (x) {
      alert(x.message);
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "sq_search") {
      stockFilter = e.target.value;
      const pos = e.target.selectionStart ?? stockFilter.length;
      draw();
      const box = $("#sq_search");
      if (box) {
        box.focus();
        box.setSelectionRange(pos, pos);
      }
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "fileUploadInput" && t.files && t.files.length) {
      dr.files = dr.files || [];
      Array.from(t.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const category = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "file";
          dr.files.push({
            id: "f_" + Math.random().toString(36).slice(2, 9),
            name: file.name,
            type: file.type || "application/octet-stream",
            category,
            size: file.size,
            data: String(reader.result)
          });
          draw();
        };
        reader.readAsDataURL(file);
      });
      t.value = "";
    }
    if (t.id === "vidUploadInput" && t.files && t.files[0]) {
      const file = t.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        dr.files = dr.files || [];
        const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
        dr.files.push({
          id: "vid_" + Math.random().toString(36).slice(2, 9),
          name: file.name || `Video note (${timeStr})`,
          type: file.type || "video/mp4",
          category: "video",
          size: file.size,
          data: String(reader.result)
        });
        ACT.closeVideoModal();
      };
      reader.readAsDataURL(file);
    }
    if (t.id === "pf" && t.files[0]) img(t.files[0], "img");
    if (t.id === "df" && t.files[0]) img(t.files[0], "doc");
    if (t.id === "cf" && t.files[0]) {
      const kind = $("#ik")?.value || "items";
      const f = new FileReader();
      f.onload = () => {
        const r = csv(String(f.result));
        if (r.length < 2) {
          alert("That file looks empty.");
          return;
        }
        imp = { kind, head: r[0].map((h) => h.trim()), rows: r.slice(1), map: guess(kind, r[0]) };
        draw();
      };
      f.readAsText(t.files[0]);
    }
  });
  document.addEventListener("focusout", () => {
    if (pend) {
      pend = false;
      setTimeout(draw, 100);
    }
  });
  boot();
})();
