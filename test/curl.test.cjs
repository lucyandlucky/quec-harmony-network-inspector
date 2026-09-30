'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCurl } = require('../src/curl.js');

test('generates a replayable cURL with URL, headers and form body', () => {
  const result = buildCurl({
    method: 'POST', url: 'https://example.com/login?from=app',
    requestHeaders: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Bearer token' },
    requestBody: 'email=a%40b.com&pwd=x%20y', requestBodyType: 'text'
  });
  assert.equal(result.error, '');
  assert.match(result.command, /curl -X 'POST' 'https:\/\/example.com\/login\?from=app'/);
  assert.match(result.command, /-H 'Authorization: Bearer token'/);
  assert.match(result.command, /--data-raw 'email=a%40b.com&pwd=x%20y'/);
});

test('quotes shell metacharacters and reports unsupported bodies', () => {
  const result = buildCurl({ method: 'POST', url: "https://example.com/a'b", requestBody: "x'$(whoami)" });
  assert.match(result.command, /a'"'"'b/);
  assert.match(result.command, /x'"'"'\$\(whoami\)/);
  assert.equal(buildCurl({ method: 'POST', url: 'https://example.com', requestBodyType: 'form-data' }).command, '');
});
