/* ============================================================
   tasks.js — todo-задачи
   ============================================================ */

const Tasks = (() => {
  const PRIORITIES = { high: 'Важно', med: 'Средне', low: 'Обычно' };

  let filter  = 'active';
  let project = '';   // '' = все проекты
  let query   = '';

  /* ---------- выборки ---------- */

  function all() { return Store.get().tasks; }

  function sorted(list) {
    const rank = { high: 0, med: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!!a.due !== !!b.due) return a.due ? -1 : 1;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      const ra = rank[a.priority] ?? 2, rb = rank[b.priority] ?? 2;
      if (ra !== rb) return ra - rb;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function isOverdue(t) { return !t.done && t.due && t.due < dateKey(); }
  function isToday(t)   { return !t.done && t.due === dateKey(); }

  /** Задачи на сегодня + всё просроченное. */
  function forToday() {
    return sorted(all().filter(t => !t.done && t.due && t.due <= dateKey()));
  }

  function counts() {
    const list = all();
    return {
      active:  list.filter(t => !t.done).length,
      today:   list.filter(isToday).length,
      overdue: list.filter(isOverdue).length,
      done:    list.filter(t => t.done).length,
      doneToday: list.filter(t => t.done && t.doneAt && dateKey(new Date(t.doneAt)) === dateKey()).length
    };
  }

  function projects() {
    return [...new Set(all().map(t => (t.project || '').trim()).filter(Boolean))].sort();
  }

  function visible() {
    const today = dateKey();
    const weekEnd = dateKey(addDays(new Date(), 7));
    let list = all();

    switch (filter) {
      case 'active':  list = list.filter(t => !t.done); break;
      case 'today':   list = list.filter(t => !t.done && t.due && t.due <= today); break;
      case 'week':    list = list.filter(t => !t.done && t.due && t.due <= weekEnd); break;
      case 'overdue': list = list.filter(isOverdue); break;
      case 'done':    list = list.filter(t => t.done); break;
    }
    if (project) list = list.filter(t => (t.project || '') === project);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.note  || '').toLowerCase().includes(q) ||
        (t.project || '').toLowerCase().includes(q));
    }
    return sorted(list);
  }

  /* ---------- отрисовка ---------- */

  function taskHTML(t, compact = false) {
    const tags = [];
    if (t.project) tags.push(`<span class="tag tag-proj">${esc(t.project)}</span>`);
    if (t.priority && t.priority !== 'low') {
      tags.push(`<span class="tag tag-${t.priority}">${PRIORITIES[t.priority]}</span>`);
    }
    if (t.due && !t.done) {
      const cls = isOverdue(t) ? 'tag-over' : isToday(t) ? 'tag-today' : 'tag-due';
      const label = isOverdue(t)
        ? `Просрочено · ${humanDate(t.due)}`
        : humanDate(t.due);
      tags.push(`<span class="tag ${cls}">${esc(label)}</span>`);
    }

    return `
      <div class="task ${t.done ? 'is-done' : ''}" data-id="${t.id}">
        <input type="checkbox" class="check" data-act="toggle" ${t.done ? 'checked' : ''}
               aria-label="Выполнено">
        <div class="task-main">
          <div class="task-title">${esc(t.title)}</div>
          ${t.note && !compact ? `<div class="task-note">${esc(t.note)}</div>` : ''}
          ${tags.length ? `<div class="task-meta">${tags.join('')}</div>` : ''}
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-act="edit" title="Изменить">✏️</button>
          <button class="icon-btn" data-act="del" title="Удалить">🗑️</button>
        </div>
      </div>`;
  }

  function render() {
    // чипсы проектов
    const projs = projects();
    $('#taskProjects').innerHTML = projs.length
      ? [`<button class="chip ${!project ? 'is-active' : ''}" data-project="">Все проекты</button>`]
          .concat(projs.map(p =>
            `<button class="chip ${project === p ? 'is-active' : ''}" data-project="${esc(p)}">${esc(p)}</button>`))
          .join('')
      : '';

    const list = visible();
    $('#tasksList').innerHTML = list.length
      ? list.map(t => taskHTML(t)).join('')
      : emptyState('🗒️', filter === 'done' ? 'Пока ничего не выполнено.' : 'Задач нет. Отдыхай или добавь новую.');
  }

  /* ---------- действия ---------- */

  function toggle(id) {
    const t = Store.find('tasks', id);
    if (!t) return;
    Store.update('tasks', id, { done: !t.done, doneAt: !t.done ? Date.now() : null });
  }

  function quickAdd(title, due = dateKey()) {
    const clean = title.trim();
    if (!clean) return;
    Store.add('tasks', { title: clean, note: '', priority: 'low', due, project: '', done: false, doneAt: null });
    toast('Задача добавлена');
  }

  function openForm(id = null) {
    const t = id ? Store.find('tasks', id) : null;
    const datalist = projects().map(p => `<option value="${esc(p)}">`).join('');

    Modal.open({
      title: t ? 'Изменить задачу' : 'Новая задача',
      submitText: t ? 'Сохранить' : 'Добавить',
      html: `
        <label class="field">
          <span>Что нужно сделать</span>
          <input type="text" name="title" required maxlength="200" value="${esc(t?.title || '')}"
                 placeholder="Например: дочитать главу 4">
        </label>
        <div class="field-row">
          <label class="field">
            <span>Срок</span>
            <input type="date" name="due" value="${esc(t?.due || '')}">
          </label>
          <label class="field">
            <span>Приоритет</span>
            <select name="priority">
              <option value="low"  ${t?.priority === 'low'  || !t ? 'selected' : ''}>Обычно</option>
              <option value="med"  ${t?.priority === 'med'  ? 'selected' : ''}>Средне</option>
              <option value="high" ${t?.priority === 'high' ? 'selected' : ''}>Важно</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Проект / сфера (необязательно)</span>
          <input type="text" name="project" list="projList" maxlength="40"
                 value="${esc(t?.project || '')}" placeholder="Учёба, Спорт, Английский…">
          <datalist id="projList">${datalist}</datalist>
        </label>
        <label class="field">
          <span>Заметка</span>
          <textarea name="note" rows="3" placeholder="Детали, ссылки, шаги…">${esc(t?.note || '')}</textarea>
        </label>`,
      onSubmit: v => {
        const payload = {
          title: v.title.trim(),
          due: v.due || '',
          priority: v.priority,
          project: (v.project || '').trim(),
          note: (v.note || '').trim()
        };
        if (!payload.title) return false;
        if (t) {
          Store.update('tasks', t.id, payload);
          toast('Сохранено');
        } else {
          Store.add('tasks', Object.assign(payload, { done: false, doneAt: null }));
          toast('Задача добавлена');
        }
      }
    });
  }

  function del(id) {
    const t = Store.find('tasks', id);
    if (!t) return;
    confirmDialog(`Удалить задачу «${t.title}»?`, () => {
      Store.remove('tasks', id);
      toast('Удалено');
    });
  }

  /* ---------- события ---------- */

  function bind() {
    $('#addTaskBtn').addEventListener('click', () => openForm());

    $('#taskFilters').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      filter = chip.dataset.filter;
      $$('#taskFilters .chip').forEach(c => c.classList.toggle('is-active', c === chip));
      render();
    });

    $('#taskProjects').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      project = chip.dataset.project;
      render();
    });

    $('#taskSearch').addEventListener('input', e => {
      query = e.target.value.trim();
      render();
    });

    // делегирование по обоим спискам задач
    ['#tasksList', '#todayTasks'].forEach(sel => {
      $(sel).addEventListener('click', e => {
        const row = e.target.closest('.task');
        if (!row) return;
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'toggle') toggle(row.dataset.id);
        else if (act === 'edit') openForm(row.dataset.id);
        else if (act === 'del')  del(row.dataset.id);
      });
    });

    $('#quickTaskForm').addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#quickTaskInput');
      quickAdd(input.value);
      input.value = '';
    });
  }

  return { bind, render, taskHTML, forToday, counts, openForm, all };
})();
