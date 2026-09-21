const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BALE_TOKEN = process.env.BALE_BOT_TOKEN;

app.get("/", (req, res) => {
  res.send("👑 GameWorld Bot is running!");
});

app.post("/bale/webhook", async (req, res) => {
  try {
    const update = req.body;

    const message = update?.message;
    const text = message?.text;
    const chatId = message?.chat?.id;

    if (text === "/start" && chatId && BALE_TOKEN) {
      await fetch(
        `https://tapi.bale.ai/bot${BALE_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text:
              "👑 به نگهبان اعظم GameWorld خوش آمدید!\n\n" +
              "🛡️ من نگهبان رسمی GameWorld هستم.\n" +
              "🎮 برای ورود به GameWorld آماده‌اید؟"
          })
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`GameWorld Bot running on port ${PORT}`);
});
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BALE_BOT_TOKEN = process.env.BALE_BOT_TOKEN;

const API_BASE = `https://tapi.bale.ai/bot${BALE_BOT_TOKEN}`;

// =========================
// 🧠 ذخیره یادگیری‌ها
// =========================

const DATA_FILE = path.join(__dirname, "learned.json");

function loadLearned() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};

    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (error) {
    console.error("Learned data error:", error);
    return {};
  }
}

function saveLearned(data) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2),
      "utf8"
    );
    return true;
  } catch (error) {
    console.error("Save learned error:", error);
    return false;
  }
}

let learned = loadLearned();

// =========================
// 🛡️ ضد اسپم
// =========================

const spamTracker = new Map();

const SPAM_LIMIT = 3;
const SPAM_WINDOW = 5000;
const AUTO_MUTE_SECONDS = 120;

// =========================
// 🔌 ارتباط با API بله
// =========================

async function bale(method, body = {}) {
  if (!BALE_BOT_TOKEN) {
    throw new Error("BALE_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.description || `Bale API error: HTTP ${response.status}`
    );
  }

  return data;
}

// =========================
// 💬 ارسال پیام
// =========================

async function sendMessage(chatId, text) {
  return bale("sendMessage", {
    chat_id: chatId,
    text
  });
}

// =========================
// 👑 بررسی مدیر/مالک
// =========================

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
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

// =========================
// 🧠 یادگیری
// =========================

function learnCommand(text) {
  const prefix = "یاد بگیر ";

  if (!text.startsWith(prefix)) return null;

  const content = text.slice(prefix.length).trim();

  if (!content.includes("=")) {
    return "❌ فرمت درست:\nیاد بگیر سلام = سلام رفیق 👋";
  }

  const parts = content.split("=");
  const question = parts.shift().trim();
  const answer = parts.join("=").trim();

  if (!question || !answer) {
    return "❌ عبارت و پاسخ نباید خالی باشند.";
  }

  learned[question] = answer;

  if (!saveLearned(learned)) {
    return "❌ ذخیره‌سازی انجام نشد.";
  }

  return `✅ یاد گرفتم!\n\n«${question}» → «${answer}»`;
}

// =========================
// 🗑️ فراموش کردن
// =========================

function forgetCommand(text) {
  const prefix = "فراموش کن ";

  if (!text.startsWith(prefix)) return null;

  const question = text.slice(prefix.length).trim();

  if (!question) {
    return "❌ بنویس چه چیزی را فراموش کنم.";
  }

  if (!(question in learned)) {
    return `❌ «${question}» را یاد نگرفته‌ام.`;
  }

  delete learned[question];
  saveLearned(learned);

  return `🗑️ «${question}» را فراموش کردم.`;
}

// =========================
// 📋 لیست یادگیری
// =========================

function learningList() {
  const keys = Object.keys(learned);

  if (keys.length === 0) {
    return "🧠 هنوز چیزی یاد نگرفته‌ام.";
  }

  let result = "🧠 چیزهایی که یاد گرفته‌ام:\n\n";

  for (const key of keys) {
    result += `• ${key} → ${learned[key]}\n`;
  }

  return result;
}

