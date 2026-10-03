import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleStartUpcomingSession } from '@/features/fitness-tracker/server/handlers/training';

export const POST = fitnessRoute(handleStartUpcomingSession);
