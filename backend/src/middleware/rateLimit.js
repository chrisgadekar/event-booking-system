import rateLimit from 'express-rate-limit';

// Throttles authentication attempts to slow down credential-stuffing and
// brute-force attacks.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

// A looser limiter applied to write-heavy booking actions.
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You are doing that too often. Please slow down.' },
});
