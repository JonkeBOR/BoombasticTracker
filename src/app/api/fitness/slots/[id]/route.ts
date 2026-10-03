import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import {
  handleRemoveSlot,
  handleUpdateSlot,
} from '@/features/fitness-tracker/server/handlers/slots';

export const PATCH = fitnessRoute(handleUpdateSlot);
export const DELETE = fitnessRoute(handleRemoveSlot);
