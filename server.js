const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BALE_BOT_TOKEN;

if (!TOKEN) {
  console.warn("⚠️ BALE_BOT_TOKEN تنظیم نشده است.");
}

const API = TOKEN
  ? `https://tapi.bale.ai/bot${TOKEN}`
  : null;

// ==============================
// 🧠 فایل یادگیری
// ==============================

const DATA_FILE = path.join(__dirname, "learned.json");

let learned = {};

function loadLearned() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      learned = JSON.parse(data || "{}");
    }
  } catch (err) {
    console.error("❌ خطای خواندن learned.json:", err);
    learned = {};
  }
}

function saveLearned() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(learned, null, 2),
      "utf8"
    );
    return true;
  } catch (err) {
    console.error("❌ خطای ذخیره یادگیری:", err);
    return false;
  }
}

loadLearned();

// ==============================
// 🔌 ارتباط با بله
// ==============================

async function bale(method, body = {}) {
  if (!API) {
    throw new Error("BALE_BOT_TOKEN تنظیم نشده است.");
  }

  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.description ||
      `Bale API Error: ${response.status}`
    );
  }

  return data;
}

// ==============================
// 💬 ارسال پیام
// ==============================

async function sendMessage(chatId, text) {
  return bale("sendMessage", {
    chat_id: chatId,
    text: String(text)
  });
}

// ==============================
// 👑 بررسی مدیر
// ==============================

async function isAdmin(chatId, userId) {
  try {
    const result = await bale("getChatMember", {
      chat_id: chatId,
      user_id: userId
    });

    const status = result?.result?.status;

    return (
      status === "administrator" ||
      status === "creator"
    );
  } catch (err) {
    console.error("Admin check:", err);
    return false;
  }
}

// ==============================
// 🧠 یادگیری
// ==============================

function learn(text) {
  const prefix = "یاد بگیر ";

  if (!text.startsWith(prefix)) {
    return null;
  }

  const content = text.slice(prefix.length).trim();

  if (!content.includes("=")) {
    return "❌ فرمت درست:\nیاد بگیر سلام = سلام رفیق 👋";
  }

  const index = content.indexOf("=");

  const question = content
    .slice(0, index)
    .trim();

  const answer = content
    .slice(index + 1)
    .trim();

  if (!question || !answer) {
    return "❌ عبارت یا پاسخ خالی است.";
  }

  learned[question] = answer;

  if (!saveLearned()) {
    return "❌ ذخیره انجام نشد.";
  }

  return (
    `✅ یاد گرفتم!\n\n` +
    `«${question}» → «${answer}»`
  );
}

// ==============================
// 🗑️ فراموش کردن
// ==============================

function forget(text) {
  const prefix = "فراموش کن ";

  if (!text.startsWith(prefix)) {
    return null;
  }

  const question = text
    .slice(prefix.length)
    .trim();

  if (!question) {
    return "❌ مشخص کن چه چیزی را فراموش کنم.";
  }

  if (!(question in learned)) {
    return `❌ «${question}» را یاد نگرفته‌ام.`;
  }

  delete learned[question];
  saveLearned();

  return `🗑️ «${question}» را فراموش کردم.`;
}

// ==============================
// 📋 لیست یادگیری‌ها
// ==============================

function learningList() {
  const keys = Object.keys(learned);

  if (keys.length === 0) {
    return "🧠 هنوز چیزی یاد نگرفته‌ام.";
  }

  let result = "🧠 یادگیری‌های من:\n\n";

  for (const key of keys) {
    result += `• ${key} → ${learned[key]}\n`;
  }

  return result;
}

// ==============================
// 📖 راهنما
// ==============================

