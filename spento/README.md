Spento — Деньги уходят незаметно. Теперь ты это видишь.

# Spento

Приложение для отслеживания расходов с категоризацией, сканированием чеков через OCR, статистикой и рейтингом экономии.

---

## Стек

| Слой | Технология |
|---|---|
| Платформа | React Native / Expo SDK 54 |
| Роутинг | Expo Router v6 (файловый) |
| Язык | TypeScript |
| Локальное хранилище | AsyncStorage |
| Бэкенд | Node.js + Express (REST API) |
| База данных | MongoDB Atlas + Mongoose |
| Хранилище изображений | Cloudinary |
| OCR | Tesseract.js v7 (на сервере) |
| Загрузка файлов | multer (memoryStorage) |
| Графики | react-native-svg (DonutChart) |
| Свайп между табами | react-native-pager-view |
| Анимации | React Native `Animated` API |
| Размытие фона | expo-blur (BlurView) |
| Выбор изображений | expo-image-picker |
| Вибрация | expo-haptics |

---

## Структура экранов

```
app/
├── index.tsx              — редирект: проверяет сессию → /welcome или /(tabs)/explore
├── welcome.tsx            — выбор: войти / зарегистрироваться
├── login.tsx              — вход по email + пароль
├── signup-credentials.tsx — регистрация шаг 1: email, пароль
├── signup-profile.tsx     — регистрация шаг 2: имя, ник, фото, бюджет
├── verify-email.tsx       — OTP-подтверждение (6 цифр, хардкод 111111)
├── quiz.tsx               — онбординг: страна, валюта, язык
├── profile.tsx            — профиль (открывается из бургер-меню)
└── (tabs)/
    ├── _layout.tsx        — PagerView + кастомный таб-бар
    ├── explore.tsx        — список расходов, сканирование чеков, управление тратами
    ├── stats.tsx          — статистика по месяцам (бар + пончик-чарт)
    └── top.tsx            — рейтинг экономии среди пользователей
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

## Экран расходов (explore.tsx)

### Список трат

- Расходы сгруппированы по дням: **Сегодня**, **Вчера**, **Пн 20 янв**, и т.д.
- У каждой группы показан дневной итог.
- В конце списка — кнопка **Архив**, открывающая историю по месяцам.

### Управление итемом

| Действие | Результат |
|---|---|
| Свайп влево | Открывает кнопки «Редактировать» и «Удалить» |
| Двойное нажатие | Открывает форму редактирования |
| Удаление | Показывает undo-тост на 5 секунд с обратным отсчётом |
| Подтверждение undo | Восстанавливает итем на исходную позицию в списке |

### Редактирование

Нажатие «Редактировать» (кнопка после свайпа или двойной тап) раскрывает форму прямо внутри карточки. Анимация — spring с `Animated.Value` (`editAnim`), `maxHeight` от 0 до 600. Закрытие — плавное сжатие за 210 мс.

### Добавление расходов

Две кнопки внизу экрана:

- **Камера (сканирование чека)** — OCR через Cloudinary + Tesseract
- **+ (ручной ввод)** — стандартная форма (название, цена, количество, категория)

---

## Сканирование чеков (OCR)

### Пользовательский сценарий

1. Нажать кнопку с иконкой камеры
2. Выбрать источник: **Камера** или **Галерея**
3. Сделать / выбрать фото чека
4. Появляется оверлей с размытым фоном
5. Пока идёт обработка — циклически сменяются статусы: *«Загружаем изображение»* → *«Распознаём текст»* → *«Анализируем строки»* → *«Ищем позиции»*
6. Найденные позиции появляются одна за другой: скелетон → данные
7. Нажать **«Добавить N»** — позиции добавляются в список расходов
8. Если закрыть оверлей без добавления — запись чека удаляется из MongoDB

### Технический pipeline

```
Телефон → POST /api/ocr (multipart/form-data)
    ↓
multer.memoryStorage() → buffer
    ↓
cloudinary.uploader.upload_stream() → secure_url (JPEG)
    ↓
fetch(secure_url) → imageBuffer
    ↓
Tesseract.createWorker(['pol', 'eng']).recognize(imageBuffer)
    ↓
parseReceiptText(rawText) → items[]
    ↓
Receipt.save() → MongoDB
    ↓
{ receiptId, items, total } → клиент
```

### Парсер чеков

Поддерживает два формата:

**Format A — польские магазины (Biedronka, Lidl, Żabka):**
```
NapTymbOwocŚwiMix1l  C  1 x  3,99  3,99C
     ↑ name         vat qty   unit  total
