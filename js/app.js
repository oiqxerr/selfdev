/* ============================================================
   app.js — роутинг, тема, настройки, бэкап, запуск
   ============================================================ */

const App = (() => {
  let current = 'today';

  /* ---------- навигация ---------- */

  function go(view) {
    current = view;
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${view}`));
    $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    location.hash = view;
    renderCurrent();
    window.scrollTo({ top: 0 });
  }

  function renderCurrent() {
    switch (current) {
      case 'today':    Today.render();    break;
      case 'tasks':    Tasks.render();    break;
      case 'schedule': Schedule.render(); break;
      case 'homework': Homework.render(); break;
      case 'habits':   Habits.render();   break;
      case 'goals':    Goals.render();    break;
      case 'notes':    Notes.render();    break;
      case 'settings': renderSettings();  break;
    }
    renderBadges();
  }

  function renderBadges() {
    const t = Tasks.counts();
    const hb = Habits.todayProgress();
    const hw = Homework.counts();
    $('#badgeToday').textContent = t.today || '';
    $('#badgeTasks').textContent = t.active || '';
    $('#badgeHomework').textContent = hw.active || '';
    $('#badgeHabits').textContent = hb.total ? `${hb.done}/${hb.total}` : '';
  }

  /* ---------- тема ---------- */

  function applyTheme(theme) {
    const resolved = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.dataset.theme = resolved;
  }

  function setTheme(theme) {
    Store.commit(d => { d.settings.theme = theme; });
    applyTheme(theme);
  }

  /* ---------- настройки ---------- */

  function renderSettings() {
    const s = Store.get();
    // не трогаем поле, пока пользователь в нём печатает — иначе прыгает курсор
    if (document.activeElement !== $('#settingName')) $('#settingName').value = s.settings.name || '';
    $('#settingTheme').value = s.settings.theme || 'dark';

    Sync.renderSettings();

    const doneTasks = s.tasks.filter(t => t.done).length;
    const totalChecks = s.habits.reduce((n, h) => n + Object.keys(h.log || {}).length, 0);
    const goalsDone = s.goals.filter(g => g.done || Goals.progress(g) === 100).length;

    $('#settingsStats').innerHTML = [
      { val: s.tasks.length,    label: 'задач всего' },
      { val: doneTasks,         label: 'выполнено задач', cls: 'stat-green' },
      { val: s.schedule.length, label: 'занятий в расписании' },
      { val: s.homework.filter(h => !h.done).length, label: 'домашних заданий' },
      { val: totalChecks,       label: 'отметок привычек', cls: 'stat-amber' },
      { val: `${goalsDone}/${s.goals.length}`, label: 'целей достигнуто' },
      { val: s.notes.length,    label: 'заметок' }
    ].map(c => `
      <div class="stat ${c.cls || ''}">
        <div class="stat-val">${esc(String(c.val))}</div>
        <div class="stat-label">${esc(c.label)}</div>
      </div>`).join('');
  }

  /* ---------- настоящее расписание 11Ф ---------- */

  // day: 0=Пн … 5=Сб. Учёба в двух местах — ИПФРАН и школа (кабинеты с
  // трёхзначными номерами). Если весь день в ИПФРАН — институтские звонки
  // (45 мин, большая перемена 40 мин после 4 урока). Если в конце дня нужно
  // в школу — весь день идёт по школьным звонкам (без большой перемены).
  const REAL_SCHEDULE = [
    // Понедельник
    { day: 0, start: '08:20', end: '09:05', title: 'Физика',          place: 'Ковалёв / Смирнов · 2319/2408', color: 'violet' },
    { day: 0, start: '09:15', end: '10:00', title: 'Физика',          place: 'Ковалёв / Смирнов · 2319/2408', color: 'violet' },
    { day: 0, start: '10:10', end: '10:55', title: 'Англ. яз.',       place: 'Кержак. / Мухарл. · 2408/2313', color: 'green'  },
    { day: 0, start: '11:05', end: '11:50', title: 'Англ. яз.',       place: 'Кержак. / Мухарл. · 2408/2313', color: 'green'  },
    { day: 0, start: '12:30', end: '13:15', title: 'Алгебра',         place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 0, start: '13:25', end: '14:10', title: 'Геометрия',       place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 0, start: '14:20', end: '15:05', title: 'Алгебра',         place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 0, start: '15:15', end: '16:00', title: 'Разг. о важном',  place: 'Кузнецова · 2311',              color: 'red'    },
    // Вторник — в конце дня школа (312/406), поэтому весь день по школьным звонкам
    { day: 1, start: '08:20', end: '09:00', title: 'Русский язык',    place: 'Синица · 2313',                 color: 'green'  },
    { day: 1, start: '09:10', end: '09:50', title: 'Русский язык',    place: 'Синица · 2313',                 color: 'green'  },
    { day: 1, start: '10:10', end: '10:50', title: 'Литература',      place: 'Синица · 2313',                 color: 'green'  },
    { day: 1, start: '11:00', end: '11:40', title: 'Биология (б/п)',  place: 'Лебединский · 2321',            color: 'blue'   },
    { day: 1, start: '12:00', end: '12:40', title: 'Информатика',     place: 'Братч. / Арс. · КЦ',            color: 'blue'   },
    { day: 1, start: '12:50', end: '13:30', title: 'Информатика',     place: 'Братч. / Арс. · КЦ',            color: 'blue'   },
    { day: 1, start: '13:50', end: '14:30', title: 'Англ. яз.',       place: 'Кержакова / Мухарл. · 312/406', color: 'green'  },
    // Среда — в конце дня школа (114), поэтому весь день по школьным звонкам
    { day: 2, start: '08:20', end: '09:00', title: 'Алгебра',         place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 2, start: '09:10', end: '09:50', title: 'Геометрия',       place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 2, start: '10:10', end: '10:50', title: 'История',        place: 'Синяева · 2327',                color: 'red'    },
    { day: 2, start: '11:00', end: '11:40', title: 'История',        place: 'Синяева · 2327',                color: 'red'    },
    { day: 2, start: '12:00', end: '12:40', title: 'География',      place: 'Рузанова · 2313',               color: 'blue'   },
    { day: 2, start: '12:50', end: '13:30', title: 'ОБЗР',           place: 'Кириллов · 114',                color: 'red'    },
    { day: 2, start: '13:50', end: '14:30', title: 'Физ. культура',  place: 'Фролов / Шильникова · БСЗ',     color: 'red'    },
    { day: 2, start: '14:40', end: '15:20', title: 'Физ. культура',  place: 'Фролов / Шильникова · БСЗ',     color: 'red'    },
    // Четверг
    { day: 3, start: '09:15', end: '10:00', title: 'Астрономия',      place: 'Рульков · 2327',                color: 'violet' },
    { day: 3, start: '10:10', end: '10:55', title: 'Геометрия',       place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 3, start: '11:05', end: '11:50', title: 'Обществознание',  place: 'Синяева · 2313',                color: 'red'    },
    { day: 3, start: '12:30', end: '13:15', title: 'Обществознание',  place: 'Синяева · 2313',                color: 'red'    },
    { day: 3, start: '13:25', end: '14:10', title: 'Физика ВУД',      place: 'Рейман · 2313',                 color: 'violet' },
    { day: 3, start: '14:20', end: '15:05', title: 'Физика ВУД',      place: 'Рейман · 2313',                 color: 'violet' },
    { day: 3, start: '15:15', end: '16:00', title: 'Билет в будущее', place: 'Кузнецова · 2311',              color: 'red'    },
    // Пятница — в конце дня школа (304, 116/115), поэтому весь день по школьным звонкам
    { day: 4, start: '08:20', end: '09:00', title: 'Физика',          place: 'Ковалёв / Смирнов · 2319/2408', color: 'violet' },
    { day: 4, start: '09:10', end: '09:50', title: 'Физика',          place: 'Ковалёв / Смирнов · 2319/2408', color: 'violet' },
    { day: 4, start: '10:10', end: '10:50', title: 'Алгебра',         place: 'Кузнецова · 2311',              color: 'amber'  },
    { day: 4, start: '11:00', end: '11:40', title: 'ВерСтат (б/п)',   place: 'Кузнецова · 2311',              color: 'blue'   },
    { day: 4, start: '12:00', end: '12:40', title: 'Литература',      place: 'Синица · 304',                  color: 'green'  },
    { day: 4, start: '12:50', end: '13:30', title: 'Литература',      place: 'Синица · 304',                  color: 'green'  },
    { day: 4, start: '13:50', end: '14:30', title: 'ОФЭ',             place: 'Смирнов / Кочешков · 116/115',  color: 'blue'   },
    { day: 4, start: '14:40', end: '15:20', title: 'ОФЭ',             place: 'Смирнов / Кочешков · 116/115',  color: 'blue'   },
    // Суббота (укороченные звонки)
    { day: 5, start: '08:20', end: '09:00', title: 'Алгебра',         place: 'Кузнецова · 401',               color: 'amber'  },
    { day: 5, start: '09:10', end: '09:50', title: 'Алгебра',         place: 'Кузнецова · 401',               color: 'amber'  },
    { day: 5, start: '10:00', end: '10:40', title: 'Химия',           place: 'Горюнова · 215',                color: 'blue'   },
    { day: 5, start: '10:50', end: '11:30', title: 'Химия',           place: 'Горюнова · 215',                color: 'blue'   },
    { day: 5, start: '11:40', end: '12:20', title: 'Математика ВУД',  place: 'Кузнецова · 401',               color: 'amber'  },
    { day: 5, start: '12:30', end: '13:10', title: 'Математика ВУД',  place: 'Кузнецова · 401',               color: 'amber'  }
  ];

  function loadRealSchedule() {
    confirmDialog(
      'Текущее расписание будет полностью заменено расписанием 11Ф. Продолжить?',
      () => {
        Store.commit(d => {
          d.schedule = REAL_SCHEDULE.map(l => Object.assign({ id: Store.uid(), createdAt: Date.now() }, l));
        });
        toast('Расписание 11Ф загружено');
      },
      'Заменить'
    );
  }

  /* ---------- бэкап ---------- */

  function exportData() {
    const blob = new Blob([JSON.stringify(Store.get(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dicipline-${dateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Файл сохранён');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        toast('Не похоже на JSON-файл');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) {
        toast('Файл не от этого приложения');
        return;
      }
      confirmDialog(
        'Загрузка заменит все текущие данные. Продолжить?',
        () => {
          Store.replaceAll(parsed);
          applyTheme(Store.get().settings.theme || 'dark');
          renderCurrent();
          toast('Данные загружены');
        },
        'Заменить'
      );
    };
    reader.readAsText(file);
  }

  /* ---------- события ---------- */

  function bind() {
    $$('.nav-item').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.view)));
    $$('[data-goto]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.goto)));

    $('#themeToggle').addEventListener('click', () => {
      const now = document.documentElement.dataset.theme;
      setTheme(now === 'dark' ? 'light' : 'dark');
    });

    $('#settingName').addEventListener('input', e => {
      Store.commit(d => { d.settings.name = e.target.value; });
    });
    $('#settingTheme').addEventListener('change', e => setTheme(e.target.value));

    $('#loadRealScheduleBtn').addEventListener('click', loadRealSchedule);

    $('#exportBtn').addEventListener('click', exportData);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', e => {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });

    $('#wipeBtn').addEventListener('click', () => {
      confirmDialog('Точно удалить ВСЕ данные? Восстановить будет нельзя.', () => {
        const theme = Store.get().settings.theme;
        Store.wipe();
        Store.commit(d => { d.settings.seeded = true; });  // примеры больше не подставляем
        setTheme(theme);
        renderCurrent();
        toast('Всё очищено');
      });
    });

    window.addEventListener('hashchange', () => {
      const view = location.hash.slice(1);
      if (view && view !== current && $(`#view-${view}`)) go(view);
    });

    // горячие клавиши
    document.addEventListener('keydown', e => {
      if (Modal.isOpen()) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (typing) return;

      if (e.key === 'n' || e.key === 'т') {   // новая запись в текущем разделе
        e.preventDefault();
        ({ tasks: Tasks.openForm, schedule: Schedule.openForm, homework: Homework.openForm,
           habits: Habits.openForm, goals: Goals.openForm, notes: Notes.openForm
         }[current] || Tasks.openForm)();
      }
      const idx = Number(e.key);
      const navBtns = $$('.nav-item');
      if (idx >= 1 && idx <= navBtns.length) go(navBtns[idx - 1].dataset.view);
    });

    // пересчитываем «сегодня», если вкладка провисела до следующего дня
    let lastDay = dateKey();
    setInterval(() => {
      if (dateKey() !== lastDay) { lastDay = dateKey(); renderCurrent(); }
      else if (current === 'today') Schedule.renderToday();
    }, 60000);
  }

  /* ---------- старт ---------- */

  function init() {
    applyTheme(Store.get().settings.theme || 'dark');

    // сначала — всё, от чего зависит базовая работа приложения
    Tasks.bind();
    Schedule.bind();
    Homework.bind();
    Habits.bind();
    Goals.bind();
    Notes.bind();
    Activity.bind();
    bind();

    // любая запись в хранилище → перерисовываем активный экран
    Store.onChange((data, ok) => {
      renderCurrent();
      $('#saveHint').textContent = ok ? 'Сохранено ✓' : 'Ошибка сохранения!';
      setTimeout(() => { $('#saveHint').textContent = ''; }, 1500);
    });

    const startView = location.hash.slice(1);
    go(startView && $(`#view-${startView}`) ? startView : 'today');

    const d = Store.get();
    if (!d.settings.seeded && !d.tasks.length && !d.habits.length && !d.schedule.length) {
      seedDemo();
    }

    // синхронизация — необязательная надстройка; если Firebase не загрузился
    // (блокировщик, недоступен CDN и т.п.), это не должно ронять остальное
    try {
      Sync.init();
      Sync.bind();
    } catch (e) {
      console.error('Sync недоступен:', e);
    }
  }

  /** Первый запуск: показываем пример, чтобы приложение не было пустым. */
  function seedDemo() {
    Store.commit(d => {
      d.settings.seeded = true;
      d.tasks.push(
        { id: Store.uid(), createdAt: Date.now(), title: 'Посмотреть, как работает приложение',
          note: 'Отметь галочкой — задача уйдёт в выполненные.', priority: 'low',
          due: dateKey(), project: '', done: false, doneAt: null },
        { id: Store.uid(), createdAt: Date.now(), title: 'Добавить своё расписание на неделю',
          note: '', priority: 'med', due: dateKey(addDays(new Date(), 1)),
          project: 'Старт', done: false, doneAt: null }
      );
      d.habits.push(
        { id: Store.uid(), createdAt: Date.now(), title: 'Читать 20 минут', icon: '📚',
          days: [0,1,2,3,4,5,6], log: {} },
        { id: Store.uid(), createdAt: Date.now(), title: 'Зарядка', icon: '💪',
          days: [0,2,4], log: {} }
      );
      d.goals.push({
        id: Store.uid(), createdAt: Date.now(), title: 'Пример цели: прочитать 12 книг за год',
        desc: 'Замени на свою — или удали.', deadline: '', progress: 0, done: false,
        steps: [
          { id: Store.uid(), title: 'Выбрать первую книгу', done: false },
          { id: Store.uid(), title: 'Читать по 20 страниц в день', done: false }
        ]
      });
    });
    toast('Добавил пару примеров — можешь их удалить');
  }

  return { init, go };
})();

document.addEventListener('DOMContentLoaded', App.init);
