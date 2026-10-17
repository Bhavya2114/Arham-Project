import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || '';

if (uri.includes('.mongodb.net') || uri.startsWith('mongodb+srv://')) {
  // Safety guard: Redirect test runs to local MongoDB to protect remote database
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/inventory_management_test';
}

// Safety guard: Clear live Gemini keys from .env during test runs to protect real Gemini quotas
for (const key of Object.keys(process.env)) {
  if (key.startsWith('GEMINI_API_KEY')) {
    delete process.env[key];
  }
}
