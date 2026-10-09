import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as program from '../program.js?v=22';
import * as state from '../state.js?v=22';
import * as timer from '../timer.js?v=10';
import * as exporting from '../export.js?v=22';
import * as backup from '../backup.js?v=22';
import * as history from '../history.js?v=22';
import * as historyView from '../history-view.js?v=22';
import * as replacement from '../exercise-replacement.js?v=22';
import * as progression from '../progression.js?v=22';
import * as html from '../html.js?v=20';
import * as warmup from '../warmup.js?v=22';

// Run the actual application and event handlers with DOM/storage adapters.
// This verifies UI behaviour, not browser layout or service-worker execution.
function startApp(store = state.createInitialStore()) {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) {
      nodes.set(selector, {
        innerHTML: '', textContent: '', value: '', hidden: false,
        listeners: new Map(),
        addEventListener(type, callback) { this.listeners.set(type, callback); },
        querySelector: node,
        querySelectorAll: () => [],
        setAttribute() {}, removeAttribute() {}, focus() {}, click() {}, remove() {},
        getBoundingClientRect: () => ({ top: 0, height: 0 })
      });
    }
    return nodes.get(selector);
  };
  let saved = state.serializeStore(store);
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '');
  const context = {
    ...program, ...state, ...timer, ...exporting, ...backup, ...history,
    ...historyView, ...replacement, ...progression, ...html, ...warmup,
    document: {
      querySelector: node, querySelectorAll: () => [], addEventListener() {},
      createElement: () => node('download'), body: { append() {} }
    },
    window: {
      localStorage: { getItem: () => saved, setItem: (_key, raw) => { saved = raw; } },
      addEventListener() {}, scrollTo() {}, confirm: () => true
    },
    navigator: { onLine: true },
    setInterval() {}, setTimeout() {}, clearTimeout() {},
    structuredClone, Date, Intl, Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }
  };
  runInNewContext(source, context);
  return {
    node,
    saved: () => saved,
    commitStore: (next) => context.commitStore(next),
    async restore(raw) {
      node('#backup-file').files = [{ size: raw.length, text: async () => raw }];
      await node('#backup-file').listeners.get('change')();
      assert.equal(node('#storage-warning').hidden, true, node('#storage-warning').textContent);
    },
    input(exerciseId, value, index = 0) {
      const input = {
        dataset: { exerciseId, field: 'weight', setIndex: String(index) }, value,
        checkValidity: () => true,
        closest: () => input
      };
      node('#exercise-list').listeners.get('input')({ target: input });
    },
    tick(exerciseId, index = 0, checked = true) {
      const checkbox = {
        checked, dataset: { warmupSet: String(index) },
        closest: () => ({ dataset: { warmupExercise: exerciseId } })
      };
      node('#exercise-list').listeners.get('change')({ target: { closest: () => checkbox } });
    },
    selectDay(routineId) {
      node('#day-selector').listeners.get('click')({ target: { closest: () => ({ dataset: { routineId } }) } });
    }
  };
}

test('разминка пересчитывается по введённому весу любого подхода, пустое поле использует прошлый вес', () => {
  const store = state.createInitialStore();
  const previous = state.createWorkout('legs-a', 100, 'previous');
  Object.assign(previous.sets.squat[0], { status: 'done', weight: '80', reps: '5' });
  store.history.push(state.finishWorkout(previous, 200));
  const app = startApp(store);
  assert.match(app.node('#exercise-list').innerHTML, /20 кг × 10/);
  assert.match(app.node('#exercise-list').innerHTML, /45 кг × 5/);
  app.input('squat', '120', 1);
  const block = app.node('[data-warmup-exercise="squat"]');
  for (const text of ['60 кг × 5', '80 кг × 3', '100 кг × 2', '110 кг × 1']) assert.ok(block.innerHTML.includes(text));
  app.input('squat', '', 1);
  assert.match(block.innerHTML, /45 кг × 5/);
  app.input('squat', '20');
  assert.doesNotMatch(block.innerHTML, /type="checkbox"/);
  app.input('squat', '82.5');
  assert.match(block.innerHTML, /62,5 кг × 3/);
});

test('восстановление бэкапа того же черновика сбрасывает старый вес разминки и галочки', async () => {
  const store = state.createInitialStore();
  const draft = state.ensureDraft(store, 'legs-a', 100);
  draft.sets.squat[0].weight = '80';
  const raw = backup.createBackup(store, 200);
  const app = startApp(store);
  app.input('squat', '120');
  app.tick('squat');
  await app.restore(raw);
  const rendered = app.node('#exercise-list').innerHTML;
  assert.match(rendered, /45 кг × 5/);
  assert.doesNotMatch(rendered, /110 кг × 1/);
  assert.doesNotMatch(rendered, /data-warmup-set="\d+" checked/);
  assert.equal(state.parseStore(app.saved()).drafts['legs-a'].sets.squat[0].weight, '80');

  // Ticks must also reset when the restored weights produce identical sets.
  app.tick('squat');
  await app.restore(raw);
  assert.doesNotMatch(app.node('#exercise-list').innerHTML, /data-warmup-set="\d+" checked/);
});

