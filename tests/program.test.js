import test from 'node:test';
import assert from 'node:assert/strict';

import definition from '../program.json' with { type: 'json' };
import legacyDefinition from './fixtures/program-v1.json' with { type: 'json' };
import { createLegacyWorkout } from './fixtures/legacy-workout.js';
import { getActiveWorkoutExercises, getAvailableExercises, getRoutine, validateProgram } from '../program.js';
import { createBackup, parseBackup } from '../backup.js';
import { renderExerciseHistory } from '../history-view.js';
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
    (data) => { data.routines[0].exercises.find((exercise) => exercise.id === 'squat').links[0].url = 'javascript:alert(1)'; },
    (data) => { data.schedule[0].routineId = 'missing'; },
    (data) => { data.neckCircuit = { exerciseIds: ['missing'] }; },
    (data) => { data.routines[0].exercises[2].warmup = 'true'; },
    (data) => { data.routines[0].exercises[0].warmup = true; },
    (data) => { data.routines[0].exercises[0].superset = 'A3'; }
  ];
  for (const change of invalid) {
    const data = structuredClone(definition);
    change(data);
    assert.throws(() => validateProgram(data), /program\.json/);
  }
});

test('обновление программы влияет на новые тренировки, но не меняет черновик, таймер и экспорт истории', () => {
  const routine = getRoutine('back-b');
  const exercise = routine.exercises.find((item) => item.id === 'front-squat');
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
    assert.equal(timer.deadline, 150_500);

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
  assert.equal(loaded.store.drafts['legs-a'].plan.name, getRoutine('legs-a').name);
  assert.equal(loaded.store.drafts['legs-a'].sets.squat[0].weight, '80');
  assert.equal(loaded.store.history[0].addedExercises.find((exercise) => exercise.id === 'shrug').name, 'Шраги с гантелями');
  assert.match(workoutToMarkdown(loaded.store.history[0]), /24 кг на одну гантель × 10 повт\./);
});

test('отключение круга в файле допустимо, а неполный круг отклоняется', () => {
  const data = structuredClone(legacyDefinition);
  const ids = data.neckCircuit.exerciseIds;
  data.routines[1].exercises = data.routines[1].exercises.filter((exercise) => !ids.includes(exercise.id));
  assert.throws(() => validateProgram(data), /program\.json/);
  data.neckCircuit = null;
  assert.doesNotThrow(() => validateProgram(data));
});

