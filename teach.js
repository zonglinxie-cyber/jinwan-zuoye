/* 讲解两层：先钉住错在哪，再想开一点。禁止最终得数、可抄填空、方程。 */

const SKILL_PACKS = {
  carry: {
    where: "竖式个位满十之后，进位没写对",
    step: [
      "就看这一步：进位。",
      "个位先算完，写下个位上的那个数。",
      "多出来的，轻轻写在十位肩膀上。",
      "先不要写下整道题的得数。",
    ],
    diverge: [
      "想开一点：个位满十，就要交给下一位。10 根小棒捆成一捆，捆放到十位。",
      "肩膀上写的是「交给下一位几捆」，不是个位算式的整个结果。",
      "换个角度看：如果个位乘完是五十几，纸上个位只留几，肩膀上才是那个五。",
      "再想：十位算完如果也满十，同样再往百位交一捆。规则一样，只是位置往左移。",
    ],
    speak: "就看进位。个位算完，写下个位，多的写在十位肩膀上。先不要写出整道题的得数。",
    divergeSpeak:
      "个位满十，交给下一位。肩膀上写的是交给下一位几捆，不是整个乘出来的数。",
  },
  "align-tens": {
    where: "用十位去乘时，第二层没有对准十位",
    step: [
      "就看这一步：第二层站哪。",
      "用十位去乘，写下来的第一个数字要站在十位下面。",
    ],
    diverge: [
      "想开一点：十位乘出来的是「几个十」，所以它不能从个位那一格起头。",
      "换个位置想：如果下一步用百位去乘，第一个数字就要站在百位下面。",
      "每一位都在说「我是几个一、几个十、几个百」。写歪一格，数就大了十倍或小了十倍。",
    ],
    speak: "用十位去乘，写下来的第一个数字，要站在十位下面。",
    divergeSpeak: "十位乘出来的是几个十，第一个数字要站在十位下面。写歪一格，数会大十倍或小十倍。",
  },
  "read-zero": {
    where: "读数时，中间的 0 和末尾的 0 没分开",
    step: [
      "万级读完先停一下。",
      "中间空的 0 读一个零，尾巴上的 0 不用读。",
    ],
    diverge: [
      "想开一点：四位一级，像两栋楼。万级是楼上，个级是楼下。",
      "楼与楼之间空着的房间要报「零」；楼尾没人住的房间不用报。",
      "换个数想：只问中间那个 0 读不读，末尾那串 0 读不读。不要一次把整串读完。",
    ],
    speak: "万级读完停一下。中间空的零，读一个零。尾巴上的零，不用读。",
    divergeSpeak: "四位一级。中间空着的零要读，末尾的零不用读。",
  },
  hectare: {
    where: "公顷和平方米的进率没站住",
    step: [
      "1 公顷是边长 100 米的正方形。",
      "里面有 10000 个 1 平方米。先想这一块地，再换单位。",
    ],
    diverge: [
      "想开一点：公顷是「一大块地」，平方米是「地上铺的小格子」。",
      "换单位时，问自己：我是从大块走到小格，还是从小格收成大块？方向反了，零就会少写或多写。",
      "再想一块边长 100 米的操场：它就是 1 公顷。不要先去乘一个还没学的公式。",
    ],
    speak: "一公顷，是边长一百米的正方形。里面有一万个一平方米。",
    divergeSpeak: "公顷是一大块地，平方米是小格子。先想操场那么大的一块，再换单位。",
  },
  protractor: {
    where: "量角器的 0 刻度线和内外圈没对上",
    step: [
      "顶点对中心，一条边对 0。",
      "读另一条边，从 0 的那一圈开始读。",
    ],
    diverge: [
      "想开一点：内外两圈是给两条开口方向相反的角用的。从哪条边对 0，就读哪一圈。",
      "换个角度看：如果对 0 的边在右边，就走右边那圈；对 0 的边在左边，就走左边那圈。",
      "先别报度数。问自己：我是从 0 开始走的，还是看了另一圈的数字。",
    ],
    speak: "顶点对中心，一条边对零。读另一条边，从零的那一圈开始。",
    divergeSpeak: "从哪条边对零，就读哪一圈。不要看反了另一圈的数字。",
  },
  read: {
    where: "题目还没缩成「已知什么、求什么」",
    step: [
      "先把题目缩成两句：已知什么，求什么。",
      "先别列式。",
    ],
    diverge: [
      "想开一点：应用题先当故事听完，再当算式做。",
      "问自己三句：谁？有多少？要我们找的是总数、剩下、还是每一份？",
      "这三句清楚了，列式才是下一步。现在只练把故事说短。",
    ],
    speak: "先把题目缩成两句：已知什么，求什么。先别列式。",
    divergeSpeak: "先当故事听完。谁，有多少，要找的是总数、剩下，还是每一份。",
  },
  setup: {
    where: "还不知道这一步该用加、减、乘还是除",
    step: [
      "先说清要求的是合起来、剩下、几份，还是每一份。",
      "一步只选一种运算。先不要写出得数。",
    ],
    diverge: [
      "想开一点：合起来用加，拿走用减，几份同样的用乘，平均分或求一份用除。",
      "换个生活想：把糖分给几个小朋友，问每人几个，是除；问一共几颗，是乘。",
      "先用手指比出「合、剩、份、每份」，再动笔。",
    ],
    speak: "先说清要求的是合起来、剩下、几份，还是每一份。一步只选一种运算。",
    divergeSpeak: "合起来用加，拿走用减，几份同样的用乘，平均分用除。先比出是哪一种。",
  },
  mid: {
    where: "算到一半，对位或进位乱了",
    step: [
      "先对准个位和个位。",
      "一步只做一个动作。先不要报整道题的得数。",
    ],
    diverge: [
      "想开一点：乱了就回到「这一位在干什么」，不要从得数往回猜。",
      "竖式像排队：个位和个位站一起，十位和十位站一起。",
      "换个角度看：你现在做的是哪一位？做完再走下一位。不要三位一起算。",
    ],
    speak: "先对准个位和个位。一步只做一个动作。先不要报整道题的得数。",
    divergeSpeak: "乱了就问这一位在干什么。个位对个位，做完再走下一位。",
  },
  check: {
    where: "得数出来了，但验算这一步不稳",
    step: [
      "不要先改得数。先用相反的运算，或用估算看大概对不对。",
      "估算只看到整十整百，不代替精确计算。",
    ],
    diverge: [
      "想开一点：验算是换一条路走回去，不是把得数再抄一遍。",
      "乘法可以想：拆成整十再补零头，看是不是还在附近。",
      "如果估算差得很远，先查对位和进位，不要先改答案。",
    ],
    speak: "先不要改得数。用估算看成整十整百，看是不是还在附近。",
    divergeSpeak: "验算是换一条路走回去。差得远，先查对位和进位。",
  },
  locate: {
    where: "答案在课文里，还没有指到那一段",
    step: [
      "答案在课文里。",
      "先用手指住那一段，再写。",
      "我不会把原句放到屏幕上让你抄。",
    ],
    diverge: [
      "想开一点：题目若问「从哪里看出来」，要回课文找原句；若问「你想到什么」，才用自己的话。",
      "先分清题目在问哪一种，再动笔。两种题不能用同一种写法。",
      "找原句时，先圈题目里的一个词，再在课文里找这个词附近的句子。",
    ],
    speak: "先用手指住课文那一段，再写。不要空写感想。",
    divergeSpeak: "问从哪里看出来，就回课文找。问你想到什么，才用自己的话。先分清是哪一种。",
  },
  ask: {
    where: "还没看清题目要找原词，还是用自己的话说",
    step: [
      "先看题目要你干什么：找原词，还是用自己的话说。",
      "问为什么，就用因为……所以……说完。",
    ],
    diverge: [
      "想开一点：四年级的提问本身可以是作业。没有唯一标准问句。",
      "好问题常常从「为什么会这样」「如果换一个条件会怎样」长出来。",
      "先问自己：我是在找书上的句子，还是在想书上没写完的那一层。",
    ],
    speak: "题目问为什么，你就用因为，所以，说完一整句。",
    divergeSpeak: "先分清是找书上的词，还是用自己的话说。问为什么，就用因为所以说完。",
  },
  "fill-exact": {
    where: "练习册要课文里的原词，写成了近义词",
    step: [
      "练习册要课文里的那个词，不能换近义词。",
      "打开书，对三个字。",
    ],
    diverge: [
      "想开一点：课文选这个词，是因为它写的是眼前的声音、样子或顺序，不是大概的意思。",
      "「人声鼎沸」写的是声音挤在一起；只写「人很多」，画面就飘走了。",
      "换词之前先问：我是在默写课文，还是在写作文？默写不能换。",
    ],
    speak: "练习册要课文里的那个词。打开书，一个字一个字对。",
    divergeSpeak: "默写课文不能换近义词。打开书，对三个字。",
  },
  sentence: {
    where: "意思有了，但没有写成完整的一句",
    step: [
      "先说完一句有人、有事、有结果的话，再写下来。",
      "不要只丢两个字在格子里。",
    ],
    diverge: [
      "想开一点：完整的一句，听的人不用猜你在说谁、发生了什么。",
      "可以先口头说给自己听。说不利落，就还没写清楚。",
      "语文里「写完整」和数学里「写得数」一样，都是把过程收到一个能看懂的结果。",
    ],
    speak: "先说完一句有人、有事、有结果的话，再写下来。",
    divergeSpeak: "先口头说完一句。听的人不用猜你在说谁、发生了什么，再写。",
  },
  spell: {
    where: "单词中间几个字母没看清",
    step: ["盖住两边，只看中间这个字母，再写一遍。"],
    diverge: [
      "想开一点：先让这个词站回句子里。sweep 是扫，后面常常跟着 the floor。",
      "会读不会写时，先拍手把音节拍开，再看中间那一拍是哪个字母。",
      "家里还有哪个动作也是「动词 + 地方」？先说句子，再回到会写。",
    ],
    speak: "盖住两边，只看中间这个字母，再写一遍。",
    divergeSpeak: "先让词站回句子里。拍手把音节拍开，再看中间那一拍。",
  },
  word: {
    where: "这个词还不在今晚能用的词表里",
    step: ["今晚只用这一页单词表里的词。"],
    diverge: [
      "想开一点：先问这个词在家里干什么：扫、洗、铺，还是浇。",
      "会做这个动作，再记这个词。词是动作的名字，不是一串要抄的字母。",
      "本单元能说的句子先套：I can ____. 空里只放会的那个动作。",
    ],
    speak: "今晚只用这一页单词表里的词，不要用还没学的词。",
    divergeSpeak: "先问这个词在家里干什么。会做这个动作，再记这个词。",
  },
  write: {
    where: "会读，但默写时字母顺序乱了",
    step: ["先盖住书，只写这一个词。写完再掀开对。"],
    diverge: [
      "想开一点：默写是把声音变回字母。先出声读，再写，不要抄旁边的形状。",
      "写完用手指指着自己写的，再读一次。读不顺的地方，就是写反的字母。",
    ],
    speak: "先盖住书，只写这一个词。写完再掀开对。",
    divergeSpeak: "先出声读，再写。写完用手指指着再读，读不顺的地方就是写反了。",
  },
};

