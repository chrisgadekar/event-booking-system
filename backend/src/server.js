import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { loadEnv } from './config/env.js';

async function start() {
  const env = loadEnv();
  try {
    await connectDB(env.mongoUri);
    const app = createApp({ clientOrigin: env.clientOrigin, nodeEnv: env.nodeEnv });
    app.listen(env.port, () => {
      console.log(`API listening on http://localhost:${env.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
