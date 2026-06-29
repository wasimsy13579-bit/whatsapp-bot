const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');

let latestQR = ''; 

// سيرفر الويب لعرض كود الـ QR كصورة مريحة للجوال
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (latestQR) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
            <head>
                <title>WhatsApp Bot QR Code</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { text-align: center; font-family: Arial, sans-serif; margin-top: 30px; background-color: #f4f4f9; color: #333; }
                    .container { max-width: 400px; margin: auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    img { max-width: 100%; height: auto; border: 4px solid #25D366; border-radius: 5px; margin-top: 15px; }
                    p { font-size: 14px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>🤖 مساعدك الذكي جاهز للربط</h2>
                    <p>إذا واجهت فصل في السيرفر، قم بتحديث الصفحة وامسح الكود الجديد.</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQR)}" alt="WhatsApp QR">
                    <p style="margin-top:15px; font-weight:bold; color:#25D366;">يتجدد الكود تلقائياً عند الحاجة</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('البوت يعمل الآن ومستقر بنجاح!');
    }
});

server.listen(port);

// إعداد الذكاء الاصطناعي
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "أنت مساعد ذكي للرد على العملاء عبر الواتساب. أجب دائماً باللغة العربية بأسلوب ودود ومختصر يناسب محادثات الشات. إذا استمعت لمقطع صوتی، افهمه جيداً وأجب عليه كتابةً."
});

// إعداد عميل الواتساب مع إعدادات صارمة لتقليل استهلاك الرام (تناسب الـ 512 ميجا)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        handleSIGINT: false,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // يمنع استخدام الذاكرة المشتركة لتوفير الرام
            '--disable-gpu',           // إيقاف معالج الرسوميات تماماً لتقليل الضغط
            '--no-zygote',             // تعطيل العمليات الخلفية الزائدة لكروم
            '--single-process'         // دمج المتصفح في عملية واحدة فقط (أهم سطر لحل مشكلة الـ Memory)
        ] 
    }
});

client.on('qr', (qr) => {
    latestQR = qr; 
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    latestQR = ''; // تنظيف المتغير بعد نجاح الاستقرار
    console.log('✅ البوت جاهز الآن ومتصل بالواتساب ومستعد لاستقبال الرسائل والمكالمات!');
});

client.on('call', async (call) => {
    if (call.isGroup) return;
    try {
        await call.reject();
        await client.sendMessage(call.from, "🤖 *رد تلقائي:* أهلاً بك! عذراً، لا يمكنني استقبال المكالمات الهاتفية حالياً.\n\nيرجى إرسال استفسارك هنا في *رسالة نصية* أو *تسجيل صوتي* وسأجيبك فوراً! 🌹");
    } catch (err) { console.error(err); }
});

client.on('message', async (msg) => {
    if (msg.from.endsWith('@g.us') || msg.fromMe) return;
    try {
        let chat = await msg.getChat();
        await chat.sendStateTyping();

        if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
            const media = await msg.downloadMedia();
            const mimeType = media.mimetype.split(';')[0];
            const result = await model.generateContent([
                { inlineData: { data: media.data, mimeType: mimeType } },
                "استمع للمقطع الصوتي السابق الخاص بالعميل، وأجب على طلبه مباشرة."
            ]);
            await msg.reply(result.response.text());
        } else if (msg.type === 'chat') {
            const result = await model.generateContent(msg.body);
            await msg.reply(result.response.text());
        }
    } catch (error) { console.error(error); }
});

client.initialize();
