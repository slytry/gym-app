import test from 'node:test';
import assert from 'node:assert/strict';

import {
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
