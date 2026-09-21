const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const BALE_BOT_TOKEN = process.env.BALE_BOT_TOKEN;

app.get("/", (req, res) => {
  res.send("👑 GameWorld Bot is running!");
});

app.post("/bale/webhook", async (req, res) => {
  try {
    const update = req.body;

    const message = update?.message;
    const text = message?.text;
    const chatId = message?.chat?.id;

    if (text === "/start" && chatId && BALE_BOT_TOKEN) {
      await fetch(
        `https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/sendMessage`,
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
              "🎮 آماده ورود به دنیای GameWorld هستید؟"
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
import json
import os
import time

# =========================
# تنظیمات
# =========================

DATA_FILE = "learned.json"
SPAM_LIMIT = 3
SPAM_WINDOW = 5
AUTO_MUTE_TIME = 120

# =========================
# ذخیره‌سازی
# =========================

def load_data():
    if not os.path.exists(DATA_FILE):
        return {}

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        if isinstance(data, dict):
            return data

    except (json.JSONDecodeError, OSError):
        pass

    return {}


def save_data(data):
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
        return True
    except OSError:
        return False


learned = load_data()

# user_id:
# {
#   "count": 0,
#   "last": 0
# }
spam_users = {}


# =========================
# 🧠 یادگیری
# =========================

def learn(text):
    prefix = "یاد بگیر "

    if not text.startswith(prefix):
        return None

    value = text[len(prefix):].strip()

    if "=" not in value:
        return "❌ فرمت درست:\nیاد بگیر سلام = سلام رفیق 👋"

    question, answer = value.split("=", 1)

    question = question.strip()
    answer = answer.strip()

    if not question or not answer:
        return "❌ عبارت و پاسخ نباید خالی باشند."

    learned[question] = answer

    if not save_data(learned):
        return "❌ ذخیره‌سازی انجام نشد."

    return f"✅ یاد گرفتم:\n{question} → {answer}"


def forget(text):
    prefix = "فراموش کن "

    if not text.startswith(prefix):
        return None

    question = text[len(prefix):].strip()

    if not question:
        return "❌ بنویس چه چیزی را فراموش کنم."

    if question not in learned:
        return f"❌ «{question}» را یاد نگرفته‌ام."

    del learned[question]
    save_data(learned)

    return f"🗑️ «{question}» را فراموش کردم."


def learned_list():
    if not learned:
        return "🧠 هنوز چیزی یاد نگرفته‌ام."

    result = "🧠 چیزهایی که یاد گرفته‌ام:\n\n"

    for question, answer in learned.items():
        result += f"• {question} → {answer}\n"

    return result


# =========================
# 🛡️ ضد اسپم
# =========================

def check_spam(user_id, text):
    now = time.time()

    if user_id not in spam_users:
        spam_users[user_id] = {
            "count": 0,
            "last": now
        }

    user = spam_users[user_id]

    if now - user["last"] > SPAM_WINDOW:
        user["count"] = 0

    user["last"] = now

    if text.strip() == "بن":
        user["count"] += 1
    else:
        user["count"] = 0

    if user["count"] >= SPAM_LIMIT:
        user["count"] = 0

        return True

    return False


# =========================
# 📖 راهنما
# =========================

HELP_TEXT = """
📖 راهنمای بات

👑 مدیریت گروه:

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

🧠 یادگیری:

یاد بگیر سلام = سلام رفیق
→ بات این پاسخ را ذخیره می‌کند.

فراموش کن سلام
→ پاسخ ذخیره‌شده حذف می‌شود.

یادگیری‌ها
→ موارد یادگرفته‌شده را نمایش می‌دهد.
"""


# =========================
# 👑 دستورات مدیریتی
# =========================

MANAGEMENT_COMMANDS = {
    "بن": "ban",
    "آن‌بن": "unban",
    "انبن": "unban",
    "سکوت": "mute",
    "رفع سکوت": "unmute",
    "رفع‌سکوت": "unmute",
    "اخراج": "kick"
}


# =========================
# پردازش پیام
# =========================

def handle_message(
    user_id,
    text,
    is_admin=False,
    is_owner=False,
    reply_user_id=None
):
    text = str(text).strip()

    if not text:
        return None

    # 🧠 یاد بگیر
    if text.startswith("یاد بگیر "):
        return {
            "action": "reply",
            "text": learn(text)
        }

    # 🗑️ فراموش کن
    if text.startswith("فراموش کن "):
        return {
            "action": "reply",
            "text": forget(text)
        }

    # 📋 لیست یادگیری‌ها
    if text == "یادگیری‌ها":
        return {
            "action": "reply",
            "text": learned_list()
        }

    # 🛡️ ضد اسپم
    if check_spam(user_id, text):
        return {
            "action": "mute",
            "user_id": user_id,
            "duration": AUTO_MUTE_TIME,
            "text": "⚠️ به دلیل ارسال پشت‌سرهم دستور «بن»، ۲ دقیقه سکوت شدی."
        }

    # 📖 راهنما
    if text in ("راهنما", "/help"):
        return {
            "action": "reply",
            "text": HELP_TEXT
        }

    # 👑 دستورات مدیریت
    if text in MANAGEMENT_COMMANDS:

        if not (is_admin or is_owner):
            return {
                "action": "reply",
                "text": "⛔ فقط مدیر یا مالک گروه می‌تواند از این دستور استفاده کند."
            }

        if reply_user_id is None:

            if text == "بن":
                message = (
                    "📌 برای بن کردن یک نفر، "
                    "روی پیام او ریپلای کن و «بن» بفرست."
                )
            else:
                message = (
                    "📌 برای استفاده از این دستور، "
                    "روی پیام شخص موردنظر ریپلای کن."
                )

            return {
                "action": "reply",
                "text": message
            }

        action = MANAGEMENT_COMMANDS[text]

        return {
            "action": action,
            "target_user_id": reply_user_id
        }

    # 🧠 پاسخ یادگرفته‌شده
    if text in learned:
        return {
            "action": "reply",
            "text": learned[text]
        }

    return None


# =========================
# تست داخلی
# =========================

if __name__ == "__main__":

    print("================================")
    print("🤖 Bot management module started")
    print("================================")

    print("\n🧠 تست یادگیری:")

    print(
        handle_message(
            "test_user",
            "یاد بگیر سلام = سلام رفیق 👋"
        )
    )

    print(
        handle_message(
            "test_user",
            "سلام"
        )
    )

    print(
        handle_message(
            "test_user",
            "فراموش کن سلام"
        )
    )

    print(
        handle_message(
            "test_user",
            "سلام"
        )
    )

    print("\n📖 برای تست راهنما:")

    print(
        handle_message(
            "test_user",
            "راهنما"
        )
    )

    print("\n✅ تست اولیه تمام شد.")
