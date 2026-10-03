import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handlePause } from '@/features/fitness-tracker/server/handlers/activation';

export const DELETE = fitnessRoute(handlePause);
