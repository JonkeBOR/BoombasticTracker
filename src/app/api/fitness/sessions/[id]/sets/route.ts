import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleLogSet } from '@/features/fitness-tracker/server/handlers/training';

export const POST = fitnessRoute(handleLogSet);
