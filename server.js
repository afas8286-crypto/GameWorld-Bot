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
