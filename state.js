import {
  EXERCISE_BANK,
  NECK_CIRCUIT,
  NECK_CIRCUIT_IDS,
  PROGRAM,
  getActiveWorkoutExercises,
  getAvailableExercises,
  getExercise,
  getRoutine,
  getWorkoutExercises,
  getWorkoutNeckCircuit,
  getWorkoutRoutine,
  getWorkoutExerciseSettings
} from './program.js?v=22';
import { createTimerState, startTimer } from './timer.js?v=10';

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
    specialHistory: [],
    timer: createTimerState()
  };
}

export function createWorkout(routineId, timestamp = Date.now(), id = createId(timestamp), history = []) {
  const routine = getRoutine(routineId);
  const sets = {};

  for (const exercise of routine.exercises) {
    sets[exercise.id] = Array.from({ length: exercise.sets }, (_, setIndex) => (
      createSetResult(exercise, findPreviousSet(history, routine.id, exercise.id, setIndex))
    ));
  }

  return {
    id,
    routineId: routine.id,
    date: localDateKey(timestamp),
    startedAt: timestamp,
    updatedAt: timestamp,
    finishedAt: null,
    sets,
    plan: structuredCloneSafe({ ...routine, neckCircuit: NECK_CIRCUIT }),
    addedExercises: []
  };
}

function createSetResult(exercise, previous = null) {
  const fallback = String(planLowerBound(exercise.target));
  const result = {
    status: 'pending',
    weight: previousValue(previous, 'weight', ''),
    prefilled: true,
    edited: false
  };

  if (exercise.kind === 'seconds') {
    // Distance is recorded in a note; the optional time must not default to metres.
    const seconds = /\d+[–-]?\d*\s+м(?:\s|$)/.test(exercise.target) ? '' : fallback;
    result.seconds = previousValue(previous, 'seconds', seconds);
  }
  if (exercise.kind === 'sides') {
    result.leftReps = previousValue(previous, 'leftReps', fallback);
    result.rightReps = previousValue(previous, 'rightReps', fallback);
  }
  if (exercise.kind === 'reps') result.reps = previousValue(previous, 'reps', fallback);

  return result;
}

export function ensureDraft(store, routineId, timestamp = Date.now()) {
  if (store.drafts[routineId]) {
    const draft = store.drafts[routineId];
    ensureWorkoutPlan(draft);
    for (const exercise of getWorkoutRoutine(draft).exercises) {
      if (!draft.sets[exercise.id]) {
        draft.sets[exercise.id] = Array.from({ length: exercise.sets }, (_, index) => (
          createSetResult(exercise, findPreviousSet(store.history, routineId, exercise.id, index))
        ));
      }
    }
    return draft;
  }

  return startNewDraft(store, routineId, timestamp);
}

export function startNewDraft(store, routineId, timestamp = Date.now()) {
  const draft = createWorkout(routineId, timestamp, undefined, store.history);
  store.drafts[routineId] = draft;
  return draft;
}

export function addWorkoutExercise(store, routineId, exerciseId, timestamp = Date.now()) {
  const bankId = NECK_CIRCUIT_IDS.includes(exerciseId) ? NECK_CIRCUIT_IDS[0] : exerciseId;
  if (!EXERCISE_BANK.some((exercise) => exercise.id === bankId)) {
    throw new Error('Упражнение не найдено в банке');
  }
  const draft = ensureDraft(store, routineId, timestamp);
  if (!getAvailableExercises(draft).some((exercise) => exercise.id === bankId)) return draft;
  const exerciseIds = NECK_CIRCUIT_IDS.includes(bankId) ? NECK_CIRCUIT_IDS : [bankId];
  if (NECK_CIRCUIT_IDS.includes(bankId)) draft.plan.neckCircuit = structuredCloneSafe(NECK_CIRCUIT);
  for (const id of exerciseIds) {
    const exercise = getRoutine(routineId).exercises.find((item) => item.id === id)
      || EXERCISE_BANK.find((item) => item.id === id);
    draft.addedExercises.push(structuredCloneSafe(exercise));
    draft.sets[id] = Array.from({ length: exercise.sets }, (_, index) => (
      createSetResult(exercise, findPreviousSet(store.history, routineId, id, index))
    ));
  }
  draft.updatedAt = timestamp;
  return draft;
}

