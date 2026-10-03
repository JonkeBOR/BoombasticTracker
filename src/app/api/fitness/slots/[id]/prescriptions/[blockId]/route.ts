import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import { handleSetPrescription } from '@/features/fitness-tracker/server/handlers/slots';

export const PUT = fitnessRoute(handleSetPrescription);
