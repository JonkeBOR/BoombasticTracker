import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleStartSession } from '@/features/fitness-tracker/server/handlers/training';

export const POST = fitnessRoute(handleStartSession);
