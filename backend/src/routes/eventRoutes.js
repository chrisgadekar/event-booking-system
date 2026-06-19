import { Router } from 'express';
import { param } from 'express-validator';
import { listEvents, getEvent } from '../controllers/eventController.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/', listEvents);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid event id')],
  validate,
  getEvent
);

export default router;
