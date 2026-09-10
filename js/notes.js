/* ============================================================
   notes.js — заметки и дневник
   ============================================================ */

const Notes = (() => {
  let query = '';

  function all() { return Store.get().notes; }

  function visible() {
    let list = [...all()].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.body  || '').toLowerCase().includes(q));
    }
    return list;
  }

  function render() {
    const list = visible();
    $('#notesList').innerHTML = list.length
      ? list.map(n => {
          const ts = n.updatedAt || n.createdAt || Date.now();
          const d = new Date(ts);
          return `
            <div class="note" data-id="${n.id}">
              <div class="goal-top">
                <div class="note-title">${esc(n.title || 'Без названия')}</div>
                <div class="task-actions" style="opacity:1">
                  <button class="icon-btn" data-act="del" title="Удалить">🗑️</button>
                </div>
              </div>
              <div class="note-body">${esc(n.body || '')}</div>
              <div class="note-date">${esc(humanDate(dateKey(d)))} · ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}</div>
            </div>`;
        }).join('')
      : emptyState('📝', query ? 'Ничего не найдено.' : 'Заметок пока нет. Запиши мысль, идею или итог дня.');
  }

  function openForm(id = null) {
    const n = id ? Store.find('notes', id) : null;

    Modal.open({
      title: n ? 'Заметка' : 'Новая заметка',
      submitText: 'Сохранить',
      html: `
        <label class="field">
          <span>Заголовок</span>
          <input type="text" name="title" maxlength="120" value="${esc(n?.title || '')}"
                 placeholder="Итоги дня, ${esc(humanDate(dateKey()).toLowerCase())}">
        </label>
        <label class="field">
          <span>Текст</span>
          <textarea name="body" rows="9" placeholder="Что получилось, что нет, что улучшить завтра…">${esc(n?.body || '')}</textarea>
        </label>`,
      onSubmit: v => {
        const title = (v.title || '').trim();
        const body  = (v.body || '').trim();
        if (!title && !body) return false;
        if (n) {
          Store.update('notes', n.id, { title, body, updatedAt: Date.now() });
          toast('Сохранено');
        } else {
          Store.add('notes', { title, body, updatedAt: Date.now() });
          toast('Заметка добавлена');
        }
      }
    });
  }

  function del(id) {
    const n = Store.find('notes', id);
    if (!n) return;
    confirmDialog(`Удалить заметку «${n.title || 'Без названия'}»?`, () => {
      Store.remove('notes', id);
      toast('Удалено');
    });
  }

  function bind() {
    $('#addNoteBtn').addEventListener('click', () => openForm());

    $('#noteSearch').addEventListener('input', e => {
      query = e.target.value.trim();
      render();
    });

    $('#notesList').addEventListener('click', e => {
      const note = e.target.closest('.note');
      if (!note) return;
      if (e.target.closest('[data-act="del"]')) del(note.dataset.id);
      else openForm(note.dataset.id);
    });
  }

  return { bind, render, all };
})();
