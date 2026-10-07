import test from 'node:test';
import assert from 'node:assert/strict';

import { NECK_CIRCUIT_IDS, getActiveWorkoutExercises, getAvailableExercises } from '../program.js';
import {
  addWorkoutExercise,
  addWorkoutSet,
  countStatuses,
  createInitialStore,
  ensureDraft,
  finishWorkout,
  loadStore,
  saveStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from '../state.js';
import { workoutToMarkdown } from '../export.js';

test('добавляет упражнение из банка в конец тренировки и не дублирует упражнения с тем же названием', () => {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-a', 100);
  const before = getActiveWorkoutExercises(draft).map((exercise) => exercise.id);
  assert.strictEqual(addWorkoutExercise(store, 'legs-a', 'dumbbell-bench', 200), draft);
  assert.equal(draft.updatedAt, 200);
  assert.deepEqual(getActiveWorkoutExercises(draft).map((exercise) => exercise.id), [...before, 'dumbbell-bench']);
  assert.equal(draft.sets['dumbbell-bench'].length, 2);
  assert.equal(draft.sets['dumbbell-bench'][0].reps, '6');
  assert.equal(countStatuses(draft).total, 12);
  assert.equal(workoutHasProgress(draft), true);
  assert.equal(getAvailableExercises(draft).some((exercise) => exercise.id === 'dumbbell-bench'), false);

  draft.sets['dumbbell-bench'][0].weight = '20';
  addWorkoutExercise(store, 'legs-a', 'dumbbell-bench', 300);
  assert.equal(draft.sets['dumbbell-bench'][0].weight, '20');
  assert.equal(draft.updatedAt, 200);
  const friday = ensureDraft(store, 'back-b', 400);
  addWorkoutExercise(store, 'back-b', 'chest-row-a', 500);
  assert.equal(friday.sets['chest-row-a'], undefined);
  assert.equal(countStatuses(friday).total, 7);
});

test('сохраняет добавленное упражнение, дополнительные подходы, таймер и экспорт без изменения базового плана', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'seated-press', 100);
  addWorkoutSet(store, 'legs-a', 'seated-press', 200);
  draft.sets['seated-press'][2].weight = '16';
  draft.sets['seated-press'][2].reps = '8';
  store.timer = transitionSetStatus(draft, store.timer, 'seated-press', 2, 'done', 300);
  assert.equal(store.timer.deadline, 120_300);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  assert.equal(saveStore(storage, store).ok, true);
  const loaded = loadStore(storage).store;
  const restored = ensureDraft(loaded, 'legs-a', 400);
  assert.equal(restored.sets['seated-press'].length, 3);
  assert.equal(countStatuses(restored).total, 13);
  loaded.history.push(finishWorkout(restored, 500));
  const markdown = workoutToMarkdown(loaded.history[0]);
  assert.match(markdown, /## Жим гантелей сидя/);
  assert.match(markdown, /Подход 3: 16 кг на одну гантель × 8 повт\./);
  startNewDraft(loaded, 'legs-a', 600);
  assert.equal(loaded.drafts['legs-a'].sets['seated-press'], undefined);
  assert.equal(loaded.history[0].sets['seated-press'].length, 3);
});

test('предзаполняет добавленное упражнение из истории той же тренировки', () => {
  const store = createInitialStore();
  const previous = addWorkoutExercise(store, 'legs-a', 'dumbbell-bench', 100);
  previous.sets['dumbbell-bench'][0] = { status: 'done', weight: '22', reps: '8' };
  store.history.push(finishWorkout(previous, 200));
  startNewDraft(store, 'legs-a', 300);
  const next = addWorkoutExercise(store, 'legs-a', 'dumbbell-bench', 400);
  assert.equal(next.sets['dumbbell-bench'][0].weight, '22');
  assert.equal(next.sets['dumbbell-bench'][0].reps, '8');
  assert.equal(next.sets['dumbbell-bench'][0].status, 'pending');
});

test('добавляет шею полным кругом в другой день и сохраняет отдых после последнего направления', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'neck-front', 100);
  assert.equal(NECK_CIRCUIT_IDS.every((id) => draft.sets[id].length === 2), true);
  assert.equal(countStatuses(draft).total, 18);
  assert.equal(getAvailableExercises(draft).some((exercise) => NECK_CIRCUIT_IDS.includes(exercise.id)), false);
  addWorkoutSet(store, 'legs-a', 'neck-front', 200);
  assert.equal(NECK_CIRCUIT_IDS.every((id) => draft.sets[id].length === 3), true);
  for (const id of NECK_CIRCUIT_IDS.slice(0, -1)) {
    assert.strictEqual(transitionSetStatus(draft, store.timer, id, 2, 'done', 300), store.timer);
  }
  assert.equal(transitionSetStatus(draft, store.timer, 'neck-right', 2, 'done', 300).deadline, 30_300);
  assert.match(workoutToMarkdown(finishWorkout(draft, 400)), /## Шея — правый висок/);
});

test('отклоняет неизвестное упражнение до изменения данных', () => {
  const store = createInitialStore();
  assert.throws(() => addWorkoutExercise(store, 'legs-a', 'missing', 100), /Упражнение не найдено в банке/);
  assert.deepEqual(store.drafts, {});
});
