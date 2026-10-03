import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import {
  handleLabelBlock,
  handleRemoveBlock,
} from '@/features/fitness-tracker/server/handlers/programs';

export const PATCH = fitnessRoute(handleLabelBlock);
export const DELETE = fitnessRoute(handleRemoveBlock);
