/* 错因：对照验算结果、本上的字、她以前的错，推断为什么会这样写。不报本得数。 */

function diagnoseWhy(item, judge, memory) {
  const work = String(item.work || "");
  const stem = String(item.stem || "");
  const ans = String(item.childAnswer || "").trim();
  const whereFromJudge = (judge && judge.where) || item.where || "";

  let stuck = item.stuck || "";
  let where = whereFromJudge;
  let why = "";

  if (item.subject === "math") {
    if (/万|亿|读作|写作/.test(stem)) {
      stuck = stuck || "read";
      where = where || "读数时中间的 0 和末尾的 0 没分开";
      why = "大数先按「级」停一下。中间空位要读零，尾巴上的零不用读。她这次多半把两种零当成同一种了。";
    } else if (/公顷/.test(stem)) {
      stuck = stuck || "setup";
      where = where || "公顷和平方米的进率没站住";
      why = "公顷是一大块地，平方米是小格子。单位换反了，零就会少写或多写。";
    } else if (/[×*]/.test(stem) || /×|x/.test(normalizeExpr(stem))) {
      if (/个位/.test(whereFromJudge) || onlyOnesDigit(stem, ans)) {
        stuck = "check";
        where = "只写下了个位，整题还没合完";
        why = "个位乘完只留下一位，上面还有十位、百位要加回来。她把个位上的那个数当成了整道题的得数。";
      } else if (/数位|对准|第二层/.test(whereFromJudge) || offByTen(stem, ans)) {
        stuck = "mid";
        where = "用十位去乘时，第二层没有对准十位";
        why = "十位乘出来的是「几个十」，第一个数字必须站在十位下面。写歪一格，得数会大十倍或小十倍。";
      } else if (/进位/.test(work) === false && /[×*]/.test(stem)) {
        stuck = stuck || "mid";
        where = where || "竖式个位满十之后，进位没写对";
        why = "个位满十要交给下一位。肩膀上写的是交给下一位几捆，不是个位乘出来的整个数。";
      } else {
        stuck = stuck || "mid";
        where = where || "算到一半，对位或进位乱了";
        why = "竖式乱了不要从得数往回猜。先问这一位在干什么，个位对个位，做完再走下一位。";
      }
    } else if (!ans) {
      stuck = "setup";
      where = "本上还没有能核对的得数";
      why = "题目还没做成一个能核对的得数。先说清是合起来、剩下、几份，还是每一份。";
    } else {
      stuck = stuck || "check";
      where = where || "得数和验算对不上";
      why = "先不要改得数。用估算看成整十整百，差得远就回头查对位和进位。";
    }
  } else if (item.subject === "chinese") {
    if ((judge && judge.verdict) === "coaching") {
      stuck = stuck || "ask";
      where = "要看有没有写到点，不打对错";
      why = "这题问的是自己的话或提问，没有唯一标准句。先分清题目要找原词，还是用因为所以说完。";
    } else if (/近义|不是课文/.test(whereFromJudge)) {
      stuck = "unsure";
      where = "写成了近义词或少了字，不是课文原词";
      why = "练习册要课文里的那个词。近义词意思近，画面会飘。打开书对三个字，不要用自己习惯的词替换。";
    } else if (!ans) {
      stuck = "locate";
      where = "格子还是空的";
      why = "答案多半在课文里。先用手指住那一段，再写。空着写感想，对不上原词。";
    } else {
      stuck = stuck || "locate";
      where = where || "还没指到课文里的那一段";
      why = "题目若问从哪里看出来，要回课文找原句。先圈题目里的一个词，再在附近找。";
    }
  } else {
    if ((judge && judge.verdict) === "out_of_unit") {
      stuck = "word";
      where = "词在别的单元";
      why = "今晚只用本单元词表。别的单元的词先不当新课，回到这一页会的动作词。";
    } else if (!ans) {
      stuck = "write";
      where = "单词还没写";
      why = "会读不会写时，先让词站回句子里，再拍手把音节拍开，看中间那一拍。";
    } else {
      stuck = stuck || "spell";
      where = where || "和本单元词表对不上";
      why = "先盖住两边，只看中间这个字母。写完用手指指着再读，读不顺的地方就是写反了。";
    }
  }

  const skill = pickSkill({ ...item, stuck }, { math: {}, chinese: {}, english: {} });
  const hist = (memory && memory.skills && memory.skills[skill]) || {};
  const again = hist.status === "watching" || (hist.fails || 0) >= 2;

  if (again && hist.where) {
    why = `这和她以前卡住的是同一处：${hist.where}。` + why;
  }

  if (judge && judge.verdict === "correct") {
    why = again ? "这次做对了。以前错的那一步今晚站住了。" : "这题验算通过。";
    where = "";
  }

  if (judge && (judge.verdict === "abstain" || judge.verdict === "blocked")) {
    why = why || "图上的字或这道题我验不准，不能假装批过。留给大人看一眼。";
  }

  return {
    skill,
    stuck,
    where,
    why,
    again: !!again,
    helpful: why.split("。")[0] || where,
  };
}

function onlyOnesDigit(stem, ans) {
  const { left } = splitEquation(stem || "");
  const v = safeEval(left);
  const n = Number(String(ans).replace(/[^\d.\-]/g, ""));
  if (v == null || Number.isNaN(n)) return false;
  return nearlyEqual(n, Math.abs(Math.trunc(v)) % 10);
}

function offByTen(stem, ans) {
  const { left } = splitEquation(stem || "");
  const v = safeEval(left);
  const n = Number(String(ans).replace(/[^\d.\-]/g, ""));
  if (v == null || !v || Number.isNaN(n)) return false;
  return nearlyEqual(n, v * 10) || nearlyEqual(n, v / 10);
}
