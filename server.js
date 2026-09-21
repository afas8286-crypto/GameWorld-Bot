const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "256kb" }));

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.BALE_BOT_TOKEN || "";
const API = TOKEN ? `https://tapi.bale.ai/bot${TOKEN}` : "";
const SECRET = process.env.BALE_WEBHOOK_SECRET || "";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "bot-data.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

const emptyDB = {
  users: {}, groups: {}, memories: {}, originals: {},
  warnings: {}, stats: {}, settings: {}, pending: {}
};

function loadDB() {
  try {
    return { ...emptyDB, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch {
    return structuredClone(emptyDB);
  }
}
let db = loadDB();

function saveDB() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function idOf(x) { return String(x?.id ?? x ?? ""); }
function nameOf(u) { return u?.first_name || u?.name || u?.username || "کاربر"; }
function textOf(m) { return String(m?.text || "").trim(); }
function isGroup(m) { return ["group", "supergroup"].includes(m?.chat?.type); }

async function bale(method, body = {}) {
  if (!API) throw new Error("BALE_BOT_TOKEN is not configured");
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) {
    throw new Error(data.description || `Bale API ${r.status}`);
  }
  return data.result ?? data;
}

async function sendMessage(chatId, text, replyTo) {
  const body = { chat_id: chatId, text: String(text) };
  if (replyTo) body.reply_to_message_id = replyTo;
  return bale("sendMessage", body);
}

async function memberInfo(chatId, userId) {
  try { return await bale("getChatMember", { chat_id: chatId, user_id: userId }); }
  catch { return null; }
}

function isAdmin(member) {
  const s = String(member?.status || "").toLowerCase();
  return ["creator", "owner", "administrator", "admin"].includes(s);
}

function groupDB(chatId) {
  const k = idOf(chatId);
  db.groups[k] ||= {
    welcome: true, farewell: true, antiLink: false,
    antiSpam: true, daily: true, truthDare: true
  };
  db.stats[k] ||= { messages: 0, users: {}, hours: {} };
  return db.groups[k];
}

function userDB(userId) {
  const k = idOf(userId);
  db.users[k] ||= { name: "", xp: 0, messages: 0 };
  return db.users[k];
}

function originalKey(chatId, userId) {
  return `${idOf(chatId)}:${idOf(userId)}`;
}

function memoryKey(scope, owner, key) {
  return `${scope}:${idOf(owner)}:${key.toLowerCase()}`;
}

const QUESTIONS = [
"حقیقت: آخرین چیزی که واقعاً خندوندت چی بود؟",
"جرئت: سه ایموجی بفرست که حال امروزت رو توضیح بده.",
"حقیقت: کدوم مهارت رو دوست داری سریع یاد بگیری؟",
"جرئت: یک جمله خیلی رسمی درباره یک چیز کاملاً بی‌اهمیت بنویس.",
"حقیقت: عجیب‌ترین غذایی که امتحان کردی چی بوده؟",
"جرئت: اسم خودت رو با سه لقب خنده‌دار معرفی کن.",
"حقیقت: اگر یک روز قدرت نامرئی شدن داشتی، اولین کار بی‌خطر و بامزه‌ات چی بود؟",
"جرئت: یک پیام فقط با ایموجی بفرست و بگذار بقیه حدس بزنند منظورت چیست.",
"حقیقت: کدام فیلم یا بازی را می‌توانی چند بار ببینی؟",
"جرئت: یک جمله بساز که هر کلمه‌اش با حرف «م» شروع شود."
];

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function dailyQuestion(chatId, userId) {
  const k = idOf(chatId);
  const u = userDB(userId);
  const seed = [...`${todayKey()}:${k}:${idOf(userId)}`]
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return QUESTIONS[seed % QUESTIONS.length];
}

function startText(name) {
  return [
    "╭━━━━━━━━━━━━━━━━━━╮",
    "      🤖 𝐀𝐑𝐂𝐀𝐍𝐀",
    "   𝐀𝐈 𝐆𝐑𝐎𝐔𝐏 𝐁𝐎𝐓",
    "╰━━━━━━━━━━━━━━━━━━╯",
    "",
    `سلام ${name} 👋`,
    "خوش اومدی ✨",
    "",
    "🛡️ مدیریت • 🧠 هوش • 🎭 سرگرمی",
    "🎬 GIF • 🎁 روزانه • 🏆 رتبه‌بندی",
    "",
    "همه‌چی آماده‌ست 😎🔥"
  ].join("\n");
}

function helpText() {
  return [
    "📚 راهنمای سریع",
    "",
    "🪪 «اصل» → روی پیام شخص ریپلای کن",
    "🪪 «اصل من» → اصل خودت",
    "🧠 «یاد بگیر X = Y» → آموزش حافظه",
    "🎭 «جرئت حقیقت» → سوال امروز",
    "🎬 «گیف ...» → درخواست ساخت GIF",
    "🎁 «روزانه» → جایزه",
    "🏆 «رتبه» → رتبه فعالیت",
    "",
    "🤖 شخصیت: 😂 شوخ • 😈 شیطون • 😎 خودمونی",
    "🤨 تیکه‌پرون • 🔥 هیجانی • 🗿 خشک • 👑 رسمی"
  ].join("\n");
}

async function showOriginal(chatId, message, self = false) {
  const target = self ? message.from : (message.reply_to_message?.from || message.reply_to_message?.sender_chat);
  if (!target?.id) return sendMessage(chatId, "🪪 روی پیام شخص ریپلای کن.");
  const rec = db.originals[originalKey(chatId, target.id)];
  if (!rec) return sendMessage(chatId, `🪪 (${nameOf(target)})\nهنوز اصلی ثبت نشده.`);
  return sendMessage(chatId, `🪪 (${nameOf(target)})\n${rec.text}`);
}

async function registerOriginal(chatId, message) {
  const actor = message.from;
  const member = await memberInfo(chatId, actor?.id);
  if (!isAdmin(member)) return sendMessage(chatId, "🚫 این کار فقط برای مالک و مدیرهاست.");

  const target = message.reply_to_message?.from;
  if (!target?.id) return sendMessage(chatId, "🪪 روی پیام شخص موردنظر ریپلای کن و «ثبت اصل» بفرست.");

  db.pending[`${chatId}:${actor.id}`] = {
    type: "original", targetId: idOf(target.id), targetName: nameOf(target)
  };
  saveDB();
  return sendMessage(chatId, `✍️ اصل جدید برای (${nameOf(target)}) رو بفرست.`);
}

function findMemory(scope, owner, key) {
  return db.memories[memoryKey(scope, owner, key)];
}

async function learnMemory(chatId, message, key, value) {
  const userId = idOf(message.from?.id);
  const cleanKey = key.trim().replace(/\s+/g, " ");
  const cleanValue = value.trim();
  if (!cleanKey || !cleanValue) return sendMessage(chatId, "🧠 فرمت: یاد بگیر X = Y");

  const k = memoryKey("user", userId, cleanKey);
  const old = db.memories[k];
  if (old && old.value !== cleanValue) {
    return sendMessage(chatId, `🧠 برای «${cleanKey}» قبلاً یه چیز دیگه یاد گرفته بودم.\nاول «فراموش کن ${cleanKey}» بفرست.`);
  }
  db.memories[k] = { key: cleanKey, value: cleanValue, owner: userId, updatedAt: Date.now() };
  saveDB();
  return sendMessage(chatId, `🧠 یاد گرفتم!\n«${cleanKey}» → ${cleanValue}`);
}

async function handleText(message) {
  const chatId = idOf(message.chat?.id);
  const userId = idOf(message.from?.id);
  const text = textOf(message);
  if (!chatId || !text) return;

  if (isGroup(message)) {
    const g = groupDB(chatId);
    const u = userDB(userId);
    u.name = nameOf(message.from);
    u.messages++;
    g.stats = db.stats[chatId];
    g.stats.messages++;
    g.stats.users[userId] = (g.stats.users[userId] || 0) + 1;
    g.stats.hours[new Date().getHours()] = (g.stats.hours[new Date().getHours()] || 0) + 1;
    u.xp += 1;
  }

  const pendingKey = `${chatId}:${userId}`;
  const pending = db.pending[pendingKey];
  if (pending?.type === "original" && text !== "ثبت اصل") {
    db.originals[originalKey(chatId, pending.targetId)] = {
      text, updatedAt: Date.now()
    };
    delete db.pending[pendingKey];
    saveDB();
    return sendMessage(chatId, `🪪 اصل (${pending.targetName}) ثبت و جایگزین شد.`);
  }

  if (text === "/start") return sendMessage(chatId, startText(nameOf(message.from)));
  if (text === "راهنما" || text === "📚 راهنما") return sendMessage(chatId, helpText());

  if (text === "اصل من" || text === "اصل خودم") return showOriginal(chatId, message, true);
  if (text === "اصل") return showOriginal(chatId, message, false);
  if (text === "ثبت اصل") return registerOriginal(chatId, message);

  const learn = text.match(/^یاد\s*بگیر\s+(.+?)\s*=\s*(.+)$/);
  if (learn) return learnMemory(chatId, message, learn[1], learn[2]);

  const forget = text.match(/^فراموش\s*کن\s+(.+)$/);
  if (forget) {
    delete db.memories[memoryKey("user", userId, forget[1].trim())];
    saveDB();
    return sendMessage(chatId, "🧠 انجام شد.");
  }

  if (text === "جرئت حقیقت" || text === "جرئت یا حقیقت") {
    return sendMessage(chatId, dailyQuestion(chatId, userId));
  }

  if (text.startsWith("گیف ")) {
    return sendMessage(chatId, "🎬 درخواست GIF ثبت شد. ماژول رندر را می‌توانی به سرویس GIF خودت وصل کنی.");
  }

  if (text === "روزانه") return sendMessage(chatId, "🎁 جایزه روزانه: +10 XP ✨");
  if (text === "رتبه") {
    const stats = db.stats[chatId]?.users || {};
    const top = Object.entries(stats).sort((a,b) => b[1]-a[1]).slice(0,3);
    const lines = top.map((x,i) => `${["🥇","🥈","🥉"][i]} ${db.users[x[0]]?.name || x[0]} — ${x[1]}`);
    return sendMessage(chatId, `🏆 رتبه فعالیت\n\n${lines.join("\n") || "هنوز آماری نیست."}`);
  }

  const memAsk = text.match(/^(.+?)\s+(کیه|چیه|یعنی چی)\??$/);
  if (memAsk) {
    const rec = findMemory("user", userId, memAsk[1].trim());
    if (rec) return sendMessage(chatId, `🧠 طبق چیزایی که بهم یاد دادی:\n${rec.key} = ${rec.value}`);
  }
}

app.get("/", (_req, res) => res.json({
  ok: true, bot: "ARCANA", configured: Boolean(TOKEN)
}));

app.get("/health", (_req, res) => res.json({
  ok: true, uptime: Math.round(process.uptime()), configured: Boolean(TOKEN)
}));

app.post("/webhook", async (req, res) => {
  if (SECRET && req.get("x-bale-webhook-secret") !== SECRET) {
    return res.status(401).json({ ok: false });
  }
  res.json({ ok: true });
  try {
    const update = req.body || {};
    const message = update.message || update.edited_message;
    if (message) await handleText(message);
  } catch (err) {
    console.error("[UPDATE]", err.message);
  }
});

process.on("uncaughtException", e => console.error("[FATAL]", e));
process.on("unhandledRejection", e => console.error("[REJECTION]", e));

app.listen(PORT, () => console.log(`ARCANA running on :${PORT}`));