export function addWorkoutSet(store, routineId, exerciseId, timestamp = Date.now()) {
  const draft = ensureDraft(store, routineId, timestamp);
  const circuitIds = getWorkoutNeckCircuit(draft).exerciseIds;
  const exerciseIds = circuitIds.includes(exerciseId) ? circuitIds : [exerciseId];
  for (const id of exerciseIds) {
    const exercise = getExercise(draft, id);
    const previous = findPreviousSet(store.history, routineId, id, draft.sets[id].length);
    draft.sets[id].push(createSetResult(exercise, previous));
  }
  draft.updatedAt = timestamp;
  return draft;
}

export function getExerciseReplacementError(workout, exerciseId) {
  if (!workout || workout.finishedAt || !getActiveWorkoutExercises(workout).some((item) => item.id === exerciseId)) {
    return 'Упражнение не найдено в текущем черновике';
  }
  if (getWorkoutNeckCircuit(workout).exerciseIds.includes(exerciseId)) {
    return 'Круг шеи нельзя заменять. Добавьте другое упражнение отдельно.';
  }
  if (workout.sets[exerciseId].some(setHasProgress)) {
    return 'В упражнении уже есть записи. Добавьте другое упражнение отдельно, чтобы сохранить результаты.';
  }
  return null;
}

export function replaceWorkoutExercise(store, routineId, exerciseId, replacementId, timestamp = Date.now()) {
  const draft = store.drafts[routineId];
  const error = getExerciseReplacementError(draft, exerciseId);
  if (error) throw new Error(error);
  if (NECK_CIRCUIT_IDS.includes(replacementId)
    || !getAvailableExercises(draft).some((item) => item.id === replacementId)) {
    throw new Error('Выберите другое упражнение из банка, которого ещё нет в тренировке');
  }
  const exercise = getExercise(draft, exerciseId);
  const replacement = structuredCloneSafe(getRoutine(routineId).exercises.find((item) => item.id === replacementId)
    || EXERCISE_BANK.find((item) => item.id === replacementId));
  const originId = exercise.replaces || exerciseId;
  if (originId !== replacementId) replacement.replaces = originId;
  const sets = Array.from({ length: replacement.sets }, (_, index) => (
    createSetResult(replacement, findPreviousSet(store.history, routineId, replacementId, index))
  ));
  draft.plan.exercises = draft.plan.exercises.map((item) => item.id === exerciseId ? replacement : item);
  draft.addedExercises = draft.addedExercises.map((item) => item.id === exerciseId ? replacement : item);
  draft.sets = Object.fromEntries(Object.entries(draft.sets).map(([id, results]) => (
    id === exerciseId ? [replacementId, sets] : [id, results]
  )));
  draft.updatedAt = timestamp;
  return draft;
}

export function workoutHasProgress(workout) {
  const routine = getWorkoutRoutine(workout);
  return !!workout.note?.trim() || getActiveWorkoutExercises(workout).some((exercise) => (
    !!exercise.replaces || !routine.exercises.some((item) => item.id === exercise.id) || workout.sets[exercise.id].length > exercise.sets
  ))
    || Object.values(workout.sets).flat().some(setHasProgress);
}

export function finishWorkout(workout, timestamp = Date.now()) {
  const completed = structuredCloneSafe(workout);
  ensureWorkoutPlan(completed);
  const routine = getWorkoutRoutine(completed);
  completed.addedExercises = structuredCloneSafe(getWorkoutExercises(completed)
    .filter((exercise) => !routine.exercises.some((item) => item.id === exercise.id)));
  return {
    ...completed,
    updatedAt: timestamp,
    finishedAt: timestamp
  };
}

