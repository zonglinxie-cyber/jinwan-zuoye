/* 判官：只有确定性规则能写对错。模型没有写入权。 */

const FORBID_MATH = ["方程", "未知数", "设x", "设 X", "移项", "x=", "X="];

function normText(s) {
  return String(s ?? "")
    .replace(/\s+/g, "")
    .replace(/[，。！？、．]/g, "")
    .toLowerCase();
}

function normalizeExpr(raw) {
  return String(raw ?? "")
    .replace(/[×xXｘＸ]/g, "*")
    .replace(/[÷／/]/g, "/")
    .replace(/[－—]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[＝=]/g, "=")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/\s+/g, "");
}

function splitEquation(raw) {
  const s = normalizeExpr(raw);
  const i = s.lastIndexOf("=");
  if (i < 0) return { left: s, right: "" };
  return { left: s.slice(0, i), right: s.slice(i + 1) };
}

function safeEval(expr) {
  if (!expr || !/^[\d+\-*/().]+$/.test(expr)) return null;
  if (/[+\-*/]{2,}/.test(expr.replace(/^\-/, ""))) return null;
  try {
    const v = Function(`"use strict"; return (${expr})`)();
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function currentEnglishUnit(kb, settings) {
  const id = settings.englishUnit || "u1";
  return (kb.english.units || []).find((u) => u.id === id) || kb.english.units[0];
}

function allEnglishWords(unit) {
  return [...(unit.fourSkills || []), ...(unit.threeSkills || [])];
}

function judgeItem(item, kb, settings) {
  const subject = item.subject;
  const stem = item.stem || "";
  const answer = item.childAnswer || "";

  if (!item.stemConfirmed) {
    return { verdict: "blocked", authority: "none", reason: "题目还没对过，不能判。" };
  }

  if (subject === "math") {
    if (FORBID_MATH.some((w) => stem.includes(w) || (item.teachText || "").includes(w))) {
      return { verdict: "abstain", authority: "method", reason: "这题或讲法碰到四年级还不能用的方程，留给大人。" };
    }
    const fromStem = splitEquation(stem);
    const leftVal = safeEval(fromStem.left);
    const typed = splitEquation(answer);
    const herVal =
      typed.right !== ""
        ? safeEval(typed.right) ?? Number(typed.right)
        : safeEval(answer) ?? Number(normalizeExpr(answer));
    if (leftVal == null) {
      return { verdict: "abstain", authority: "none", reason: "这题我算不准，不能判对错。" };
    }
    if (answer.trim() === "" || Number.isNaN(herVal)) {
      return { verdict: "needs_redo", authority: "calc", reason: "已验算：本上还没有能核对的得数。" };
    }
    if (nearlyEqual(leftVal, Number(herVal))) {
      return { verdict: "correct", authority: "calc", reason: "已验算" };
    }
    return { verdict: "needs_redo", authority: "calc", reason: "已验算" };
  }

  if (subject === "chinese") {
    const type = item.itemType || "fill";
    if (type === "reading" || type === "open") {
      return { verdict: "coaching", authority: "none", reason: "这题不打分，只看有没有写到点。" };
    }
    const poemHits = (kb.chinese.publicDomain || []).flatMap((p) => p.lines.map((l) => l.replace(/[，。]/g, "")));
    const fillBank = [
      ...(kb.chinese.units || []).flatMap((u) => u.exactFill || []),
      ...poemHits,
    ];
    const a = normText(answer);
    if (!a) return { verdict: "needs_redo", authority: "passage", reason: "书上原句还没写。" };
    const hit = fillBank.find((w) => normText(w) === a);
    if (hit) return { verdict: "correct", authority: "passage", reason: "书上原句" };
    const close = fillBank.find((w) => normText(w).includes(a) || a.includes(normText(w)));
    if (close && normText(close) !== a) {
      return {
        verdict: "needs_redo",
        authority: "passage",
        reason: "不是课文里的那个词，打开书对三个字。",
      };
    }
    return { verdict: "abstain", authority: "none", reason: "书上的句子我没对上，不能判。" };
  }

  if (subject === "english") {
    const unit = currentEnglishUnit(kb, settings);
    const words = allEnglishWords(unit);
    const a = String(answer).trim().toLowerCase().replace(/\s+/g, " ");
    if (!a) return { verdict: "needs_redo", authority: "wordlist", reason: "本单元词表：还没写。" };
    const inUnit = words.some((w) => w.en.toLowerCase() === a);
    if (inUnit) return { verdict: "correct", authority: "wordlist", reason: `本单元词表 · ${unit.name}` };
    const other = (kb.english.units || []).some((u) =>
      u.id !== unit.id && allEnglishWords(u).some((w) => w.en.toLowerCase() === a)
    );
    if (other) {
      return { verdict: "out_of_unit", authority: "wordlist", reason: "这个词不在本单元，我不当新课讲。" };
    }
    return { verdict: "needs_redo", authority: "wordlist", reason: `本单元词表 · ${unit.name}` };
  }

  return { verdict: "abstain", authority: "none", reason: "这一格我不能替老师判。" };
}

function detectSubject(stem) {
  const s = stem || "";
  if (/[a-zA-Z]{3,}/.test(s) && !/[\u4e00-\u9fff]{4,}/.test(s)) return "english";
  if (/[0-9０-９].*[+\-×÷*xX=＝]/.test(s) || /[+\-×÷*xX=＝].*[0-9０-９]/.test(s)) return "math";
  return "chinese";
}
