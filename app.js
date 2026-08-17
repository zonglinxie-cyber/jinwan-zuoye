const STORAGE = "jw-tonight-v1";
const KEYS = { settings: "jw-settings", days: "jw-days", memory: "jw-memory" };

const KB = { meta: null, math: null, chinese: null, english: null };

const $ = (sel, el = document) => el.querySelector(sel);

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultSettings() {
  return {
    booksReady: false,
    mathBook: "renjiao-s4a",
    chineseBook: "tongbian-s4a",
    englishBook: "pep2024-s4a",
    englishUnit: "u1",
    presence: "solo",
    judgeOnly: false,
    seeUrl: "",
  };
}

const state = {
  screen: "home",
  settings: Object.assign(defaultSettings(), load(KEYS.settings, {})),
  days: load(KEYS.days, {}),
  memory: Object.assign({ skills: {}, errors: [] }, load(KEYS.memory, {})),
  subject: "math",
  itemId: null,
  photoDraft: "",
  recordTarget: null,
  recording: false,
  clockStart: 0,
  usedMs: 0,
  busy: "",
  lastAuto: null,
};

function persist() {
  save(KEYS.settings, state.settings);
  save(KEYS.days, state.days);
  save(KEYS.memory, state.memory);
}

function tonight() {
  const k = todayKey();
  if (!state.days[k]) state.days[k] = { key: k, items: [], usedMs: 0 };
  return state.days[k];
}
function items() {
  return tonight().items;
}
function currentItem() {
  return items().find((i) => i.id === state.itemId) || null;
}

function visibleStatus(item) {
  if (!item.stemConfirmed) return { label: "还没批", cls: "" };
  if (item.verdict === "correct") return { label: "对", cls: "ok" };
  if (item.verdict === "needs_redo") return { label: "错，要订正", cls: "redo" };
  if (item.verdict === "coaching") return { label: "一起看", cls: "" };
  if (item.memoryId) return { label: "记下了", cls: "ok" };
  if (["abstain", "out_of_unit", "parked"].includes(item.verdict) || item.parked)
    return { label: "等大人看", cls: "park" };
  return { label: "进行中", cls: "" };
}

function weekdayName() {
  return "日一二三四五六".charAt(new Date().getDay());
}

function similarMemory(item) {
  const skill = pickSkill(item, KB);
  const rec = state.memory.skills[skill];
  if (!rec || rec.status === "stable") return null;
  return rec;
}

function errorList() {
  if (!Array.isArray(state.memory.errors)) state.memory.errors = [];
  return state.memory.errors;
}

function watchingSkills() {
  return Object.values(state.memory.skills || {}).filter((s) => s.status === "watching" || s.status === "new");
}

function bumpSkill(item, teach, passed) {
  const id = teach.skill;
  const prev = state.memory.skills[id] || { id, fails: 0, passes: 0, banned: [], helpful: "", where: "" };
  if (passed) prev.passes += 1;
  else prev.fails += 1;
  prev.helpful = teach.lines[0];
  prev.where = teach.where || item.where || prev.where;
  prev.lastKey = todayKey();
  prev.lastStem = item.stem;
  prev.status = prev.fails >= 2 && prev.passes < 2 ? "watching" : prev.passes >= 2 ? "stable" : "new";
  state.memory.skills[id] = prev;
  item.memoryId = id;
}

function recordError(item, teach) {
  const errors = errorList();
  const existing = errors.find((e) => e.itemId === item.id && e.key === todayKey());
  const entry = existing || {
    id: uid(),
    itemId: item.id,
    key: todayKey(),
    subject: item.subject,
    stem: item.stem,
    wrongAnswer: item.childAnswer,
    stuck: item.stuck || "",
    skill: teach.skill,
    where: teach.where || item.where || "",
    helpful: teach.lines[0],
    fixed: false,
  };
  entry.wrongAnswer = item.childAnswer;
  entry.stuck = item.stuck || entry.stuck;
  entry.where = teach.where || item.where || entry.where;
  entry.why = item.why || entry.why || "";
  entry.helpful = teach.lines[0];
  entry.fixed = false;
  if (!existing) {
    errors.unshift(entry);
    bumpSkill(item, teach, false);
  }
  if (errors.length > 80) errors.length = 80;
  persist();
  return entry;
}

