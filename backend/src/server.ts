import app from './app';
import { env } from './config/env';
import { connectDB } from './config/database';

const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
};

startServer();
