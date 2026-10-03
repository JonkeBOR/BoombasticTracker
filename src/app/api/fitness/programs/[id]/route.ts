import { fitnessRoute } from '@/features/fitness-tracker/server/fitness-route';
import {
  handleDeleteProgram,
  handleRenameProgram,
} from '@/features/fitness-tracker/server/handlers/programs';

export const PATCH = fitnessRoute(handleRenameProgram);
export const DELETE = fitnessRoute(handleDeleteProgram);