function markErrorFixed(item) {
  const hit = errorList().find((e) => e.itemId === item.id && e.key === todayKey());
  if (hit) hit.fixed = true;
  persist();
}

function writeMemory(item, teach) {
  bumpSkill(item, teach, item.verdict === "correct");
  persist();
}

function parentQueue() {
  return items().filter((i) => i.parked || i.verdict === "abstain" || i.verdict === "out_of_unit");
}

function addUsed(ms) {
  tonight().usedMs = (tonight().usedMs || 0) + ms;
  persist();
}
function usedMin() {
  return Math.floor((tonight().usedMs || 0) / 60000);
}

async function loadKB() {
  const [meta, math, chinese, english] = await Promise.all([
    fetch("./kb/meta.json").then((r) => r.json()),
    fetch("./kb/math-renjiao-s4a.json").then((r) => r.json()),
    fetch("./kb/chinese-tongbian-s4a.json").then((r) => r.json()),
    fetch("./kb/english-pep2024-s4a.json").then((r) => r.json()),
  ]);
  KB.meta = meta;
  KB.math = math;
  KB.chinese = chinese;
  KB.english = english;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600;
      let { width, height } = img;
      const scale = Math.min(1, max / Math.max(width, height));
      width *= scale;
      height *= scale;
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function go(screen, itemId) {
  Speak.stop();
  if (itemId) state.itemId = itemId;
  state.screen = screen;
  persist();
  render();
}

function applyJudge(item) {
  const r = judgeItem(item, KB, state.settings);
  item.verdict = r.verdict;
  item.authority = r.authority;
  item.reason = r.reason;
  if (r.where) item.where = r.where;
  if (r.verdict === "abstain" || r.verdict === "out_of_unit") item.parked = true;
  persist();
  return r;
}

function autoGradeItem(item) {
  item.stemConfirmed = true;
  const r = item.authority === "parent" ? { verdict: item.verdict, reason: item.reason, where: item.where } : applyJudge(item);
  const d = diagnoseWhy(item, r, state.memory);
  item.where = d.where || item.where;
  item.why = d.why;
  item.stuck = item.stuck || d.stuck;
  item.skill = d.skill;
  const teach = teachOne(item, KB, state.settings, state.memory.skills[d.skill] || {});
  if (r.verdict === "needs_redo" || r.verdict === "coaching") {
    recordError(item, { ...teach, where: item.where });
  } else if (r.verdict === "correct") {
    writeMemory(item, teach);
  }
  persist();
  return { r, d, teach };
}

function seeEndpoint() {
  const custom = (state.settings.seeUrl || "").trim().replace(/\/$/, "");
  if (custom) return custom;
  if (!/github\.io$/i.test(location.hostname)) return `${location.origin}/api/see`;
  return "";
}

async function seeHomework(dataUrl) {
  const url = seeEndpoint();
  if (!url) {
    throw new Error("自动批改要先打开本机看图服务，或在设置里填写看图地址。");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: dataUrl,
      subject: state.subject,
      englishUnit: state.settings.englishUnit,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `看图失败 ${res.status}`);
  const list = Array.isArray(data.items) ? data.items : [];
  if (!list.length) throw new Error("图上没有拆出能批的题。换更清楚的一页，或手写一题。");
  return list;
}

function subjectName(s) {
  return { math: "数学", chinese: "语文", english: "英语" }[s] || s;
}

function inWeChat() {
  return /MicroMessenger/i.test(navigator.userAgent || "");
}

function wechatBanner() {
  if (!inWeChat()) return "";
  return `<div class="wechat-warn">请点右上角 ⋯，选「在 Safari 中打开」或「在浏览器打开」。微信里相机和记录会丢。</div>`;
}

/* ---------- screens ---------- */

function shell(title, inner, backTo) {
  return `
    ${wechatBanner()}
    <div class="top">
      ${backTo ? `<button class="back" data-act="go" data-to="${backTo}">上一页</button>` : `<span></span>`}
      <div class="title">${esc(title)}</div>
      <span class="tiny">周${weekdayName()}</span>
    </div>
    ${inner}
  `;
}

function renderSetup() {
  return shell(
    "先选定她的书",
    `
    <p class="lede">以后按这些书来判。2026 秋四年级上：语文统编、数学人教、英语是 2024 审定新 PEP（Helping at home），不是旧的 My classroom。</p>
    <div class="card">
      <p>数学</p>
      <select id="mathBook"><option value="renjiao-s4a">人教版四年级上册</option></select>
      <p>语文</p>
      <select id="chineseBook"><option value="tongbian-s4a">统编四年级上册</option></select>
      <p>英语</p>
      <select id="englishBook"><option value="pep2024-s4a">PEP 2024 新教材四上</option></select>
      <p>英语现在讲到</p>
      <select id="englishUnit">
        ${(KB.english.units || []).map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}
      </select>
      <p>工作日晚上大人常常不在</p>
      <select id="presence">
        <option value="solo">默认：我先做</option>
        <option value="together">默认：大人在旁边</option>
      </select>
      <p>看图接口（手机用 GitHub 页时要填；用电脑开出来的地址则不用填）</p>
      <input id="seeUrl" type="text" value="${esc(state.settings.seeUrl || "")}" placeholder="例如 http://192.168.1.108:8787/api/see" />
    </div>
    <button class="primary" data-act="save-setup">选好了，去自动批改</button>
    <p class="tiny">教材包 ${esc(KB.meta.packVersion)} · ${esc(KB.meta.updated)}</p>
  `
  );
}

function renderHome() {
  const list = items();
  const q = parentQueue();
  const overtime = usedMin() >= 8;
  const mems = watchingSkills();
  const graded = list.filter((it) => it.stemConfirmed).length;
  return `
    ${wechatBanner()}
    <div class="top">
      <div class="title">今晚作业</div>
      <span class="tiny">周${weekdayName()}</span>
    </div>
    <p class="lede">拍今晚那一页：<b>自动批改</b>，想她为什么错，讲给她听，记进错题记。</p>
    <input class="hidden" id="auto-file" type="file" accept="image/*" capture="environment" />
    <button class="primary grade-cta" data-act="auto-capture" ${state.busy ? "disabled" : ""}>${state.busy || "拍作业，自动批改"}</button>
    <button class="secondary" data-act="start-mark">看不清就手写一题批改</button>
    ${state.lastAuto ? `<p class="tiny">${esc(state.lastAuto)}</p>` : `<p class="tiny" style="margin-top:8px">先选科目。照片会送到本机看图服务拆题，对错仍用验算/词表判，不让模型打分。</p>`}
    <div class="subjects">
      ${["math", "chinese", "english"]
        .map((s) => {
          const name = { math: "数学", chinese: "语文", english: "英语" }[s];
          return `<button data-act="subject" data-v="${s}" class="${state.subject === s ? "on" : ""}">${name}</button>`;
        })
        .join("")}
    </div>
    ${overtime ? `<div class="overtime">今晚已经 ${usedMin()} 分钟。余下的题可以只批不讲。</div>` : ""}
    <p class="section">今晚已批 ${graded} 题</p>
    ${
      list.length
        ? list
            .map((it) => {
              const st = visibleStatus(it);
              return `<button class="list-row" data-act="open" data-id="${it.id}">
                <span>${esc(it.stem || "还没填题目")}</span>
                <span class="chip ${st.cls}">${st.label}</span>
              </button>`;
            })
            .join("")
        : `<div class="card">还没有批过。点「拍作业，自动批改」，或手写一题。</div>`
    }
    ${
      mems.length
        ? `<div class="card"><p>她最近错在哪</p>${mems
            .slice(0, 4)
            .map((m) => `<p>${esc(m.where || m.helpful || m.id)} · ${m.lastKey === todayKey() ? "今天" : "还要盯"}</p>`)
            .join("")}</div>`
        : ""
    }
    ${
      q.length
        ? `<button class="secondary" data-act="go" data-to="parent">${q.length} 题系统不敢自动批，要你看一眼</button>`
        : ""
    }
    <button class="secondary" data-act="go" data-to="errors">错题记 · ${errorList().length} 条</button>
    <button class="foot-link" data-act="go" data-to="voice">爸爸的声音 · 已录 ${Speak.recordedCount()} / ${DAD_SCRIPTS.length} 句</button>
    <button class="foot-link" data-act="go" data-to="setup">大人设置</button>
  `;
}

function renderMark() {
  const it = currentItem() || {};
  const sub = it.subject || state.subject;
  return shell(
    "批改作业",
    `
    <p class="lede">自动看图看不清时，手写题目和本上的答案，再批改。</p>
    <input class="hidden" id="file" type="file" accept="image/*" capture="environment" />
    ${it.photo ? `<img class="photo" alt="作业对照" src="${it.photo}" />` : ""}
    <button class="secondary" data-act="pick-file" style="margin-top:0">${it.photo ? "换一张对照图" : "拍一张作业对照（可选）"}</button>
    <p>科目</p>
    <div class="subjects">
      ${["math", "chinese", "english"]
        .map((s) => `<button data-act="item-subject" data-v="${s}" class="${sub === s ? "on" : ""}">${{ math: "数学", chinese: "语文", english: "英语" }[s]}</button>`)
        .join("")}
    </div>
    <p>题目</p>
    <textarea id="stem" rows="3" placeholder="例如 36×28＝  或  人声（　）  或  wash the dishes">${esc(it.stem || "")}</textarea>
    <p>她本上写的</p>
    <input id="ans" type="text" value="${esc(it.childAnswer || "")}" placeholder="得数 / 词语 / 单词" />
    ${sub === "chinese" ? `<p class="tiny">阅读简答：题目开头写「阅读：」，不自动打对错，你来批。</p>` : ""}
    <button class="primary grade-cta" data-act="confirm-stem">批改</button>
  `,
    "home"
  );
}

function renderJudge() {
  const it = currentItem();
  if (!it) return renderHome();
  const r = it.authority === "parent" ? { verdict: it.verdict, reason: it.reason, where: it.where } : applyJudge(it);
  const map = {
    correct: { t: "批改结果：对", cls: "ok" },
    needs_redo: { t: "批改结果：错", cls: "redo" },
    coaching: { t: "这题不自动打分，请你批", cls: "" },
    abstain: { t: "系统批不了，请你批", cls: "park" },
    out_of_unit: { t: "这个词不在本单元", cls: "park" },
    blocked: { t: "题目还没填完", cls: "park" },
  };
  const v = map[r.verdict] || map.abstain;
  const canTeach = r.verdict === "needs_redo" || r.verdict === "coaching" || r.verdict === "abstain";
  return shell(
    "批改结果",
    `
    <p class="stem math">${esc(it.stem)}</p>
    <p>本上：${esc(it.childAnswer || "（空）")}</p>
    <div class="verdict ${v.cls}">${v.t}</div>
    ${it.where || r.where ? `<p class="where">错在哪：${esc(it.where || r.where)}</p>` : ""}
    ${it.why ? `<div class="card"><p class="layer">她为什么会错</p><p>${esc(it.why)}</p></div>` : ""}
    <p class="reason">${esc(r.reason)}${it.memoryId ? " · 已记入错题记" : ""}</p>
    <p class="section">要改判就点这里</p>
    <div class="row3">
      <button class="mark-ok ${it.verdict === "correct" ? "on" : ""}" data-act="manual-grade" data-grade="ok">对</button>
      <button class="mark-bad ${it.verdict === "needs_redo" ? "on" : ""}" data-act="manual-grade" data-grade="wrong">错</button>
      <button class="mark-park" data-act="manual-grade" data-grade="park">先放着</button>
    </div>
    ${canTeach && !state.settings.judgeOnly ? `<button class="primary" data-act="go" data-to="${it.stuck ? "teach" : "stuck"}">听讲解</button>` : ""}
    <button class="secondary" data-act="start-mark">批下一题</button>
    <button class="secondary" data-act="go" data-to="home">回今晚</button>
  `,
    "home"
  );
}

function renderStuck() {
  const it = currentItem();
  const chips =
    it.subject === "math" ? KB.math.stuckChips : it.subject === "chinese" ? KB.chinese.stuckChips : KB.english.stuckChips;
  return shell(
    "卡在哪一步？",
    `
    <p class="lede">只点一个。点完只讲这一步。</p>
    <div class="chips">
      ${chips.map((c) => `<button data-act="stuck" data-v="${c.id}" class="${it.stuck === c.id ? "on" : ""}">${esc(c.label)}</button>`).join("")}
    </div>
    <button class="primary" data-act="go" data-to="teach" ${it.stuck ? "" : "disabled"}>讲解这题</button>
  `,
    "judge"
  );
}

function renderTeach() {
  const it = currentItem();
  if (!it.stuck && it.subject !== "chinese") it.stuck = "mid";
  const teach = teachOne(it, KB, state.settings, state.memory.skills[pickSkill(it, KB)] || {});
  it.teachText = [...teach.lines, ...(teach.diverge || [])].join("\n");
  it.skill = teach.skill;
  it.where = teach.where || it.where;
  if (it.verdict !== "correct") recordError(it, teach);
  const similar = similarMemory(it);
  return shell(
    "讲解",
    `
    ${it.why ? `<div class="banner">${esc(it.why)}</div>` : ""}
    ${similar && !it.why ? `<div class="banner">这题和 ${esc(similar.lastKey)} 那道一样，错在同一处：${esc(similar.where || similar.helpful || "")}</div>` : ""}
    <p class="where">错在哪：${esc(it.where || teach.where || "这一步还没钉住")}</p>
    <div class="card teach">
      <p class="layer">先钉住这一步</p>
      ${teach.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
    </div>
    ${
      teach.diverge && teach.diverge.length
        ? `<div class="card teach diverge">
            <p class="layer">再想开一点</p>
            ${teach.diverge.map((l) => `<p>${esc(l)}</p>`).join("")}
          </div>`
        : ""
    }
    <div class="row2">
      <button class="secondary" data-act="speak" data-skill="${esc(teach.skill)}" data-text="${esc(teach.speak)}" style="margin:0">听这一步</button>
      <button class="secondary" data-act="speak" data-skill="" data-text="${esc(teach.divergeSpeak || "")}" style="margin:0" ${teach.divergeSpeak ? "" : "disabled"}>听想开的</button>
    </div>
    ${
      state.settings.presence === "together"
        ? `<button class="secondary" data-act="parent-line">我来说一句</button>`
        : ""
    }
    ${teach.blocked ? `<button class="secondary" data-act="park">先放着给大人</button>` : `<button class="primary" data-act="go" data-to="redo">去订正</button>`}
    <button class="secondary" data-act="still-lost">还是不会</button>
    <p class="tiny">想开一点不给这题得数。听讲解优先用爸爸录过的那句。</p>
  `,
    "stuck"
  );
}

function renderErrors() {
  const list = errorList();
  if (!list.length) {
    return shell("错题记", `<div class="card">还没有记下错在哪。今晚判错并讲解后，会出现在这里。</div>`, "home");
  }
  return shell(
    "错题记",
    `
    <p class="lede">记下她错在哪，不是正确率。订正过的还留着，方便下次从同一处看。</p>
    ${list
      .map((e) => {
        return `<button class="list-row error-row" type="button">
          <span>
            <span class="tiny">${esc(e.key)} · ${esc(subjectName(e.subject))}${e.fixed ? " · 当晚订正过" : ""}</span><br />
            <strong>${esc(e.where || "未标明")}</strong><br />
            ${e.why ? `<span class="tiny">${esc(e.why)}</span><br />` : ""}
            <span class="tiny">${esc(e.stem || "")}${e.wrongAnswer ? `　本上：${esc(e.wrongAnswer)}` : ""}</span>
          </span>
          <span class="chip ${e.fixed ? "ok" : "redo"}">${e.fixed ? "订正过" : "还要盯"}</span>
        </button>`;
      })
      .join("")}
  `,
    "home"
  );
}

function renderRedo() {
  const it = currentItem();
  return shell(
    "把这题再做一遍",
    `
    <p class="stem math">${esc(it.stem)}</p>
    <p class="lede">写在本子上也可以，把订正后的得数/词语打在这里。</p>
    <input id="redo" type="text" placeholder="订正后的答案" />
    <button class="primary" data-act="recheck">好了，再看一次</button>
  `,
    "teach"
  );
}

function renderMemory() {
  const it = currentItem();
  const teach = teachOne(it, KB, state.settings, {});
  return shell(
    "记下这一下",
    `
    <div class="card">
      <p class="layer">她刚才错在哪</p>
      <p>${esc(teach.where || it.where || teach.lines[0])}</p>
    </div>
    <p class="lede">已经记进错题记。订正过也留着，下次从同一处看。</p>
    <button class="primary" data-act="save-mem">好，回今晚</button>
    <button class="secondary" data-act="go" data-to="errors">去看错题记</button>
  `,
    "home"
  );
}

function renderParent() {
  const q = parentQueue();
  if (!q.length) {
    return shell("大人看一眼", `<div class="card">今晚没有待看的题。</div><button class="primary" data-act="go" data-to="home">回今晚</button>`, "home");
  }
  const it = q[0];
  return shell(
    "大人看一眼",
    `
    <p class="tiny">${q.length} 题 · 每题大约半分钟</p>
    <div class="card">
      <p class="stem math">${esc(it.stem)}</p>
      <p>本上她写：${esc(it.childAnswer || "（空）")}</p>
      <p class="reason">${esc(it.reason || "系统不敢判")}</p>
    </div>
    <button class="primary" data-act="p-keep" data-id="${it.id}">就这么着</button>
    <button class="secondary" data-act="p-ok" data-id="${it.id}">其实是对的</button>
    <button class="secondary" data-act="p-veto" data-id="${it.id}">这么讲不对</button>
    <p class="tiny">原题若能验算，得数只给你看：${(() => {
      const v = safeEval(splitEquation(it.stem || "").left);
      return v == null ? "（验不了）" : v;
    })()}</p>
  `,
    "home"
  );
}

function renderVoice() {
  const rows = DAD_SCRIPTS.map((s) => {
    const has = !!Speak.dadClip(s.id);
    return `<div class="card">
      <p><strong>${esc(s.id)}</strong> ${has ? "· 已录" : ""}</p>
      <p>${esc(s.text)}</p>
      <div class="row2">
        <button class="secondary" data-act="rec" data-id="${s.id}" style="margin:0">${state.recording && state.recordTarget === s.id ? "停止并保存" : "朗读并录音"}</button>
        <button class="secondary" data-act="preview-dad" data-id="${s.id}" style="margin:0" ${has ? "" : "disabled"}>试听</button>
      </div>
    </div>`;
  }).join("");
  return shell(
    "爸爸的声音",
    `
    <p class="lede">本机没有现成的你的声样。请对着这些讲解底稿各读一遍，晚上就用你的声音讲。没录的句子会用系统中文声。</p>
    <p class="tiny">录音只存在这台设备的浏览器里，不会上传到 GitHub。</p>
    ${rows}
  `,
    "home"
  );
}

function render() {
  const app = $("#app");
  if (!KB.meta) {
    app.innerHTML = `<p class="lede">正在打开课本尺…</p>`;
    return;
  }
  if (!state.settings.booksReady && state.screen !== "setup") state.screen = "setup";
  const map = {
    setup: renderSetup,
    home: renderHome,
    mark: renderMark,
    capture: renderMark,
    type: renderMark,
    judge: renderJudge,
    stuck: renderStuck,
    teach: renderTeach,
    redo: renderRedo,
    memory: renderMemory,
    errors: renderErrors,
    parent: renderParent,
    voice: renderVoice,
  };
  app.innerHTML = (map[state.screen] || renderHome)();
}

async function onClick(ev) {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === "go") return go(btn.dataset.to);
  if (act === "presence") {
    state.settings.presence = btn.dataset.v;
    persist();
    return render();
  }
  if (act === "subject") {
    state.subject = btn.dataset.v;
    return render();
  }
  if (act === "save-setup") {
    state.settings.booksReady = true;
    state.settings.englishUnit = $("#englishUnit")?.value || "u1";
    state.settings.presence = $("#presence")?.value || "solo";
    state.settings.seeUrl = $("#seeUrl")?.value.trim() || "";
    persist();
    return go("home");
  }
  if (act === "auto-capture") {
    const file = $("#auto-file");
    if (file) file.click();
    return;
  }
  if (act === "start-mark") {
    const it = {
      id: uid(),
      subject: state.subject,
      stem: "",
      childAnswer: "",
      photo: "",
      stemConfirmed: false,
      verdict: "",
    };
    items().push(it);
    state.itemId = it.id;
    persist();
    return go("mark");
  }
  if (act === "pick-file") return $("#file").click();
  if (act === "item-subject") {
    const it = currentItem();
    if (it) it.subject = btn.dataset.v;
    persist();
    return render();
  }
  if (act === "confirm-stem") {
    let it = currentItem();
    if (!it) {
      it = {
        id: uid(),
        subject: state.subject,
        stem: "",
        childAnswer: "",
        photo: "",
        stemConfirmed: false,
        verdict: "",
      };
      items().push(it);
      state.itemId = it.id;
    }
    it.stem = $("#stem").value.trim();
    it.childAnswer = $("#ans").value.trim();
    if (!it.subject) it.subject = detectSubject(it.stem);
    if (/^阅读[:：]/.test(it.stem)) it.itemType = "reading";
    if (!it.stem) {
      alert("先把题目写上，才能批改。");
      return;
    }
    it.authority = "";
    autoGradeItem(it);
    return go("judge");
  }
  if (act === "manual-grade") {
    const it = currentItem();
    if (!it) return;
    const g = btn.dataset.grade;
    if (g === "ok") {
      it.verdict = "correct";
      it.authority = "parent";
      it.reason = "大人批：对";
      it.where = "";
      it.parked = false;
      markErrorFixed(it);
    } else if (g === "wrong") {
      it.verdict = "needs_redo";
      it.authority = "parent";
      it.reason = "大人批：错";
      it.where = it.where || "大人判这题错了";
      it.parked = false;
      recordError(it, teachOne(it, KB, state.settings, {}));
    } else {
      it.parked = true;
      it.verdict = "abstain";
      it.authority = "parent";
      it.reason = "先放着";
    }
    persist();
    return render();
  }
  if (act === "open") {
    state.itemId = btn.dataset.id;
    const it = currentItem();
    if (!it.stemConfirmed) return go("mark");
    if (it.verdict === "needs_redo") return go("judge");
    return go("judge");
  }
  if (act === "stuck") {
    currentItem().stuck = btn.dataset.v;
    persist();
    return render();
  }
  if (act === "speak") {
    const t0 = performance.now();
    await Speak.speak(btn.dataset.text, btn.dataset.skill);
    addUsed(performance.now() - t0);
    return;
  }
  if (act === "still-lost") {
    const it = currentItem();
    it.lostCount = (it.lostCount || 0) + 1;
    if (it.lostCount >= 2) {
      it.parked = true;
      persist();
      return go("home");
    }
    persist();
    return go("teach");
  }
  if (act === "park") {
    currentItem().parked = true;
    persist();
    return go("home");
  }
  if (act === "recheck") {
    const it = currentItem();
    it.childAnswer = $("#redo").value.trim();
    const r = applyJudge(it);
    if (r.verdict === "correct") {
      markErrorFixed(it);
      writeMemory(it, teachOne(it, KB, state.settings, {}));
      return go("memory");
    }
    it.parked = true;
    persist();
    return go("home");
  }
  if (act === "save-mem") {
    return go("home");
  }
  if (act === "parent-ok" || act === "p-ok") {
    const it = act === "p-ok" ? items().find((i) => i.id === btn.dataset.id) : currentItem();
    it.verdict = "correct";
    it.authority = "parent";
    it.reason = "听大人的：这题算对。";
    it.parked = false;
    persist();
    return render();
  }
  if (act === "p-keep") {
    const it = items().find((i) => i.id === btn.dataset.id);
    it.parked = false;
    it.parentSeen = true;
    persist();
    return render();
  }
  if (act === "parent-veto" || act === "p-veto") {
    const it = act === "p-veto" ? items().find((i) => i.id === btn.dataset.id) : currentItem();
    const skill = it.skill || pickSkill(it, KB);
    if (!state.memory.skills[skill]) state.memory.skills[skill] = { id: skill, banned: [] };
    if (!state.memory.skills[skill].banned.includes(skill)) state.memory.skills[skill].banned.push(skill);
    it.parked = false;
    it.reason = "这种讲法今晚不用了。听大人的。";
    persist();
    return render();
  }
  if (act === "parent-line") {
    const line = prompt("你想让她听到哪一句？（最多 30 字）", "先把个位算完，进位写上头。");
    if (line) {
      Speak.stop();
      currentItem().parentLine = line.slice(0, 30);
      persist();
      Speak.speak(currentItem().parentLine);
    }
    return render();
  }
  if (act === "preview-dad") {
    const url = Speak.dadClip(btn.dataset.id);
    if (url) await Speak.playDataUrl(url);
    return;
  }
  if (act === "rec") {
    const id = btn.dataset.id;
    if (state.recording && state.recordTarget === id) {
      const blob = await Speak.stopRecord();
      if (blob) await Speak.saveDadClip(id, blob);
      state.recording = false;
      state.recordTarget = null;
      return render();
    }
    try {
      await Speak.startRecord();
      state.recording = true;
      state.recordTarget = id;
      render();
    } catch {
      alert("打不开麦克风。请允许浏览器使用麦克风，或用系统声音先将就。");
    }
  }
}

