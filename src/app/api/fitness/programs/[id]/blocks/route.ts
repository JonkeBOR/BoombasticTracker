import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleAddBlock } from '@/features/fitness-tracker/server/handlers/programs';

export const POST = fitnessRoute(handleAddBlock);
