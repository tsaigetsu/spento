require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const multer   = require('multer');
const { Readable } = require('stream');
const cloudinary   = require('cloudinary').v2;
const { createWorker } = require('tesseract.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// --- Cloudinary ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- multer: in-memory buffer ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB
});

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// --- User schema ---
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    profile: {
      firstName: String,
      lastName: String,
      username: String,
      showUsernameInsteadOfName: { type: Boolean, default: false },
      avatarUrl: { type: String, default: null },
    },
    settings: {
      language: { type: String, default: 'ru' },
      currency: { type: String, default: 'PLN' },
      country:  { type: String, default: 'PL' },
    },
    finance: {
      monthlyBudget: { type: Number, default: 0 },
    },
    personal: {
      birthDate: { type: String, default: '' },
    },
    quizDone: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

// --- Receipt schema ---
const receiptItemSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  category: { type: String, default: 'Needs' },
}, { _id: false });

const receiptSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true, index: true },
    imageUrl: { type: String, required: true },
    items:    [receiptItemSchema],
    total:    { type: Number, default: 0 },
    rawText:  { type: String, default: '' },
  },
  { timestamps: true }
);
const Receipt = mongoose.model('Receipt', receiptSchema);

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await User.findOne({ email: email.toLowerCase(), password });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json(toApiUser(user));
});

app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(toApiUser(user));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/users/by-email/:email', async (req, res) => {
  const user = await User.findOne({ email: req.params.email.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(toApiUser(user));
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(toApiUser(user));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/receipts/:userId — history ─────────────────────────────────────

app.get('/api/receipts/:userId', async (req, res) => {
  try {
    const receipts = await Receipt
      .find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-rawText');
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/ocr — upload image → Cloudinary → Tesseract → save receipt ────

app.post('/api/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image file required (field: image)' });

  const userId = req.body?.userId || 'anonymous';
  let worker;

  try {
    // 1. Upload buffer to Cloudinary — no transforms, store as-is
    const imageUrl = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'spento/receipts', resource_type: 'image' },
        (err, result) => {
          if (err) return reject(err);
          if (!result?.secure_url) return reject(new Error('Cloudinary: no secure_url in response'));
          console.log('[Cloudinary] upload OK →', result.secure_url);
          console.log('[Cloudinary] format:', result.format, '| bytes:', result.bytes);
          resolve(result.secure_url);
        }
      );
      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    // 2. Download image from Cloudinary into a buffer
    console.log('[fetch] downloading image from Cloudinary…');
    const imgResp = await fetch(imageUrl);
    const contentType = imgResp.headers.get('content-type') ?? 'unknown';
    console.log(`[fetch] ${imgResp.status} — content-type: ${contentType}`);
    if (!imgResp.ok) {
      throw new Error(`Failed to download image: ${imgResp.status} (${contentType})`);
    }
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    console.log('[fetch] buffer size:', imgBuffer.length, 'bytes');

    // 3. Run Tesseract OCR on the buffer (no network calls inside Tesseract)
    console.log('[Tesseract] starting recognition…');
    worker = await createWorker(['pol', 'eng'], 1, {
      cachePath: '/tmp/tessdata',
      logger: () => {},
    });
    const { data: { text } } = await worker.recognize(imgBuffer);
    console.log('[Tesseract] done, text length:', text.length);

    // 3. Parse receipt text into items
    const items = parseReceiptText(text);
    const total = parseFloat(
      items.reduce((s, it) => s + it.price * it.quantity, 0).toFixed(2)
    );

    // 4. Persist receipt in MongoDB
    const receipt = new Receipt({ userId, imageUrl, items, total, rawText: text });
    await receipt.save();

    res.json({
      receiptId: receipt._id.toString(),
      imageUrl,
      items,
      total,
    });
  } catch (err) {
    console.error('OCR pipeline error:', err);
    res.status(500).json({ error: String(err) });
  } finally {
    if (worker) await worker.terminate();
  }
});

