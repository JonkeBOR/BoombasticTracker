import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleActivateProgram } from '@/features/fitness-tracker/server/handlers/activation';

export const POST = fitnessRoute(handleActivateProgram);
