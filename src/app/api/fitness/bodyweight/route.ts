import { handleRecordBodyweight } from '@/features/fitness-tracker/server/handlers/bodyweight';
import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';

export const POST = fitnessRoute(handleRecordBodyweight);
