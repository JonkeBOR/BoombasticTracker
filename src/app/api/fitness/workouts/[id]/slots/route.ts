import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleAddSlot } from '@/features/fitness-tracker/server/handlers/slots';

export const POST = fitnessRoute(handleAddSlot);
