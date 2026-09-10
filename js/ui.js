/* ============================================================
   ui.js — общие хелперы: DOM, даты, модалка, тосты
   ============================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Экранирование пользовательского текста перед вставкой в HTML. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============ ДАТЫ ============ */
/* Неделя начинается с понедельника: индексы 0=Пн … 6=Вс */

const DAYS_FULL  = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

/** Ключ даты в локальном времени: '2026-09-10' (не UTC — важно!). */
function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Разбор 'YYYY-MM-DD' в локальную дату (полночь). */
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Индекс дня недели по-нашему: 0=Пн … 6=Вс. */
function weekdayIndex(d = new Date()) {
  return (d.getDay() + 6) % 7;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Понедельник той недели, в которую попадает дата. */
function startOfWeek(d = new Date()) {
  return addDays(d, -weekdayIndex(d));
}

/** Разница в днях между ключами дат (b - a). */
function daysBetween(keyA, keyB) {
  const MS = 86400000;
  return Math.round((parseKey(keyB) - parseKey(keyA)) / MS);
}

/** 'ДД.ММ.ГГГГ' — единый числовой формат даты. */
function formatDate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** «Сегодня», «Завтра», «Вчера» или «12.09.2026». */
function humanDate(key) {
  const diff = daysBetween(dateKey(), key);
  if (diff === 0)  return 'Сегодня';
  if (diff === 1)  return 'Завтра';
  if (diff === -1) return 'Вчера';
  return formatDate(parseKey(key));
}

function fullDate(d = new Date()) {
  return `${DAYS_FULL[weekdayIndex(d)]}, ${formatDate(d)}`;
}

/** 'HH:MM' → минуты от полуночи. Некорректное значение → null. */
function toMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Склонение: plural(5, 'день','дня','дней') → 'дней'. */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5)   return few;
  if (b === 1)          return one;
  return many;
}

/* ============ ТОСТ ============ */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ============ МОДАЛКА ============ */
const Modal = (() => {
  const backdrop = $('#modalBackdrop');
  const form     = $('#modalForm');
  const body     = $('#modalBody');
  const title    = $('#modalTitle');
  const submit   = $('#modalSubmit');
  let onSubmit = null;

  /**
   * open({ title, html, submitText, danger, onSubmit(values, formEl) })
   * onSubmit возвращает false → модалка остаётся открытой.
   */
  function open(opts) {
    title.textContent = opts.title || '';
    body.innerHTML = opts.html || '';
    submit.textContent = opts.submitText || 'Сохранить';
    submit.classList.toggle('btn-danger', !!opts.danger);
    onSubmit = opts.onSubmit || null;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = body.querySelector('input:not([type=hidden]), textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
  }

  function close() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
    body.innerHTML = '';
    submit.classList.remove('btn-danger');
    onSubmit = null;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!onSubmit) return close();
    const values = Object.create(null);   // без прототипа: поле «constructor» не сломает разбор
    new FormData(form).forEach((v, k) => {
      if (k in values) {
        values[k] = Array.isArray(values[k]) ? [...values[k], v] : [values[k], v];
      } else {
        values[k] = v;
      }
    });
    // чекбоксы-группы должны быть массивом даже при одном значении
    $$('input[type=checkbox][data-multi]', form).forEach(cb => {
      const k = cb.name;
      if (values[k] !== undefined && !Array.isArray(values[k])) values[k] = [values[k]];
      if (values[k] === undefined) values[k] = [];
    });
    if (onSubmit(values, form) !== false) close();
  });

  $('#modalClose').addEventListener('click', close);
  $('#modalCancel').addEventListener('click', close);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !backdrop.hidden) close();
  });

  return { open, close, isOpen: () => !backdrop.hidden };
})();

/** Диалог подтверждения через ту же модалку. */
function confirmDialog(text, onYes, submitText = 'Удалить') {
  Modal.open({
    title: 'Подтверждение',
    html: `<p style="font-size:14px">${esc(text)}</p>`,
    submitText,
    danger: true,
    onSubmit: () => { onYes(); }
  });
}

/** Заглушка для пустого списка. */
function emptyState(icon, text) {
  return `<div class="empty"><span class="empty-ico">${icon}</span>${esc(text)}</div>`;
}
