/* 只讲一步。禁止最终得数、可抄填空、方程。 */

function containsFinalAnswer(text, item) {
  if (!text) return false;
  if (item.subject === "math") {
    const { left } = splitEquation(item.stem || "");
    const v = safeEval(left);
    if (v != null && new RegExp(`(^|[^0-9])${v}([^0-9]|$)`).test(text.replace(/\s/g, ""))) return true;
  }
  return /标准答案|最终得数|正确答案是/.test(text);
}

function containsForbiddenMath(text) {
  return FORBID_MATH.some((w) => (text || "").includes(w));
}

function pickSkill(item, kb) {
  if (item.subject === "math") {
    if (/[×*]/.test(item.stem || "") && (item.stuck === "mid" || item.stuck === "check")) return "carry";
    if (/万|亿|读作|写作/.test(item.stem || "")) return "read-zero";
    if (/公顷/.test(item.stem || "")) return "hectare";
    return item.stuck || "mid";
  }
  if (item.subject === "chinese") {
    if (item.stuck === "locate") return "locate";
    if (item.stuck === "ask") return "ask";
    return "fill-exact";
  }
  return item.stuck || "spell";
}

function teachOne(item, kb, settings, memory) {
  const skill = pickSkill(item, kb);
  const banned = (memory.banned || []).includes(skill);
  const lines = [];

  if (item.subject === "math") {
    if (skill === "carry") {
      lines.push("就看这一步：进位。");
      lines.push("个位先算完，写下个位上的那个数。");
      lines.push("多出来的，轻轻写在十位肩膀上。");
      lines.push("先不要写下整道题的得数。");
    } else if (skill === "align-tens") {
      lines.push("就看这一步：第二层站哪。");
      lines.push("用十位去乘，写下来的第一个数字要站在十位下面。");
    } else if (skill === "read") {
      lines.push("先把题目缩成两句：已知什么，求什么。");
      lines.push("先别列式。");
    } else {
      lines.push("先对准个位和个位。");
      lines.push("一步只做一个动作。先不要报整道题的得数。");
    }
  } else if (item.subject === "chinese") {
    if (skill === "locate") {
      lines.push("答案在课文里。");
      lines.push("先用手指住那一段，再写。");
      lines.push("我不会把原句放到屏幕上让你抄。");
    } else if (skill === "ask") {
      lines.push("先看题目要你干什么：找原词，还是用自己的话说。");
      lines.push("问为什么，就用因为……所以……说完。");
    } else {
      lines.push("练习册要课文里的那个词，不能换近义词。");
      lines.push("打开书，对三个字。");
    }
  } else {
    const unit = currentEnglishUnit(kb, settings);
    lines.push(`今晚只用 ${unit.name} 里的词。`);
    if (skill === "spell") {
      lines.push("盖住两边，只看中间这个字母，再写一遍。");
    } else if (skill === "word") {
      const sample = (unit.fourSkills || []).slice(0, 3).map((w) => w.en).join("、");
      lines.push(sample ? `本单元可以写：${sample}。` : "先回到本课单词表。");
    } else {
      const p = (unit.patterns || [])[0];
      lines.push(p ? `套这个框：${p}` : "先口头说一遍，再写。");
    }
  }

  const text = lines.join("\n");
  if (banned) {
    return {
      skill,
      lines: ["这种讲法爸爸说先别用。", "听大人的一句，再订正。"],
      speak: "这种讲法今晚不用了。听大人的。",
      blocked: true,
    };
  }
  if (containsFinalAnswer(text, item) || containsForbiddenMath(text)) {
    return {
      skill,
      lines: ["这题我不能往下讲，怕讲错方法。", "先放着给大人，你做下一题。"],
      speak: "这题我不能往下讲。先放着给大人。",
      blocked: true,
    };
  }
  return { skill, lines, speak: lines.join(" "), blocked: false };
}
