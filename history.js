import { getWorkoutExercises, getWorkoutNeckCircuit, validateProgram } from './program.js?v=22';
import { localDateKey } from './state.js?v=22';

export function beginWorkoutEdit(history, id) {
  const workout = history.find((item) => item.id === id);
  if (!workout) throw new Error('Тренировка не найдена');
  return structuredClone(workout);
}

export function saveWorkoutEdit(store, editing, timestamp = Date.now()) {
  const original = store.history.find((item) => item.id === editing.id);
  if (!original) throw new Error('Тренировка не найдена');
  const updated = {
    ...original,
    date: editing.date,
    startedAt: editing.startedAt,
    finishedAt: editing.finishedAt,
    updatedAt: timestamp,
    sets: structuredClone(editing.sets),
    note: editing.note || ''
  };
  validateWorkout(updated, true);
  return { ...store, history: store.history.map((item) => item.id === updated.id ? updated : item) };
}

export function deleteWorkout(store, id) {
  if (!store.history.some((workout) => workout.id === id)) throw new Error('Тренировка не найдена');
  return { ...store, history: store.history.filter((workout) => workout.id !== id) };
}

export function getExerciseHistory(history, routineId, exerciseId, limit = 10) {
  return history
    .filter((workout) => workout.routineId === routineId && workout.finishedAt
      && workout.sets[exerciseId]?.some((set) => set.status === 'done'))
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .slice(0, limit)
    .map((workout) => ({
      workout,
      exercise: getWorkoutExercises(workout).find((exercise) => exercise.id === exerciseId),
      sets: workout.sets[exerciseId]
    }));
}

export function validateWorkout(workout, completed) {
  check(isRecord(workout) && isId(workout.id) && isId(workout.routineId), 'неверный id тренировки');
  check(typeof workout.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(workout.date)
    && localDateKey(new Date(`${workout.date}T12:00:00`).getTime()) === workout.date, 'неверная дата тренировки');
  check(isTimestamp(workout.startedAt) && isTimestamp(workout.updatedAt), 'неверное время тренировки');
  check(completed ? isTimestamp(workout.finishedAt) && workout.finishedAt >= workout.startedAt
    : workout.finishedAt === null, 'неверное время завершения');
  check(isRecord(workout.plan) && workout.plan.id === workout.routineId, 'неверный снимок программы');
  check(Array.isArray(workout.addedExercises), 'неверный список добавленных упражнений');
  validateProgram({
    routines: [workout.plan],
    guidance: [],
    schedule: [{ routineId: workout.routineId }],
    archivedExercises: workout.addedExercises,
    neckCircuit: null
  });
  validateNote(workout.note);
  check(isRecord(workout.sets), 'неверный список подходов');
  const exercises = getWorkoutExercises(workout);
  for (const [id, sets] of Object.entries(workout.sets)) {
    check(isId(id) && exercises.some((exercise) => exercise.id === id), 'неизвестное упражнение в подходах');
    check(Array.isArray(sets) && sets.length > 0, 'неверный список подходов');
    sets.forEach(validateSet);
  }
  const circuit = getWorkoutNeckCircuit(workout);
  if (circuit !== undefined) {
    check(isRecord(circuit) && Array.isArray(circuit.exerciseIds), 'неверный круг шеи');
    const ids = circuit.exerciseIds;
    if (ids.length) {
      check(ids.length > 1 && new Set(ids).size === ids.length && ids.every(isId)
        && ['name', 'technique', 'extraRoundNote'].every((field) => typeof circuit[field] === 'string'), 'неверный круг шеи');
      if (!completed && ids.some((id) => workout.sets[id])) {
        check(ids.every((id) => workout.sets[id]?.length === workout.sets[ids[0]]?.length
          && exercises.find((exercise) => exercise.id === id)?.kind === 'seconds'), 'неполный круг шеи');
      }
    }
  }
}

function validateSet(set) {
  check(isRecord(set) && ['done', 'pending', 'skipped'].includes(set.status), 'неверный статус подхода');
  for (const field of ['weight', 'reps', 'seconds', 'leftReps', 'rightReps']) {
    const value = set[field];
    if (value === undefined || value === '') continue;
    check((typeof value === 'number' || typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))
      && Number.isFinite(Number(value)) && Number(value) >= 0, 'неверный результат подхода');
    if (['reps', 'leftReps', 'rightReps'].includes(field)) check(Number.isInteger(Number(value)), 'неверные повторы');
  }
  if (set.rir !== undefined && set.rir !== '') {
    check((typeof set.rir === 'number' || typeof set.rir === 'string' && /^\d+$/.test(set.rir))
      && Number.isInteger(Number(set.rir)) && Number(set.rir) >= 0 && Number(set.rir) <= 10, 'RIR должен быть целым числом от 0 до 10');
  }
  validateNote(set.note);
  for (const field of ['prefilled', 'edited']) {
    if (set[field] !== undefined) check(typeof set[field] === 'boolean', 'неверная отметка ввода');
  }
}

function validateNote(note) {
  check(note === undefined || typeof note === 'string' && note.length <= 2000, 'заметка должна быть текстом до 2000 символов');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) && !Object.hasOwn(Object.prototype, value);
}

function isTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}
