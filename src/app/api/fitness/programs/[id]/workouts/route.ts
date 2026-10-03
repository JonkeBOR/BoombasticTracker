import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleAddWorkout } from '@/features/fitness-tracker/server/handlers/programs';

export const POST = fitnessRoute(handleAddWorkout);
