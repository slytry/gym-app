import test from 'node:test';
import assert from 'node:assert/strict';
import { getExercise, getWorkoutExerciseSettings } from '../program.js';
import {
  addWorkoutExercise, createInitialStore, ensureDraft, parseStore,
  replaceWorkoutExercise, serializeStore, transitionSetStatus
} from '../state.js';
import { createBackup, parseBackup } from '../backup.js';

test('добавление одного упражнения из пары даёт обычный отдых и убирает метку и подсказку', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'overhead-press', 100);
  const before = serializeStore(store);
  const exercise = getWorkoutExerciseSettings(draft, 'overhead-press');
  assert.equal(exercise.restSeconds, 90);
  assert.equal(exercise.superset, undefined);
  assert.doesNotMatch(exercise.note || '', /Суперсет|по очереди|после пары/);
  // Monday already contains A1/A2: the same label alone does not make a partner.
  assert.equal(getWorkoutExerciseSettings(draft, 'standing-calf-raise').restSeconds, 15);
  assert.equal(serializeStore(store), before);
  assert.equal(getExercise(draft, 'overhead-press').restSeconds, 15);
  assert.equal(transitionSetStatus(draft, store.timer, 'overhead-press', 0, 'done', 200).deadline, 90_200);
});

test('добавление настоящего партнёра включает пару без изменения сохранённых настроек', () => {
  const store = createInitialStore();
  const draft = addWorkoutExercise(store, 'legs-a', 'overhead-press', 100);
  addWorkoutExercise(store, 'legs-a', 'lat-pulldown', 200);
  const before = serializeStore(store);
  const first = getWorkoutExerciseSettings(draft, 'overhead-press');
  const second = getWorkoutExerciseSettings(draft, 'lat-pulldown');
  assert.equal(first.superset, 'A1');
  assert.equal(first.restSeconds, 15);
  assert.equal(second.superset, 'A2');
  assert.equal(second.restSeconds, 90);
  assert.ok(first.note.includes(second.name) && second.note.includes(first.name));
  assert.equal(serializeStore(store), before);
});

test('замена участника занимает его слот, сохраняет пару и обновляет имя партнёра', () => {
  for (const [from, replacement] of [
    ['lat-pulldown', 'bench-press'], ['overhead-press', 'barbell-row'],
    ['lat-pulldown', 'barbell-wrist-curl']
  ]) {
    const store = createInitialStore();
    const draft = ensureDraft(store, 'legs-b', 100);
    replaceWorkoutExercise(store, 'legs-b', from, replacement, 200);
    const firstId = from === 'overhead-press' ? replacement : 'overhead-press';
    const secondId = from === 'lat-pulldown' ? replacement : 'lat-pulldown';
    const first = getWorkoutExerciseSettings(draft, firstId);
    const second = getWorkoutExerciseSettings(draft, secondId);
    assert.equal(first.superset, 'A1');
    assert.equal(first.restSeconds, 15);
    assert.equal(second.superset, 'A2');
    assert.equal(second.restSeconds, 90);
    assert.ok(first.note.includes(second.name) && second.note.includes(first.name));
    assert.equal(transitionSetStatus(draft, store.timer, firstId, 0, 'done', 300).deadline, 15_300);
    assert.equal(transitionSetStatus(draft, store.timer, secondId, 0, 'done', 400).deadline, 90_400);
    const restored = parseBackup(createBackup(store, 500));
    assert.equal(getWorkoutExerciseSettings(restored.drafts['legs-b'], firstId).superset, 'A1');
    assert.equal(getWorkoutExerciseSettings(restored.drafts['legs-b'], secondId).restSeconds, 90);
  }
});

test('повторная замена обоих участников и возврат исходного упражнения сохраняют слоты пары', () => {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-b', 100);
  replaceWorkoutExercise(store, 'legs-b', 'lat-pulldown', 'bench-press', 200);
  replaceWorkoutExercise(store, 'legs-b', 'bench-press', 'front-squat', 300);
  replaceWorkoutExercise(store, 'legs-b', 'overhead-press', 'barbell-row', 400);
  let restored = parseStore(serializeStore(store)).drafts['legs-b'];
  assert.equal(getWorkoutExerciseSettings(restored, 'front-squat').superset, 'A2');
  assert.equal(getWorkoutExerciseSettings(restored, 'barbell-row').restSeconds, 15);
  replaceWorkoutExercise(store, 'legs-b', 'front-squat', 'lat-pulldown', 500);
  restored = parseStore(serializeStore(store)).drafts['legs-b'];
  assert.equal(getWorkoutExerciseSettings(restored, 'barbell-row').superset, 'A1');
  assert.equal(getWorkoutExerciseSettings(restored, 'lat-pulldown').restSeconds, 90);
});

test('без участника оставшееся упражнение становится одиночным; дополнительные заметки сохраняются', () => {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-b', 100);
  delete draft.sets['lat-pulldown'];
  const orphan = getWorkoutExerciseSettings(draft, 'overhead-press');
  assert.equal(orphan.superset, undefined);
  assert.equal(orphan.restSeconds, 90);
  assert.doesNotMatch(orphan.note || '', /Суперсет|по очереди/);
  assert.equal(transitionSetStatus(draft, store.timer, 'overhead-press', 0, 'done', 200).deadline, 90_200);

  delete draft.sets['barbell-shrug'];
  const farmer = getWorkoutExerciseSettings(draft, 'farmer-walk');
  assert.equal(farmer.superset, undefined);
  assert.equal(farmer.restSeconds, 75);
  assert.match(farmer.note, /30–40 м/);
  assert.doesNotMatch(farmer.note, /Суперсет|по очереди|после пары/);
});

test('замена одиночного участника не создаёт ложную пару с другим A2', () => {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-b', 100);
  delete draft.sets['lat-pulldown'];
  replaceWorkoutExercise(store, 'legs-b', 'overhead-press', 'standing-calf-raise', 200);
  assert.equal(getWorkoutExerciseSettings(draft, 'standing-calf-raise').superset, undefined);
  assert.equal(getWorkoutExerciseSettings(draft, 'standing-calf-raise').restSeconds, 60);
  assert.doesNotMatch(getWorkoutExerciseSettings(draft, 'standing-calf-raise').note || '', /Суперсет/);
});

test('повторное добавление исходного упражнения не забирает слот у замены', () => {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-b', 100);
  replaceWorkoutExercise(store, 'legs-b', 'overhead-press', 'barbell-row', 200);
  addWorkoutExercise(store, 'legs-b', 'overhead-press', 300);
  const added = getWorkoutExerciseSettings(draft, 'overhead-press');
  assert.equal(added.superset, undefined);
  assert.equal(added.restSeconds, 90);
  assert.equal(getWorkoutExerciseSettings(draft, 'barbell-row').superset, 'A1');
  assert.ok(getWorkoutExerciseSettings(draft, 'lat-pulldown').note.includes('Тяга штанги в\u00a0наклоне'));
});
