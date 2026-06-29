const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. إعداد الذكاء الاصطناعي (Gemini API)
const GEMINI_API_KEY = "ضع_مفتاح_API_الخاص_بـ_جوجل_هنا"; // استبدل هذا النص بمفتاحك الحقيقي
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "أنت مساعد ذكي للرد على العملاء عبر الواتساب. أجب دائماً باللغة العربية بأسلوب ودود ومختصر يناسب محادثات الشات. إذا استمعت لمقطع صوتي، افهمه جيداً وأجب عليه كتابةً."
});

// 2. إعداد البوت
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// توليد كود QR
client.on('qr', (qr) => {
    console.log('🤖 يرجى مسح كود الـ QR التالي باستخدام تطبيق واتساب:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ البوت جاهز الآن ومتصل بالواتساب ومستعد لاستقبال الرسائل والمكالمات!');
});

// معالجة المكالمات الواردة
client.on('call', async (call) => {
    if (call.isGroup) return;
    console.log(`📞 مكالمة واردة من: ${call.from} - جاري الرفض والرد التلقائي...`);
    try {
        await call.reject();
        const replyMessage = "🤖 *رد تلقائي:* أهلاً بك! عذراً، لا يمكنني استقبال المكالمات حالياً.\n\nيرجى إرسال استفسارك هنا في *رسالة نصية* أو *تسجيل صوتي* وسأجيبك فوراً! 🌹";
        await client.sendMessage(call.from, replyMessage);
    } catch (err) {
        console.error("خطأ أثناء معالجة المكالمة:", err);
    }
});

// معالجة الرسائل والصوت الوارد
client.on('message', async (msg) => {
    if (msg.from.endsWith('@g.us') || msg.fromMe) return;

    try {
        let chat = await msg.getChat();
        await chat.sendStateTyping();

        // إذا كانت الرسالة مقطعاً صوتياً
        if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
            console.log(`🎙️ تم استقبال مقطع صوتي من: ${msg.from}`);
            const media = await msg.downloadMedia();
            const mimeType = media.mimetype.split(';')[0];

            const result = await model.generateContent([
                { inlineData: { data: media.data, mimeType: mimeType } },
                "استمع للمقطع الصوتي السابق الخاص بالعميل، وأجب على طلبه مباشرة."
            ]);

            await msg.reply(result.response.text());
        } 
        // إذا كانت الرسالة نصية
        else if (msg.type === 'chat') {
            console.log(`💬 رسالة نصية واردة من: ${msg.from}`);
            const result = await model.generateContent(msg.body);
            await msg.reply(result.response.text());
        }
    } catch (error) {
        console.error("❌ حدث خطأ:", error);
    }
});

client.initialize();