async function runAuto(file) {
  state.busy = "正在看这一页…";
  state.lastAuto = "";
  render();
  try {
    const dataUrl = await compressImage(file);
    const found = await seeHomework(dataUrl);
    let ok = 0;
    let bad = 0;
    let park = 0;
    let firstBad = null;
    found.forEach((raw) => {
      const it = {
        id: uid(),
        subject: raw.subject || state.subject,
        stem: raw.stem,
        childAnswer: raw.childAnswer || "",
        work: raw.work || "",
        photo: dataUrl,
        stemConfirmed: false,
        verdict: "",
        confidence: raw.confidence,
      };
      items().push(it);
      if ((raw.confidence || 1) < 0.45) {
        it.parked = true;
        it.verdict = "abstain";
        it.why = "图上这题不够清楚，不敢自动批。";
        park += 1;
        return;
      }
      const { r } = autoGradeItem(it);
      if (r.verdict === "correct") ok += 1;
      else if (r.verdict === "needs_redo") {
        bad += 1;
        if (!firstBad) firstBad = it;
      } else park += 1;
    });
    persist();
    state.lastAuto = `这一页：对 ${ok} · 错 ${bad} · 不敢批 ${park}。点题目可听讲解。`;
    state.busy = "";
    if (firstBad) return go("judge", firstBad.id);
    return go("home");
  } catch (err) {
    state.busy = "";
    state.lastAuto = err.message || String(err);
    render();
  }
}

function onChange(ev) {
  if (ev.target.id === "auto-file" && ev.target.files && ev.target.files[0]) {
    runAuto(ev.target.files[0]);
    ev.target.value = "";
    return;
  }
  if (ev.target.id === "file" && ev.target.files && ev.target.files[0]) {
    const stem = $("#stem");
    const ans = $("#ans");
    const it = currentItem();
    if (it) {
      if (stem) it.stem = stem.value;
      if (ans) it.childAnswer = ans.value;
    }
    compressImage(ev.target.files[0]).then((data) => {
      if (it) it.photo = data;
      else state.photoDraft = data;
      persist();
      render();
    });
  }
}

async function main() {
  await loadKB();
  $("#app").addEventListener("click", onClick);
  $("#app").addEventListener("change", onChange);
  render();
}

main();