// =========================
// 📖 راهنما
// =========================

const HELP_TEXT = `
📖 راهنمای بات

👑 مدیریت گروه

بن
روی پیام شخص ریپلای کن و «بن» بفرست.

آن‌بن
روی پیام شخص ریپلای کن و «آن‌بن» بفرست.

سکوت
روی پیام شخص ریپلای کن و «سکوت» بفرست.

رفع سکوت
روی پیام شخص ریپلای کن و «رفع سکوت» بفرست.

اخراج
روی پیام شخص ریپلای کن و «اخراج» بفرست.

🧠 یادگیری

یاد بگیر سلام = سلام رفیق
→ بات پاسخ را ذخیره می‌کند.

فراموش کن سلام
→ پاسخ ذخیره‌شده حذف می‌شود.

یادگیری‌ها
→ موارد یادگرفته‌شده را نمایش می‌دهد.

🛡️ ضد اسپم

اگر کسی «بن» را پشت سر هم چند بار ارسال کند،
برای ۲ دقیقه سکوت می‌شود.
`;

// =========================
// 🛡️ بررسی اسپم بن
// =========================

function checkBanSpam(userId) {
  const now = Date.now();

  let data = spamTracker.get(userId);

  if (!data) {
    data = {
      count: 0,
      last: now
    };
  }

  if (now - data.last > SPAM_WINDOW) {
    data.count = 0;
  }

  data.count++;
  data.last = now;

  spamTracker.set(userId, data);

  if (data.count >= SPAM_LIMIT) {
    data.count = 0;
    spamTracker.set(userId, data);

    return true;
  }

  return false;
}

// =========================
// 🔇 سکوت
// =========================

