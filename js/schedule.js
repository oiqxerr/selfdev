/* ============================================================
   schedule.js — недельное расписание (повторяется каждую неделю)
   ============================================================ */

const Schedule = (() => {
  const COLORS = {
    blue:   { label: 'Синий',    css: 'var(--accent)' },
    green:  { label: 'Зелёный',  css: 'var(--green)'  },
    amber:  { label: 'Жёлтый',   css: 'var(--amber)'  },
    red:    { label: 'Красный',  css: 'var(--red)'    },
    violet: { label: 'Фиолетовый', css: 'var(--violet)' }
  };

  function all() { return Store.get().schedule; }

  function forDay(dayIndex) {
    return all()
      .filter(l => l.day === dayIndex)
      .sort((a, b) => (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0));
  }

  function colorCss(key) { return (COLORS[key] || COLORS.blue).css; }

  /* ---------- неделя ---------- */

  function render() {
    const todayIdx = weekdayIndex();
    const monday = startOfWeek();

    $('#weekGrid').innerHTML = DAYS_SHORT.map((name, i) => {
      const lessons = forDay(i);
      const date = addDays(monday, i);
      return `
        <div class="day ${i === todayIdx ? 'is-today' : ''}" data-day="${i}">
          <div class="day-head">
            <span class="day-name">${name}</span>
            <span class="day-count">${date.getDate()}</span>
          </div>
          ${lessons.length
            ? lessons.map(lessonHTML).join('')
            : `<div class="day-empty">—</div>`}
        </div>`;
    }).join('');
  }

  function lessonHTML(l) {
    return `
      <div class="lesson" data-id="${l.id}" style="border-left-color:${colorCss(l.color)}">
        <div class="lesson-actions">
          <button class="icon-btn" data-act="hw" title="Добавить домашнее задание">📚</button>
          <button class="icon-btn" data-act="del" title="Удалить">✕</button>
        </div>
        <div class="lesson-time">${esc(l.start)}${l.end ? '–' + esc(l.end) : ''}</div>
        <div class="lesson-title">${esc(l.title)}</div>
        ${l.place ? `<div class="lesson-place">${esc(l.place)}</div>` : ''}
      </div>`;
  }

  /* ---------- сегодня ---------- */

  function renderToday() {
    const lessons = forDay(weekdayIndex());
    const now = nowMinutes();

    $('#todaySchedule').innerHTML = lessons.length
      ? lessons.map(l => {
          const s = toMinutes(l.start), e = toMinutes(l.end);
          const isNow  = s !== null && e !== null && now >= s && now < e;
          const isPast = e !== null ? now >= e : (s !== null && now >= s + 60);
          return `
            <div class="slot ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}"
                 style="border-left-color:${isNow ? 'var(--green)' : colorCss(l.color)}">
              <span class="slot-time">${esc(l.start)}${l.end ? '–' + esc(l.end) : ''}</span>
              <span>
                <span class="slot-title">${esc(l.title)}</span>
                ${l.place ? `<div class="muted">${esc(l.place)}</div>` : ''}
              </span>
              ${isNow ? '<span class="slot-badge">СЕЙЧАС</span>' : ''}
            </div>`;
        }).join('')
      : emptyState('🌤️', 'На сегодня занятий нет.');
  }

  /** Ближайшее занятие сегодня, которое ещё не началось. */
  function nextToday() {
    const now = nowMinutes();
    return forDay(weekdayIndex()).find(l => {
      const s = toMinutes(l.start);
      return s !== null && s > now;
    }) || null;
  }

  /* ---------- форма ---------- */

  function openForm(id = null, presetDay = null) {
    const l = id ? Store.find('schedule', id) : null;
    const day = l ? l.day : (presetDay ?? weekdayIndex());

    const dayOptions = DAYS_FULL.map((name, i) =>
      `<option value="${i}" ${i === day ? 'selected' : ''}>${name}</option>`).join('');
    const colorOptions = Object.entries(COLORS).map(([key, c]) =>
      `<option value="${key}" ${l?.color === key ? 'selected' : ''}>${c.label}</option>`).join('');

    Modal.open({
      title: l ? 'Изменить занятие' : 'Новое занятие',
      submitText: l ? 'Сохранить' : 'Добавить',
      html: `
        <label class="field">
          <span>Название</span>
          <input type="text" name="title" required maxlength="120"
                 value="${esc(l?.title || '')}" placeholder="Математика / Спортзал / Работа">
        </label>
        <label class="field">
          <span>День недели</span>
          <select name="day">${dayOptions}</select>
        </label>
        <div class="field-row">
          <label class="field">
            <span>Начало</span>
            <input type="time" name="start" required value="${esc(l?.start || '09:00')}">
          </label>
          <label class="field">
            <span>Конец</span>
            <input type="time" name="end" value="${esc(l?.end || '')}">
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Место (необязательно)</span>
            <input type="text" name="place" maxlength="80" value="${esc(l?.place || '')}"
                   placeholder="ауд. 305, Zoom…">
          </label>
          <label class="field">
            <span>Цвет</span>
            <select name="color">${colorOptions}</select>
          </label>
        </div>`,
      onSubmit: v => {
        const payload = {
          title: v.title.trim(),
          day: Number(v.day),
          start: v.start,
          end: v.end || '',
          place: (v.place || '').trim(),
          color: v.color
        };
        if (!payload.title || toMinutes(payload.start) === null) return false;
        if (payload.end && toMinutes(payload.end) !== null &&
            toMinutes(payload.end) <= toMinutes(payload.start)) {
          toast('Конец должен быть позже начала');
          return false;
        }
        if (l) { Store.update('schedule', l.id, payload); toast('Сохранено'); }
        else   { Store.add('schedule', payload); toast('Занятие добавлено'); }
      }
    });
  }

  function del(id) {
    const l = Store.find('schedule', id);
    if (!l) return;
    confirmDialog(`Удалить «${l.title}» из расписания?`, () => {
      Store.remove('schedule', id);
      toast('Удалено');
    });
  }

  /* ---------- события ---------- */

  function bind() {
    $('#addLessonBtn').addEventListener('click', () => openForm());

    $('#weekGrid').addEventListener('click', e => {
      const lesson = e.target.closest('.lesson');
      if (lesson) {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'del') del(lesson.dataset.id);
        else if (act === 'hw') {
          const l = Store.find('schedule', lesson.dataset.id);
          if (l) Homework.openForm(null, { subject: l.title, date: nextOccurrence(l.day) });
        }
        else openForm(lesson.dataset.id);
        return;
      }
      // клик по пустому месту в дне — добавить занятие в этот день
      const day = e.target.closest('.day');
      if (day) openForm(null, Number(day.dataset.day));
    });
  }

  return { bind, render, renderToday, nextToday, all };
})();
