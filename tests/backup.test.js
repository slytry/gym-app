import test from 'node:test';
import assert from 'node:assert/strict';
import { createLegacyWorkout } from './fixtures/legacy-workout.js';
import { getRoutine } from '../program.js?v=22';
import { createBackup, parseBackup, restoreBackup } from '../backup.js';
import { STORAGE_KEY, createInitialStore, ensureDraft, finishWorkout, recordSpecialWorkout, startNewDraft } from '../state.js';

function savedStore() {
  const store = createInitialStore();
  const draft = ensureDraft(store, 'legs-a', 100);
  draft.note = 'Утром';
  draft.sets.squat[0] = { status: 'done', weight: '80', reps: '5', rir: '2', note: 'Без рывка' };
  store.history.push(finishWorkout(draft, 200));
  startNewDraft(store, 'legs-a', 250);
  recordSpecialWorkout(store, 'hands', 300);
  recordSpecialWorkout(store, 'foot-ankle', 400);
  return store;
}

test('JSON-бэкап восстанавливает историю, черновики, снимки программы, RIR, заметки и специализированные занятия', () => {
  const original = savedStore();
  const file = createBackup(original, 500);
  assert.deepEqual(parseBackup(file), original);
  const memory = new Map();
  const result = restoreBackup({ setItem: (key, value) => memory.set(key, value) }, file);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(memory.get(STORAGE_KEY)), original);
  result.store.history[0].sets.squat[0].weight = '90';
  assert.equal(original.history[0].sets.squat[0].weight, '80');
});

test('неверный бэкап не пишет в хранилище, включая повреждённые подходы, даты и небезопасные ссылки', () => {
  const invalid = [
    (backup) => { backup.version = 99; },
    (backup) => { backup.state.drafts = null; },
    (backup) => { backup.state.history[0].sets.squat = {}; },
    (backup) => { backup.state.history[0].sets.squat[0].rir = '11'; },
    (backup) => { backup.state.history[0].sets.squat[0].weight = '-80'; },
    (backup) => { backup.state.history[0].finishedAt = 'вчера'; },
    (backup) => { backup.state.history.push(structuredClone(backup.state.history[0])); },
    (backup) => { backup.state.specialHistory[0].routineId = 'unknown'; },
    (backup) => { backup.state.history[0].plan.exercises[0].image = 'javascript:alert(1)'; },
    (backup) => { backup.state.drafts['legs-a'].sets.unknown = [{ status: 'done' }]; }
  ];
  for (const change of invalid) {
    const backup = JSON.parse(createBackup(savedStore(), 500));
    change(backup);
    let writes = 0;
    const result = restoreBackup({ setItem() { writes += 1; } }, JSON.stringify(backup));
    assert.equal(result.ok, false);
    assert.equal(writes, 0);
  }
  assert.throws(() => parseBackup(''), /бэкап/i);
  assert.throws(() => parseBackup('{'), /JSON/);
});

test('ошибка сохранения не выдаётся за восстановление', () => {
  const result = restoreBackup({ setItem() { throw new Error('quota'); } }, createBackup(savedStore(), 500));
  assert.equal(result.ok, false);
  assert.equal(result.store, undefined);
  assert.match(result.error, /quota/);
});

test('восстановление сохраняет старый снимок программы и локальную дату, даже если текущий план или часовой пояс отличаются', () => {
  const store = savedStore();
  store.history[0].date = '1970-01-02';
  const raw = createBackup(store, 500);
  const routine = getRoutine('legs-a');
  const name = routine.name;
  try {
    routine.name = 'Новый план';
    assert.deepEqual(parseBackup(raw), store);
  } finally { routine.name = name; }
});

test('неполный круг шеи не принимается как черновик', () => {
  const store = createInitialStore();
  store.drafts['back-a'] = createLegacyWorkout('back-a', 100);
  const raw = JSON.parse(createBackup(store, 500));
  delete raw.state.drafts['back-a'].sets['neck-right'];
  assert.throws(() => parseBackup(JSON.stringify(raw)), /круг шеи/);
});
