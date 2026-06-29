const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const http = require('http');

let latestQR = ''; // متغير لحفظ كود الـ QR الجديد فور صدوره

// سيرفر الويب الذكي - سيقوم بعرض الكود كصورة مربعة نظيفة عند فتح الرابط
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
                    <p>قم بتصوير الشاشة وأرسلها لهاتف آخر، أو امسحها مباشرة إن كان لديك جهاز ثانٍ.</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQR)}" alt="WhatsApp QR">
                    <p style="margin-top:15px; font-weight:bold; color:#25D366;">يتجدد الكود تلقائياً.. قم بتحديث الصفحة إذا انتهت صلاحيته</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('جاري تشغيل البوت وتجهيز كود الـ QR... يرجى تحديث الصفحة بعد 10 ثوانٍ.');
    }
});

server.listen(port, () => {
    console.log(`سيرفر العرض الذكي يعمل على منفذ: ${port}`);
});

// إعداد الذكاء الاصطناعي
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: "أنت مساعد ذكي للرد على العملاء عبر الواتساب. أجب دائماً باللغة العربية بأسلوب ودود ومختصر يناسب محادثات الشات. إذا استمعت لمقطع صوتی، افهمه جيداً وأجب عليه كتابةً."
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        handleSIGINT: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

// حفظ نص الكود في المتغير عند توليده
client.on('qr', (qr) => {
    latestQR = qr; 
    console.log('🤖 تم توليد كود QR جديد وتم إرساله لصفحة الويب الخاصة بك!');
    qrcode.generate(qr, { small: true });
