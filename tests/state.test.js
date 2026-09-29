import test from 'node:test';
import assert from 'node:assert/strict';

import { PROGRAM } from '../program.js';
import {
  STORAGE_KEY,
  countStatuses,
  createInitialStore,
  createWorkout,
  ensureDraft,
  findPreviousSet,
  finishWorkout,
  loadStore,
  recordSpecialWorkout,
  saveStore,
  startNewDraft,
  transitionSetStatus,
  workoutHasProgress
} from '../state.js';
import { createTimerState } from '../timer.js';

test('фиксирует отдельные занятия для кистей, не меняя силовую историю и загружая старые данные', () => {
  const store = createInitialStore();
  const first = recordSpecialWorkout(store, 'hands', 1_700_000_000_000);
  const second = recordSpecialWorkout(store, 'foot-ankle', 1_700_000_001_000);

  assert.equal(first.routineId, 'hands');
  assert.equal(first.finishedAt, 1_700_000_000_000);
  assert.notEqual(first.id, second.id);
  assert.equal(second.routineId, 'foot-ankle');
  assert.equal(store.specialHistory.length, 2);
  assert.equal(store.history.length, 0);
  assert.equal(loadStore({ getItem: () => JSON.stringify(store) }).store.specialHistory.length, 2);
  delete store.specialHistory;
  assert.deepEqual(loadStore({ getItem: () => JSON.stringify(store) }).store.specialHistory, []);
});

test('создаёт точную структуру подходов, сторон и направлений шеи', () => {
  const legs = createWorkout('legs-a', 1_700_000_000_000, 'legs');
  const back = createWorkout('back-a', 1_700_000_000_000, 'back');

  assert.equal(legs.sets.squat.length, 3);
  assert.deepEqual(Object.keys(legs.sets['smith-calf-raise'][0]), [
    'status',
    'weight',
    'prefilled',
    'edited',
    'reps'
  ]);
  assert.equal(legs.sets.squat[0].reps, '3');
  assert.equal(legs.sets.squat[0].weight, '');
  assert.equal(legs.sets['smith-calf-raise'][0].reps, '8');
  assert.equal(back.sets['neck-front'][0].seconds, '10');
  assert.equal(legs.sets.squat[0].status, 'pending');
  assert.equal(back.sets['neck-front'].length, 2);
  assert.equal(back.sets['neck-back'].length, 2);
  assert.equal(back.sets['neck-left'].length, 2);
  assert.equal(back.sets['neck-right'].length, 2);
  assert.equal(PROGRAM.length, 4);
});

test('предыдущее значение берётся из последнего выполненного подхода через пропуски и pending', () => {
  const older = finishWorkout(createWorkout('legs-a', 100, 'old'), 200);
  const skipped = finishWorkout(createWorkout('legs-a', 300, 'skipped'), 400);
  const pending = finishWorkout(createWorkout('legs-a', 500, 'pending'), 600);
  older.sets.squat[0] = { status: 'done', weight: '80', reps: '5' };
  skipped.sets.squat[0] = { status: 'skipped', weight: '82.5', reps: '4' };
  pending.sets.squat[0] = { status: 'pending', weight: '85', reps: '3' };

  assert.deepEqual(findPreviousSet([skipped, older, pending], 'legs-a', 'squat', 0), older.sets.squat[0]);
  assert.equal(findPreviousSet([skipped, older, pending], 'back-a', 'weighted-pullup', 0), null);
});

test('старый черновик сохраняет записи с гантелью, но новый подъём в Смите начинает отдельно', () => {
  const store = createInitialStore();
  const draft = createWorkout('legs-a', 100, 'old');
  delete draft.sets['smith-calf-raise'];
  draft.sets['single-calf-raise'] = [
    { status: 'done', weight: '12', leftReps: '10', rightReps: '10' },
    { status: 'pending', weight: '', leftReps: '8', rightReps: '8' }
  ];
  store.drafts['legs-a'] = draft;

  assert.strictEqual(ensureDraft(store, 'legs-a'), draft);
  assert.equal(draft.sets['single-calf-raise'][0].weight, '12');
  assert.equal(draft.sets['smith-calf-raise'][0].reps, '8');
  assert.equal(draft.sets['smith-calf-raise'][0].weight, '');
  assert.equal(countStatuses(draft).total, 10);
});

test('предзаполняет нулевой вес и значения сторон и секунд с fallback по плану', () => {
  const legsHistory = finishWorkout(createWorkout('legs-a', 100, 'legs-history'), 200);
  legsHistory.sets.squat[0] = { status: 'done', weight: 0, reps: '' };
  legsHistory.sets['smith-calf-raise'][0] = {
    status: 'done',
    weight: '',
    reps: '11'
  };

  const legs = createWorkout('legs-a', 300, 'legs-next', [legsHistory]);
  assert.equal(legs.sets.squat[0].weight, '0');
  assert.equal(legs.sets.squat[0].reps, '3');
  assert.equal(legs.sets['smith-calf-raise'][0].weight, '');
  assert.equal(legs.sets['smith-calf-raise'][0].reps, '11');

  const backHistory = finishWorkout(createWorkout('back-a', 400, 'back-history'), 500);
  backHistory.sets['neck-front'][0] = { status: 'done', weight: '', seconds: '13' };
  backHistory.sets['neck-back'][0] = { status: 'done', weight: '', seconds: '' };
  const back = createWorkout('back-a', 600, 'back-next', [backHistory]);
  assert.equal(back.sets['neck-front'][0].seconds, '13');
  assert.equal(back.sets['neck-back'][0].seconds, '10');
  assert.equal(back.sets['neck-front'][0].status, 'pending');
});

