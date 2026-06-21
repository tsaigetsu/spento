import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Auth ---

/**
 * Represents a registered user profile.
 * Stored in AsyncStorage under USER_KEY and synced to MongoDB.
 */
export type AuthUser = {
  /** Primary email address — used as login ID */
  email: string;
  firstName: string;
  lastName: string;
  /** Alphanumeric + underscore, used as display handle */
  nick: string;
  /** When true, the UI shows @nick instead of firstName + lastName */
  showNick: boolean;
  /** Format: DD.MM.YYYY */
  birthDate: string;
  /** Local URI from expo-image-picker, or null if no photo set */
  photoUri: string | null;
  /** Monthly spending budget in the selected currency */
  budget: number;
  /** Whether the onboarding quiz has been completed */
  quizDone: boolean;
  /** Stub: selected country */
  country: string;
  /** Stub: selected currency string, e.g. "PLN (zł)" */
  currency: string;
  /** Stub: selected UI language */
  language: string;
  /**
   * Unix timestamp (ms) of last successful login.
   * Used to enforce 30-day session expiry.
   */
  loginTimestamp: number;
  /** MongoDB _id after first sync, undefined for local-only users */
  mongoId?: string;
};

export const USER_KEY = 'SPENTO_USER';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Built-in admin account. Activated when nick="admin" + password="admin".
 * Bypasses normal registration validation.
 */
export const ADMIN_USER: AuthUser = {
  email: 'admin@spento.app',
  firstName: 'Test',
  lastName: 'Account',
  nick: 'admin',
  showNick: true,
  birthDate: '01.01.1990',
  photoUri: null,
  budget: 2000,
  quizDone: true,
  country: 'Польша',
  currency: 'PLN (zł)',
  language: 'Русский',
  loginTimestamp: Date.now(),
};

/**
 * Loads the cached user from AsyncStorage.
 * Returns null on first launch, if session expired, or on parse errors.
 */
export async function loadUser(): Promise<AuthUser | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? (JSON.parse(data) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Persists user profile to AsyncStorage (local cache).
 * Call after registration, login, profile edits, and quiz completion.
 */
export async function saveUser(user: AuthUser): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

/**
 * Removes the user session from AsyncStorage.
 * Called on logout or when the 30-day session expires.
 */
export async function clearUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {}
}

/**
 * Returns true if the user's session is still valid (within 30 days).
 */
export function isSessionValid(user: AuthUser): boolean {
  return Date.now() - user.loginTimestamp < SESSION_DURATION_MS;
}

// --- Expenses ---

/**
 * The four expense categories.
 * - Useful  → green  (Полезности)
 * - Sweets  → pink   (Сладости)
 * - Needs   → blue   (Нужны)
 * - Harmful → orange (Вредности)
 */
export type Category = 'Useful' | 'Sweets' | 'Needs' | 'Harmful';

/**
 * A single expense record.
 * Multiple records can share the same productId when the same product
 * was bought at different prices.
 */
export type Expense = {
  id: string;
  /**
   * Product identity key.
   * Same product name → same productId across purchases.
   * Different price = separate record but same productId.
   */
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category: Category;
  /** ISO 8601 date string */
  date: string;
};

/** Display metadata for each category. */
export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  Useful:  { label: 'Полезности', color: '#4CAF50' },
  Sweets:  { label: 'Сладости',   color: '#E91E8C' },
  Needs:   { label: 'Нужны',      color: '#2196F3' },
  Harmful: { label: 'Вредности',  color: '#FF5722' },
};

/** Canonical iteration order for categories. */
export const CATEGORY_LIST: Category[] = ['Useful', 'Sweets', 'Needs', 'Harmful'];

const EXPENSES_KEY = 'SPENTO_EXPENSES_V2';

/**
 * Loads all saved expenses from AsyncStorage.
 * Returns [] on first launch or on deserialization errors.
 */
export async function loadExpenses(): Promise<Expense[]> {
  try {
    const data = await AsyncStorage.getItem(EXPENSES_KEY);
    return data ? (JSON.parse(data) as Expense[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persists the full expense list to AsyncStorage.
 * Guarded by a `loaded` flag in the explore screen to avoid overwriting on mount.
 */
export async function saveExpenses(expenses: Expense[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch (e) {
    console.log('Error saving expenses:', e);
  }
}

/**
 * Generates a collision-resistant local ID: `${timestamp}_${random7}`.
 * Used for expense IDs and new productIds.
 */
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
