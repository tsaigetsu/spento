Spento — Деньги уходят незаметно. Теперь ты это видишь.

# Spento

Приложение для отслеживания расходов с категоризацией, статистикой и рейтингом экономии.

---

## Стек

| Слой | Технология |
|---|---|
| Платформа | React Native / Expo SDK 54 |
| Роутинг | Expo Router v6 (файловый) |
| Язык | TypeScript |
| Локальное хранилище | AsyncStorage |
| База данных | MongoDB Atlas Data API (REST) |
| Графики | react-native-svg (DonutChart) |
| Свайп между табами | react-native-pager-view |
| Анимации | React Native `Animated` API |

---

## Структура экранов

```
app/
├── index.tsx              — редирект: проверяет сессию → /welcome или /(tabs)/explore
├── welcome.tsx            — выбор: войти / зарегистрироваться (Google/Apple — стабы)
├── login.tsx              — вход по email + пароль
├── signup-credentials.tsx — регистрация шаг 1: email, пароль
├── signup-profile.tsx     — регистрация шаг 2: имя, ник, фото, бюджет
├── verify-email.tsx       — OTP-подтверждение (6 цифр, хардкод 111111)
├── quiz.tsx               — онбординг: страна, валюта, язык
├── profile.tsx            — профиль (открывается из бургер-меню)
└── (tabs)/
    ├── _layout.tsx        — PagerView + кастомный таб-бар (свайп между табами)
    ├── explore.tsx        — список расходов, бургер-меню, добавление трат
    ├── stats.tsx          — статистика по месяцам (бар + пончик-чарт)
    └── top.tsx            — рейтинг экономии
```

---

## Поток аутентификации

```
Открытие → index.tsx
    ↓ нет пользователя → /welcome → /login или /signup-credentials
    ↓ сессия истекла (>30 дней) → /welcome
    ↓ квиз не пройден → /quiz
    ↓ всё ок → /(tabs)/explore
```

Сессия хранится через `loginTimestamp` в `AuthUser`. Просрочка — 30 дней.

---

## Регистрация → MongoDB

**Шаг 1** (`signup-credentials.tsx`): email + пароль сохраняются временно в AsyncStorage под ключом `SPENTO_PENDING_CREDS`.

**Шаг 2** (`signup-profile.tsx`): читает credentials, собирает `AuthUser`, сохраняет локально (`saveUser`), затем асинхронно вызывает `dbCreateUser` — данные уходят в MongoDB.

**OTP** (`verify-email.tsx`): хардкодный код `111111`. После успеха → `/quiz`.

**Формат документа в коллекции `users`:**

```json
{
  "_id": "ObjectId",
  "email": "test@test.com",
  "password": "plain_text_for_now",
  "profile": {
    "firstName": "Иван",
    "lastName": "Иванов",
    "username": "ivan_99",
    "showUsernameInsteadOfName": false,
    "avatarUrl": null
  },
  "settings": {
    "language": "ru",
    "currency": "PLN",
    "country": "PL",
    "displayNameMode": "name"
  },
  "finance": {
    "monthlyBudget": 3000
  },
  "personal": {
    "birthDate": "01.01.2001"
  },
  "quizDone": false,
  "createdAt": "2026-06-21T00:00:00Z",
  "updatedAt": "2026-06-21T00:00:00Z"
}
```

**Формат документа в коллекции `receipts`:**

```json
{
  "_id": "ObjectId",
  "userId": "ref → users._id",
  "store": "Biedronka",
  "total": 47.85,
  "currency": "PLN",
  "purchaseDate": "2026-06-05T00:00:00Z",
  "items": [
    { "name": "Молоко", "price": 3.49, "quantity": 2, "category": "Useful" }
  ],
  "aiAnalysis": null,
  "createdAt": "2026-06-21T00:00:00Z"
}
```

---

## Настройка MongoDB Atlas Data API

> **Важно:** нативный драйвер MongoDB не работает в React Native (требует Node.js API). Используется Atlas Data API (REST over HTTPS).

1. Войдите в [cloud.mongodb.com](https://cloud.mongodb.com)
2. Перейдите в **App Services** → создайте приложение (или откройте существующее)
3. Включите **Data API** для вашего кластера
4. Перейдите в **Authentication → API Keys** → создайте ключ
5. Откройте `lib/db-config.ts` и заполните:

```ts
export const DB_CONFIG = {
  APP_ID: 'data-xxxxxx',  // ← App ID из App Services
  API_KEY: '',             // ← созданный API ключ
  DATA_SOURCE: 'Cluster0',
  DATABASE: 'spento',
};
```

Пока `APP_ID` — плейсхолдер, все DB-операции завершаются молча (без краша). Данные сохраняются только локально.

---

## Локальное хранилище (AsyncStorage)

| Ключ | Содержимое |
|---|---|
| `SPENTO_USER` | JSON объект `AuthUser` |
| `SPENTO_EXPENSES` | JSON массив `Expense[]` |
| `SPENTO_THEME` | `'light'` или `'dark'` |
| `SPENTO_PENDING_CREDS` | `{ email, password }` (только во время регистрации) |

---

## Основные типы (`lib/data.ts`)

```ts
type AuthUser = {
  email: string;
  firstName: string;
  lastName: string;
  nick: string;
  showNick: boolean;
  birthDate: string;
  photoUri: string | null;
  budget: number;
  quizDone: boolean;
  country: string;
  currency: string;
  language: string;
  loginTimestamp: number;
  mongoId?: string;
};

type Expense = {
  id: string;
  name: string;
  productId: string;
  price: number;
  quantity: number;
  category: Category;       // 'Useful' | 'Sweets' | 'Needs' | 'Harmful'
  date: string;             // ISO 8601
};
```

---

## Категории расходов

| Ключ | Название | Цвет |
|---|---|---|
| `Useful` | Полезности | зелёный |
| `Sweets` | Сладости | розовый |
| `Needs` | Нужды | синий |
| `Harmful` | Вредности | красный |

---

## Навигация профиля

Профиль открывается из **бургер-меню** (кнопка «Профиль»):
- Бургер показывает аватарку пользователя (фото или инициал)
- Нажатие → Stack-переход на `/profile`
- В профиле: стрелка «назад» + свайп вправо для возврата
- В профиле: просмотр/редактирование всех данных, смена фото, выход

---

## Быстрый вход (для разработки)

| Email | Пароль | Результат |
|---|---|---|
| `admin@spento.app` | `admin` | Вход без БД, готовый пользователь |
| `admin` | `admin` | То же самое |
