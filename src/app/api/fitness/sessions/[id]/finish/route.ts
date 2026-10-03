import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleFinishSession } from '@/features/fitness-tracker/server/handlers/training';

export const POST = fitnessRoute(handleFinishSession);
