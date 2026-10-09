import test from 'node:test';
import assert from 'node:assert/strict';

import { createLegacyWorkout } from './fixtures/legacy-workout.js';
import { PROGRAM, getActiveWorkoutExercises, getAvailableExercises } from '../program.js';
import {
  addWorkoutExercise,
  createInitialStore,
  ensureDraft,
  finishWorkout,
  parseStore,
  replaceWorkoutExercise,
  serializeStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from '../state.js';
import { createBackup, parseBackup } from '../backup.js';
import { workoutToMarkdown } from '../export.js';

test('заменяет упражнение в той же позиции только на это занятие и не возвращает его после загрузки', () => {
  const program = JSON.stringify(PROGRAM);
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-a', 100);
  const ids = getActiveWorkoutExercises(draft).map((exercise) => exercise.id);
  draft.sets['romanian-deadlift'][0] = { status: 'done', weight: '30', reps: '8', rir: '2', note: 'Без боли' };
  const otherSets = structuredClone(draft.sets['romanian-deadlift']);

  assert.strictEqual(replaceWorkoutExercise(store, 'legs-a', 'squat', 'bench-press', 200), draft);
  assert.deepEqual(getActiveWorkoutExercises(draft).map((exercise) => exercise.id), ids.map((id) => id === 'squat' ? 'bench-press' : id));
  assert.equal(draft.sets.squat, undefined);
  assert.equal(draft.sets['bench-press'].length, 4);
  assert.equal(draft.sets['bench-press'][0].reps, '5');
  assert.deepEqual(draft.sets['romanian-deadlift'], otherSets);
  assert.equal(draft.updatedAt, 200);
  assert.equal(JSON.stringify(PROGRAM), program);
  assert.equal(workoutHasProgress(draft), true);
  assert.equal(getAvailableExercises(draft).some((exercise) => exercise.id === 'squat'), true);

  const loaded = parseStore(serializeStore(store));
  const restored = ensureDraft(loaded, 'legs-a', 300);
  assert.equal(restored.sets.squat, undefined);
  assert.equal(restored.plan.exercises[2].id, 'bench-press');
  loaded.history.push(finishWorkout(restored, 400));
  assert.match(workoutToMarkdown(loaded.history[0]), /## Жим лёжа/);
  assert.doesNotMatch(workoutToMarkdown(loaded.history[0]), /## Присед/);
  const next = startNewDraft(loaded, 'legs-a', 500);
  assert.equal(parseBackup(createBackup(loaded, 500)).history[0].plan.exercises[2].id, 'bench-press');
  assert.ok(next.sets.squat);
  assert.equal(next.sets['bench-press'], undefined);
});

test('повторная замена и возврат упражнения не оставляют дубликатов, используют его историю и отдых', () => {
  const store = createInitialStore();
  const previous = addWorkoutExercise(store, 'legs-a', 'overhead-press', 100);
  previous.sets['overhead-press'][0] = { status: 'done', weight: '16', reps: '8' };
  store.history.push(finishWorkout(previous, 200));
  const draft = startNewDraft(store, 'legs-a', 300);
  replaceWorkoutExercise(store, 'legs-a', 'squat', 'bench-press', 400);
  replaceWorkoutExercise(store, 'legs-a', 'bench-press', 'overhead-press', 500);
  assert.equal(draft.sets['bench-press'], undefined);
  assert.equal(draft.sets['overhead-press'][0].weight, '16');
  assert.equal(draft.sets['overhead-press'][0].reps, '8');
  assert.equal(draft.sets['overhead-press'][0].status, 'pending');
  assert.equal(workoutHasProgress(draft), true);
  const timer = transitionSetStatus(structuredClone(draft), store.timer, 'overhead-press', 0, 'done', 600);
  assert.equal(timer.deadline, 90_600);
  replaceWorkoutExercise(store, 'legs-a', 'overhead-press', 'squat', 700);
  assert.equal(draft.sets['overhead-press'], undefined);
  assert.equal(draft.plan.exercises[2].id, 'squat');
  assert.equal(workoutHasProgress(draft), false);

  addWorkoutExercise(store, 'legs-a', 'bench-press', 800);
  replaceWorkoutExercise(store, 'legs-a', 'bench-press', 'overhead-press', 900);
  assert.deepEqual(draft.addedExercises.map((exercise) => exercise.id), ['overhead-press']);
  assert.equal(getActiveWorkoutExercises(draft).at(-1).id, 'overhead-press');
});

test('не удаляет выполненные, пропущенные или вручную записанные результаты при замене', () => {
  const changes = [
    (set) => { set.status = 'done'; },
    (set) => { set.status = 'skipped'; },
    (set) => { set.weight = '80'; set.prefilled = false; },
    (set) => { set.edited = true; },
    (set) => { set.rir = '0'; },
    (set) => { set.note = 'Тяжело'; }
  ];
  for (const change of changes) {
    const store = createInitialStore();
    const draft = ensureDraft(store, 'legs-a', 100);
    change(draft.sets.squat[0]);
    const before = serializeStore(store);
    assert.throws(() => replaceWorkoutExercise(store, 'legs-a', 'squat', 'bench-press', 200), /уже есть записи/i);
    assert.equal(serializeStore(store), before);
  }
});

test('не изменяет журнал при неверном выборе, дубликате, попытке заменить круг шеи или завершённое занятие', () => {
  const store = createInitialStore();
  store.drafts['back-a'] = createLegacyWorkout('back-a', 100);
  const draft = ensureDraft(store, 'back-a', 100);
  const pairs = [['missing', 'squat'], ['weighted-pullup', 'missing'], ['weighted-pullup', 'dumbbell-bench'], ['weighted-pullup', 'neck-front'], ['neck-front', 'squat']];
  for (const [from, to] of pairs) {
    const before = serializeStore(store);
    assert.throws(() => replaceWorkoutExercise(store, 'back-a', from, to, 200));
    assert.equal(serializeStore(store), before);
  }
  store.drafts['back-a'] = finishWorkout(draft, 300);
  const before = serializeStore(store);
  assert.throws(() => replaceWorkoutExercise(store, 'back-a', 'weighted-pullup', 'squat', 400));
  assert.equal(serializeStore(store), before);
});
