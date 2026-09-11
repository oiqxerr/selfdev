/* ============================================================
   today.js — дашборд «Сегодня»
   ============================================================ */

const Today = (() => {

  function greeting() {
    const h = new Date().getHours();
    if (h < 5)  return 'Доброй ночи';
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  }

  function renderStats() {
    const t = Tasks.counts();
    const hw = Homework.counts();
    const hb = Habits.todayProgress();
    const next = Schedule.nextToday();

    const habitPct = hb.total ? Math.round(hb.done / hb.total * 100) : 0;
    const bestStreak = Habits.all().reduce((max, h) => Math.max(max, Habits.streak(h)), 0);

    const cards = [
      { cls: 'stat-accent', val: t.today, label: `${plural(t.today, 'задача', 'задачи', 'задач')} на сегодня` },
      hw.tomorrow > 0 || hw.overdue > 0
        ? { cls: hw.overdue > 0 ? 'stat-red' : 'stat-accent', val: hw.tomorrow + hw.overdue,
            label: `${plural(hw.tomorrow + hw.overdue, 'задание', 'задания', 'заданий')} по ДЗ` }
        : null,
      { cls: 'stat-green',  val: t.doneToday, label: 'выполнено сегодня' },
      { cls: 'stat-amber',  val: `${hb.done}/${hb.total}`, label: `привычек · ${habitPct}%` },
      bestStreak > 0
        ? { cls: 'stat-amber', val: `🔥${bestStreak}`, label: 'лучший стрик' }
        : null,
      t.overdue > 0
        ? { cls: 'stat-red', val: t.overdue, label: 'просрочено' }
        : next
          ? { cls: '', val: next.start, label: `дальше: ${next.title}` }
          : null
    ].filter(Boolean);

    $('#todayStats').innerHTML = cards.map(c => `
      <div class="stat ${c.cls}">
        <div class="stat-val">${esc(String(c.val))}</div>
        <div class="stat-label">${esc(c.label)}</div>
      </div>`).join('');
  }

  function renderTasks() {
    const list = Tasks.forToday();
    $('#todayTasks').innerHTML = list.length
      ? list.map(t => Tasks.taskHTML(t, true)).join('')
      : emptyState('☕', 'На сегодня задач нет. Хороший день!');
  }

  function render() {
    const name = (Store.get().settings.name || '').trim();
    $('#todayTitle').textContent = name ? `${greeting()}, ${name}!` : greeting() + '!';
    $('#todayDate').textContent = fullDate();

    renderStats();
    renderTasks();
    Activity.render();
    Schedule.renderToday();
    Homework.renderToday();
    Habits.renderToday();
    Goals.renderToday();
  }

  return { render, greeting };
})();
