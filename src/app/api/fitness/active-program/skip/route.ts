import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleSkip } from '@/features/fitness-tracker/server/handlers/activation';

export const POST = fitnessRoute(handleSkip);