test('ensure и явное создание нового черновика предзаполняют только при создании', () => {
  const store = createInitialStore();
  const previous = finishWorkout(createWorkout('legs-a', 100, 'previous'), 200);
  previous.sets.squat[0] = { status: 'done', weight: '80', reps: '5' };
  store.history.push(previous);

  const ensured = ensureDraft(store, 'legs-a', 300);
  assert.equal(ensured.sets.squat[0].weight, '80');
  ensured.sets.squat[0].weight = '77.5';
  assert.equal(ensureDraft(store, 'legs-a', 400).sets.squat[0].weight, '77.5');

  const latest = finishWorkout(createWorkout('legs-a', 500, 'latest'), 600);
  latest.sets.squat[0] = { status: 'done', weight: '82.5', reps: '4' };
  store.history.push(latest);
  const replacement = startNewDraft(store, 'legs-a', 700);
  assert.equal(replacement.sets.squat[0].weight, '82.5');
  assert.equal(replacement.sets.squat[0].reps, '4');
  assert.equal(replacement.sets.squat[0].status, 'pending');
});

test('предзаполнение не считается прогрессом, а редактирование считается', () => {
  const workout = createWorkout('legs-b', 100, 'draft');
  assert.equal(workoutHasProgress(workout), false);

  workout.sets.deadlift[0].weight = '120';
  workout.sets.deadlift[0].reps = '3';
  workout.sets.deadlift[0].prefilled = false;
  workout.sets.deadlift[0].edited = true;

  assert.equal(workout.sets.deadlift[0].status, 'pending');
  assert.equal(workoutHasProgress(workout), true);
});

test('сохраняет намеренно очищенные поля черновика без повторного заполнения', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  const store = createInitialStore();
  const previous = finishWorkout(createWorkout('legs-a', 100, 'previous'), 200);
  previous.sets.squat[0] = { status: 'done', weight: '80', reps: '5' };
  store.history.push(previous);

  const draft = ensureDraft(store, 'legs-a', 300);
  draft.sets.squat[0].weight = '';
  draft.sets.squat[0].prefilled = false;
  draft.sets.squat[0].edited = true;
  saveStore(storage, store);

  const loaded = loadStore(storage).store;
  assert.equal(ensureDraft(loaded, 'legs-a', 400).sets.squat[0].weight, '');
  assert.equal(workoutHasProgress(loaded.drafts['legs-a']), true);
});

test('переход статуса запускает таймер только при входе в done', () => {
  const workout = createWorkout('legs-a', 100, 'status');
  const idle = createTimerState();
  const started = transitionSetStatus(workout, idle, 'squat', 0, 'done', 1_000);

  assert.equal(workout.sets.squat[0].status, 'done');
  assert.equal(started.mode, 'running');
  assert.equal(started.durationMs, 180_000);
  assert.equal(started.deadline, 181_000);

  const toggledOff = transitionSetStatus(workout, started, 'squat', 0, 'done', 2_000);
  assert.equal(workout.sets.squat[0].status, 'pending');
  assert.strictEqual(toggledOff, started);

  const skipped = transitionSetStatus(workout, toggledOff, 'squat', 0, 'skipped', 3_000);
  assert.equal(workout.sets.squat[0].status, 'skipped');
  assert.strictEqual(skipped, started);

  const restarted = transitionSetStatus(workout, skipped, 'squat', 0, 'done', 4_000);
  assert.equal(restarted.deadline, 184_000);
  const changedToSkipped = transitionSetStatus(workout, restarted, 'squat', 0, 'skipped', 5_000);
  assert.strictEqual(changedToSkipped, restarted);
});

test('все упражнения имеют явную автодлительность отдыха по категории', () => {
  assert.equal(PROGRAM.every((routine) => routine.exercises.every((exercise) => Number.isFinite(exercise.restSeconds))), true);
  assert.equal(PROGRAM[0].exercises.find((exercise) => exercise.id === 'squat').restSeconds, 180);
  assert.equal(PROGRAM[0].exercises.find((exercise) => exercise.id === 'leg-curl').restSeconds, 120);
  assert.equal(PROGRAM[1].exercises.find((exercise) => exercise.id === 'dumbbell-bench').restSeconds, 90);
  assert.equal(PROGRAM[0].exercises.find((exercise) => exercise.id === 'reverse-wrist-curl').restSeconds, 60);
  assert.equal(PROGRAM[1].exercises.find((exercise) => exercise.id === 'neck-front').restSeconds, 30);
});

test('таймер для шеи стартует только после последнего направления круга', () => {
  const workout = createWorkout('back-a', 100, 'neck-circuit');
  const idle = createTimerState();
  for (const id of ['neck-front', 'neck-back', 'neck-left']) {
    assert.strictEqual(transitionSetStatus(workout, idle, id, 0, 'done', 1000), idle);
  }
  const resting = transitionSetStatus(workout, idle, 'neck-right', 0, 'done', 1000);
  assert.equal(resting.mode, 'running');
  assert.equal(resting.durationMs, 30_000);
  assert.strictEqual(transitionSetStatus(workout, resting, 'neck-front', 1, 'done', 2000), resting);
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