function containsFinalAnswer(text, item) {
  if (!text) return false;
  if (item.subject === "math") {
    const { left } = splitEquation(item.stem || "");
    const v = safeEval(left);
    if (v != null && new RegExp(`(^|[^0-9.])${v}([^0-9.]|$)`).test(String(text).replace(/\s/g, ""))) return true;
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
    if (/角|度|量角器/.test(item.stem || "")) return "protractor";
    if (item.stuck && SKILL_PACKS[item.stuck]) return item.stuck;
    return item.stuck || "mid";
  }
  if (item.subject === "chinese") {
    if (item.stuck === "locate") return "locate";
    if (item.stuck === "ask") return "ask";
    if (item.stuck === "sentence") return "sentence";
    return "fill-exact";
  }
  if (item.stuck === "sentence") return "sentence";
  if (item.stuck === "write") return "write";
  if (item.stuck === "word") return "word";
  return item.stuck || "spell";
}

const PRACTICE = {
  carry: "换一道，只看进位：47×26，个位乘完，个位写下几？肩膀上写几？先不要写出整道题的得数。",
  "align-tens": "换一道，只看第二层：208×34，用十位的 3 去乘，写下来的第一个数字要站在哪一位下面？",
  "read-zero": "换一道，只问零：2 005 0000，中间那个 0 读不读？末尾那些 0 读不读？",
  hectare: "换一道：边长 100 米的正方形是多少公顷？先想这一块地，再换单位。",
  protractor: "换一道：顶点对好了，0 刻度在左边那一圈。另一条边该读哪一圈？",
  read: "换一道：先只说两句——已知什么，求什么。先别列式。",
  setup: "换一道：糖 24 颗分给 6 个小朋友，求的是合、剩、几份，还是每一份？",
  mid: "换一道：先对准个位和个位。这一位做完，再走下一位。",
  check: "换一道：得数出来了，先估成整十整百，看是不是还在附近。先不要改得数。",
  locate: "换一道：题目若问「从哪里看出来」，先用手指住课文那一段，再写。",
  ask: "换一道：先看题目要找原词，还是用因为所以自己说。",
  "fill-exact": "换一道：练习册要课文原词。打开书，对三个字，不要换近义词。",
  sentence: "换一道：先口头说完有人、有事、有结果的一句，再写。",
  spell: "换一道：盖住两边，只看中间这个字母，再写一遍。",
  word: "换一道：今晚只用这一页词表。先让词站回 I can ____. 再写。",
  write: "换一道：盖住书，只写这一个词。写完再掀开对。",
};

