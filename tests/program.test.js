import test from 'node:test';
import assert from 'node:assert/strict';

import definition from '../program.json' with { type: 'json' };
import { getAvailableExercises, getRoutine, validateProgram } from '../program.js';
import {
  addWorkoutSet,
  createInitialStore,
  createWorkout,
  ensureDraft,
  finishWorkout,
  loadStore,
  saveStore,
  transitionSetStatus
} from '../state.js';
import { createTimerState } from '../timer.js';
import { workoutToMarkdown } from '../export.js';

test('проверка программы отклоняет неоднозначные идентификаторы, неверные подходы, ссылки и расписание', () => {
  const invalid = [
    (data) => { data.routines[1].id = data.routines[0].id; },
    (data) => { data.routines[0].id = 'constructor'; },
    (data) => { data.routines[0].exercises[1].id = data.routines[0].exercises[0].id; },
    (data) => { data.routines[0].exercises[0].sets = 0; },
    (data) => { data.routines[0].exercises[0].restSeconds = -30; },
    (data) => { data.routines[0].exercises[0].kind = 'unknown'; },
    (data) => { data.routines[0].exercises[0].links[0].url = 'javascript:alert(1)'; },
    (data) => { data.schedule[0].routineId = 'missing'; },
    (data) => { data.neckCircuit.exerciseIds.push('missing'); },
    (data) => { data.routines[1].exercises.find((exercise) => exercise.id === 'neck-right').sets = 3; }
  ];
  for (const change of invalid) {
    const data = structuredClone(definition);
    change(data);
    assert.throws(() => validateProgram(data), /program\.json/);
  }
});

test('обновление программы влияет на новые тренировки, но не меняет черновик, таймер и экспорт истории', () => {
  const routine = getRoutine('back-b');
  const exercise = routine.exercises[0];
  const original = structuredClone(exercise);
  const name = routine.name;
  const store = createInitialStore();
  const draft = ensureDraft(store, 'back-b', 100);
  draft.sets[exercise.id][0] = { status: 'done', weight: '24', reps: '8' };
  store.history.push(finishWorkout(draft, 200));
  const exported = workoutToMarkdown(store.history[0]);

  try {
    routine.name = 'Обновлённая программа';
    exercise.name = 'Обновлённое упражнение';
    exercise.sets = 5;
    exercise.target = '20–30 повторов';
    exercise.restSeconds = 15;
    routine.exercises.push({ ...exercise, id: 'new-exercise' });

    const memory = new Map();
    const storage = {
      getItem: (key) => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    };
    assert.equal(saveStore(storage, store).ok, true);
    const loaded = loadStore(storage).store;
    assert.equal(workoutToMarkdown(loaded.history[0]), exported);
    const restored = ensureDraft(loaded, 'back-b', 300);
    assert.equal(restored.sets[exercise.id].length, 3);
    assert.equal(restored.sets['new-exercise'], undefined);
    assert.equal(getAvailableExercises(restored).some((item) => item.id === exercise.id), false);
    addWorkoutSet(loaded, 'back-b', exercise.id, 400);
    assert.equal(restored.sets[exercise.id][3].reps, '6');
    const timer = transitionSetStatus(restored, createTimerState(), exercise.id, 3, 'done', 500);
    assert.equal(timer.deadline, 180_500);

    const next = createWorkout('back-b', 600);
    assert.equal(next.sets[exercise.id].length, 5);
    assert.equal(next.sets[exercise.id][0].reps, '20');
    assert.equal(next.sets['new-exercise'].length, 5);
  } finally {
    routine.exercises.pop();
    routine.name = name;
    Object.assign(exercise, original);
  }
});

test('старые записи получают снимок доступного плана без потери результатов и архивных упражнений', () => {
  const store = createInitialStore();
  const draft = createWorkout('legs-a', 100, 'old-draft');
  const history = finishWorkout(createWorkout('back-b', 200, 'old-history'), 300);
  delete draft.plan;
  delete draft.addedExercises;
  delete history.plan;
  delete history.addedExercises;
  history.sets.shrug = [{ status: 'done', weight: '24', reps: '10' }];
  draft.sets.squat[0].weight = '80';
  store.drafts['legs-a'] = draft;
  store.history.push(history);

  const loaded = loadStore({ getItem: () => JSON.stringify(store) });
  assert.equal(loaded.error, null);
  assert.equal(loaded.store.drafts['legs-a'].plan.name, 'Ноги А — присед');
  assert.equal(loaded.store.drafts['legs-a'].sets.squat[0].weight, '80');
  assert.equal(loaded.store.history[0].addedExercises.find((exercise) => exercise.id === 'shrug').name, 'Шраги с гантелями');
  assert.match(workoutToMarkdown(loaded.store.history[0]), /24 кг на одну гантель × 10 повт\./);
});

test('отключение круга в файле допустимо, а неполный круг отклоняется', () => {
  const data = structuredClone(definition);
  const ids = data.neckCircuit.exerciseIds;
  data.routines[1].exercises = data.routines[1].exercises.filter((exercise) => !ids.includes(exercise.id));
  assert.throws(() => validateProgram(data), /program\.json/);
  data.neckCircuit = null;
  assert.doesNotThrow(() => validateProgram(data));
});
