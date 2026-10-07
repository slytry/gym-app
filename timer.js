export function createTimerState() {
  return {
    mode: 'idle',
    durationMs: 90_000,
    remainingMs: 90_000,
    deadline: null
  };
}

export function startTimer(timer, seconds, now = Date.now()) {
  const durationMs = Math.max(0, Number(seconds) * 1000);
  return {
    mode: 'running',
    durationMs,
    remainingMs: durationMs,
    deadline: now + durationMs
  };
}

export function addTimerSeconds(timer, seconds, now = Date.now()) {
  const current = settleTimer(timer, now).timer;
  if (current.mode === 'finished') return startTimer(current, seconds, now);

  const addedMs = Math.max(0, Number(seconds) * 1000);
  return {
    ...current,
    durationMs: current.durationMs + addedMs,
    remainingMs: current.remainingMs + addedMs,
    deadline: current.mode === 'running' ? current.deadline + addedMs : null
  };
}

export function pauseTimer(timer, now = Date.now()) {
  if (timer.mode !== 'running') return { ...timer };

  return {
    ...timer,
    mode: 'paused',
    remainingMs: remainingTime(timer, now),
    deadline: null
  };
}

export function resumeTimer(timer, now = Date.now()) {
  if (timer.mode !== 'paused' || timer.remainingMs <= 0) return { ...timer };

  return {
    ...timer,
    mode: 'running',
    deadline: now + timer.remainingMs
  };
}

export function resetTimer(timer) {
  return {
    mode: 'idle',
    durationMs: timer.durationMs,
    remainingMs: timer.durationMs,
    deadline: null
  };
}

export function settleTimer(timer, now = Date.now()) {
  if (timer.mode !== 'running') return { timer: { ...timer }, finishedNow: false };

  const remainingMs = remainingTime(timer, now);
  if (remainingMs > 0) return { timer: { ...timer, remainingMs }, finishedNow: false };

  return {
    timer: {
      ...timer,
      mode: 'finished',
      remainingMs: 0,
      deadline: null
    },
    finishedNow: true
  };
}

export function remainingTime(timer, now = Date.now()) {
  if (timer.mode === 'running' && timer.deadline !== null) {
    return Math.max(0, timer.deadline - now);
  }
  return Math.max(0, timer.remainingMs || 0);
}

export function formatTimer(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
