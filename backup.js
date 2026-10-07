import { parseStore, saveStore } from './state.js?v=20';
import { validateWorkout } from './history.js?v=20';

export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

export function createBackup(store, timestamp = Date.now()) {
  const raw = JSON.stringify({ format: 'gym-log-pwa-backup', version: 1, exportedAt: timestamp, state: store }, null, 2);
  parseBackup(raw);
  return raw;
}

export function parseBackup(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Бэкап пуст');
  if (new TextEncoder().encode(raw).length > BACKUP_MAX_BYTES) throw new Error('Бэкап больше 10 МБ');
  let backup;
  try { backup = JSON.parse(raw); }
  catch { throw new Error('Бэкап содержит неверный JSON'); }
  if (backup?.format !== 'gym-log-pwa-backup' || backup.version !== 1) throw new Error('Неподдерживаемый формат бэкапа');
  rejectUnsafeKeys(backup);
  const state = backup.state;
  if (!state || state.version !== 1 || !state.drafts || typeof state.drafts !== 'object' || Array.isArray(state.drafts)
    || !Array.isArray(state.history) || !Array.isArray(state.specialHistory)
    || typeof state.selectedRoutineId !== 'string') throw new Error('Бэкап содержит неверные данные журнала');
  const ids = new Set();
  for (const [routineId, workout] of Object.entries(state.drafts)) {
    validateWorkout(workout, false);
    if (workout.routineId !== routineId) throw new Error('Неверная программа черновика');
    uniqueId(ids, workout.id);
  }
  for (const workout of state.history) {
    validateWorkout(workout, true);
    uniqueId(ids, workout.id);
  }
  for (const entry of state.specialHistory) {
    if (!entry || !['hands', 'foot-ankle'].includes(entry.routineId)
      || typeof entry.id !== 'string' || !entry.id
      || !Number.isFinite(entry.finishedAt) || entry.finishedAt < 0 || entry.finishedAt > 8.64e15) {
      throw new Error('Неверное специализированное занятие');
    }
    uniqueId(ids, entry.id);
  }
  const timer = state.timer;
  if (!timer || !['idle', 'running', 'paused', 'finished'].includes(timer.mode)
    || !Number.isFinite(timer.durationMs) || timer.durationMs < 0
    || !Number.isFinite(timer.remainingMs) || timer.remainingMs < 0
    || (timer.mode === 'running' ? !Number.isFinite(timer.deadline) || timer.deadline < 0 : timer.deadline !== null)) {
    throw new Error('Неверный таймер в бэкапе');
  }
  return parseStore(JSON.stringify(state));
}

export function restoreBackup(storage, raw) {
  try {
    const store = parseBackup(raw);
    const result = saveStore(storage, store);
    return result.ok ? { ...result, store } : result;
  } catch (error) {
    return { ok: false, error: `Не удалось восстановить бэкап: ${error.message}` };
  }
}

function uniqueId(ids, id) {
  if (ids.has(id)) throw new Error('Повторный id записи в бэкапе');
  ids.add(id);
}

function rejectUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Небезопасный ключ в бэкапе');
    rejectUnsafeKeys(child);
  }
}
