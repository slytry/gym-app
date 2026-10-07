import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addTimerSeconds,
  createTimerState,
  formatTimer,
  pauseTimer,
  resetTimer,
  resumeTimer,
  settleTimer,
  startTimer
} from '../timer.js';

test('deadline определяет остаток после перезагрузки или скрытия страницы', () => {
  const timer = startTimer(createTimerState(), 90, 1_000);
  assert.equal(timer.deadline, 91_000);
  assert.equal(settleTimer(timer, 31_000).timer.remainingMs, 60_000);
});

test('pause и resume не считают время паузы', () => {
  const started = startTimer(createTimerState(), 120, 10_000);
  const paused = pauseTimer(started, 40_000);
  const resumed = resumeTimer(paused, 100_000);

  assert.equal(paused.remainingMs, 90_000);
  assert.equal(resumed.deadline, 190_000);
  assert.equal(settleTimer(resumed, 130_000).timer.remainingMs, 60_000);
});

test('завершение и сброс имеют явные состояния', () => {
  const started = startTimer(createTimerState(), 60, 0);
  const settled = settleTimer(started, 61_000);

  assert.equal(settled.finishedNow, true);
  assert.equal(settled.timer.mode, 'finished');
  assert.equal(formatTimer(settled.timer.remainingMs), '0:00');
  assert.deepEqual(resetTimer(settled.timer), {
    mode: 'idle',
    durationMs: 60_000,
    remainingMs: 60_000,
    deadline: null
  });
});

test('+30 продлевает deadline, учитывает прошедшее время и сохраняется после загрузки', () => {
  const started = startTimer(createTimerState(), 90, 1_000);
  const extended = addTimerSeconds(started, 30, 31_000);
  assert.equal(extended.mode, 'running');
  assert.equal(extended.deadline, 121_000);
  assert.equal(extended.remainingMs, 90_000);
  assert.equal(extended.durationMs, 120_000);
  assert.equal(started.deadline, 91_000);

  const repeated = addTimerSeconds(extended, 30, 41_000);
  const restored = JSON.parse(JSON.stringify(repeated));
  assert.equal(restored.deadline, 151_000);
  assert.equal(settleTimer(restored, 61_000).timer.remainingMs, 90_000);
});

test('+30 не запускает готовый таймер и не снимает паузу', () => {
  const idle = addTimerSeconds(createTimerState(), 30, 1_000);
  assert.equal(idle.mode, 'idle');
  assert.equal(idle.remainingMs, 120_000);
  assert.equal(idle.durationMs, 120_000);
  assert.equal(idle.deadline, null);

  const paused = pauseTimer(startTimer(createTimerState(), 90, 1_000), 46_000);
  const extended = addTimerSeconds(paused, 30, 100_000);
  assert.equal(extended.mode, 'paused');
  assert.equal(extended.remainingMs, 75_000);
  assert.equal(extended.deadline, null);
  assert.equal(resumeTimer(extended, 200_000).deadline, 275_000);
});

test('+30 после окончания запускает только добавленное время, включая ещё не обновлённый таймер', () => {
  const started = startTimer(createTimerState(), 90, 1_000);
  const finished = settleTimer(started, 91_000).timer;
  for (const timer of [finished, started]) {
    const extended = addTimerSeconds(timer, 30, 100_000);
    assert.equal(extended.mode, 'running');
    assert.equal(extended.remainingMs, 30_000);
    assert.equal(extended.durationMs, 30_000);
    assert.equal(extended.deadline, 130_000);
  }
});
