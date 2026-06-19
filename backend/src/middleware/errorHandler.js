import { ApiError } from '../utils/ApiError.js';

export function notFound(_req, res) {
  res.status(404).json({ message: 'Route not found' });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Duplicate key (e.g. email already registered).
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Resource already exists' });
  }

  // Mongoose validation errors.
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({ message });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier' });
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}
