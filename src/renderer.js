'use strict';

const transactions = new Map();
let selectedKey = '';
let activeTab = 'overview';
let connectedSerial = '';
let connectionState = 'disconnected';

const $ = (id) => document.getElementById(id);
const deviceSelect = $('device-select');
const appFilter = $('app-filter');
const requestSearch = $('request-search');
const requestList = $('request-list');

function text(tag, value, className = '') {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}

function requestPath(value) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}` || '/';
  } catch (_) {
    return value || '/';
  }
}

function requestHost(value) {
  try { return new URL(value).host; } catch (_) { return ''; }
}

function timeOf(value) {
  return Number.isFinite(value) ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false }) : '-';
}

function dateTimeOf(value) {
  return Number.isFinite(value) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function statusOf(item) {
  if (item.phase === 'request') return { label: '等待', className: 'pending' };
  if (item.phase === 'error' && !item.status) return { label: '错误', className: 'error' };
  if (Number.isFinite(item.status)) {
    return { label: String(item.status), className: item.status >= 400 || item.phase === 'error' ? 'error' : '' };
  }
  return { label: '错误', className: 'error' };
}

function durationOf(item) {
  if (!Number.isFinite(item.durationMs)) return '-';
  return `${item.durationMs} ms`;
}

function filteredRequests() {
  const query = requestSearch.value.trim().toLowerCase();
  return [...transactions.values()]
    .filter((item) => (!appFilter.value || item.bundleName === appFilter.value) &&
      (!query || `${item.method} ${item.url} ${item.status || ''}`.toLowerCase().includes(query)))
    .sort((a, b) => b.startedAt - a.startedAt || b.time - a.time);
}

function updateAppOptions() {
  const previous = appFilter.value;
  const names = [...new Set([...transactions.values()].map((item) => item.bundleName))].sort();
  appFilter.replaceChildren(new Option('全部应用', ''));
  for (const name of names) appFilter.add(new Option(name, name));
  appFilter.value = names.includes(previous) ? previous : '';
}

function renderList() {
  const items = filteredRequests();
  $('request-count').textContent = String(transactions.size);
  $('visible-count').textContent = `显示 ${items.length} 条`;
  requestList.replaceChildren();
  if (!items.length) {
    const empty = text('div', '', 'list-empty');
    const icon = document.createElement('img');
    icon.src = 'icons/activity.svg';
    icon.alt = '';
    empty.append(icon, text('strong', '暂无请求'), text('span', connectionState === 'connected' ? '等待请求' : '未连接设备'));
    requestList.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const row = text('button', '', `request-row${selectedKey === item.key ? ' selected' : ''}`);
    row.type = 'button';
    row.title = `${item.method} ${item.url}`;
    row.addEventListener('click', () => { selectedKey = item.key; renderList(); renderDetail(); });
    const name = text('div', '', 'request-name');
    const primary = text('div', '', 'request-primary');
    primary.append(text('span', item.method, `method ${item.method}`), text('span', requestPath(item.url), 'request-path'));
    name.append(primary, text('span', `${item.bundleName} · ${requestHost(item.url)}`, 'request-subtitle'));
    const status = statusOf(item);
    row.append(name, text('span', status.label, `request-status ${status.className}`),
      text('span', durationOf(item), 'request-duration'));
    fragment.append(row);
  }
  requestList.append(fragment);
}

function addSection(container, heading, child) {
  const section = text('section', '', 'content-section');
  section.append(text('h3', heading), child);
  container.append(section);
}

function infoGrid(entries) {
  const grid = text('dl', '', 'info-grid');
  for (const [name, value] of entries) {
    grid.append(text('dt', name), text('dd', value === undefined || value === null || value === '' ? '-' : String(value)));
  }
  return grid;
}

function headerGrid(headers) {
  const entries = Object.entries(headers || {});
  return entries.length ? infoGrid(entries.map(([name, value]) => [name, Array.isArray(value) ? value.join('\n') : value])) : text('div', '(none)', 'muted');
}

function bodyBlock(body, type) {
  if (body === undefined || body === null) return text('div', '(none)', 'muted');
  let value = body;
  if (type === 'json' || type === 'text') {
    try { value = JSON.stringify(JSON.parse(body), null, 2); } catch (_) { /* keep raw text */ }
  }
  return text('pre', value, 'code-block');
}

function renderContent(item) {
  const content = $('detail-content');
  content.replaceChildren();
  if (activeTab === 'overview') {
    addSection(content, '请求', infoGrid([
      ['方法', item.method], ['地址', item.url], ['包名', item.bundleName], ['设备', item.device]
    ]));
    addSection(content, '响应', infoGrid([
      ['HTTP 状态', item.status], ['耗时', durationOf(item)], ['完成时间', item.phase === 'request' ? '-' : dateTimeOf(item.time)],
      ['错误', item.error]
    ]));
  } else if (activeTab === 'headers') {
    addSection(content, '请求头', headerGrid(item.requestHeaders));
    addSection(content, '响应头', headerGrid(item.responseHeaders));
  } else if (activeTab === 'body') {
    addSection(content, '请求体', bodyBlock(item.requestBody, item.requestBodyType));
    addSection(content, '响应体', bodyBlock(item.responseBody, item.responseBodyType));
  } else {
    const result = window.QuecCurl.buildCurl(item);
    addSection(content, 'cURL', result.command ? text('pre', result.command, 'code-block curl') : text('div', result.error, 'error-text'));
  }
}

function renderDetail() {
  const item = transactions.get(selectedKey);
  $('detail-empty').hidden = Boolean(item);
  $('detail-view').hidden = !item;
  if (!item) return;
  $('detail-package').textContent = item.bundleName;
  $('detail-time').textContent = timeOf(item.startedAt);
  $('detail-method').textContent = item.method;
  $('detail-path').textContent = requestPath(item.url);
  $('detail-url').textContent = item.url;
  const status = statusOf(item);
  $('detail-status').textContent = status.label;
  $('detail-status').className = status.className === 'error' ? 'bad' : status.className === 'pending' ? 'pending' : 'good';
  $('detail-duration').textContent = durationOf(item);
  $('detail-start').textContent = dateTimeOf(item.startedAt);
  $('copy-curl').disabled = !window.QuecCurl.buildCurl(item).command;
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === activeTab));
  renderContent(item);
}

function renderConnection(status) {
  connectionState = status.state;
  connectedSerial = status.state === 'connected' ? status.serial : '';
  const badge = $('connection-status');
  badge.className = `connection-status ${status.state === 'connected' ? 'online' : status.state === 'error' ? 'error' : 'offline'}`;
  $('connection-text').textContent = status.state === 'connected' ? '采集中' :
    status.state === 'connecting' ? '连接中' : status.state === 'error' ? '连接失败' : '未连接';
  $('connection-button').title = connectedSerial ? '断开设备' : '连接设备';
  $('connection-button').setAttribute('aria-label', $('connection-button').title);
  $('connection-icon').src = connectedSerial ? 'icons/pause.svg' : 'icons/play.svg';
  $('device-footer').textContent = status.message || (connectedSerial || '未连接设备');
  if (!transactions.size) renderList();
}

async function connectSelected() {
  const serial = deviceSelect.value;
  if (!serial) return;
  renderConnection({ state: 'connecting', message: '连接中' });
  const result = await window.inspector.connect(serial);
  if (result.error) renderConnection({ state: 'error', message: result.error });
}

async function refreshDevices() {
  const current = deviceSelect.value;
  const result = await window.inspector.listDevices();
  deviceSelect.replaceChildren();
  if (!result.devices.length) {
    deviceSelect.add(new Option('无可用设备', ''));
    renderConnection({ state: result.error ? 'error' : 'disconnected', message: result.error || '未连接设备' });
    return;
  }
  for (const serial of result.devices) deviceSelect.add(new Option(serial, serial));
  deviceSelect.value = result.devices.includes(current) ? current : result.devices[0];
  if (connectedSerial !== deviceSelect.value) await connectSelected();
}

window.inspector.onEvent((event) => {
  const previous = transactions.get(event.key) || {};
  transactions.set(event.key, { ...previous, ...event });
  while (transactions.size > 1000) transactions.delete(transactions.keys().next().value);
  if (!selectedKey || !transactions.has(selectedKey)) selectedKey = event.key;
  updateAppOptions();
  renderList();
  renderDetail();
});
window.inspector.onStatus(renderConnection);

$('refresh-devices').addEventListener('click', refreshDevices);
deviceSelect.addEventListener('change', connectSelected);
$('connection-button').addEventListener('click', async () => {
  if (connectedSerial) await window.inspector.disconnect(); else await connectSelected();
});
$('clear-requests').addEventListener('click', () => {
  transactions.clear();
  selectedKey = '';
  updateAppOptions();
  renderList();
  renderDetail();
});
requestSearch.addEventListener('input', renderList);
appFilter.addEventListener('change', renderList);
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  activeTab = tab.dataset.tab;
  renderDetail();
}));
$('copy-curl').addEventListener('click', async () => {
  const result = window.QuecCurl.buildCurl(transactions.get(selectedKey));
  if (!result.command) return;
  await window.inspector.copy(result.command);
  $('copy-label').textContent = '已复制';
  setTimeout(() => { $('copy-label').textContent = '复制 cURL'; }, 1500);
});

refreshDevices();
