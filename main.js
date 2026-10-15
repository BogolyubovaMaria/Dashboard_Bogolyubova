/* =====================================================
   СОСТОЯНИЕ ПАНЕЛИ
   ===================================================== */
const STORAGE_KEY = 'lit_dashboard_v1';

const state = {
  baseHidden: [],
  dynamic: [],
  tasks: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') {
      state.baseHidden = Array.isArray(p.baseHidden) ? p.baseHidden : [];
      state.dynamic    = Array.isArray(p.dynamic)    ? p.dynamic    : [];
      state.tasks      = Array.isArray(p.tasks)      ? p.tasks      : [];
    }
  } catch (e) {}
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* =====================================================
   БАЗОВЫЙ КЛАСС ВИДЖЕТА
   ===================================================== */
class UIComponent {
  constructor({ id, title, icon }) {
    if (new.target === UIComponent) throw new Error('UIComponent — абстрактный класс');
    this.id = id || (this.constructor.name.toLowerCase() + '-' + Date.now());
    this.title = title;
    this.icon = icon;
    this.element = null;
  }

  headerHTML() {
    return `
      <div class="widget-header">
        <span class="widget-title">${this.title}</span>
        <div class="widget-header-right">
          <div class="widget-icon"><i data-lucide="${this.icon}"></i></div>
          <div class="widget-ctrls">
            <button class="widget-ctrl" data-ctrl="collapse" title="Свернуть">−</button>
            <button class="widget-ctrl delete" data-ctrl="delete" title="Удалить">×</button>
          </div>
        </div>
      </div>
    `;
  }

  render()  { throw new Error('render() не реализован'); }
  attach()  {}
  destroy() {}

  mount(parent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'widget';
    wrapper.dataset.widgetId = this.id;
    wrapper.dataset.widgetType = this.constructor.name;
    wrapper.innerHTML = this.render();
    parent.appendChild(wrapper);
    this.element = wrapper;
    this.attach();
    return wrapper;
  }
}

/* =====================================================
   TO-DO WIDGET
   ===================================================== */
class ToDoWidget extends UIComponent {
  constructor(opts = {}) {
    super({
      id: opts.id || ('todo-' + Date.now()),
      title: 'Список дел',
      icon: 'list-todo'
    });
    this.tasks = opts.tasks || [];
  }

  render() {
    const items = this.tasks.length
      ? this.tasks.map(t => `
          <li class="todo-item ${t.done ? 'done' : ''}" data-task-id="${t.id}">
            <button class="todo-check" data-action="toggle">✓</button>
            <span class="todo-text"></span>
            <button class="todo-del" data-action="delete">×</button>
          </li>
        `).join('')
      : '<li class="todo-empty">Пока пусто — добавь первую задачу</li>';

    return `
      ${this.headerHTML()}
      <div class="widget-content">
        <form class="todo-form">
          <input type="text" class="todo-input" placeholder="Что почитать?" maxlength="120">
          <button type="submit" class="todo-add">+</button>
        </form>
        <ul class="todo-list">${items}</ul>
      </div>
    `;
  }

  attach() {
    const root = this.element;
    const form = root.querySelector('.todo-form');
    const input = root.querySelector('.todo-input');
    const list = root.querySelector('.todo-list');

    this.tasks.forEach(t => {
      const li = list.querySelector(`[data-task-id="${t.id}"]`);
      if (li) li.querySelector('.todo-text').textContent = t.text;
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const task = {
        id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        text,
        done: false
      };
      this.tasks.push(task);
      this.appendTask(task);
      input.value = '';
      this.persist();
    });

    list.addEventListener('click', (e) => {
      const li = e.target.closest('.todo-item');
      if (!li) return;
      const id = li.dataset.taskId;
      const task = this.tasks.find(t => t.id === id);
      if (!task) return;

      if (e.target.dataset.action === 'toggle') {
        task.done = !task.done;
        li.classList.toggle('done', task.done);
        this.persist();
      } else if (e.target.dataset.action === 'delete') {
        this.tasks = this.tasks.filter(t => t.id !== id);
        li.remove();
        if (this.tasks.length === 0) {
          list.innerHTML = '<li class="todo-empty">Пока пусто — добавь первую задачу</li>';
        }
        this.persist();
      }
    });

    this._list = list;
  }

  appendTask(task) {
    const empty = this._list.querySelector('.todo-empty');
    if (empty) empty.remove();
    const li = document.createElement('li');
    li.className = 'todo-item' + (task.done ? ' done' : '');
    li.dataset.taskId = task.id;
    li.innerHTML = `
      <button class="todo-check" data-action="toggle">✓</button>
      <span class="todo-text"></span>
      <button class="todo-del" data-action="delete">×</button>
    `;
    li.querySelector('.todo-text').textContent = task.text;
    this._list.appendChild(li);
  }

