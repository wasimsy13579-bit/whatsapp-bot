const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http'); // مكتبة مدمجة لإنشاء سيرفر وهمي لتجاوز الـ Timeout

// إنشاء سيرفر ويب وهمي لإرضاء منصة Render ومنع فصل البوت
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WhatsApp Bot is Online!\n');
});
server.listen(port, () => {
    console.log(`سيرفر الفحص الذكي يعمل بنجاح على منفذ: ${port}`);
});

// استدعاء المفتاح السري بأمان من إعدادات السيرفر (Environment Variables)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "أنت مساعد ذكي للرد على العملاء عبر الواتساب. أجب دائماً باللغة العربية بأسلوب ودود ومختصر يناسب محادثات الشات. إذا استمعت لمقطع صوتی, افهمه جيداً وأجب عليه كتابةً."
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        handleSIGINT: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

client.on('qr', (qr) => {
    console.log('🤖 كود الـ QR جاهز للمسح:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ البوت جاهز الآن ومتصل بالواتساب ومستعد لاستقبال الرسائل والمكالمات!');
});

// إدارة المكالمات الواردة (الرفض التلقائي والرد برسالة)
client.on('call', async (call) => {
    if (call.isGroup) return;
    console.log(`📞 مكالمة واردة من: ${call.from} - جاري الرفض والرد التلقائي...`);
    try {
        await call.reject();
        const replyMessage = "🤖 *رد تلقائي:* أهلاً بك! عذراً، لا يمكنني استقبال المكالمات الهاتفية حالياً.\n\nيرجى إرسال استفسارك هنا في *رسالة نصية* أو *تسجيل صوتي* وسأجيبك فوراً! 🌹";
        await client.sendMessage(call.from, replyMessage);
    } catch (err) {
        console.error("خطأ أثناء معالجة المكالمة:", err);
    }
});

// إدارة الرسائل والصوت الوارد عبر Gemini
client.on('message', async (msg) => {
    if (msg.from.endsWith('@g.us') || msg.fromMe) return;

    try {
        let chat = await msg.getChat();
        await chat.sendStateTyping();

        // التعامل مع المقاطع الصوتية
        if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
            console.log(`🎙️ تسجيل صوتي من: ${msg.from}`);
            const media = await msg.downloadMedia();
            const mimeType = media.mimetype.split(';')[0];

            const result = await model.generateContent([
                { inlineData: { data: media.data, mimeType: mimeType } },
                "استمع للمقطع الصوتي السابق الخاص بالعميل، وأجب على طلبه مباشرة."
            ]);

            await msg.reply(result.response.text());
        } 
        // التعامل مع الرسائل النصية
        else if (msg.type === 'chat') {
            console.log(`💬 رسالة نصية من: ${msg.from}`);
            const result = await model.generateContent(msg.body);
            await msg.reply(result.response.text());
        }
    } catch (error) {
        console.error("❌ حدث خطأ:", error);
    }
});

client.initialize();
