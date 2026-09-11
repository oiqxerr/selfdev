/* ============================================================
   activity.js — график активности по домашке (как на GitHub)

   Ячейка = день. Цвет зависит от того, всё ли задание на этот
   день выполнено; количество показывается при клике/наведении.
   ============================================================ */

const Activity = (() => {
  const WEEKS = 53;

  /** Map: 'YYYY-MM-DD' → { total, done } */
  function byDate() {
    const map = new Map();
    Store.get().homework.forEach(hw => {
      if (!hw.date) return;
      const rec = map.get(hw.date) || { total: 0, done: 0 };
      rec.total++;
      if (hw.done) rec.done++;
      map.set(hw.date, rec);
    });
    return map;
  }

  function levelOf(rec) {
    if (!rec || !rec.total) return 'none';
    if (rec.done === 0) return 'miss';
    if (rec.done === rec.total) return 'full';
    return rec.done / rec.total < 0.5 ? 'low' : 'high';
  }

  function cellTitle(key, rec) {
    if (!rec || !rec.total) return `${formatDate(parseKey(key))} · заданий не было`;
    return `${formatDate(parseKey(key))} · ${rec.done} из ${rec.total} ` +
           `${plural(rec.total, 'задания', 'заданий', 'заданий')} выполнено`;
  }

  function render() {
    const data = byDate();
    const todayKey = dateKey();
    const firstMonday = addDays(startOfWeek(), -7 * (WEEKS - 1));

    const cells = [];
    const months = [];
    let prevMonth = -1;
    let doneYear = 0;

    for (let w = 0; w < WEEKS; w++) {
      const monday = addDays(firstMonday, w * 7);
      if (monday.getMonth() !== prevMonth) {
        prevMonth = monday.getMonth();
        months.push(`<span style="grid-column:${w + 1}">${MONTHS_SHORT[prevMonth]}</span>`);
      }

      for (let d = 0; d < 7; d++) {
        const key = dateKey(addDays(monday, d));
        const rec = data.get(key);
        if (rec) doneYear += rec.done;

        if (key > todayKey) {
          cells.push(`<div class="hm-cell is-future"></div>`);
        } else {
          cells.push(
            `<div class="hm-cell hm-${levelOf(rec)}" data-date="${key}" ` +
            `title="${esc(cellTitle(key, rec))}"></div>`
          );
        }
      }
    }

    $('#hmGrid').innerHTML = cells.join('');
    $('#hmMonths').innerHTML = months.join('');
    $('#activityCount').textContent =
      `${doneYear} ${plural(doneYear, 'задание', 'задания', 'заданий')} выполнено за год`;

    // показываем правый край — текущую неделю
    const scroll = $('#heatmapScroll');
    scroll.scrollLeft = scroll.scrollWidth;
  }

  function bind() {
    $('#hmGrid').addEventListener('click', e => {
      const cell = e.target.closest('.hm-cell[data-date]');
      if (cell) toast(cell.title);
    });
  }

  return { render, bind };
})();