// ─── Receipt text parser ──────────────────────────────────────────────────────

function parseReceiptText(raw) {
  const lines = raw
    .split('\n')
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(l => l.length > 2 && l.length < 100);

  const SKIP_RE = /^(suma|razem|total|итого|сумма|gotówka|reszta|kasa|kasjer|data:|godzina|zmiana|nip:|paragon|fiskal|wydruk|pokwit|cashier|change|subtotal|rabat|discount|www\.|tel\.|ul\.|al\.)/i;
  const VAT_RE  = /^(ptu\s+[a-d]|vat\s+\d|нал|ндс)/i;
  const PRICE_TAIL  = /(\d{1,4}[,.]?\d{2})\s*[A-D]?\s*$/;
  const LEADING_QTY = /^(\d+(?:[,.]\d+)?)\s*[xх×*]\s*/i;

  const items = [];

  for (const line of lines) {
    if (SKIP_RE.test(line) || VAT_RE.test(line)) continue;

    const priceM = PRICE_TAIL.exec(line);
    if (!priceM) continue;

    const price = parseFloat(priceM[1].replace(',', '.'));
    if (price <= 0 || price > 1500) continue;

    let namePart = line.slice(0, priceM.index).trim();
    if (!namePart || namePart.length < 2) continue;

    const qtyM = LEADING_QTY.exec(namePart);
    let qty = 1;
    if (qtyM) {
      qty = Math.round(parseFloat(qtyM[1].replace(',', '.'))) || 1;
      namePart = namePart.slice(qtyM[0].length).trim();
    }

    namePart = namePart
      .replace(/\s+\d+[,.]\d{3}\s*(kg|g|l|ml|szt|шт|pcs)$/i, '')
      .replace(/\s+[A-D]$/, '')
      .trim();

    if (!namePart || namePart.length < 2) continue;
    if (/^\d+([,.]?\d+)?$/.test(namePart)) continue;
    if (/^\*+$/.test(namePart)) continue;

    const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const unitPrice = qty > 1 ? parseFloat((price / qty).toFixed(2)) : price;

    items.push({ name, price: unitPrice, quantity: qty, category: guessCategory(namePart) });
  }

  return items;
}

function guessCategory(name) {
  const l = name.toLowerCase();
  if (/сигарет|papier|tytoń|cigarett|alkohol|piwo|wino|beer|wine|vodka|wódka|browary|whisky|rum|энергет/i.test(l))
    return 'Harmful';
  if (/czekolad|chocolat|candy|torte|tort|cukier|kakao|шоколад|конфет|сладк|sweet|cookie|biscuit|wafel|ciastk|lody|мороженое/i.test(l))
    return 'Sweets';
  if (/mleko|chleb|jaja|wołow|wieprzow|kurczak|łosoś|ryb|warzywa|owoce|молоко|хлеб|яйц|мяс|рыб|овощ|фрукт|jogurt|kefir|ser\s|twaróg|ryż|kasza|makaron|масло|сыр|творог|śmiet/i.test(l))
    return 'Useful';
  return 'Needs';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toApiUser(doc) {
  return {
    mongoId:   doc._id.toString(),
    email:     doc.email,
    firstName: doc.profile?.firstName ?? '',
    lastName:  doc.profile?.lastName  ?? '',
    nick:      doc.profile?.username  ?? '',
    showNick:  doc.profile?.showUsernameInsteadOfName ?? false,
    photoUri:  doc.profile?.avatarUrl ?? null,
    budget:    doc.finance?.monthlyBudget ?? 0,
    birthDate: doc.personal?.birthDate   ?? '',
    country:   doc.settings?.country     ?? '',
    currency:  doc.settings?.currency    ?? 'PLN',
    language:  doc.settings?.language    ?? 'ru',
    quizDone:  doc.quizDone ?? false,
  };
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Spento API running on http://localhost:${PORT}`));