test('новая программа: семь дней по расписанию и ровно пять упражнений с разминкой', () => {
  assert.doesNotThrow(() => validateProgram(definition));
  const schedule = definition.schedule.map((entry) => entry.routineId
    ? [getRoutine(entry.routineId).day, getRoutine(entry.routineId).name]
    : [entry.day, entry.activity]);
  assert.deepEqual(schedule.map(([day]) => day), ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
  assert.deepEqual(schedule.filter(([, activity]) => !/йога|отдых/i.test(activity)), [
    ['Пн', 'Ноги: тяжёлый присед'], ['Вт', 'Жим и\u00a0спина'],
    ['Чт', 'Становая'], ['Сб', 'Ноги объёмом и\u00a0жим']
  ]);
  assert.match(schedule[2][1], /Йога.*спокойная/);
  assert.equal(schedule[4][1], 'полный отдых');
  assert.match(schedule[6][1], /Йога.*спокойная/);
  assert.deepEqual(definition.routines.flatMap((routine) => routine.exercises)
    .filter((exercise) => exercise.warmup).map((exercise) => exercise.id).sort(),
  ['squat', 'bench-press', 'deadlift', 'front-squat', 'close-grip-bench'].sort());
  assert.equal(getRoutine('legs-b').exercises.some((exercise) => exercise.id === 'hyperextension'), false);
});

test('дозировки, порядок упражнений и отдых суперсетов соответствуют новому плану', () => {
  const plans = {
    'legs-a': [['knee-to-wall', 1, 30], ['hyperextension', 2, 45], ['squat', 4, 180],
      ['romanian-deadlift', 3, 120], ['standing-calf-raise', 3, 15], ['tibialis-raise', 3, 60]],
    'back-a': [['hyperextension', 2, 45], ['bench-press', 4, 180], ['barbell-row', 3, 120],
      ['weighted-pullup', 3, 15], ['barbell-wrist-curl', 3, 90]],
    'legs-b': [['deadlift', 4, 180], ['overhead-press', 3, 15], ['lat-pulldown', 3, 90],
      ['farmer-walk', 3, 15], ['barbell-shrug', 3, 75]],
    'back-b': [['knee-to-wall', 1, 30], ['hyperextension', 2, 45], ['front-squat', 3, 150],
      ['close-grip-bench', 3, 120], ['leg-press', 3, 15], ['reverse-curl', 3, 75],
      ['single-leg-calf-raise', 3, 15], ['plate-pinch-hold', 3, 60]]
  };
  for (const [id, expected] of Object.entries(plans)) {
    const routine = getRoutine(id);
    assert.deepEqual(routine.exercises.map((exercise) => [exercise.id, exercise.sets, exercise.restSeconds]), expected);
    for (const [index, exercise] of routine.exercises.entries()) {
      assert.ok(exercise.tips.length >= 2 && exercise.tips.length <= 3);
      if (!exercise.superset?.endsWith('1')) continue;
      const partner = routine.exercises[index + 1];
      assert.equal(partner.superset, `${exercise.superset[0]}2`);
      assert.equal(partner.sets, exercise.sets);
      assert.ok(exercise.note.includes(partner.name) && partner.note.includes(exercise.name));
    }
  }
  assert.equal(getRoutine('legs-a').exercises.find((exercise) => exercise.id === 'squat').target, '5 повторов');
  assert.equal(getRoutine('legs-b').exercises[0].target, '3 повтора');
  const farmer = createWorkout('legs-b', 100);
  assert.equal(farmer.sets['farmer-walk'][0].seconds, '');
  assert.equal(farmer.sets['farmer-walk'][0].weight, '');
  assert.equal(createWorkout('back-b', 100).sets['plate-pinch-hold'][0].seconds, '0');
  farmer.sets['farmer-walk'][0] = { status: 'done', weight: '24', seconds: '', note: '35 м' };
  assert.match(workoutToMarkdown(farmer), /24 кг на одну руку · заметка: 35 м/);
});

test('снимки старой программы сохраняют удалённые упражнения, круг шеи и экспорт через JSON-бэкап', () => {
  const store = createInitialStore();
  store.drafts['back-a'] = createLegacyWorkout('back-a', 100, 'old-tuesday');
  store.history.push(finishWorkout(createLegacyWorkout('back-b', 200, 'old-friday'), 300));
  const before = workoutToMarkdown(store.history[0]);
  const restored = parseBackup(createBackup(store, 400));
  assert.deepEqual(restored, store);
  assert.equal(workoutToMarkdown(restored.history[0]), before);
  assert.equal(ensureDraft(restored, 'back-a', 500).sets['bench-press'], undefined);
  assert.equal(restored.drafts['back-a'].plan.neckCircuit.exerciseIds.length, 4);
  assert.match(renderExerciseHistory(restored.history, 'back-b', restored.history[0].plan.exercises[0]), /История/);
});

test('старые черновики без снимка не теряют удалённые упражнения и не получают новый план вперемешку', () => {
  const store = createInitialStore();
  const draft = createLegacyWorkout('back-b', 100, 'no-snapshot');
  draft.sets['chest-row-b'][0] = { status: 'done', weight: '24', reps: '8' };
  delete draft.plan;
  delete draft.addedExercises;
  store.drafts['back-b'] = draft;
  const restored = loadStore({ getItem: () => JSON.stringify(store) });
  assert.equal(restored.error, null);
  const loaded = ensureDraft(restored.store, 'back-b', 200);
  assert.deepEqual(Object.keys(loaded.sets), Object.keys(draft.sets));
  assert.deepEqual(getActiveWorkoutExercises(loaded).map((exercise) => exercise.id), Object.keys(draft.sets));
  assert.match(workoutToMarkdown(loaded), /Тяга с упором грудью/);
  assert.equal(transitionSetStatus(loaded, createTimerState(), 'chest-row-b', 1, 'done', 300).deadline, 180_300);
  assert.doesNotThrow(() => parseBackup(createBackup(restored.store, 400)));
  restored.store.history.push(finishWorkout(loaded, 500));
  assert.match(renderExerciseHistory(restored.store.history, 'back-b', loaded.plan.exercises[0]), /24 кг на одну гантель/);
});
