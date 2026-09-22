const express=require("express");
const fs=require("fs"),path=require("path");
const app=express(); app.use(express.json({limit:"1mb"}));
const PORT=Number(process.env.PORT||3000),TOKEN=process.env.BALE_BOT_TOKEN||"";
const PUBLIC_URL=(process.env.PUBLIC_URL||"").replace(/\/+$/,"");
const SECRET=process.env.BALE_WEBHOOK_SECRET||"";
const API_BASE=(process.env.BALE_API_BASE||"").replace(/\/+$/,"");
const DATA_DIR=path.join(__dirname,"data"),DATA_FILE=path.join(DATA_DIR,"arcana-data.json");
if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});
const blank={groups:{},users:{},memory:{},originals:{},logs:[]};
let db=load(); function load(){try{return {...blank,...JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))}}catch{return structuredClone(blank)}}
function save(){fs.writeFileSync(DATA_FILE,JSON.stringify(db,null,2),"utf8")}
function log(type,detail){db.logs.push({at:new Date().toISOString(),type,detail});if(db.logs.length>2000)db.logs.splice(0,db.logs.length-2000);save()}
async function bale(method,payload={}){if(!TOKEN||!API_BASE)throw Error("BALE_BOT_TOKEN/BALE_API_BASE missing");const r=await fetch(`${API_BASE}/bot${TOKEN}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});if(!r.ok)throw Error(`${method}: HTTP ${r.status}`);return r.json()}
async function send(chatId,text,extra={}){return bale("sendMessage",{chat_id:chatId,text,...extra})}
function grp(id){return db.groups[id]??=( {settings:{antiSpam:true,antiLink:true,antiAd:true,welcome:true,truth:true,gif:true,daily:true,weeklyReport:true},truthIndex:0})}
function usr(id,name){const k=String(id);return db.users[k]??=( {id:k,name:name||"کاربر",xp:0,level:1,streak:0,badges:[],titles:[],boxes:0,messages:0,lastXP:0,history:[]})}
function level(x){return Math.max(1,Math.floor(Math.sqrt(x/100))+1)}
function xp(u,n){u.xp+=n;u.level=level(u.xp)}
function bar(u){const pct=Math.min(100,Math.round((u.xp%1000)/10));return "█".repeat(Math.round(pct/10))+"░".repeat(10-Math.round(pct/10))}
const truth=[
"اگر یک مهارت را همین امروز یاد بگیری، چه انتخاب می‌کنی؟",
"خنده‌دارترین اشتباهی که کردی چه بود؟",
"اگر گروه یک فیلم بود، اسمش چه می‌شد؟",
"جرئت: یک پیام کوتاه با سه ایموجی کاملاً تصادفی بفرست.",
"جرئت: یک جمله خیلی رسمی درباره یک موضوع کاملاً معمولی بنویس.",
"چه چیزی معمولاً سریع حالت را بهتر می‌کند؟",
"اگر برای ARCANA یک لقب انتخاب کنی، چه می‌گذاری؟",
"جرئت: یک جمله خبری درباره آخرین پیام خودت بساز.",
"کدام بازی یا سرگرمی را بیشتر از انتظار دوست داشتی؟",
"جرئت: یک جمله بساز که بیشتر کلماتش با یک حرف شروع شوند."
];
async function start(chatId,from){const name=from?.first_name||"دوست";usr(from?.id||chatId,name);return send(chatId,`╭━━━━━━━━━━━━━━━━━━╮
        🤖 𝐀𝐑𝐂𝐀𝐍𝐀
   𝐀𝐈 𝐆𝐑𝐎𝐔𝐏 𝐁𝐎𝐓
╰━━━━━━━━━━━━━━━━━━╯

سلام ${name} 👋
خوش اومدی ✨

🛡️ مدیریت • 🧠 هوش • 🎭 سرگرمی
🎬 GIF • 🎁 سیستم روزانه • 🏆 رتبه‌بندی

همه‌چی آماده‌ست 😎🔥`,{reply_markup:{inline_keyboard:[[{text:"🚀 شروع",callback_data:"arcana_start"},{text:"📚 راهنما",callback_data:"arcana_help"}]]}})}
async function help(chatId){return send(chatId,`📚 راهنمای ARCANA

🛡️ مدیریت: بن، آنبن، میوت، هشدار، ضداسپم، ضدلینک، ضدتبلیغ و لاگ.
👑 نقش‌ها: فقط با بررسی مجوز واقعی مدیر/مالک.
🎭 سرگرمی: جرئت حقیقت، مأموریت، رویداد و Mystery Box.
🎬 رسانه: GIF، متن، افکت و قالب؛ با موتور رندر فعال.
⭐ پیشرفت: XP، Level، Streak، رتبه، عنوان، Badge و Inventory.
🧠 حافظه: «یاد بگیر X = Y» برای اطلاعات غیرحساس.
🪪 اصل: روی پیام شخص پاسخ بده و «ثبت اصل» را بفرست.
⚙️ تنظیمات: قابلیت‌ها برای هر گروه جداگانه.`)}
async function processText(chat,from,text){const id=chat.id,t=String(text||"").trim(),u=usr(from?.id||id,from?.first_name);if(t==="/start"||t==="شروع")return start(id,from);if(t==="/help"||t==="راهنما")return help(id);
if(chat.type&&chat.type!=="private"){const g=grp(String(id));u.messages++;if(Date.now()-u.lastXP>60000){xp(u,2);u.lastXP=Date.now()}
if(t==="جرئت حقیقت"&&g.settings.truth){const q=truth[g.truthIndex++%truth.length];save();return send(id,`🎭 ${q}`)}
if(t==="پروفایل"||t==="پروفایل من"){save();return send(id,`👤 ${u.name}
⭐ LEVEL ${u.level}
${bar(u)} ${u.xp} XP
🔥 Streak: ${u.streak}
🎖️ Badges: ${u.badges.length}
🏷️ Titles: ${u.titles.length}
🎁 Boxes: ${u.boxes}
💬 Messages: ${u.messages}`)}
if(t==="اصل من"||t==="اصل خودم"){const o=db.originals[String(u.id)];return send(id,o?`🪪 اصل ${u.name}\n${o.text}`:"🪪 هنوز اصلی ثبت نشده.")}
if(t.startsWith("یاد بگیر ")){const b=t.slice(9),i=b.indexOf("=");if(i<1)return send(id,"🧠 فرمت: یاد بگیر X = Y");const k=b.slice(0,i).trim(),v=b.slice(i+1).trim();if(/رمز|پسورد|توکن|کلید|شماره کارت|اطلاعات بانکی/i.test(k+" "+v))return send(id,"🛡️ اطلاعات حساس ذخیره نمی‌شود.");db.memory[String(u.id)]??={};db.memory[String(u.id)][k]=v;log("memory_set",`${u.id}:${k}`);return send(id,`🧠 یاد گرفتم: ${k}`)}
if(t.startsWith("فراموش کن ")){const k=t.slice(10).trim(),m=db.memory[String(u.id)]||{};if(m[k]){delete m[k];save();return send(id,`🧠 فراموش شد: ${k}`)}return send(id,"🧠 چنین موردی نبود.")}
if(t==="حافظه من"){const m=db.memory[String(u.id)]||{};const a=Object.keys(m);return send(id,a.length?"🧠 حافظه من:\n"+a.map(k=>`• ${k} = ${m[k]}`).join("\n"):"🧠 حافظه‌ای ثبت نشده.")}
if(t==="ثبت اصل")return send(id,"🪪 این قابلیت بعد از اتصال و تأیید API مدیریتی رسمی فعال می‌شود.");
if(t==="تنظیمات")return send(id,`⚙️ تنظیمات گروه
🛡️ امنیت
🔗 ضدلینک
📢 ضدتبلیغ
🔇 میوت
👋 خوش‌آمدگویی
📜 قوانین
🎭 جرئت حقیقت
🎬 GIF
📊 گزارش هفتگی
😂 شخصیت بات
🎁 سیستم روزانه
⚡ رویدادها
📋 لاگ‌ها`);
if(t.includes("گیف"))return send(id,g.settings.gif?"🎬 درخواست GIF ثبت شد؛ موتور رندر رسانه باید روی سرور فعال باشد.":"🎬 ساخت GIF خاموش است.");
save()}}
app.get("/",(_,r)=>r.json({bot:"ARCANA",status:"online"}));
app.get("/health",(_,r)=>r.json({ok:true,bot:"ARCANA"}));
app.post("/webhook",async(req,res)=>{if(SECRET&&req.get("x-bale-bot-api-secret-token")!==SECRET)return res.sendStatus(401);res.sendStatus(200);try{const m=req.body?.message||req.body?.edited_message;if(m?.chat)await processText(m.chat,m.from||{},m.text||"")}catch(e){log("update_error",e.message)}});
app.post("/setup-webhook",async(_,res)=>{try{if(!PUBLIC_URL)return res.status(400).json({ok:false,error:"PUBLIC_URL missing"});res.json(await bale("setWebhook",{url:`${PUBLIC_URL}/webhook`,secret_token:SECRET||undefined}))}catch(e){res.status(500).json({ok:false,error:e.message})}});
process.on("uncaughtException",e=>log("uncaught_exception",e.message));process.on("unhandledRejection",e=>log("unhandled_rejection",String(e)));
app.listen(PORT,async()=>{console.log(`ARCANA :${PORT}`);if(TOKEN&&API_BASE&&PUBLIC_URL)try{await bale("setWebhook",{url:`${PUBLIC_URL}/webhook`,secret_token:SECRET||undefined});console.log("Webhook registered")}catch(e){console.error("Webhook registration failed:",e.message)}});