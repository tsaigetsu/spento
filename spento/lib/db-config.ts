/**
 * MongoDB Atlas Data API configuration.
 *
 * HOW TO GET THESE VALUES:
 * 1. Go to https://cloud.mongodb.com
 * 2. Select your project → "App Services" tab (top nav)
 * 3. Create a new App (or open existing) → "Data API" section
 * 4. Enable the Data API for your cluster
 * 5. Copy the "App ID" (looks like "data-abcdef") → paste into APP_ID below
 * 6. Go to "Authentication" → "API Keys" → Create API key → paste into API_KEY below
 *
 * Database structure: spento / users & receipts collections
 */
export const DB_CONFIG = {
  APP_ID: 'data-xxxxxx',   // ← Replace with your Atlas App Services App ID
  API_KEY: '',              // ← Replace with your Atlas Data API key
  DATA_SOURCE: 'Cluster0', // Default Atlas cluster name
  DATABASE: 'spento',
} as const;

export const IS_DB_CONFIGURED =
  DB_CONFIG.APP_ID !== 'data-xxxxxx' && DB_CONFIG.API_KEY !== '';
