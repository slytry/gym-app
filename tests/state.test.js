import test from 'node:test';
import assert from 'node:assert/strict';

import { PROGRAM } from '../program.js';
import {
  STORAGE_KEY,
  createInitialStore,
  createWorkout,
  findPreviousSet,
  finishWorkout,
  loadStore,
  saveStore,
  workoutHasProgress
} from '../state.js';

test('создаёт точную структуру подходов, сторон и направлений шеи', () => {
  const legs = createWorkout('legs-a', 1_700_000_000_000, 'legs');
  const back = createWorkout('back-a', 1_700_000_000_000, 'back');

  assert.equal(legs.sets.squat.length, 3);
  assert.deepEqual(Object.keys(legs.sets['single-calf-raise'][0]), ['status', 'weight', 'leftReps', 'rightReps']);
  assert.equal(back.sets['neck-front'].length, 2);
  assert.equal(back.sets['neck-back'].length, 2);
  assert.equal(back.sets['neck-left'].length, 2);
  assert.equal(back.sets['neck-right'].length, 2);
  assert.equal(PROGRAM.length, 4);
});

test('предыдущее значение берётся только из последней завершённой тренировки', () => {
  const older = finishWorkout(createWorkout('legs-a', 100, 'old'), 200);
  const newer = finishWorkout(createWorkout('legs-a', 300, 'new'), 400);
  older.sets.squat[0] = { status: 'done', weight: '80', reps: '5' };
  newer.sets.squat[0] = { status: 'done', weight: '82.5', reps: '4' };

  assert.deepEqual(findPreviousSet([newer, older], 'legs-a', 'squat', 0), newer.sets.squat[0]);
  assert.equal(findPreviousSet([newer, older], 'back-a', 'weighted-pullup', 0), null);
});

test('введённые числа не помечают подход выполненным автоматически', () => {
  const workout = createWorkout('legs-b', 100, 'draft');
  workout.sets.deadlift[0].weight = '120';
  workout.sets.deadlift[0].reps = '3';

  assert.equal(workout.sets.deadlift[0].status, 'pending');
  assert.equal(workoutHasProgress(workout), true);
});

test('сохраняет и загружает store через storage adapter', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  const store = createInitialStore();
  store.history.push(finishWorkout(createWorkout('back-b', 100, 'saved'), 200));

  assert.equal(saveStore(storage, store).ok, true);
  assert.equal(memory.has(STORAGE_KEY), true);
  assert.equal(loadStore(storage).store.history[0].id, 'saved');
});

test('ошибка storage возвращается явно и не выдаётся за сохранение', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); }
  };

  assert.match(loadStore(storage).error, /blocked/);
  const result = saveStore(storage, createInitialStore());
  assert.equal(result.ok, false);
  assert.match(result.error, /quota/);
});
