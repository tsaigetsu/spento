/**
 * Spento API client — calls the Express backend (backend/server.js).
 *
 * The backend uses the native MongoDB driver via mongoose, which works in Node.js.
 * React Native / Hermes cannot use the native driver directly — hence this REST layer.
 *
 * Start backend: cd backend && npm install && npm run dev
 * Configure URL: lib/api-config.ts
 */

import type { AuthUser } from './data';
import { API_URL } from './api-config';

// --- API user shape returned by the backend ---

type ApiUser = {
  mongoId: string;
  email: string;
  firstName: string;
  lastName: string;
  nick: string;
  showNick: boolean;
  photoUri: string | null;
  budget: number;
  birthDate: string;
  country: string;
  currency: string;
  language: string;
  quizDone: boolean;
};

function apiUserToAuthUser(u: ApiUser): AuthUser {
  return {
    mongoId: u.mongoId,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    nick: u.nick,
    showNick: u.showNick,
    photoUri: u.photoUri,
    budget: u.budget,
    birthDate: u.birthDate,
    country: u.country,
    currency: u.currency,
    language: u.language,
    quizDone: u.quizDone,
    loginTimestamp: Date.now(),
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[API] ${options?.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// --- User operations ---

/**
 * Login: verifies email + password, returns AuthUser or null.
 */
export async function dbFindUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    const user = await apiFetch<ApiUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });
    return apiUserToAuthUser(user);
  } catch (e) {
    console.warn('[DB] findUser failed:', e);
    return null;
  }
}

/**
 * Register: creates a new user in MongoDB.
 * Returns the mongoId string, or null on failure.
 */
export async function dbCreateUser(user: AuthUser, password: string): Promise<string | null> {
  try {
    const body = {
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
      },
      finance: { monthlyBudget: user.budget || 0 },
      personal: { birthDate: user.birthDate },
      quizDone: user.quizDone,
    };
    const created = await apiFetch<ApiUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return created.mongoId;
  } catch (e) {
    console.warn('[DB] createUser failed:', e);
    return null;
  }
}

/**
 * Update user fields in MongoDB (profile, settings, quiz flag, etc.)
 */
export async function dbUpdateUser(mongoId: string, user: Partial<AuthUser>): Promise<void> {
  try {
    const set: Record<string, unknown> = {};
    if (user.firstName !== undefined) set['profile.firstName'] = user.firstName;
    if (user.lastName !== undefined) set['profile.lastName'] = user.lastName;
    if (user.nick !== undefined) set['profile.username'] = user.nick;
    if (user.showNick !== undefined) set['profile.showUsernameInsteadOfName'] = user.showNick;
    if (user.photoUri !== undefined) set['profile.avatarUrl'] = user.photoUri;
    if (user.language !== undefined) set['settings.language'] = user.language;
    if (user.currency !== undefined) set['settings.currency'] = user.currency;
    if (user.country !== undefined) set['settings.country'] = user.country;
    if (user.budget !== undefined) set['finance.monthlyBudget'] = user.budget;
    if (user.birthDate !== undefined) set['personal.birthDate'] = user.birthDate;
    if (user.quizDone !== undefined) set['quizDone'] = user.quizDone;

    await apiFetch(`/api/users/${mongoId}`, {
      method: 'PUT',
      body: JSON.stringify(set),
    });
  } catch (e) {
    console.warn('[DB] updateUser failed:', e);
  }
}

// --- Legacy type export (used by older imports) ---
export type { ApiUser as DBUserDocument };