  persist() {
    const all = state.tasks.filter(t => t.widgetId !== this.id);
    this.tasks.forEach(t => all.push({ ...t, widgetId: this.id }));
    state.tasks = all;
    saveState();
  }
}

/* =====================================================
   WEATHER WIDGET (Open-Meteo)
   ===================================================== */
function weatherCodeInfo(code) {
  if (code === 0) return { emoji: '☀️', desc: 'Ясно' };
  if (code <= 3) return { emoji: '⛅', desc: 'Переменная облачность' };
  if (code === 45 || code === 48) return { emoji: '🌫️', desc: 'Туман' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', desc: 'Морось' };
  if (code >= 61 && code <= 67) return { emoji: '🌧️', desc: 'Дождь' };
  if (code >= 71 && code <= 77) return { emoji: '❄️', desc: 'Снег' };
  if (code >= 80 && code <= 82) return { emoji: '🌧️', desc: 'Ливень' };
  if (code >= 95) return { emoji: '⛈️', desc: 'Гроза' };
  return { emoji: '🌡️', desc: 'Погода' };
}

class WeatherWidget extends UIComponent {
  constructor(opts = {}) {
    super({
      id: opts.id || ('weather-' + Date.now()),
      title: 'Погода · Москва',
      icon: 'cloud-sun'
    });
    this.lat = 55.7558;
    this.lon = 37.6173;
    this.controller = null;
  }

  render() {
    return `
      ${this.headerHTML()}
      <div class="widget-content" id="body-${this.id}">
        <div class="api-loading">Загрузка погоды…</div>
      </div>
    `;
  }

  attach() { this.load(); }

  async load() {
    const body = this.element.querySelector(`#body-${this.id}`);
    body.innerHTML = '<div class="api-loading">Загрузка погоды…</div>';

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.lat}&longitude=${this.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
      const resp = await fetch(url, { signal: this.controller.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      this.renderWeather(body, data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      this.renderError(body);
    }
  }

  renderWeather(body, data) {
    const c = data.current;
    const { emoji, desc } = weatherCodeInfo(c.weather_code);
    body.innerHTML = `
      <div class="weather-main">
        <div class="weather-emoji">${emoji}</div>
        <div>
          <div class="weather-temp">${Math.round(c.temperature_2m)}°C</div>
          <div class="weather-desc">${desc}</div>
        </div>
      </div>
      <div class="weather-details">
        <div><span>Ощущается</span><strong>${Math.round(c.apparent_temperature)}°</strong></div>
        <div><span>Влажность</span><strong>${c.relative_humidity_2m}%</strong></div>
        <div><span>Ветер</span><strong>${c.wind_speed_10m} м/с</strong></div>
        <div><span>Обновлено</span><strong>${new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</strong></div>
      </div>
    `;
  }

  renderError(body) {
    body.innerHTML = `
      <div class="api-error">
        <div>Не удалось загрузить погоду</div>
        <button class="api-retry" type="button">Повторить</button>
      </div>
    `;
    body.querySelector('.api-retry').addEventListener('click', () => this.load());
  }

  destroy() {
    if (this.controller) this.controller.abort();
  }
}

/* =====================================================
   CURRENCY WIDGET (Frankfurter)
   ===================================================== */
class CurrencyWidget extends UIComponent {
  constructor(opts = {}) {
    super({
      id: opts.id || ('currency-' + Date.now()),
      title: 'Курсы валют',
      icon: 'coins'
    });
    this.base = 'EUR';
    this.symbols = ['USD', 'GBP', 'JPY', 'CHF'];
    this.controller = null;
  }

  render() {
    return `
      ${this.headerHTML()}
      <div class="widget-content" id="body-${this.id}">
        <div class="api-loading">Загрузка курсов…</div>
      </div>
    `;
  }

  attach() { this.load(); }

  async load() {
    const body = this.element.querySelector(`#body-${this.id}`);
    body.innerHTML = '<div class="api-loading">Загрузка курсов…</div>';

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();

    try {
      const url = `https://api.frankfurter.dev/v1/latest?base=${this.base}&symbols=${this.symbols.join(',')}`;
      const resp = await fetch(url, { signal: this.controller.signal });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      this.renderRates(body, data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      this.renderError(body);
    }
  }

  renderRates(body, data) {
    const rates = data.rates || {};
    const main = rates.USD != null ? rates.USD.toFixed(4) : '—';
    const rows = Object.entries(rates).map(([code, val]) => `
      <div class="currency-row"><span>1 ${this.base} → ${code}</span><strong>${val.toFixed(4)}</strong></div>
    `).join('');
    body.innerHTML = `
      <div class="currency-main">
        <div class="currency-pair">${this.base} → USD</div>
        <div class="currency-rate">${main}</div>
        <div class="currency-date">Курс на ${data.date || '—'}</div>
      </div>
      <div class="currency-list">${rows}</div>
    `;
  }

  renderError(body) {
    body.innerHTML = `
      <div class="api-error">
        <div>Не удалось загрузить курсы</div>
        <button class="api-retry" type="button">Повторить</button>
      </div>
    `;
    body.querySelector('.api-retry').addEventListener('click', () => this.load());
  }

  destroy() {
    if (this.controller) this.controller.abort();
  }
}

/* =====================================================
   DASHBOARD
   ===================================================== */
const WIDGET_TYPES = {
  todo: ToDoWidget,
  weather: WeatherWidget,
  currency: CurrencyWidget
};
const BASE_IDS = ['stopwatch', 'chart', 'search', 'goal', 'status', 'book'];

class Dashboard {
  constructor(rootEl) {
    this.root = rootEl;
    this.instances = new Map();

    this.root.addEventListener('click', (e) => {
      const ctrl = e.target.closest('[data-ctrl]');
      if (!ctrl) return;
      const widgetEl = ctrl.closest('.widget');
      if (!widgetEl) return;
      if (ctrl.dataset.ctrl === 'collapse') this.toggleCollapse(widgetEl);
      else if (ctrl.dataset.ctrl === 'delete') this.removeWidget(widgetEl);
    });
  }

  addWidget(type, id) {
    const Ctor = WIDGET_TYPES[type];
    if (!Ctor) return null;

    const opts = { id };
    if (type === 'todo') {
      opts.tasks = id ? state.tasks.filter(t => t.widgetId === id) : [];
    }

    const instance = new Ctor(opts);
    instance.mount(this.root);
    this.instances.set(instance.id, instance);

    if (!state.dynamic.find(w => w.id === instance.id)) {
      state.dynamic.push({ id: instance.id, type });
      saveState();
    }
    return instance;
  }

  removeWidget(widgetEl) {
    const id = widgetEl.dataset.widgetId;
    const inst = this.instances.get(id);
    if (inst && typeof inst.destroy === 'function') {
      try { inst.destroy(); } catch (e) {}
    }
    this.instances.delete(id);

    if (BASE_IDS.includes(id)) {
      if (!state.baseHidden.includes(id)) state.baseHidden.push(id);
    } else {
      state.dynamic = state.dynamic.filter(w => w.id !== id);
      state.tasks = state.tasks.filter(t => t.widgetId !== id);
    }
    widgetEl.remove();
    saveState();
  }

  toggleCollapse(widgetEl) {
    widgetEl.classList.toggle('collapsed');
    const btn = widgetEl.querySelector('[data-ctrl="collapse"]');
    if (btn) btn.textContent = widgetEl.classList.contains('collapsed') ? '+' : '−';
  }

  hasInstanceOfClass(Ctor) {
    for (const inst of this.instances.values()) {
      if (inst.constructor === Ctor) return true;
    }
    return false;
  }

  restore() {
    state.baseHidden.forEach(id => {
      const el = this.root.querySelector(`[data-widget-id="${id}"]`);
      if (el) el.remove();
    });
    state.dynamic.forEach(({ id, type }) => {
      const Ctor = WIDGET_TYPES[type];
      if (!Ctor) return;
      const opts = { id };
      if (type === 'todo') opts.tasks = state.tasks.filter(t => t.widgetId === id);
      const inst = new Ctor(opts);
      inst.mount(this.root);
      this.instances.set(inst.id, inst);
    });
  }
}

/* =====================================================
   ИНИЦИАЛИЗАЦИЯ
   ===================================================== */
loadState();
const dashboardEl = document.getElementById('dashboard');
const dashboard = new Dashboard(dashboardEl);
dashboard.restore();

if (window.lucide) lucide.createIcons();

document.querySelectorAll('[data-add]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.add;
    const Ctor = WIDGET_TYPES[type];
    if (!Ctor) return;

    if (type !== 'todo' && dashboard.hasInstanceOfClass(Ctor)) {
      btn.classList.add('disabled');
      setTimeout(() => btn.classList.remove('disabled'), 1200);
      return;
    }

    dashboard.addWidget(type);
    if (window.lucide) lucide.createIcons();
  });
});

/* =====================================================
   СУЩЕСТВУЮЩАЯ ЛОГИКА (не тронута)
   ===================================================== */

/* 1. СЕКУНДОМЕР */
let swSeconds = 0;
let swInterval = null;
const swDisplay  = document.getElementById('stopwatch-display');
const swToggle   = document.getElementById('sw-toggle');
const swReset    = document.getElementById('sw-reset');

function formatTime(totalSec) {
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function startStopwatch() {
  if (swInterval) return;
  swToggle.textContent = 'Пауза';
  swToggle.classList.remove('btn-primary');
  swInterval = setInterval(() => {
    swSeconds++;
    swDisplay.textContent = formatTime(swSeconds);
  }, 1000);
}
function pauseStopwatch() {
  clearInterval(swInterval);
  swInterval = null;
  swToggle.textContent = 'Продолжить';
  swToggle.classList.add('btn-primary');
}
if (swToggle) swToggle.addEventListener('click', () => {
  if (swInterval) pauseStopwatch(); else startStopwatch();
});
if (swReset) swReset.addEventListener('click', () => {
  pauseStopwatch();
  swSeconds = 0;
  swDisplay.textContent = '00:00:00';
  swToggle.textContent = 'Старт';
  swToggle.classList.add('btn-primary');
});

/* 2. ГРАФИК */
const readingData = [
  { day: 'Пн', minutes: 45, entries: ['45 мин — «Мастер и Маргарита»'] },
  { day: 'Вт', minutes: 80, entries: ['50 мин — «Мастер и Маргарита»', '30 мин — «1984»'] },
  { day: 'Ср', minutes: 30, entries: ['30 мин — «1984»'] },
  { day: 'Чт', minutes: 120, entries: ['120 мин — «Преступление и наказание»'] },
  { day: 'Пт', minutes: 60, entries: ['60 мин — «Преступление и наказание»'] },
  { day: 'Сб', minutes: 90, entries: ['90 мин — «Война и мир»'] },
  { day: 'Вс', minutes: 25, entries: ['25 мин — «Война и мир»'] }
];
const chartEl = document.getElementById('chart');
const chartDetails = document.getElementById('chart-details');
if (chartEl && chartDetails) {
  const maxMinutes = Math.max(...readingData.map(d => d.minutes));
  readingData.forEach(d => {
    const h = (d.minutes / maxMinutes) * 100;
    const wrapper = document.createElement('div');
    wrapper.className = 'bar-wrapper';
    wrapper.innerHTML = `
      <div class="bar" style="height:${h}%"></div>
      <div class="bar-label">${d.day}</div>
    `;
    wrapper.addEventListener('click', () => {
      document.querySelectorAll('.bar-wrapper').forEach(w => w.classList.remove('active'));
      wrapper.classList.add('active');
      chartDetails.innerHTML = `<strong>${d.day}</strong> — всего ${d.minutes} мин<br>` +
        d.entries.map(e => `• ${e}`).join('<br>');
    });
    chartEl.appendChild(wrapper);
  });
}

/* 3. ПОИСК КНИГ */
const searchInput = document.getElementById('book-search-input');
const searchResults = document.getElementById('search-results');
let searchTimeout;

async function searchBooks(query) {
  if (query.length < 3) {
    searchResults.innerHTML = '<div class="search-hint">Введите минимум 3 символа</div>';
    return;
  }
  searchResults.innerHTML = '<div class="search-hint">Поиск...</div>';
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=6`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка сети');
    const data = await response.json();
    if (!data.docs || data.docs.length === 0) {
      searchResults.innerHTML = '<div class="search-hint">Ничего не найдено</div>';
      return;
    }
    searchResults.innerHTML = data.docs.map(book => {
      const title = book.title || 'Без названия';
      const author = book.author_name ? book.author_name[0] : 'Автор неизвестен';
      const coverId = book.cover_i;
      const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-S.jpg` : '';
      const coverHtml = coverUrl
        ? `<img src="${coverUrl}" class="result-cover" alt="">`
        : `<div class="result-cover"></div>`;
      return `
        <div class="result-item">
          ${coverHtml}
          <div class="result-info">
            <div class="result-title">${title}</div>
            <div class="result-author">${author}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    searchResults.innerHTML = '<div class="search-hint">Ошибка поиска. Проверьте интернет.</div>';
  }
}
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchBooks(e.target.value.trim()), 600);
  });
}

/* 4. КНИГА ДНЯ */
const randomBooks = [
  { title: 'Мастер и Маргарита', author: 'Михаил Булгаков' },
  { title: 'Преступление и наказание', author: 'Фёдор Достоевский' },
  { title: 'Война и мир', author: 'Лев Толстой' },
  { title: 'Евгений Онегин', author: 'Александр Пушкин' },
  { title: 'Мёртвые души', author: 'Николай Гоголь' },
  { title: 'Отцы и дети', author: 'Иван Тургенев' },
  { title: 'Герой нашего времени', author: 'Михаил Лермонтов' }
];

async function loadRandomBook() {
  const titleEl = document.getElementById('random-title');
  const authorEl = document.getElementById('random-author');
  const coverEl = document.getElementById('random-cover');
  const linkEl = document.getElementById('random-link');
  if (!titleEl) return;

  const random = randomBooks[Math.floor(Math.random() * randomBooks.length)];
  try {
    const resp = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(random.title)}&limit=1`);
    const data = await resp.json();
    if (data.docs && data.docs[0] && data.docs[0].cover_i) {
      const coverUrl = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
      coverEl.innerHTML = `<img src="${coverUrl}" alt="">`;
    }
  } catch (e) {
    coverEl.innerHTML = '<i data-lucide="book"></i>';
    if (window.lucide) lucide.createIcons();
  }
  titleEl.textContent = random.title;
  authorEl.textContent = random.author;
  linkEl.href = `https://www.litres.ru/search/?q=${encodeURIComponent(random.title)}`;
}
loadRandomBook();

