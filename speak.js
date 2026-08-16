/* 语音讲解：优先播爸爸录过的句子，否则用系统中文男声。 */

const DAD_SCRIPTS = [
  { id: "carry", text: "就看进位。个位算完，写下个位，多的写在十位肩膀上。先不要写出整道题的得数。" },
  { id: "align-tens", text: "用十位去乘，写下来的第一个数字，要站在十位下面。" },
  { id: "read-zero", text: "万级读完停一下。中间空的零，读一个零。尾巴上的零，不用读。" },
  { id: "hectare", text: "一公顷，是边长一百米的正方形。里面有一万个一平方米。" },
  { id: "fill-exact", text: "练习册要课文里的那个词。打开书，一个字一个字对。" },
  { id: "locate", text: "先用手指住课文那一段，再写。不要空写感想。" },
  { id: "ask", text: "题目问为什么，你就用因为，所以，说完一整句。" },
  { id: "spell", text: "盖住两边，只看中间这个字母，再写一遍。" },
  { id: "word", text: "今晚只用这一页单词表里的词，不要用还没学的词。" },
  { id: "park", text: "这题先交给大人。你不用坐着等，先做下一题。" },
];

const Speak = {
  rec: null,
  chunks: [],
  current: null,

  loadDadMap() {
    try {
      return JSON.parse(localStorage.getItem("jw-dad-voice-index") || "{}");
    } catch {
      return {};
    }
  },

  saveDadMap(map) {
    localStorage.setItem("jw-dad-voice-index", JSON.stringify(map));
  },

  async blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  },

  async saveDadClip(id, blob) {
    const map = this.loadDadMap();
    map[id] = await this.blobToDataUrl(blob);
    this.saveDadMap(map);
  },

  dadClip(id) {
    return this.loadDadMap()[id] || "";
  },

  recordedCount() {
    return Object.keys(this.loadDadMap()).length;
  },

  stop() {
    if (this.current) {
      try {
        this.current.pause();
      } catch {}
      this.current = null;
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
  },

  async playDataUrl(url) {
    this.stop();
    const audio = new Audio(url);
    this.current = audio;
    await audio.play();
  },

  speakBrowser(text) {
    this.stop();
    if (!window.speechSynthesis) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = 0.92;
    const voices = speechSynthesis.getVoices();
    const zhMale =
      voices.find((v) => /zh|cmn/i.test(v.lang) && /male|男|Yunyang|Yunxi|Kangkang/i.test(v.name)) ||
      voices.find((v) => /zh-CN|zh_CN|cmn/i.test(v.lang));
    if (zhMale) u.voice = zhMale;
    speechSynthesis.speak(u);
    return true;
  },

  async speak(text, skillId) {
    const clip = skillId && this.dadClip(skillId);
    if (clip) {
      try {
        await this.playDataUrl(clip);
        return "dad";
      } catch {
        /* fall through */
      }
    }
    return this.speakBrowser(text) ? "tts" : "none";
  },

  async startRecord() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const rec = new MediaRecorder(stream);
    this.rec = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    rec.start();
    return rec;
  },

  async stopRecord() {
    const rec = this.rec;
    if (!rec) return null;
    const blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    rec.stream.getTracks().forEach((t) => t.stop());
    this.rec = null;
    return blob;
  },
};

if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  speechSynthesis.getVoices();
}
