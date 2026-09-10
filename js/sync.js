/* ============================================================
   sync.js — синхронизация данных между устройствами через Firestore

   Модель простая: у "пространства" есть код (случайная строка).
   Кто знает код — тот может читать и писать данные по этому коду.
   Это НЕ полноценная авторизация, а общий секрет вроде ссылки на
   Google-документ "у кого есть ссылка" — годится для личного
   дневника, но код нельзя публиковать где попало.
   ============================================================ */

const Sync = (() => {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // без 0/O/1/I/L — легче читать и печатать
  const CODE_KEY   = 'selfdev.syncCode';
  const DEVICE_KEY = 'selfdev.deviceId';

  let db = null;
  let unsub = null;
  let code = null;
  let deviceId = null;
  let applyingRemote = false;
  let pushTimer = null;
  let status = 'idle'; // idle | unavailable | connecting | synced | error

  function randomCode(len = 20) {
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
  }

  function groupCode(c) { return (c || '').match(/.{1,4}/g)?.join('-') || ''; }
  function normalizeCode(raw) { return String(raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }

  function configured() {
    return typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'ВСТАВЬ_СЮДА';
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = randomCode(10); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  }

  /* ---------- жизненный цикл ---------- */

  function init() {
    if (!configured()) { status = 'unavailable'; return; }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    deviceId = getDeviceId();

    // синхронизировать локальные изменения в облако, если подключены
    Store.onChange(data => schedulePush(data));

    const saved = localStorage.getItem(CODE_KEY);
    if (saved) connect(saved);
  }

  function connect(rawCode) {
    if (!db) return;
    const c = normalizeCode(rawCode);
    if (c.length < 16) { toast('Код слишком короткий — проверь, что скопировал целиком'); return; }

    if (unsub) unsub();
    code = c;
    localStorage.setItem(CODE_KEY, code);
    status = 'connecting';
    renderSettings();

    unsub = db.collection('syncSpaces').doc(code).onSnapshot(snap => {
      if (!snap.exists) {
        pushNow(Store.get());
        toast('В облаке по этому коду пока пусто — сохранил текущие данные как основу');
        return;
      }
      const remote = snap.data();
      if (remote.updatedBy !== deviceId) {
        applyingRemote = true;
        Store.replaceAll(remote.payload);
        applyingRemote = false;
      }
      status = 'synced';
      renderSettings();
    }, err => {
      console.error('Sync: ошибка подписки', err);
      status = 'error';
      renderSettings();
    });

    renderSettings();
  }

  function disconnect() {
    if (unsub) unsub();
    unsub = null;
    code = null;
    localStorage.removeItem(CODE_KEY);
    status = 'idle';
    renderSettings();
  }

  function schedulePush(data) {
    if (!code || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushNow(data), 600);
  }

  function pushNow(data) {
    if (!code || !db) return;
    db.collection('syncSpaces').doc(code).set({
      payload: data,
      updatedBy: deviceId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      status = 'synced';
      renderSettings();
    }).catch(err => {
      console.error('Sync: ошибка записи', err);
      status = 'error';
      renderSettings();
    });
  }

  /* ---------- настройки: отрисовка ---------- */

  const STATUS_LABEL = {
    idle:        '⚪ Не подключено',
    unavailable: '⚪ Синхронизация не настроена',
    connecting:  '🟡 Подключение…',
    synced:      '🟢 Синхронизировано',
    error:       '🔴 Ошибка соединения — проверь интернет'
  };

  function renderSettings() {
    const unavailable = $('#syncUnavailable');
    if (!unavailable) return; // раздел настроек ещё не рисовался

    const setup = $('#syncSetup');
    const connected = $('#syncConnected');

    if (!configured()) {
      unavailable.hidden = false;
      setup.hidden = true;
      connected.hidden = true;
      return;
    }
    unavailable.hidden = true;

    if (code) {
      setup.hidden = true;
      connected.hidden = false;
      $('#syncCodeDisplay').value = groupCode(code);
      $('#syncStatus').textContent = STATUS_LABEL[status] || '';
    } else {
      setup.hidden = false;
      connected.hidden = true;
    }
  }

  /* ---------- события ---------- */

  function bind() {
    if (!$('#syncCreateBtn')) return;

    $('#syncCreateBtn').addEventListener('click', () => {
      connect(randomCode());
      toast('Код создан — введи его на другом устройстве в поле подключения');
    });

    $('#syncConnectBtn').addEventListener('click', () => {
      const raw = $('#syncCodeInput').value;
      if (!raw.trim()) return;
      confirmDialog(
        'Если в облаке по этому коду уже есть данные — они заменят данные на этом устройстве. Продолжить?',
        () => connect(raw),
        'Подключиться'
      );
    });

    $('#syncCopyBtn').addEventListener('click', () => {
      if (!code) return;
      navigator.clipboard?.writeText(code).then(() => toast('Код скопирован'))
        .catch(() => toast('Не получилось скопировать — выдели код вручную'));
    });

    $('#syncDisconnectBtn').addEventListener('click', () => {
      confirmDialog(
        'Отключить синхронизацию на этом устройстве? Данные в облаке никуда не денутся.',
        disconnect,
        'Отключить'
      );
    });
  }

  return { init, bind, renderSettings };
})();
