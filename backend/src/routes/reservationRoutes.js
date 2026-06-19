import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  reserveSeats,
  getActiveReservation,
  cancelReservation,
} from '../controllers/reservationController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAuth);

router.get('/active', getActiveReservation);

router.post(
  '/',
  writeLimiter,
  [
    body('eventId').isMongoId().withMessage('Invalid event id'),
    body('seatNumbers')
      .isArray({ min: 1 })
      .withMessage('Select at least one seat'),
    body('seatNumbers.*').isString().withMessage('Invalid seat number'),
  ],
  validate,
  reserveSeats
);

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid reservation id')],
  validate,
  cancelReservation
);

export default router;
