/* ============================================================
   habits.js — трекер привычек со стриками
   ============================================================ */

const Habits = (() => {

  function all() { return Store.get().habits; }

  /** Запланирована ли привычка на этот день недели (0=Пн … 6=Вс). */
  function isScheduled(h, dayIdx) {
    return !h.days || h.days.length === 0 || h.days.includes(dayIdx);
  }

  function isDone(h, key) { return !!(h.log && h.log[key]); }

  /** Привычки, которые нужно сделать сегодня. */
  function forToday() {
    const idx = weekdayIndex();
    return all().filter(h => isScheduled(h, idx));
  }

  /**
   * Стрик — сколько запланированных дней подряд выполнено, считая назад от сегодня.
   * Сегодняшний невыполненный день стрик не обнуляет (день ещё не закончился).
   */
  function streak(h) {
    let count = 0;
    let d = new Date();
    const todayKey = dateKey();

    for (let i = 0; i < 400; i++) {
      const key = dateKey(d);
      if (isScheduled(h, weekdayIndex(d))) {
        if (isDone(h, key)) count++;
        else if (key !== todayKey) break;
      }
      d = addDays(d, -1);
    }
    return count;
  }

  /** Процент выполнения за последние 30 запланированных дней. */
  function rate30(h) {
    let planned = 0, done = 0;
    let d = new Date();
    for (let i = 0; i < 30; i++) {
      if (isScheduled(h, weekdayIndex(d))) {
        planned++;
        if (isDone(h, dateKey(d))) done++;
      }
      d = addDays(d, -1);
    }
    return planned ? Math.round(done / planned * 100) : 0;
  }

  function toggle(id, key = dateKey()) {
    const h = Store.find('habits', id);
    if (!h) return;
    Store.commit(() => {
      if (!h.log) h.log = {};
      if (h.log[key]) delete h.log[key];
      else h.log[key] = true;
    });
  }

  function daysLabel(h) {
    if (!h.days || h.days.length === 0 || h.days.length === 7) return 'Каждый день';
    if (h.days.length === 5 && [0,1,2,3,4].every(d => h.days.includes(d))) return 'По будням';
    if (h.days.length === 2 && h.days.includes(5) && h.days.includes(6)) return 'По выходным';
    return h.days.slice().sort((a,b) => a-b).map(d => DAYS_SHORT[d]).join(', ');
  }

  /* ---------- отрисовка ---------- */

  function render() {
    const list = all();
    if (!list.length) {
      $('#habitsList').innerHTML = emptyState('🌱',
        'Привычек пока нет. Начни с одной маленькой — например «10 страниц книги».');
      return;
    }

    const monday = startOfWeek();
    const todayKey = dateKey();

    $('#habitsList').innerHTML = list.map(h => {
      const s = streak(h);
      const week = DAYS_SHORT.map((name, i) => {
        const d = addDays(monday, i);
        const key = dateKey(d);
        const planned = isScheduled(h, i);
        const done = isDone(h, key);
        const future = key > todayKey;
        const cls = [
          'hday',
          done ? 'is-done' : '',
          !planned ? 'is-off' : '',
          future ? 'is-future' : '',
          key === todayKey ? 'is-today' : ''
        ].filter(Boolean).join(' ');
        return `
          <button class="${cls}" data-id="${h.id}" data-key="${key}" ${!planned ? 'disabled' : ''}>
            <div class="hday-name">${name}</div>
            <div class="hday-num">${done ? '✓' : d.getDate()}</div>
          </button>`;
      }).join('');

      return `
        <div class="habit-card" data-id="${h.id}">
          <div class="habit-top">
            <span class="habit-ico">${esc(h.icon || '🔥')}</span>
            <div>
              <div class="habit-name">${esc(h.title)}</div>
              <div class="habit-sub">${esc(daysLabel(h))} · ${rate30(h)}% за 30 дней</div>
            </div>
            <div class="habit-streak">
              <div class="streak-val">${s}</div>
              <div class="streak-label">${plural(s, 'день', 'дня', 'дней')} подряд</div>
            </div>
            <div class="task-actions" style="opacity:1">
              <button class="icon-btn" data-act="edit" title="Изменить">✏️</button>
              <button class="icon-btn" data-act="del" title="Удалить">🗑️</button>
            </div>
          </div>
          <div class="habit-week">${week}</div>
        </div>`;
    }).join('');
  }

  function renderToday() {
    const list = forToday();
    const key = dateKey();

    $('#todayHabits').innerHTML = list.length
      ? list.map(h => {
          const done = isDone(h, key);
          const s = streak(h);
          return `
            <button class="habit-pill ${done ? 'is-done' : ''}" data-id="${h.id}">
              <span>${esc(h.icon || '🔥')}</span>
              <span>${esc(h.title)}</span>
              ${s > 0 ? `<span class="pill-streak">🔥${s}</span>` : ''}
            </button>`;
        }).join('')
      : emptyState('🌱', 'На сегодня привычек не запланировано.');
  }

  function todayProgress() {
    const list = forToday();
    const key = dateKey();
    return { done: list.filter(h => isDone(h, key)).length, total: list.length };
  }

  /* ---------- форма ---------- */

  function openForm(id = null) {
    const h = id ? Store.find('habits', id) : null;
    const selected = h?.days ?? [0,1,2,3,4,5,6];

    const dayBoxes = DAYS_SHORT.map((name, i) => `
      <label>
        <input type="checkbox" name="days" value="${i}" data-multi
               ${selected.includes(i) ? 'checked' : ''}><span>${name}</span>
      </label>`).join('');

    Modal.open({
      title: h ? 'Изменить привычку' : 'Новая привычка',
      submitText: h ? 'Сохранить' : 'Добавить',
      html: `
        <div class="field-row">
          <label class="field">
            <span>Название</span>
            <input type="text" name="title" required maxlength="80"
                   value="${esc(h?.title || '')}" placeholder="Читать 20 минут">
          </label>
          <label class="field">
            <span>Значок</span>
            <input type="text" name="icon" maxlength="4" value="${esc(h?.icon || '🔥')}"
                   placeholder="📚">
          </label>
        </div>
        <div class="field">
          <span>В какие дни</span>
          <div class="daypick">${dayBoxes}</div>
        </div>`,
      onSubmit: v => {
        const title = v.title.trim();
        if (!title) return false;
        const days = (Array.isArray(v.days) ? v.days : [v.days]).filter(x => x !== undefined).map(Number);
        if (!days.length) { toast('Выбери хотя бы один день'); return false; }
        const payload = { title, icon: (v.icon || '🔥').trim() || '🔥', days };
        if (h) { Store.update('habits', h.id, payload); toast('Сохранено'); }
        else   { Store.add('habits', Object.assign(payload, { log: {} })); toast('Привычка добавлена'); }
      }
    });
  }

  function del(id) {
    const h = Store.find('habits', id);
    if (!h) return;
    confirmDialog(`Удалить привычку «${h.title}»? История отметок тоже пропадёт.`, () => {
      Store.remove('habits', id);
      toast('Удалено');
    });
  }

  /* ---------- события ---------- */

  function bind() {
    $('#addHabitBtn').addEventListener('click', () => openForm());

    $('#habitsList').addEventListener('click', e => {
      const day = e.target.closest('.hday');
      if (day && !day.disabled) {
        if (day.dataset.key > dateKey()) { toast('Это будущий день'); return; }
        toggle(day.dataset.id, day.dataset.key);
        return;
      }
      const card = e.target.closest('.habit-card');
      if (!card) return;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'edit') openForm(card.dataset.id);
      else if (act === 'del') del(card.dataset.id);
    });

    $('#todayHabits').addEventListener('click', e => {
      const pill = e.target.closest('.habit-pill');
      if (pill) toggle(pill.dataset.id);
    });
  }

  return { bind, render, renderToday, todayProgress, streak, all };
})();
