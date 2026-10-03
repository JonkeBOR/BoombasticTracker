import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleCreateProgram } from '@/features/fitness-tracker/server/handlers/programs';

export const POST = fitnessRoute(handleCreateProgram);