```
Regex вычленяет только имя, игнорируя VAT-букву, количество и обе цены.

**Format B — простой формат (российские магазины и др.):**
```
Молоко 2,5% 1л   89,00
```

Автоматически пропускаются строки: `SUMA`, `RAZEM`, `NIP`, `Discount`, `NON-FISCAL`, шапка магазина, даты, налоговые строки.

### Автоопределение категории

| Ключевые слова | Категория |
|---|---|
| piwo, wino, vodka, alkohol, сигарет... | Harmful |
| czekolad, ciastk, lody, шоколад, торт... | Sweets |
| mleko, chleb, jaja, mleko, молоко, хлеб... | Useful |
| всё остальное | Needs |

---

## API бэкенда

Бэкенд: `https://spento.onrender.com`

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/auth/login` | Вход по email + пароль |
| POST | `/api/users` | Регистрация |
| GET | `/api/users/by-email/:email` | Найти пользователя |
| PUT | `/api/users/:id` | Обновить профиль |
| POST | `/api/ocr` | Загрузить фото чека → OCR → вернуть позиции |
| GET | `/api/receipts/:userId` | История отсканированных чеков |
| DELETE | `/api/receipts/:id` | Удалить чек (вызывается при отмене оверлея) |

### POST /api/ocr

**Запрос:** `multipart/form-data`
| Поле | Тип | Описание |
|---|---|---|
| `image` | File | Фото чека (JPEG/PNG, до 12 МБ) |
| `userId` | string | MongoDB ID пользователя (опционально) |

**Ответ:**
```json
{
  "receiptId": "ObjectId",
  "imageUrl": "https://res.cloudinary.com/...",
  "items": [
    { "name": "SerMozzarella125g", "price": 1.49, "quantity": 1, "category": "Useful" }
  ],
  "total": 28.46
}
```

---

## MongoDB коллекции

### `users`

```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "password": "plain_text",
  "profile": {
    "firstName": "Иван", "lastName": "Иванов",
    "username": "ivan_99",
    "showUsernameInsteadOfName": false,
    "avatarUrl": null
  },
  "settings": { "language": "ru", "currency": "PLN", "country": "PL" },
  "finance": { "monthlyBudget": 3000 },
  "personal": { "birthDate": "01.01.2001" },
  "quizDone": false
}
```

### `receipts`

```json
{
  "_id": "ObjectId",
  "userId": "ref → users._id",
  "imageUrl": "https://res.cloudinary.com/spento_app/image/upload/...",
  "items": [
    { "name": "NapTymbOwocŚwiMix1l", "price": 3.99, "quantity": 1, "category": "Needs" }
  ],
  "total": 47.85,
  "rawText": "... исходный текст OCR ...",
  "createdAt": "2026-06-18T20:08:00Z"
}
```

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
  firstName: string; lastName: string;
  nick: string; showNick: boolean;
  birthDate: string;
  photoUri: string | null;
  budget: number;
  quizDone: boolean;
  country: string; currency: string; language: string;
  loginTimestamp: number;
  mongoId?: string;
};

type Expense = {
  id: string;
  name: string;
  productId: string;
  price: number;
  quantity: number;
  category: Category;   // 'Useful' | 'Sweets' | 'Needs' | 'Harmful'
  date: string;         // ISO 8601
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

## UI-особенности

### Навигация
- Свайп между табами — нативный через `PagerView` (`scrollEnabled={true}`)
- Свайп вправо от **левого края экрана** (ниже хедера) — открывает бургер-меню
- В хедере всех вкладок: название **Spento** + зелёный бейдж **FREE**

### Темизация
- Кнопка в хедере (`sun`/`moon`) переключает тему
- Тема сохраняется в AsyncStorage (`SPENTO_THEME`)
- По умолчанию — системная тема устройства

### Анимации
- Все кнопки — spring-пресс (`scale: 0.91`)
- Удаление из списка — `LayoutAnimation` с bouncy-эффектом
- Undo-тост — вылетает снизу с прогресс-баром
- Форма редактирования — spring `maxHeight` (editAnim)
- OCR оверлей — каждый итем влетает снизу + скелетон исчезает плавно

---

## Переменные окружения (backend/.env)

```
MONGODB_URI=mongodb+srv://...
PORT=3001
CLOUDINARY_CLOUD_NAME=spento_app
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Быстрый вход (для разработки)

| Email | Пароль | Результат |
|---|---|---|
| `admin@spento.app` | `admin` | Вход без БД, готовый пользователь |
| `admin` | `admin` | То же самое |

---

## Известные ограничения

- Пароли хранятся в открытом виде (нет bcrypt) — только для MVP
- OTP-код `111111` хардкодный — верификация email не реализована
- Tesseract при первом запуске скачивает языковые пакеты `pol+eng` (~8 МБ) в `/tmp/tessdata` — первый OCR-запрос на Render.com может занять 30–60 с
- Рейтинг экономии (`top.tsx`) — хардкодные данные, реального API нет