/* 5. СТАТУС СЕРВИСОВ */
async function checkOpenLibrary() {
  const dot = document.getElementById('st-openlib');
  const val = document.getElementById('st-openlib-val');
  if (!dot) return;
  try {
    const resp = await fetch('https://openlibrary.org/search.json?q=test&limit=1');
    if (resp.ok) {
      dot.className = 'status-dot dot-green';
      val.textContent = 'онлайн';
    } else {
      dot.className = 'status-dot dot-yellow';
      val.textContent = 'задержка';
    }
  } catch {
    dot.className = 'status-dot dot-red';
    val.textContent = 'офлайн';
  }
}
checkOpenLibrary();
setInterval(checkOpenLibrary, 60000);

/* 6. ЦЕЛЬ НА ГОД */
const goalState = { current: 12, target: 20 };
try {
  const saved = JSON.parse(localStorage.getItem('bookGoal') || 'null');
  if (saved && typeof saved.current === 'number' && typeof saved.target === 'number') {
    goalState.current = saved.current;
    goalState.target  = saved.target;
  }
} catch (e) {}

const goalCurrentEl = document.getElementById('goal-current');
const goalTargetEl  = document.getElementById('goal-target');
const goalFillEl    = document.getElementById('goal-fill');
const goalPercentEl = document.getElementById('goal-percent');
const goalLeftEl    = document.getElementById('goal-left');