const HELP = `
📖 راهنمای نگهبان GameWorld

👑 مدیریت گروه

برای مدیریت یک شخص:
روی پیام او ریپلای کن و یکی از این دستورها را بفرست:

بن
آن‌بن
انبن
سکوت
رفع سکوت
رفع‌سکوت
اخراج

🧠 یادگیری

یاد بگیر سلام = سلام رفیق 👋

فراموش کن سلام

یادگیری‌ها

🛡️ ضد اسپم

ارسال پشت‌سرهم «بن» باعث سکوت خودکار ۲ دقیقه‌ای می‌شود.

⚠️ دستورات مدیریت فقط برای مدیران گروه هستند.
`;

// ==============================
// 🛡️ ضد اسپم
// ==============================

const spam = new Map();

const SPAM_LIMIT = 3;
const SPAM_TIME = 5000;
const AUTO_MUTE = 120;

function checkSpam(userId) {
  const now = Date.now();

  let data = spam.get(userId);

  if (!data || now - data.time > SPAM_TIME) {
    data = {
      count: 0,
      time: now
    };
  }

  data.count++;
  data.time = now;

  spam.set(userId, data);

  if (data.count >= SPAM_LIMIT) {
    spam.delete(userId);
    return true;
  }

  return false;
}

// ==============================
// 🔇 سکوت
// ==============================

async function muteUser(chatId, userId, seconds = 120) {
  const untilDate =
    Math.floor(Date.now() / 1000) + seconds;

  return bale("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    until_date: untilDate
  });
}

// ==============================
// 🔊 رفع سکوت
// ==============================

async function unmuteUser(chatId, userId) {
  return bale("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true
  });
}

// ==============================
// 🚫 بن
// ==============================

