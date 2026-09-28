import { PROGRAM, getRoutine } from './program.js';
import { createTimerState } from './timer.js';

export const STORAGE_KEY = 'gym-log-pwa:v1';

export function localDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialStore() {
  return {
    version: 1,
    selectedRoutineId: PROGRAM[0].id,
    drafts: {},
    history: [],
    timer: createTimerState()
  };
}

export function createWorkout(routineId, timestamp = Date.now(), id = createId(timestamp)) {
  const routine = getRoutine(routineId);
  const sets = {};

  for (const exercise of routine.exercises) {
    sets[exercise.id] = Array.from({ length: exercise.sets }, () => createSetResult(exercise.kind));
  }

  return {
    id,
    routineId: routine.id,
    date: localDateKey(timestamp),
    startedAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
    sets
  };
}

export function createSetResult(kind) {
  const result = {
    status: 'pending',
    weight: ''
  };

  if (kind === 'seconds') result.seconds = '';
  if (kind === 'sides') {
    result.leftReps = '';
    result.rightReps = '';
  }
  if (kind === 'reps') result.reps = '';

  return result;
}

export function ensureDraft(store, routineId, timestamp = Date.now()) {
  if (store.drafts[routineId]) return store.drafts[routineId];

  const draft = createWorkout(routineId, timestamp);
  store.drafts[routineId] = draft;
  return draft;
}

export function workoutHasProgress(workout) {
  return Object.values(workout.sets).flat().some((set) => (
    set.status !== 'pending'
    || set.weight !== ''
    || set.reps !== undefined && set.reps !== ''
    || set.seconds !== undefined && set.seconds !== ''
    || set.leftReps !== undefined && set.leftReps !== ''
    || set.rightReps !== undefined && set.rightReps !== ''
  ));
}

export function finishWorkout(workout, timestamp = Date.now()) {
  return {
    ...structuredCloneSafe(workout),
    updatedAt: timestamp,
    finishedAt: timestamp
  };
}

export function findPreviousSet(history, routineId, exerciseId, setIndex) {
  const previousWorkout = [...history]
    .filter((workout) => workout.routineId === routineId && workout.finishedAt)
    .sort((a, b) => b.finishedAt - a.finishedAt)[0];

  return previousWorkout?.sets?.[exerciseId]?.[setIndex] || null;
}

export function countStatuses(workout) {
  const results = Object.values(workout.sets).flat();
  return {
    done: results.filter((set) => set.status === 'done').length,
    skipped: results.filter((set) => set.status === 'skipped').length,
    pending: results.filter((set) => set.status === 'pending').length,
    total: results.length
  };
}

export function serializeStore(store) {
  return JSON.stringify(store);
}

export function parseStore(raw) {
  if (!raw) return createInitialStore();

  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== 1 || typeof parsed.drafts !== 'object' || !Array.isArray(parsed.history)) {
    throw new Error('Неподдерживаемый формат локальных данных');
  }

  const validRoutine = PROGRAM.some((routine) => routine.id === parsed.selectedRoutineId);
  return {
    ...createInitialStore(),
    ...parsed,
    selectedRoutineId: validRoutine ? parsed.selectedRoutineId : PROGRAM[0].id,
    timer: { ...createTimerState(), ...(parsed.timer || {}) }
  };
}

export function loadStore(storage) {
  try {
    return { store: parseStore(storage.getItem(STORAGE_KEY)), error: null };
  } catch (error) {
    return {
      store: createInitialStore(),
      error: `Не удалось прочитать сохранённые данные: ${error.message}`
    };
  }
}

export function saveStore(storage, store) {
  try {
    storage.setItem(STORAGE_KEY, serializeStore(store));
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: `Данные не сохранены: ${error.message}. Не закрывайте страницу до экспорта.`
    };
  }
}

function createId(timestamp) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `workout-${timestamp}-${Math.random().toString(36).slice(2)}`;
}

function structuredCloneSafe(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
