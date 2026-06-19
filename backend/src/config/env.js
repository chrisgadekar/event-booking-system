// Validates required configuration at startup so the app fails fast and loudly
// instead of misbehaving later (e.g. signing tokens with an undefined secret).
export function loadEnv() {
  const required = ['JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    console.error(
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'Copy .env.example to .env and fill in the values.'
    );
    process.exit(1);
  }

  const reservationMinutes = Number(process.env.RESERVATION_MINUTES) || 10;
  if (reservationMinutes <= 0) {
    console.error('RESERVATION_MINUTES must be a positive number.');
    process.exit(1);
  }

  return {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sortmyscene',
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    reservationMinutes,
    clientOrigin: process.env.CLIENT_ORIGIN || true,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