async function banUser(chatId, userId) {
  return bale("banChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// ==============================
// 🔓 آن‌بن
// ==============================

async function unbanUser(chatId, userId) {
  return bale("unbanChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// ==============================
// 🚪 اخراج
// ==============================

async function kickUser(chatId, userId) {
  return bale("kickChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// ==============================
// 👑 مدیریت
// ==============================

const ADMIN_COMMANDS = [
  "بن",
  "آن‌بن",
  "انبن",
  "سکوت",
  "رفع سکوت",
  "رفع‌سکوت",
  "اخراج"
];

async function handleAdmin(
  chatId,
  senderId,
  command,
  targetId
) {
  const admin = await isAdmin(
    chatId,
    senderId
  );

  if (!admin) {
    await sendMessage(
      chatId,
      "⛔ فقط مدیر یا مالک گروه می‌تواند این دستور را اجرا کند."
    );
    return;
  }

  if (!targetId) {
    await sendMessage(
      chatId,
      "📌 باید روی پیام شخص موردنظر ریپلای کنی."
    );
    return;
  }

  try {
    switch (command) {

      case "بن":
        await banUser(chatId, targetId);
        await sendMessage(
          chatId,
          "🚫 کاربر بن شد."
        );
        break;

      case "آن‌بن":
      case "انبن":
        await unbanUser(chatId, targetId);
        await sendMessage(
          chatId,
          "🔓 بن کاربر برداشته شد."
        );
        break;

      case "سکوت":
        await muteUser(
          chatId,
          targetId,
          120
        );
        await sendMessage(
          chatId,
          "🔇 کاربر برای ۲ دقیقه سکوت شد."
        );
        break;

      case "رفع سکوت":
      case "رفع‌سکوت":
        await unmuteUser(
          chatId,
          targetId
        );
        await sendMessage(
          chatId,
          "🔊 سکوت کاربر برداشته شد."
        );
        break;

      case "اخراج":
        await kickUser(
          chatId,
          targetId
        );
        await sendMessage(
          chatId,
          "🚪 کاربر اخراج شد."
        );
        break;
    }

  } catch (err) {
    console.error("Management:", err);

    await sendMessage(
      chatId,
      "❌ عملیات انجام نشد.\n\n" +
      "ممکن است بات دسترسی مدیریتی لازم را نداشته باشد."
    );
  }
}

// ==============================
// 🌐 صفحه اصلی
// ==============================

app.get("/", (req, res) => {
  res.status(200).send(
    "👑 GameWorld Bot is running!"
  );
});

// ==============================
// 🤖 Webhook
// ==============================

app.post("/bale/webhook", async (req, res) => {

  // پاسخ سریع به بله
  res.sendStatus(200);

  try {

    const update = req.body || {};
    const message = update.message;

    if (!message) return;

    const chatId = message.chat?.id;
    const senderId = message.from?.id;

    const text =
      typeof message.text === "string"
        ? message.text.trim()
        : "";

    if (!chatId || !senderId || !text) {
      return;
    }

    // ==========================
    // /start
    // ==========================

    if (text === "/start") {

      await sendMessage(
        chatId,
        "👑 به نگهبان اعظم GameWorld خوش آمدید!\n\n" +
        "🛡️ من نگهبان رسمی GameWorld هستم.\n" +
        "🎮 آماده ورود به دنیای GameWorld هستید؟\n\n" +
        "📖 برای دیدن راهنما بنویس:\n" +
        "راهنما"
      );

      return;
    }

    // ==========================
    // راهنما
    // ==========================

    if (
      text === "راهنما" ||
      text === "/help"
    ) {
      await sendMessage(chatId, HELP);
      return;
    }

    // ==========================
    // یاد بگیر
    // ==========================

    if (text.startsWith("یاد بگیر ")) {
      const result = learn(text);

      if (result) {
        await sendMessage(chatId, result);
      }

      return;
    }

    // ==========================
    // فراموش کن
    // ==========================

    if (text.startsWith("فراموش کن ")) {
      const result = forget(text);

      if (result) {
        await sendMessage(chatId, result);
      }

      return;
    }

    // ==========================
    // یادگیری‌ها
    // ==========================

    if (text === "یادگیری‌ها") {
      await sendMessage(
        chatId,
        learningList()
      );
      return;
    }

    // ==========================
    // ضد اسپم «بن»
    // ==========================

    if (text === "بن") {

      const repeated = checkSpam(senderId);

      if (repeated) {

        const admin =
          await isAdmin(
            chatId,
            senderId
          );

        if (!admin) {

          try {

            await muteUser(
              chatId,
              senderId,
              AUTO_MUTE
            );

            await sendMessage(
              chatId,
              "⚠️ ارسال پشت‌سرهم دستور «بن»\n\n" +
              "🔇 برای ۲ دقیقه سکوت شدی."
            );

          } catch (err) {
            console.error(
              "Auto mute:",
              err
            );
          }

          return;
        }
      }
    }

    // ==========================
    // مدیریت
    // ==========================

    if (ADMIN_COMMANDS.includes(text)) {

      const targetId =
        message.reply_to_message?.from?.id;

      if (
        text === "بن" &&
        !targetId
      ) {

        await sendMessage(
          chatId,
          "📌 برای بن کردن یک نفر:\n\n" +
          "1️⃣ روی پیام او ریپلای کن\n" +
          "2️⃣ بن را بفرست"
        );

        return;
      }

      await handleAdmin(
        chatId,
        senderId,
        text,
        targetId
      );

      return;
    }

    // ==========================
    // پاسخ‌های یادگرفته‌شده
    // ==========================

    if (
      Object.prototype.hasOwnProperty.call(
        learned,
        text
      )
    ) {

      await sendMessage(
        chatId,
        learned[text]
      );

      return;
    }

  } catch (err) {
    console.error(
      "❌ Webhook Error:",
      err
    );
  }
});

// ==============================
// 🚀 اجرای سرور
// ==============================

app.listen(PORT, () => {

  console.log(
    `👑 GameWorld Bot running on port ${PORT}`
  );

  if (TOKEN) {
    console.log(
      "✅ BALE_BOT_TOKEN detected."
    );
  } else {
    console.log(
      "⚠️ BALE_BOT_TOKEN is missing."
    );
  }

});