async function muteUser(chatId, userId, seconds = 120) {
  const untilDate = Math.floor(Date.now() / 1000) + seconds;

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

// =========================
// 🔊 رفع سکوت
// =========================

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

// =========================
// 🚫 بن
// =========================

async function banUser(chatId, userId) {
  return bale("banChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// =========================
// 🔓 آن‌بن
// =========================

async function unbanUser(chatId, userId) {
  return bale("unbanChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// =========================
// 🚪 اخراج
// =========================

async function kickUser(chatId, userId) {
  return bale("kickChatMember", {
    chat_id: chatId,
    user_id: userId
  });
}

// =========================
// 📌 اجرای دستور مدیریتی
// =========================

async function handleAdminCommand(
  chatId,
  senderId,
  text,
  replyUserId
) {
  const admin = await isAdmin(chatId, senderId);

  if (!admin) {
    await sendMessage(
      chatId,
      "⛔ فقط مدیر یا مالک گروه می‌تواند از این دستور استفاده کند."
    );
    return;
  }

  if (!replyUserId) {
    await sendMessage(
      chatId,
      "📌 برای اجرای این دستور باید روی پیام شخص موردنظر ریپلای کنی."
    );
    return;
  }

  try {
    if (text === "بن") {
      await banUser(chatId, replyUserId);
      await sendMessage(chatId, "✅ کاربر بن شد.");
      return;
    }

    if (text === "آن‌بن" || text === "انبن") {
      await unbanUser(chatId, replyUserId);
      await sendMessage(chatId, "✅ بن کاربر برداشته شد.");
      return;
    }

    if (text === "سکوت") {
      await muteUser(chatId, replyUserId, 120);
      await sendMessage(chatId, "🔇 کاربر برای ۲ دقیقه سکوت شد.");
      return;
    }

    if (text === "رفع سکوت" || text === "رفع‌سکوت") {
      await unmuteUser(chatId, replyUserId);
      await sendMessage(chatId, "🔊 سکوت کاربر برداشته شد.");
      return;
    }

    if (text === "اخراج") {
      await kickUser(chatId, replyUserId);
      await sendMessage(chatId, "🚪 کاربر اخراج شد.");
      return;
    }

  } catch (error) {
    console.error("Management error:", error);

    await sendMessage(
      chatId,
      "❌ عملیات انجام نشد.\nممکن است بات دسترسی مدیریتی لازم را نداشته باشد."
    );
  }
}

// =========================
// 🌐 صفحه اصلی
// =========================

app.get("/", (req, res) => {
  res.send("👑 GameWorld Bot is running!");
});

// =========================
// 🤖 Webhook
// =========================

app.post("/bale/webhook", async (req, res) => {
  // سریع به بله پاسخ می‌دهیم
  res.sendStatus(200);

  try {
    const update = req.body || {};
    const message = update.message;

    if (!message) return;

    const chatId = message.chat?.id;
    const text = message.text?.trim();
    const senderId = message.from?.id;

    if (!chatId || !senderId || !text) return;

    // =========================
    // /start
    // =========================

    if (text === "/start") {
      await sendMessage(
        chatId,
        "👑 به نگهبان اعظم GameWorld خوش آمدید!\n\n" +
        "🛡️ من نگهبان رسمی GameWorld هستم.\n" +
        "🎮 آماده ورود به دنیای GameWorld هستید؟"
      );

      return;
    }

    // =========================
    // 🧠 یاد بگیر
    // =========================

    if (text.startsWith("یاد بگیر ")) {
      await sendMessage(chatId, learnCommand(text));
      return;
    }

    // =========================
    // 🗑️ فراموش کن
    // =========================

    if (text.startsWith("فراموش کن ")) {
      await sendMessage(chatId, forgetCommand(text));
      return;
    }

    // =========================
    // 📋 یادگیری‌ها
    // =========================

    if (text === "یادگیری‌ها") {
      await sendMessage(chatId, learningList());
      return;
    }

    // =========================
    // 📖 راهنما
    // =========================

    if (text === "راهنما" || text === "/help") {
      await sendMessage(chatId, HELP_TEXT);
      return;
    }

    // =========================
    // 🛡️ بن بن بن
    // =========================

    if (text === "بن") {
      const spam = checkBanSpam(senderId);

      if (spam) {
        const senderIsAdmin = await isAdmin(chatId, senderId);

        if (!senderIsAdmin) {
          try {
            await muteUser(
              chatId,
              senderId,
              AUTO_MUTE_SECONDS
            );

            await sendMessage(
              chatId,
              "⚠️ به دلیل ارسال پشت‌سرهم دستور «بن»، " +
              "برای ۲ دقیقه سکوت شدی."
            );
          } catch (error) {
            console.error("Auto mute error:", error);
          }

          return;
        }
      }
    }

    // =========================
    // 👑 مدیریت با ریپلای
    // =========================

    const managementCommands = [
      "بن",
      "آن‌بن",
      "انبن",
      "سکوت",
      "رفع سکوت",
      "رفع‌سکوت",
      "اخراج"
    ];

    if (managementCommands.includes(text)) {
      const replyUserId =
        message.reply_to_message?.from?.id;

      // بن بدون ریپلای
      if (text === "بن" && !replyUserId) {
        await sendMessage(
          chatId,
          "📌 برای بن کردن یک نفر، " +
          "روی پیام او ریپلای کن و «بن» بفرست."
        );
        return;
      }

      await handleAdminCommand(
        chatId,
        senderId,
        text,
        replyUserId
      );

      return;
    }

    // =========================
    // 🧠 پاسخ یادگرفته‌شده
    // =========================

    if (Object.prototype.hasOwnProperty.call(learned, text)) {
      await sendMessage(chatId, learned[text]);
    }

  } catch (error) {
    console.error("Webhook error:", error);
  }
});

// =========================
// 🚀 Start
// =========================

app.listen(PORT, () => {
  console.log(`👑 GameWorld Bot running on port ${PORT}`);

  if (!BALE_BOT_TOKEN) {
    console.warn("⚠️ BALE_BOT_TOKEN is not set.");
  } else {
    console.log("✅ Bale token detected.");
  }
});
