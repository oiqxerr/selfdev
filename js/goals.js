/* ============================================================
   goals.js — долгосрочные цели с шагами и прогрессом
   ============================================================ */

const Goals = (() => {

  function all() { return Store.get().goals; }

  /** Если у цели есть шаги — прогресс считается по ним, иначе берётся ручной. */
  function progress(g) {
    if (g.steps && g.steps.length) {
      const done = g.steps.filter(s => s.done).length;
      return Math.round(done / g.steps.length * 100);
    }
    return Math.min(100, Math.max(0, Number(g.progress) || 0));
  }

  function sorted() {
    return [...all()].sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (!!a.deadline !== !!b.deadline) return a.deadline ? -1 : 1;
      if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  /* ---------- отрисовка ---------- */

  function goalHTML(g) {
    const pct = progress(g);
    const done = g.done || pct === 100;

    let deadlineTag = '';
    if (g.deadline) {
      const diff = daysBetween(dateKey(), g.deadline);
      const cls = done ? 'tag' : diff < 0 ? 'tag tag-over' : diff <= 14 ? 'tag tag-med' : 'tag tag-due';
      const label = diff < 0 && !done
        ? `Срок прошёл · ${humanDate(g.deadline)}`
        : `${humanDate(g.deadline)}${diff >= 0 ? ` · ${diff} ${plural(diff, 'день', 'дня', 'дней')}` : ''}`;
      deadlineTag = `<span class="${cls}">${esc(label)}</span>`;
    }

    const steps = (g.steps || []).map(s => `
      <label class="step ${s.done ? 'is-done' : ''}">
        <input type="checkbox" class="check" data-act="step" data-step="${s.id}" ${s.done ? 'checked' : ''}>
        <span>${esc(s.title)}</span>
        <button type="button" class="icon-btn" data-act="stepdel" data-step="${s.id}" title="Удалить шаг">✕</button>
      </label>`).join('');

    return `
      <div class="goal ${done ? 'is-done' : ''}" data-id="${g.id}">
        <div class="goal-top">
          <div class="goal-title">${done ? '✅ ' : '🎯 '}${esc(g.title)}</div>
          <div class="task-actions" style="opacity:1">
            <button class="icon-btn" data-act="edit" title="Изменить">✏️</button>
            <button class="icon-btn" data-act="del" title="Удалить">🗑️</button>
          </div>
        </div>
        ${g.desc ? `<div class="goal-desc">${esc(g.desc)}</div>` : ''}
        ${deadlineTag ? `<div class="task-meta">${deadlineTag}</div>` : ''}
        <div>
          <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="bar-row">
            <span>${pct}%</span>
            <span>${g.steps?.length ? `${g.steps.filter(s => s.done).length} из ${g.steps.length} шагов` : 'без шагов'}</span>
          </div>
        </div>
        ${steps ? `<div class="steps">${steps}</div>` : ''}
        <form class="step-add" data-act="stepadd">
          <input type="text" placeholder="+ добавить шаг" maxlength="140">
          <button type="submit" class="btn btn-sm">Добавить</button>
        </form>
      </div>`;
  }

  function render() {
    const list = sorted();
    $('#goalsList').innerHTML = list.length
      ? list.map(goalHTML).join('')
      : emptyState('🎯', 'Целей пока нет. Опиши, чего хочешь достичь за ближайшие месяцы.');
  }

  /** Активные цели с ближайшим сроком — для дашборда. */
  function renderToday() {
    const list = sorted().filter(g => !g.done && progress(g) < 100).slice(0, 3);
    const card = $('#todayGoalsCard');

    if (!list.length) {
      card.hidden = all().length === 0;
      $('#todayGoals').innerHTML = emptyState('🎉', 'Активных целей нет.');
      return;
    }
    card.hidden = false;

    $('#todayGoals').innerHTML = list.map(g => {
      const pct = progress(g);
      return `
        <div class="task" style="cursor:default">
          <div class="task-main">
            <div class="task-title">🎯 ${esc(g.title)}</div>
            <div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="bar-row">
              <span>${pct}%</span>
              ${g.deadline ? `<span>до ${esc(humanDate(g.deadline))}</span>` : '<span></span>'}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ---------- шаги ---------- */

  function addStep(goalId, title) {
    const clean = title.trim();
    if (!clean) return;
    Store.commit(d => {
      const g = d.goals.find(x => x.id === goalId);
      if (!g) return;
      if (!g.steps) g.steps = [];
      g.steps.push({ id: Store.uid(), title: clean, done: false });
    });
  }

  function toggleStep(goalId, stepId) {
    Store.commit(d => {
      const g = d.goals.find(x => x.id === goalId);
      const s = g?.steps?.find(x => x.id === stepId);
      if (s) s.done = !s.done;
    });
  }

  function delStep(goalId, stepId) {
    Store.commit(d => {
      const g = d.goals.find(x => x.id === goalId);
      if (!g?.steps) return;
      const i = g.steps.findIndex(x => x.id === stepId);
      if (i > -1) g.steps.splice(i, 1);
    });
  }

  /* ---------- форма ---------- */

  function openForm(id = null) {
    const g = id ? Store.find('goals', id) : null;
    const hasSteps = !!g?.steps?.length;

    Modal.open({
      title: g ? 'Изменить цель' : 'Новая цель',
      submitText: g ? 'Сохранить' : 'Добавить',
      html: `
        <label class="field">
          <span>Цель</span>
          <input type="text" name="title" required maxlength="160"
                 value="${esc(g?.title || '')}" placeholder="Выучить английский до B2">
        </label>
        <label class="field">
          <span>Описание / зачем мне это</span>
          <textarea name="desc" rows="3" placeholder="Чтобы свободно читать документацию и проходить собеседования">${esc(g?.desc || '')}</textarea>
        </label>
        <div class="field-row">
          <label class="field">
            <span>Дедлайн</span>
            <input type="date" name="deadline" value="${esc(g?.deadline || '')}">
          </label>
          <label class="field">
            <span>Прогресс, %${hasSteps ? ' (считается по шагам)' : ''}</span>
            <input type="number" name="progress" min="0" max="100" step="5"
                   value="${progress(g || {})}" ${hasSteps ? 'disabled' : ''}>
          </label>
        </div>
        <label class="field" style="flex-direction:row;align-items:center;gap:10px">
          <input type="checkbox" name="done" class="check" style="flex:0 0 19px" ${g?.done ? 'checked' : ''}>
          <span style="font-size:14px;color:var(--text)">Цель достигнута</span>
        </label>`,
      onSubmit: v => {
        const title = v.title.trim();
        if (!title) return false;
        const payload = {
          title,
          desc: (v.desc || '').trim(),
          deadline: v.deadline || '',
          done: v.done === 'on'
        };
        if (!hasSteps) payload.progress = Number(v.progress) || 0;
        if (g) { Store.update('goals', g.id, payload); toast('Сохранено'); }
        else   { Store.add('goals', Object.assign(payload, { steps: [] })); toast('Цель добавлена'); }
      }
    });
  }

  function del(id) {
    const g = Store.find('goals', id);
    if (!g) return;
    confirmDialog(`Удалить цель «${g.title}»?`, () => {
      Store.remove('goals', id);
      toast('Удалено');
    });
  }

  /* ---------- события ---------- */

  function bind() {
    $('#addGoalBtn').addEventListener('click', () => openForm());

    $('#goalsList').addEventListener('click', e => {
      const goal = e.target.closest('.goal');
      if (!goal) return;
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'edit') openForm(goal.dataset.id);
      else if (act === 'del') del(goal.dataset.id);
      else if (act === 'step') toggleStep(goal.dataset.id, btn.dataset.step);
      else if (act === 'stepdel') delStep(goal.dataset.id, btn.dataset.step);
    });

    $('#goalsList').addEventListener('submit', e => {
      const form = e.target.closest('[data-act="stepadd"]');
      if (!form) return;
      e.preventDefault();
      const goal = form.closest('.goal');
      const input = form.querySelector('input');
      addStep(goal.dataset.id, input.value);
      input.value = '';
    });
  }

  return { bind, render, renderToday, progress, all };
})();
