/**
 * MongoDB Atlas Data API client for Spento.
 *
 * SETUP: Fill in APP_ID and API_KEY in lib/db-config.ts
 * Get them from: Atlas → App Services → your app → Data API + Authentication → API Keys
 *
 * The native MongoDB driver cannot run in React Native (requires Node.js APIs).
 * The Atlas Data API (REST over HTTPS) is the correct approach for mobile.
 */

import type { AuthUser } from './data';
import { DB_CONFIG, IS_DB_CONFIGURED } from './db-config';

const BASE_URL = `https://data.mongodb-api.com/app/${DB_CONFIG.APP_ID}/endpoint/data/v1`;

// --- MongoDB document shape (matches user's spec) ---

export type DBUserDocument = {
  _id?: string;
  email: string;
  password: string; // plaintext for now — hash before production
  profile: {
    firstName: string;
    lastName: string;
    username: string;
    showUsernameInsteadOfName: boolean;
    avatarUrl: string | null;
  };
  settings: {
    language: string;
    currency: string;
    country: string;
    displayNameMode: 'username' | 'name';
  };
  finance: {
    monthlyBudget: number;
  };
  personal: {
    birthDate: string;
  };
  quizDone: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Low-level fetch wrapper ---

async function mongoFetch<T>(action: string, collection: string, body: object): Promise<T> {
  if (!IS_DB_CONFIGURED) throw new Error('MongoDB not configured — fill in lib/db-config.ts');
  const res = await fetch(`${BASE_URL}/action/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': DB_CONFIG.API_KEY },
    body: JSON.stringify({
      dataSource: DB_CONFIG.DATA_SOURCE,
      database: DB_CONFIG.DATABASE,
      collection,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`MongoDB ${action} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// --- Mapping helpers ---

/** Maps an AuthUser + password → MongoDB document */
function toDocument(user: AuthUser, password: string): Omit<DBUserDocument, '_id'> {
  const now = new Date().toISOString();
  return {
    email: user.email.toLowerCase().trim(),
    password,
    profile: {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.nick,
      showUsernameInsteadOfName: user.showNick,
      avatarUrl: user.photoUri,
    },
    settings: {
      language: user.language || 'ru',
      currency: user.currency || 'PLN',
      country: user.country || 'PL',
      displayNameMode: user.showNick ? 'username' : 'name',
    },
    finance: { monthlyBudget: user.budget || 0 },
    personal: { birthDate: user.birthDate },
    quizDone: user.quizDone,
    createdAt: now,
    updatedAt: now,
  };
}

/** Maps a MongoDB document → AuthUser (for local storage) */
function fromDocument(doc: DBUserDocument): AuthUser {
  return {
    email: doc.email,
    firstName: doc.profile.firstName,
    lastName: doc.profile.lastName,
    nick: doc.profile.username,
    showNick: doc.profile.showUsernameInsteadOfName,
    photoUri: doc.profile.avatarUrl,
    language: doc.settings.language,
    currency: doc.settings.currency,
    country: doc.settings.country,
    budget: doc.finance.monthlyBudget,
    birthDate: doc.personal.birthDate,
    quizDone: doc.quizDone,
    loginTimestamp: Date.now(),
    mongoId: doc._id,
  };
}

// --- User operations ---

/**
 * Creates a new user document in the `users` collection.
 * Returns the inserted MongoDB _id string, or null on failure.
 */
export async function dbCreateUser(user: AuthUser, password: string): Promise<string | null> {
  try {
    const result = await mongoFetch<{ insertedId: string }>('insertOne', 'users', {
      document: toDocument(user, password),
    });
    return result.insertedId;
  } catch (e) {
    console.warn('[DB] createUser failed:', e);
    return null;
  }
}

/**
 * Finds a user by email + verifies password.
 * Returns a mapped AuthUser (ready for saveUser), or null.
 */
export async function dbFindUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    const result = await mongoFetch<{ document: DBUserDocument | null }>('findOne', 'users', {
      filter: { email: email.toLowerCase().trim() },
    });
    const doc = result.document;
    if (!doc || doc.password !== password) return null;
    return fromDocument(doc);
  } catch (e) {
    console.warn('[DB] findUser failed:', e);
    return null;
  }
}

/**
 * Updates user document fields (profile edits, quiz completion, etc.)
 * Pass the mongoId from AuthUser.mongoId.
 */
export async function dbUpdateUser(mongoId: string, user: Partial<AuthUser>): Promise<void> {
  try {
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (user.firstName !== undefined) set['profile.firstName'] = user.firstName;
    if (user.lastName !== undefined) set['profile.lastName'] = user.lastName;
    if (user.nick !== undefined) set['profile.username'] = user.nick;
    if (user.showNick !== undefined) {
      set['profile.showUsernameInsteadOfName'] = user.showNick;
      set['settings.displayNameMode'] = user.showNick ? 'username' : 'name';
    }
    if (user.photoUri !== undefined) set['profile.avatarUrl'] = user.photoUri;
    if (user.language !== undefined) set['settings.language'] = user.language;
    if (user.currency !== undefined) set['settings.currency'] = user.currency;
    if (user.country !== undefined) set['settings.country'] = user.country;
    if (user.budget !== undefined) set['finance.monthlyBudget'] = user.budget;
    if (user.birthDate !== undefined) set['personal.birthDate'] = user.birthDate;
    if (user.quizDone !== undefined) set['quizDone'] = user.quizDone;

    await mongoFetch('updateOne', 'users', {
      filter: { _id: { $oid: mongoId } },
      update: { $set: set },
    });
  } catch (e) {
    console.warn('[DB] updateUser failed:', e);
  }
}

// --- Receipt operations ---

export type DBReceipt = {
  _id?: string;
  userId: string;
  store: string;
  total: number;
  currency: string;
  purchaseDate: string;
  items: {
    name: string;
    price: number;
    quantity: number;
    category: string;
  }[];
  aiAnalysis: null | object;
  createdAt: string;
};

/** Creates a receipt document in the `receipts` collection. */
export async function dbCreateReceipt(receipt: Omit<DBReceipt, '_id' | 'createdAt'>): Promise<string | null> {
  try {
    const result = await mongoFetch<{ insertedId: string }>('insertOne', 'receipts', {
      document: { ...receipt, createdAt: new Date().toISOString() },
    });
    return result.insertedId;
  } catch (e) {
    console.warn('[DB] createReceipt failed:', e);
    return null;
  }
}

/** Fetches all receipts for a userId, sorted newest first. */
export async function dbGetReceipts(userId: string): Promise<DBReceipt[]> {
  try {
    const result = await mongoFetch<{ documents: DBReceipt[] }>('find', 'receipts', {
      filter: { userId },
      sort: { purchaseDate: -1 },
    });
    return result.documents ?? [];
  } catch (e) {
    console.warn('[DB] getReceipts failed:', e);
    return [];
  }
}

/**
 * Seeds the `receipts` collection with two demo receipts.
 * Call once after first successful DB setup.
 */
export async function dbSeedSampleReceipts(userId: string): Promise<void> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();

  const samples: Omit<DBReceipt, '_id' | 'createdAt'>[] = [
    {
      userId,
      store: 'Biedronka',
      total: 47.85,
      currency: 'PLN',
      purchaseDate: thisMonth,
      items: [
        { name: 'Молоко 3.2%', price: 3.49, quantity: 2, category: 'Useful' },
        { name: 'Хлеб ржаной', price: 4.99, quantity: 1, category: 'Useful' },
        { name: 'Шоколадка Milka', price: 6.49, quantity: 3, category: 'Sweets' },
        { name: 'Яблоки', price: 7.99, quantity: 2, category: 'Useful' },
        { name: 'Пиво Żywiec', price: 9.90, quantity: 1, category: 'Harmful' },
      ],
      aiAnalysis: null,
    },
    {
      userId,
      store: 'Lidl',
      total: 123.40,
      currency: 'PLN',
      purchaseDate: lastMonth,
      items: [
        { name: 'Куриное филе', price: 19.99, quantity: 2, category: 'Useful' },
        { name: 'Сыр Гауда', price: 12.49, quantity: 1, category: 'Useful' },
        { name: 'Кока-Кола 2л', price: 7.99, quantity: 2, category: 'Harmful' },
        { name: 'Моющее средство', price: 15.49, quantity: 1, category: 'Needs' },
        { name: 'Печенье', price: 5.49, quantity: 3, category: 'Sweets' },
        { name: 'Туалетная бумага', price: 18.99, quantity: 1, category: 'Needs' },
      ],
      aiAnalysis: null,
    },
  ];

  for (const receipt of samples) {
    await dbCreateReceipt(receipt);
  }
}