test('замена store сбрасывает временные значения даже при совпадении id черновика', () => {
  const store = state.createInitialStore();
  state.ensureDraft(store, 'legs-a', 100).sets.squat[0].weight = '80';
  const app = startApp(store);
  app.input('squat', '120');
  app.tick('squat');
  assert.equal(app.commitStore(structuredClone(store)), true);
  assert.match(app.node('#exercise-list').innerHTML, /45 кг × 5/);
  assert.doesNotMatch(app.node('#exercise-list').innerHTML, /110 кг × 1|data-warmup-set="\d+" checked/);
});

test('карточки показывают обычный отдых без партнёра и пересчитывают пару после замены', () => {
  const card = (app, name) => app.node('#exercise-list').innerHTML.split('<article class="exercise-card">')
    .find((content) => content.includes(`<h3>${name}</h3>`));
  const store = state.createInitialStore();
  state.addWorkoutExercise(store, 'legs-a', 'overhead-press', 100);
  const app = startApp(store);
  let rendered = card(app, 'Жим штанги стоя');
  assert.match(rendered, /Отдых 1:30/);
  assert.doesNotMatch(rendered, /superset-label|Суперсет|подходы по очереди/);

  store.selectedRoutineId = 'legs-b';
  const draft = state.ensureDraft(store, 'legs-b', 200);
  state.replaceWorkoutExercise(store, 'legs-b', 'lat-pulldown', 'bench-press', 300);
  app.commitStore(structuredClone(store));
  rendered = card(app, 'Жим штанги стоя');
  assert.match(rendered, /Суперсет A1/);
  assert.match(rendered, /Отдых 0:15/);
  assert.match(rendered, /Суперсет с\s+«Жим лёжа»/);
  assert.match(card(app, 'Жим лёжа'), /Суперсет A2/);
  assert.match(card(app, 'Жим лёжа'), /Отдых 1:30/);

  delete draft.sets['bench-press'];
  draft.plan.exercises = draft.plan.exercises.filter((exercise) => exercise.id !== 'bench-press');
  app.commitStore(structuredClone(store));
  rendered = card(app, 'Жим штанги стоя');
  assert.match(rendered, /Отдых 1:30/);
  assert.doesNotMatch(rendered, /superset-label|Суперсет|подходы по очереди/);
});

test('галочки разминки переживают перерисовку, но не меняют сохранение, рабочие подходы, таймер и экспорт', () => {
  const app = startApp();
  app.input('squat', '120');
  const saved = app.saved();
  const store = state.parseStore(saved);
  const draft = store.drafts['legs-a'];
  const counts = state.countStatuses(draft);
  const markdown = exporting.workoutToMarkdown(draft);
  app.tick('squat');
  assert.equal(app.saved(), saved);
  assert.deepEqual(state.countStatuses(state.parseStore(app.saved()).drafts['legs-a']), counts);
  assert.equal(exporting.workoutToMarkdown(state.parseStore(app.saved()).drafts['legs-a']), markdown);
  assert.equal(backup.createBackup(state.parseStore(app.saved()), 500), backup.createBackup(store, 500));
  app.selectDay('back-a');
  app.selectDay('legs-a');
  assert.match(app.node('#exercise-list').innerHTML, /data-warmup-set="0" checked/);
  app.input('squat', '80');
  assert.doesNotMatch(app.node('[data-warmup-exercise="squat"]').innerHTML, / checked/);
  const loaded = state.parseStore(app.saved());
  assert.equal(loaded.drafts['legs-a'].sets.squat.length, 4);
  assert.deepEqual(loaded.timer, store.timer);
  assert.doesNotMatch(app.saved(), /warmupChecks|warmupSets/);
  const restarted = startApp(loaded);
  assert.doesNotMatch(restarted.node('#exercise-list').innerHTML, /data-warmup-set="0" checked/);
});

test('оболочка PWA кэширует разминку и все локальные зависимости с согласованными версиями', () => {
  const files = new Set();
  const serviceWorker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const cached = [...serviceWorker.matchAll(/'\.\/([^']+)'/g)].map((match) => match[1]);
  assert.ok(cached.includes('warmup.js?v=22'));
  assert.match(serviceWorker, /CACHE_PREFIX\}v22/);
  const dependencies = (path) => {
    if (files.has(path)) return;
    files.add(path);
    const source = readFileSync(new URL(`../${path.split('?')[0]}`, import.meta.url), 'utf8');
    for (const [, dependency] of source.matchAll(/(?:from\s+|import\()['"]\.\/([^'"]+)['"]/g)) {
      assert.ok(cached.includes(dependency), `${path}: ${dependency} отсутствует в кэше`);
      if (dependency.split('?')[0].endsWith('.js')) dependencies(dependency);
    }
  };
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, path] of index.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) {
    assert.ok(cached.includes(path), `${path} отсутствует в кэше`);
    if (path.split('?')[0].endsWith('.js')) dependencies(path);
  }
});
