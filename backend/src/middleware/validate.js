import { validationResult } from 'express-validator';

// Collects express-validator results and returns 400 on the first failures.
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
}
