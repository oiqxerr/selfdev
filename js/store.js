/* ============================================================
   store.js — хранилище данных (localStorage)
   ============================================================ */

const Store = (() => {
  const KEY = 'selfdev.data.v1';

  const EMPTY = {
    version: 1,
    tasks: [],
    schedule: [],
    homework: [],
    habits: [],
    goals: [],
    notes: [],
    settings: { theme: 'dark', name: '' }
  };

  let data = load();
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(EMPTY);
      const parsed = JSON.parse(raw);
      // мягкая миграция: добиваем недостающие ключи
      return Object.assign(structuredClone(EMPTY), parsed, {
        settings: Object.assign({}, EMPTY.settings, parsed.settings || {})
      });
    } catch (e) {
      console.error('Не удалось прочитать данные, начинаем с чистого листа:', e);
      return structuredClone(EMPTY);
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Не удалось сохранить данные:', e);
      return false;
    }
  }

  /** Изменить данные и уведомить подписчиков. */
  function commit(fn) {
    if (typeof fn === 'function') fn(data);
    const ok = save();
    listeners.forEach(cb => cb(data, ok));
    return ok;
  }

  function onChange(cb) { listeners.push(cb); }

  function get() { return data; }

  function replaceAll(next) {
    data = Object.assign(structuredClone(EMPTY), next, {
      settings: Object.assign({}, EMPTY.settings, next.settings || {})
    });
    commit();
  }

  function wipe() {
    data = structuredClone(EMPTY);
    commit();
  }

  /* --- коллекции --- */
  function add(collection, item) {
    const record = Object.assign({ id: uid(), createdAt: Date.now() }, item);
    commit(d => d[collection].push(record));
    return record;
  }

  function update(collection, id, patch) {
    commit(d => {
      const item = d[collection].find(x => x.id === id);
      if (item) Object.assign(item, patch);
    });
  }

  function remove(collection, id) {
    commit(d => {
      const i = d[collection].findIndex(x => x.id === id);
      if (i > -1) d[collection].splice(i, 1);
    });
  }

  function find(collection, id) {
    return data[collection].find(x => x.id === id);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return { get, commit, onChange, add, update, remove, find, replaceAll, wipe, uid, KEY };
})();
