import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || '';

if (uri.includes('.mongodb.net') || uri.startsWith('mongodb+srv://')) {
  throw new Error(
    '\n=================================================================================\n' +
    '🚨 SAFETY GUARD: Refusing to run Jest tests against remote MongoDB Atlas database!\n' +
    'Tests must run against local MongoDB (mongodb://127.0.0.1:27017/inventory_management).\n' +
    '=================================================================================\n'
  );
}
