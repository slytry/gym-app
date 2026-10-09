import definition from './program-v1.json' with { type: 'json' };
import { createWorkout as createCurrentWorkout, findPreviousSet } from '../../state.js';

export const LEGACY_NECK_IDS = definition.neckCircuit.exerciseIds;

// A real snapshot of the previous program, independent of the current exercise bank.
export function createLegacyWorkout(routineId, timestamp, id, history = []) {
  const workout = createCurrentWorkout(routineId, timestamp, id);
  const routine = definition.routines.find((item) => item.id === routineId);
  workout.plan = structuredClone({ ...routine, neckCircuit: definition.neckCircuit });
  workout.sets = Object.fromEntries(routine.exercises.map((exercise) => [exercise.id,
    Array.from({ length: exercise.sets }, (_, index) => {
      const previous = findPreviousSet(history, routineId, exercise.id, index);
      const result = { status: 'pending', weight: String(previous?.weight ?? ''), prefilled: true, edited: false };
      const field = exercise.kind === 'seconds' ? 'seconds' : 'reps';
      result[field] = String(previous?.[field] || exercise.target.match(/\d+/)[0]);
      return result;
    })
  ]));
  return workout;
}
