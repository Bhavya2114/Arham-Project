import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) return;
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