export function recordSpecialWorkout(store, routineId, timestamp = Date.now()) {
  const entry = {
    id: createId(timestamp),
    routineId,
    finishedAt: timestamp
  };
  store.specialHistory.push(entry);
  return entry;
}

export function findPreviousSet(history, routineId, exerciseId, setIndex) {
  const previousSet = [...history]
    .filter((workout) => workout.routineId === routineId && workout.finishedAt)
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((workout) => workout.sets?.[exerciseId]?.[setIndex])
    .find((set) => set?.status === 'done');

  return previousSet || null;
}

export function transitionSetStatus(workout, timer, exerciseId, setIndex, requestedStatus, timestamp = Date.now()) {
  const result = workout.sets[exerciseId][setIndex];
  const nextStatus = result.status === requestedStatus ? 'pending' : requestedStatus;
  result.status = nextStatus;

  if (nextStatus !== 'done') return timer;

  const circuitIds = getWorkoutNeckCircuit(workout).exerciseIds;
  if (circuitIds.includes(exerciseId) && exerciseId !== circuitIds.at(-1)) return timer;

  const exercise = getWorkoutExerciseSettings(workout, exerciseId);
  return startTimer(timer, exercise.restSeconds, timestamp);
}

export function countStatuses(workout) {
  const exercises = workout.finishedAt ? getWorkoutExercises(workout) : getActiveWorkoutExercises(workout);
  const results = exercises.flatMap((exercise) => workout.sets[exercise.id] || []);
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
  if (parsed.specialHistory !== undefined && !Array.isArray(parsed.specialHistory)) {
    throw new Error('Неподдерживаемый формат локальных данных');
  }
  const store = {
    ...createInitialStore(),
    ...parsed,
    selectedRoutineId: validRoutine ? parsed.selectedRoutineId : PROGRAM[0].id,
    specialHistory: parsed.specialHistory || [],
    timer: { ...createTimerState(), ...(parsed.timer || {}) }
  };
  for (const workout of [...Object.values(store.drafts), ...store.history]) ensureWorkoutPlan(workout);
  return store;
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

function ensureWorkoutPlan(workout) {
  if (workout.plan) return;
  const routine = getRoutine(workout.routineId);
  const exercises = getWorkoutExercises(workout);
  workout.addedExercises = structuredCloneSafe(exercises
    .filter((exercise) => !routine.exercises.some((item) => item.id === exercise.id)));
  workout.plan = structuredCloneSafe({
    ...routine,
    exercises: exercises.filter((exercise) => routine.exercises.some((item) => item.id === exercise.id)),
    neckCircuit: NECK_CIRCUIT
  });
  // An old draft can consist entirely of exercises that have since been removed.
  if (!workout.plan.exercises.length) {
    workout.plan.exercises = structuredCloneSafe(exercises);
    workout.addedExercises = [];
  }
}

function createId(timestamp) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `workout-${timestamp}-${Math.random().toString(36).slice(2)}`;
}

function previousValue(previous, field, fallback) {
  const value = previous?.[field];
  return value === undefined || value === '' ? fallback : String(value);
}

function planLowerBound(target) {
  const match = target.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function setHasValues(set) {
  return set.weight !== ''
    || set.reps !== undefined && set.reps !== ''
    || set.seconds !== undefined && set.seconds !== ''
    || set.leftReps !== undefined && set.leftReps !== ''
    || set.rightReps !== undefined && set.rightReps !== '';
}

function setHasProgress(set) {
  return set.status !== 'pending'
    || set.edited === true
    || set.prefilled !== true && setHasValues(set)
    || set.rir !== undefined && set.rir !== ''
    || !!set.note?.trim();
}

function structuredCloneSafe(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
