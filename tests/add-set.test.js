import test from 'node:test';
import assert from 'node:assert/strict';

import { LEGACY_NECK_IDS as NECK_CIRCUIT_IDS, createLegacyWorkout } from './fixtures/legacy-workout.js';
import {
  addWorkoutSet,
  countStatuses,
  createInitialStore,
  createWorkout,
  ensureDraft,
  finishWorkout,
  loadStore,
  saveStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from '../state.js';
import { workoutToMarkdown } from '../export.js';

test('добавленный подход сохраняется после загрузки, учитывается в прогрессе и не меняет план новой тренировки', () => {
  const store = createInitialStore();
  store.drafts['back-b'] = createLegacyWorkout('back-b', 100);
  const draft = ensureDraft(store, 'back-b', 100);
  draft.sets['chest-row-b'][0].weight = '24';
  const timer = { ...store.timer };

  assert.strictEqual(addWorkoutSet(store, 'back-b', 'chest-row-b', 200), draft);
  assert.equal(draft.updatedAt, 200);
  assert.equal(draft.sets['chest-row-b'].length, 4);
  assert.equal(draft.sets['chest-row-b'][0].weight, '24');
  assert.equal(draft.sets['chest-row-b'][3].reps, '6');
  assert.equal(draft.sets['chest-row-b'][3].status, 'pending');
  assert.equal(workoutHasProgress(draft), true);
  assert.equal(countStatuses(draft).total, 8);
  assert.deepEqual(store.timer, timer);

  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  assert.equal(saveStore(storage, store).ok, true);
  const loaded = loadStore(storage).store;
  const restored = ensureDraft(loaded, 'back-b', 300);
  assert.equal(restored.sets['chest-row-b'].length, 4);
  loaded.timer = transitionSetStatus(restored, loaded.timer, 'chest-row-b', 3, 'done', 400);
  assert.equal(loaded.timer.deadline, 180_400);
  assert.equal(countStatuses(restored).done, 1);
  loaded.history.push(finishWorkout(restored, 500));
  startNewDraft(loaded, 'back-b', 600);
  assert.equal(loaded.drafts['back-b'].sets['chest-row-b'], undefined);
  assert.equal(loaded.drafts['back-b'].sets['front-squat'].length, 3);
  assert.equal(loaded.history[0].sets['chest-row-b'].length, 4);
});

test('предзаполняет дополнительный подход из выполненного подхода с тем же номером и не копирует пропуск', () => {
  const store = createInitialStore();
  const older = finishWorkout(createLegacyWorkout('back-b', 100, 'older'), 200);
  older.sets['dumbbell-bench'].push({ status: 'done', weight: '22', reps: '10' });
  const newer = finishWorkout(createLegacyWorkout('back-b', 300, 'newer'), 400);
  newer.sets['dumbbell-bench'].push({ status: 'skipped', weight: '24', reps: '8' });
  store.history.push(older, newer);

  store.drafts['back-b'] = createLegacyWorkout('back-b', 100);
  const draft = addWorkoutSet(store, 'back-b', 'dumbbell-bench', 500);
  assert.equal(draft.sets['dumbbell-bench'][2].weight, '22');
  assert.equal(draft.sets['dumbbell-bench'][2].reps, '10');
  assert.equal(draft.sets['dumbbell-bench'][2].status, 'pending');
  assert.equal(draft.sets['dumbbell-bench'][2].prefilled, true);
  assert.equal(older.sets['dumbbell-bench'].length, 3);
});

test('для шеи добавляет полный круг и запускает отдых только после последнего направления', () => {
  const store = createInitialStore();
  store.drafts['back-a'] = createLegacyWorkout('back-a', 100);
  const draft = addWorkoutSet(store, 'back-a', 'neck-front', 100);
  for (const id of NECK_CIRCUIT_IDS) {
    assert.equal(draft.sets[id].length, 3);
    assert.equal(draft.sets[id][2].seconds, '10');
  }
  assert.equal(countStatuses(draft).total, 19);
  for (const id of NECK_CIRCUIT_IDS.slice(0, -1)) {
    const timer = transitionSetStatus(draft, store.timer, id, 2, 'done', 200);
    assert.strictEqual(timer, store.timer);
  }
  const timer = transitionSetStatus(draft, store.timer, 'neck-right', 2, 'done', 200);
  assert.equal(timer.deadline, 30_200);
  addWorkoutSet(store, 'back-a', 'neck-right', 300);
  assert.equal(NECK_CIRCUIT_IDS.every((id) => draft.sets[id].length === 4), true);
});

test('экспорт не обрезает дополнительные выполненные, пропущенные и незавершённые подходы', () => {
  const store = createInitialStore();
  store.drafts['back-b'] = createLegacyWorkout('back-b', 100);
  const draft = addWorkoutSet(store, 'back-b', 'dumbbell-bench', 100);
  draft.sets['dumbbell-bench'][2] = { status: 'done', weight: '22', reps: '10' };
  addWorkoutSet(store, 'back-b', 'dumbbell-bench', 200);
  draft.sets['dumbbell-bench'][3].status = 'skipped';
  addWorkoutSet(store, 'back-b', 'dumbbell-bench', 300);

  const markdown = workoutToMarkdown(finishWorkout(draft, 400));
  assert.match(markdown, /План: 2 × 8–12 повторов/);
  assert.match(markdown, /Подход 3: 22 кг на одну гантель × 10 повт\./);
  assert.match(markdown, /Подход 4: пропущен/);
  assert.match(markdown, /Подход 5: не завершён/);
});