function packFor(skill) {
  const base = SKILL_PACKS[skill] || {
    where: "这一步还没钉住",
    step: ["一步只做一个动作。先不要报整道题的得数。"],
    diverge: ["先回到这一步在干什么，再往下做。"],
    speak: "一步只做一个动作。",
    divergeSpeak: "先回到这一步在干什么。",
  };
  return Object.assign({ practice: PRACTICE[skill] || "换一道：还是刚才那一步，数字换一换。" }, base);
}

function teachOne(item, kb, settings, memory) {
  const skill = pickSkill(item, kb);
  const banned = (memory.banned || []).includes(skill);
  const pack = packFor(skill);
  const lines = pack.step.slice();
  const diverge = pack.diverge.slice();

  if (item.subject === "english" && (skill === "word" || skill === "spell")) {
    const unit = currentEnglishUnit(kb, settings);
    const sample = (unit.fourSkills || [])
      .slice(0, 3)
      .map((w) => w.en)
      .join("、");
    if (sample) diverge.push(`本单元可以先站进句子里的词：${sample}。`);
    const p = (unit.patterns || [])[0];
    if (p) diverge.push(`套这个框再说一遍：${p}`);
  }

  if (banned) {
    return {
      skill,
      where: pack.where,
      lines: ["这种讲法爸爸说先别用。", "听大人的一句，再订正。"],
      diverge: [],
      speak: "这种讲法今晚不用了。听大人的。",
      divergeSpeak: "",
      blocked: true,
    };
  }

  const text = [...lines, ...diverge].join("\n");
  if (containsFinalAnswer(text, item) || containsForbiddenMath(text)) {
    return {
      skill,
      where: pack.where,
      lines: ["这题我不能往下讲，怕讲错方法。", "先放着给大人，你做下一题。"],
      diverge: [],
      speak: "这题我不能往下讲。先放着给大人。",
      divergeSpeak: "",
      blocked: true,
    };
  }

  return {
    skill,
    where: pack.where,
    lines,
    diverge,
    speak: pack.speak || lines.join(" "),
    divergeSpeak: pack.divergeSpeak || diverge.join(" "),
    practice: pack.practice || PRACTICE[skill] || "",
    blocked: false,
  };
}


