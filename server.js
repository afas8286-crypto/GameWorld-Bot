const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.BALE_BOT_TOKEN || "";
const API = (process.env.BALE_API_BASE || "").replace(/\/+$/,"");
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/+$/,"");
const DB_FILE = path.join(__dirname,"data","arcana-data.json");

const DEFAULT = {
  version:1, groups:{}, users:{}, memory:{}, originals:{}, logs:[], truthDare:[]
};

function loadDB(){
  try{
    if(!fs.existsSync(DB_FILE)) return structuredClone(DEFAULT);
    return {...structuredClone(DEFAULT),...JSON.parse(fs.readFileSync(DB_FILE,"utf8"))};
  }catch(e){
    console.error("[DB_LOAD]",e.message);
    return structuredClone(DEFAULT);
  }
}
let db=loadDB();

function saveDB(){
  const tmp=DB_FILE+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(db,null,2),"utf8");
  fs.renameSync(tmp,DB_FILE);
}
function log(event,data={}){
  db.logs.push({time:new Date().toISOString(),event,data});
  if(db.logs.length>1000) db.logs=db.logs.slice(-1000);
  console.log("[ARCANA]",event,data);
  try{saveDB()}catch(e){console.error("[DB_SAVE]",e.message)}
}
function getGroup(chatId){
  if(!db.groups[chatId]){
    db.groups[chatId]={
      chatId,createdAt:new Date().toISOString(),
      settings:{
        security:true,antiSpam:true,antiLink:false,antiAd:false,
        mute:false,welcome:true,rules:true,truthDare:true,gif:true,
        weeklyReport:true,personality:true,daily:true,events:true,logs:true
      },
      personality:"😎 خونسرد",dailyCode:"",dailyIndex:0,
      permissions:{checked:false,missing:[]},missions:[],weekly:{}
    };
  }
  return db.groups[chatId];
}
function getUser(chatId,userId,name){
  const key=`${chatId}:${userId}`;
  if(!db.users[key]){
    db.users[key]={
      chatId,userId,name:name||"کاربر",xp:0,level:1,messages:0,
      streak:0,lastDaily:null,title:"عضو ARCANA",badges:[],
      inventory:[],boxes:0,joinedAt:new Date().toISOString()
    };
  }
  if(name) db.users[key].name=name;
  return db.users[key];
}
function addXP(user,amount){
  let n=Math.max(0,Math.min(100,Number(amount)||0));
  user.xp+=n;
  while(user.xp>=user.level*500){
    user.xp-=user.level*500;
    user.level++;
  }
}
function keyboard(rows){return {keyboard:rows,resize_keyboard:true};}

async function bale(method,payload={}){
  if(!TOKEN || !API)
    return {ok:false,skipped:true,error:"BALE_API_BASE or BALE_BOT_TOKEN is not configured"};
  try{
    const response=await fetch(`${API}/bot${TOKEN}/${method}`,{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(payload)
    });
    const text=await response.text();
    try{return JSON.parse(text)}catch{return {ok:response.ok,raw:text}};
  }catch(e){
    log("BALE_API_ERROR",{method,error:e.message});
    return {ok:false,error:e.message};
  }
}
async function sendMessage(chatId,text,markup){
  const payload={chat_id:chatId,text:String(text)};
  if(markup) payload.reply_markup=markup;
  return bale("sendMessage",payload);
}