function saveGoal() {
  try { localStorage.setItem('bookGoal', JSON.stringify(goalState)); } catch (e) {}
}

function renderGoal(bumpEl) {
  if (!goalCurrentEl) return;
  goalCurrentEl.textContent = goalState.current;
  goalTargetEl.textContent  = goalState.target;
  const percent = goalState.target > 0
    ? Math.min(100, Math.round((goalState.current / goalState.target) * 100))
    : 0;
  goalFillEl.style.width = percent + '%';
  goalPercentEl.textContent = percent + '% выполнено';
  const left = Math.max(0, goalState.target - goalState.current);
  goalLeftEl.textContent = left === 0 ? 'цель достигнута!' : 'осталось ' + left;

  document.querySelectorAll('.step-btn').forEach(btn => {
    const type  = btn.dataset.type;
    const delta = parseInt(btn.dataset.delta, 10);
    if (type === 'current') {
      btn.disabled = (delta < 0 && goalState.current <= 0) ||
                     (delta > 0 && goalState.current >= 999);
    } else {
      btn.disabled = (delta < 0 && goalState.target <= 1) ||
                     (delta > 0 && goalState.target >= 999);
    }
  });

  if (bumpEl) {
    bumpEl.classList.remove('bump');
    void bumpEl.offsetWidth;
    bumpEl.classList.add('bump');
    setTimeout(() => bumpEl.classList.remove('bump'), 180);
  }
}

document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type  = btn.dataset.type;
    const delta = parseInt(btn.dataset.delta, 10);
    if (type === 'current') {
      goalState.current = Math.max(0, Math.min(999, goalState.current + delta));
      renderGoal(goalCurrentEl);
    } else {
      goalState.target = Math.max(1, Math.min(999, goalState.target + delta));
      renderGoal(goalTargetEl);
    }
    saveGoal();
  });
});
renderGoal();