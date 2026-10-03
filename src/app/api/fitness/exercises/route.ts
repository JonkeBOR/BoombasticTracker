import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleAddExercise } from '@/features/fitness-tracker/server/handlers/exercises';

export const POST = fitnessRoute(handleAddExercise);
