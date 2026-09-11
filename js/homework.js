/* ============================================================
   homework.js — домашние задания по предметам и дням
   ============================================================ */

const Homework = (() => {
  let filter = 'upcoming';

  function all() { return Store.get().homework; }

  function isOverdue(hw)  { return !hw.done && hw.date && hw.date < dateKey(); }
  function isToday(hw)    { return !hw.done && hw.date === dateKey(); }
  function isTomorrow(hw) { return !hw.done && hw.date === dateKey(addDays(new Date(), 1)); }

  function sorted(list) {
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.subject || '').localeCompare(b.subject || '');
    });
  }

  function visible() {
    const today = dateKey();
    const weekEnd = dateKey(addDays(new Date(), 7));
    let list = all();
    switch (filter) {
      case 'upcoming': list = list.filter(h => !h.done); break;
      case 'today':    list = list.filter(h => !h.done && h.date <= today); break;
      case 'overdue':  list = list.filter(isOverdue); break;
      case 'done':     list = list.filter(h => h.done); break;
      case 'all':      break;
    }
    return sorted(list);
  }

  function counts() {
    const list = all();
    return {
      today:    list.filter(isToday).length,
      tomorrow: list.filter(isTomorrow).length,
      overdue:  list.filter(isOverdue).length,
      active:   list.filter(h => !h.done).length
    };
  }

  /** Просроченные и завтрашние задания — для дашборда (сегодняшнее уже пора сдавать). */
  function forDashboard() {
    const tomorrow = dateKey(addDays(new Date(), 1));
    return sorted(all().filter(h => !h.done && h.date && (h.date < dateKey() || h.date === tomorrow)));
  }

  function subjects() {
    const fromSchedule = Schedule.all().map(l => l.title);
    const fromHomework = all().map(h => h.subject);
    return [...new Set([...fromSchedule, ...fromHomework])].filter(Boolean).sort();
  }

  /* ---------- отрисовка ---------- */

  function itemHTML(hw) {
    const cls = isOverdue(hw) ? 'tag-over' : isToday(hw) ? 'tag-today' : 'tag-due';
    const label = isOverdue(hw) ? `Просрочено · ${humanDate(hw.date)}` : humanDate(hw.date);
    return `
      <div class="task ${hw.done ? 'is-done' : ''}" data-id="${hw.id}">
        <input type="checkbox" class="check" data-act="toggle" ${hw.done ? 'checked' : ''}
               aria-label="Выполнено">
        <div class="task-main">
          <div class="task-title">${esc(hw.subject)}</div>
          ${hw.text ? `<div class="task-note">${esc(hw.text)}</div>` : ''}
          <div class="task-meta">
            ${hw.date ? `<span class="tag ${cls}">${esc(label)}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-act="edit" title="Изменить">✏️</button>
          <button class="icon-btn" data-act="del" title="Удалить">🗑️</button>
        </div>
      </div>`;
  }

  function render() {
    const list = visible();
    $('#homeworkList').innerHTML = list.length
      ? list.map(itemHTML).join('')
      : emptyState('📚', filter === 'done' ? 'Пока ничего не выполнено.' : 'Заданий нет — можно выдохнуть.');
  }

  function renderToday() {
    const list = forDashboard();
    $('#todayHomework').innerHTML = list.length
      ? list.map(itemHTML).join('')
      : emptyState('📚', 'На завтра заданий нет.');
  }

  /* ---------- действия ---------- */

  function toggle(id) {
    const hw = Store.find('homework', id);
    if (!hw) return;
    Store.update('homework', id, { done: !hw.done });
  }

  function openForm(id = null, presets = {}) {
    const hw = id ? Store.find('homework', id) : null;
    const subjectList = subjects().map(s => `<option value="${esc(s)}">`).join('');

    Modal.open({
      title: hw ? 'Изменить задание' : 'Новое домашнее задание',
      submitText: hw ? 'Сохранить' : 'Добавить',
      html: `
        <div class="field-row">
          <label class="field">
            <span>Предмет</span>
            <input type="text" name="subject" list="hwSubjects" required maxlength="60"
                   value="${esc(hw?.subject || presets.subject || '')}" placeholder="Алгебра">
            <datalist id="hwSubjects">${subjectList}</datalist>
          </label>
          <label class="field">
            <span>К какому дню</span>
            <input type="date" name="date" required value="${esc(hw?.date || presets.date || dateKey())}">
          </label>
        </div>
        <label class="field">
          <span>Что задано</span>
          <textarea name="text" rows="4" placeholder="№12-18, стр. 34, читать параграф 5…">${esc(hw?.text || '')}</textarea>
        </label>`,
      onSubmit: v => {
        const subject = v.subject.trim();
        if (!subject || !v.date) return false;
        const payload = { subject, date: v.date, text: (v.text || '').trim() };
        if (hw) { Store.update('homework', hw.id, payload); toast('Сохранено'); }
        else    { Store.add('homework', Object.assign(payload, { done: false })); toast('Задание добавлено'); }
      }
    });
  }

  function del(id) {
    const hw = Store.find('homework', id);
    if (!hw) return;
    confirmDialog(`Удалить задание по предмету «${hw.subject}»?`, () => {
      Store.remove('homework', id);
      toast('Удалено');
    });
  }

  /* ---------- события ---------- */

  function bind() {
    $('#addHomeworkBtn').addEventListener('click', () => openForm());

    $('#homeworkFilters').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      filter = chip.dataset.filter;
      $$('#homeworkFilters .chip').forEach(c => c.classList.toggle('is-active', c === chip));
      render();
    });

    ['#homeworkList', '#todayHomework'].forEach(sel => {
      $(sel).addEventListener('click', e => {
        const row = e.target.closest('.task');
        if (!row) return;
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'toggle') toggle(row.dataset.id);
        else if (act === 'edit') openForm(row.dataset.id);
        else if (act === 'del')  del(row.dataset.id);
      });
    });
  }

  return { bind, render, renderToday, counts, openForm, all };
})();
