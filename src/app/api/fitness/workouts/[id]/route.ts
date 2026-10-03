import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import {
  handleRemoveWorkout,
  handleUpdateWorkout,
} from '@/features/fitness-tracker/server/handlers/programs';

export const PATCH = fitnessRoute(handleUpdateWorkout);
export const DELETE = fitnessRoute(handleRemoveWorkout);
