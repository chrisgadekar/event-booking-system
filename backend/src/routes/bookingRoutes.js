import { Router } from 'express';
import { body } from 'express-validator';
import { confirmBooking, listBookings } from '../controllers/bookingController.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAuth);

router.get('/', listBookings);

router.post(
  '/',
  writeLimiter,
  [body('reservationId').isMongoId().withMessage('Invalid reservation id')],
  validate,
  confirmBooking
);

export default router;
