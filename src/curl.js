'use strict';

function quote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function buildCurl(request) {
  if (!request || !request.url) return { command: '', error: '请求地址不可用' };
  if (request.requestBodyType === 'hex' || request.requestBodyType === 'form-data') {
    return { command: '', error: '该请求包含二进制或 multipart 数据，无法生成可准确重放的 cURL' };
  }

  const lines = [`curl -X ${quote(request.method || 'GET')} ${quote(request.url)}`];
  const headers = request.requestHeaders || {};
  for (const [name, rawValue] of Object.entries(headers)) {
    if (rawValue === null || rawValue === undefined) continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) lines.push(`-H ${quote(`${name}: ${value}`)}`);
  }
  if (request.requestBody !== undefined && request.requestBody !== null) {
    lines.push(`--data-raw ${quote(request.requestBody)}`);
  }
  return { command: lines.join(' \\\n  '), error: '' };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { buildCurl, quote };
if (typeof window !== 'undefined') window.QuecCurl = { buildCurl, quote };
