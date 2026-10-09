import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWarmupSets } from '../warmup.js';

test('до 60 кг включительно: гриф и 60% рабочего веса', () => {
  assert.deepEqual(calculateWarmupSets(50), [{ weightKg: 20, reps: 10 }, { weightKg: 30, reps: 5 }]);
  assert.deepEqual(calculateWarmupSets('60'), [{ weightKg: 20, reps: 10 }, { weightKg: 35, reps: 5 }]);
});

test('свыше 60 до 100 кг включительно: гриф, 55% и 75%', () => {
  assert.deepEqual(calculateWarmupSets(80), [
    { weightKg: 20, reps: 10 }, { weightKg: 45, reps: 5 }, { weightKg: 60, reps: 3 }
  ]);
  assert.deepEqual(calculateWarmupSets(100), [
    { weightKg: 20, reps: 10 }, { weightKg: 55, reps: 5 }, { weightKg: 75, reps: 3 }
  ]);
  assert.equal(calculateWarmupSets(60.5).length, 3);
});

test('свыше 100 кг: 50%, 67%, 83%, 92%; пример 120 кг совпадает точно', () => {
  assert.deepEqual(calculateWarmupSets(120), [
    { weightKg: 60, reps: 5 }, { weightKg: 80, reps: 3 },
    { weightKg: 100, reps: 2 }, { weightKg: 110, reps: 1 }
  ]);
  assert.equal(calculateWarmupSets(100.5).length, 4);
});

test('округляет к ближайшему шагу, в том числе пользовательскому и дробному', () => {
  assert.deepEqual(calculateWarmupSets(57.5), [{ weightKg: 20, reps: 10 }, { weightKg: 35, reps: 5 }]);
  assert.deepEqual(calculateWarmupSets(80, { roundToKg: 5 }), [
    { weightKg: 20, reps: 10 }, { weightKg: 45, reps: 5 }, { weightKg: 60, reps: 3 }
  ]);
  assert.deepEqual(calculateWarmupSets(30, { barKg: 15, roundToKg: 0.1 }), [
    { weightKg: 15, reps: 10 }, { weightKg: 18, reps: 5 }
  ]);
});

test('не опускается ниже грифа, удаляет дубли с меньшим числом повторов и веса не ниже рабочего', () => {
  assert.deepEqual(calculateWarmupSets(25), [{ weightKg: 20, reps: 10 }]);
  assert.deepEqual(calculateWarmupSets(120, { barKg: 90 }), [
    { weightKg: 90, reps: 5 }, { weightKg: 100, reps: 2 }, { weightKg: 110, reps: 1 }
  ]);
  assert.deepEqual(calculateWarmupSets(110, { roundToKg: 100 }), [{ weightKg: 100, reps: 5 }]);
  assert.deepEqual(calculateWarmupSets(25, { roundToKg: 25 }), []);
});

test('пустой, неверный ввод и рабочий вес не больше грифа возвращают пустой список', () => {
  for (const value of ['', ' ', null, undefined, false, true, [], {}, 'abc', NaN, Infinity, -Infinity, -5, 0, 19, 20]) {
    assert.deepEqual(calculateWarmupSets(value), [], String(value));
  }
  assert.deepEqual(calculateWarmupSets(15, { barKg: 15 }), []);
  for (const options of [{ barKg: 0 }, { barKg: NaN }, { roundToKg: 0 }, { roundToKg: -1 }, { roundToKg: Infinity }]) {
    assert.deepEqual(calculateWarmupSets(80, options), []);
  }
});
