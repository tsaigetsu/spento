require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// --- User schema (mirrors app's AuthUser + DB structure) ---
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
      country: { type: String, default: 'PL' },
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

// --- POST /api/auth/login ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = await User.findOne({ email: email.toLowerCase(), password });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  res.json(toApiUser(user));
});

// --- POST /api/users  (register) ---
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

// --- GET /api/users/by-email/:email ---
app.get('/api/users/by-email/:email', async (req, res) => {
  const user = await User.findOne({ email: req.params.email.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(toApiUser(user));
});

// --- PUT /api/users/:id ---
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(toApiUser(user));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Helper: flatten doc to app format ---
function toApiUser(doc) {
  return {
    mongoId: doc._id.toString(),
    email: doc.email,
    firstName: doc.profile?.firstName ?? '',
    lastName: doc.profile?.lastName ?? '',
    nick: doc.profile?.username ?? '',
    showNick: doc.profile?.showUsernameInsteadOfName ?? false,
    photoUri: doc.profile?.avatarUrl ?? null,
    budget: doc.finance?.monthlyBudget ?? 0,
    birthDate: doc.personal?.birthDate ?? '',
    country: doc.settings?.country ?? '',
    currency: doc.settings?.currency ?? 'PLN',
    language: doc.settings?.language ?? 'ru',
    quizDone: doc.quizDone ?? false,
  };
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Spento API running on http://localhost:${PORT}`));