const TD=[
"جرئت: یک شعار کوتاه و خلاقانه برای گروه بساز.",
"حقیقت: این هفته چه چیزی واقعاً خوشحالت کرد؟",
"جرئت: یک جمله کاملاً رسمی درباره یک موضوع معمولی بنویس.",
"حقیقت: اگر یک مهارت را سریع یاد می‌گرفتی، چه بود؟",
"جرئت: یک اسم برای یک فیلم خیالی بساز.",
"حقیقت: کدام سرگرمی را بیشتر از بقیه دوست داری؟",
"جرئت: یک پیام فقط با سه ایموجی بفرست.",
"حقیقت: بهترین اتفاق این ماه برایت چه بوده؟",
"جرئت: برای گروه یک شعار حماسی یک‌خطی بساز.",
"حقیقت: دوست داری امسال چه چیزی را تجربه کنی؟"
];
function todayCode(){
  const d=new Date();
  const s=`${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
  let n=0; for(const c of s)n=(n*31+c.charCodeAt(0))%10000;
  return `JT-${String(n).padStart(4,"0")}`;
}
function help(){
  return [
    "📚 راهنمای ARCANA","","🚀 شروع — منوی اصلی",
    "👤 پروفایل — سطح و فعالیت","🎭 جرئت حقیقت — سؤال روز",
    "🎁 روزانه — پاداش روزانه","🪪 اصل من — اصل ثبت‌شده",
    "🧠 حافظه — حافظه‌های مجاز","⚙️ تنظیمات — مخصوص مدیران",
    "🛡️ امنیت و نقش‌های واقعی از عنوان‌های نمایشی جدا هستند."
  ].join("\n");
}
function start(name){
  return [
    "╭━━━━━━━━━━━━━━━━━━╮",
    "      🤖 ARCANA",
    "   AI GROUP BOT",
    "╰━━━━━━━━━━━━━━━━━━╯","",
    `سلام ${name||"دوست من"} 👋`,
    "خوش اومدی ✨","",
    "🛡️ مدیریت • 🧠 هوش • 🎭 سرگرمی",
    "🎬 GIF • 🎁 سیستم روزانه • 🏆 رتبه‌بندی"
  ].join("\n");
}
function profile(u){
  const need=u.level*500;
  const barLen=10, filled=Math.round((u.xp/need)*barLen);
  return [
    "👤 پروفایل ARCANA","",
    `نام: ${u.name}`,`⭐ LEVEL ${u.level}`,
    `XP: ${u.xp} / ${need}`,
    `▰`.repeat(filled)+`▱`.repeat(barLen-filled),
    `🔥 Streak: ${u.streak}`,`💬 پیام‌ها: ${u.messages}`,
    `🏷️ ${u.title}`,`🎖️ نشان‌ها: ${u.badges.length}`,
    `🎁 جعبه‌ها: ${u.boxes}`
  ].join("\n");
}

async function route(req,res,body){
  const url=new URL(req.url,"http://localhost");
  const json=(status,obj)=>{res.writeHead(status,{"content-type":"application/json; charset=utf-8"});res.end(JSON.stringify(obj));};
  if(req.method==="GET" && url.pathname==="/") return json(200,{ok:true,name:"ARCANA",version:"1.0.0"});
  if(req.method==="GET" && url.pathname==="/health") return json(200,{ok:true,service:"ARCANA",time:new Date().toISOString(),configured:Boolean(API&&TOKEN),publicUrl:Boolean(PUBLIC_URL)});
  if(req.method==="POST" && url.pathname==="/webhook"){
    res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true}));
    req.arcanaBody=body;
  try{
    const update=body||{};
    const message=update.message||update.edited_message||update;
    const chat=message.chat||{};
    const from=message.from||message.sender||{};
    const chatId=chat.id, userId=from.id;
    if(chatId==null || userId==null) return;
    const text=String(message.text||"").trim();
    const name=from.first_name||from.name||"کاربر";
    const g=getGroup(chatId), u=getUser(chatId,userId,name);

    if(text){
      u.messages++;
      if(!/^\/|^جرئت حقیقت$|^پروفایل$|^روزانه$|^اصل من$|^راهنما$|^تنظیمات$/.test(text))
        addXP(u,1);
    }

    if(text==="/start" || text==="🚀 شروع"){
      await sendMessage(chatId,start(name),keyboard([["🚀 شروع","📚 راهنما"],["👤 پروفایل","🎭 جرئت حقیقت"],["🎁 روزانه","🪪 اصل من"]]));
      return;
    }
    if(text==="📚 راهنما" || text==="/help" || text==="راهنما"){
      await sendMessage(chatId,help());
      return;
    }
    if(text==="👤 پروفایل" || text==="پروفایل"){
      await sendMessage(chatId,profile(u));
      return;
    }
    if(text==="🎭 جرئت حقیقت" || text==="جرئت حقیقت"){
      if(!g.settings.truthDare){await sendMessage(chatId,"🎭 این بخش برای این گروه غیرفعال است.");return;}
      const code=todayCode(); g.dailyCode=code;
      const q=TD[g.dailyIndex%TD.length]; g.dailyIndex++;
      await sendMessage(chatId,`🎭 ${q}`);
      return;
    }
    if(text==="🎁 روزانه" || text==="روزانه"){
      const day=new Date().toISOString().slice(0,10);
      if(u.lastDaily===day){await sendMessage(chatId,"🎁 پاداش امروزت رو قبلاً گرفتی.");return;}
      u.lastDaily=day;u.streak++;addXP(u,25);
      await sendMessage(chatId,`🎁 پاداش روزانه دریافت شد!\n+25 XP\n🔥 Streak: ${u.streak}`);
      return;
    }
    if(text==="🪪 اصل من" || text==="اصل من"){
      const value=db.originals[`${chatId}:${userId}`];
      await sendMessage(chatId,value?`🪪 اصل تو:\n${value}`:"🪪 هنوز اصلی برای تو ثبت نشده است.");
      return;
    }
    if(text==="⚙️ تنظیمات" || text==="تنظیمات"){
      await sendMessage(chatId,
`⚙️ تنظیمات گروه

🛡️ امنیت
محافظت در برابر اسپم و مزاحمت

🔗 ضدلینک
کنترل لینک‌های اعضا

📢 ضدتبلیغ
شناسایی پیام‌های تبلیغاتی

🔇 میوت
مدیریت محدودیت ارسال

👋 خوش‌آمدگویی
پیام خودکار اعضای جدید

📜 قوانین
نمایش قوانین گروه

🎭 جرئت حقیقت
فعال/غیرفعال کردن بازی

🎬 GIF
مدیریت ماژول رسانه

📊 گزارش هفتگی
گزارش آماری فعالیت

😂 شخصیت ARCANA
تغییر حالت گفتاری

🎁 سیستم روزانه
Daily و Streak

⚡ رویدادها
رویدادهای گروه

📋 لاگ‌ها
ثبت اقدامات مهم`);
      return;
    }

    if(text.startsWith("یاد بگیر ")){
      const raw=text.slice(8).trim();
      if(!raw.includes("=")){await sendMessage(chatId,"🧠 قالب درست:\nیاد بگیر X = Y");return;}
      const [key,...rest]=raw.split("=");
      const value=rest.join("=").trim();
      if(!key.trim()||!value){await sendMessage(chatId,"🧠 اطلاعات ناقصه.");return;}
      if(/token|password|رمز|پسورد|secret/i.test(raw)){await sendMessage(chatId,"🔐 اطلاعات محرمانه ذخیره نمی‌کنم.");return;}
      db.memory[`${chatId}:${userId}`]??={};
      db.memory[`${chatId}:${userId}`][key.trim()]=value;
      log("MEMORY_SET",{chatId,userId,key:key.trim()});
      await sendMessage(chatId,"🧠 یاد گرفتم.");
      return;
    }
    if(text==="حافظه من"){
      const m=db.memory[`${chatId}:${userId}`]||{};
      const lines=Object.entries(m).map(([k,v])=>`• ${k} = ${v}`);
      await sendMessage(chatId,lines.length?`🧠 حافظه تو:\n${lines.join("\n")}`:"🧠 حافظه‌ای ثبت نشده.");
      return;
    }
    if(text.startsWith("فراموش کن ")){
      const key=text.slice(10).trim(), k=`${chatId}:${userId}`;
      if(db.memory[k]) delete db.memory[k][key];
      saveDB();await sendMessage(chatId,"🧠 انجام شد.");
      return;
    }
    log("MESSAGE",{chatId,userId,text:text.slice(0,200)});
    saveDB();
  }catch(e){
    log("WEBHOOK_ERROR",{error:e.message,stack:e.stack});
  }
    return;
  }
  if(req.method==="POST" && url.pathname==="/setup-webhook"){
    if(!PUBLIC_URL) return json(400,{ok:false,error:"PUBLIC_URL is required"});
    return json(200,await bale("setWebhook",{url:`${PUBLIC_URL}/webhook`}));
  }
  return json(404,{ok:false,error:"Not found"});
}
const server=http.createServer((req,res)=>{
  let body="";
  req.on("data",chunk=>{body+=chunk;if(body.length>2*1024*1024)req.destroy();});
  req.on("end",async()=>{let parsed={};if(body){try{parsed=JSON.parse(body)}catch{return route(req,res,{})}};await route(req,res,parsed)});
});
server.listen(PORT,()=>console.log(`ARCANA listening on ${PORT}`));
