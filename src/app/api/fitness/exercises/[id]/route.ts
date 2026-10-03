import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import {
  handleDeleteExercise,
  handleUpdateExercise,
} from '@/features/fitness-tracker/server/handlers/exercises';

export const PATCH = fitnessRoute(handleUpdateExercise);
export const DELETE = fitnessRoute(handleDeleteExercise);
