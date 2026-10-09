import test from 'node:test';
import assert from 'node:assert/strict';

import { getActiveWorkoutExercises, getAvailableExercises } from '../program.js';
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
  assert.strictEqual(addWorkoutExercise(store, 'legs-a', 'bench-press', 200), draft);
  assert.equal(draft.updatedAt, 200);
  assert.deepEqual(getActiveWorkoutExercises(draft).map((exercise) => exercise.id), [...before, 'bench-press']);
  assert.equal(draft.sets['bench-press'].length, 4);
  assert.equal(draft.sets['bench-press'][0].reps, '5');
  assert.equal(countStatuses(draft).total, 20);
  assert.equal(workoutHasProgress(draft), true);
  assert.equal(getAvailableExercises(draft).some((exercise) => exercise.id === 'bench-press'), false);

  draft.sets['bench-press'][0].weight = '20';
  addWorkoutExercise(store, 'legs-a', 'bench-press', 300);
  assert.equal(draft.sets['bench-press'][0].weight, '20');
  assert.equal(draft.updatedAt, 200);
  const friday = ensureDraft(store, 'back-b', 400);
  addWorkoutExercise(store, 'back-b', 'hyperextension', 500);
  assert.equal(friday.sets.hyperextension.length, 2);
  assert.equal(countStatuses(friday).total, 21);
});

test('сохраняет добавленное упражнение, дополнительные подходы, таймер и экспорт без изменения базового плана', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'overhead-press', 100);
  addWorkoutSet(store, 'legs-a', 'overhead-press', 200);
  draft.sets['overhead-press'][3].weight = '16';
  draft.sets['overhead-press'][3].reps = '8';
  store.timer = transitionSetStatus(draft, store.timer, 'overhead-press', 3, 'done', 300);
  assert.equal(store.timer.deadline, 90_300);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  assert.equal(saveStore(storage, store).ok, true);
  const loaded = loadStore(storage).store;
  const restored = ensureDraft(loaded, 'legs-a', 400);
  assert.equal(restored.sets['overhead-press'].length, 4);
  assert.equal(countStatuses(restored).total, 20);
  loaded.history.push(finishWorkout(restored, 500));
  const markdown = workoutToMarkdown(loaded.history[0]);
  assert.match(markdown, /## Жим штанги стоя/);
  assert.match(markdown, /Подход 4: 16 кг, общий вес × 8 повт\./);
  startNewDraft(loaded, 'legs-a', 600);
  assert.equal(loaded.drafts['legs-a'].sets['overhead-press'], undefined);
  assert.equal(loaded.history[0].sets['overhead-press'].length, 4);
});

test('предзаполняет добавленное упражнение из истории той же тренировки', () => {
  const store = createInitialStore();
  const previous = addWorkoutExercise(store, 'legs-a', 'bench-press', 100);
  previous.sets['bench-press'][0] = { status: 'done', weight: '22', reps: '8' };
  store.history.push(finishWorkout(previous, 200));
  startNewDraft(store, 'legs-a', 300);
  const next = addWorkoutExercise(store, 'legs-a', 'bench-press', 400);
  assert.equal(next.sets['bench-press'][0].weight, '22');
  assert.equal(next.sets['bench-press'][0].reps, '8');
  assert.equal(next.sets['bench-press'][0].status, 'pending');
});

test('добавляет удержание с секундными подходами и сохраняет отдых и экспорт', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'plate-pinch-hold', 100);
  assert.equal(draft.sets['plate-pinch-hold'].length, 3);
  assert.equal(draft.sets['plate-pinch-hold'][0].seconds, '0');
  assert.equal(countStatuses(draft).total, 19);
  assert.equal(getAvailableExercises(draft).some((exercise) => exercise.id === 'plate-pinch-hold'), false);
  addWorkoutSet(store, 'legs-a', 'plate-pinch-hold', 200);
  assert.equal(draft.sets['plate-pinch-hold'].length, 4);
  assert.equal(transitionSetStatus(draft, store.timer, 'plate-pinch-hold', 3, 'done', 300).deadline, 60_300);
  assert.match(workoutToMarkdown(finishWorkout(draft, 400)), /## Удержание блинов щипковым хватом/);
});

test('отклоняет неизвестное упражнение до изменения данных', () => {
  const store = createInitialStore();
  assert.throws(() => addWorkoutExercise(store, 'legs-a', 'missing', 100), /Упражнение не найдено в банке/);
  assert.deepEqual(store.drafts, {});
});
