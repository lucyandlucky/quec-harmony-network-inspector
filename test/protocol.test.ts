import assert from 'node:assert/strict'
import test from 'node:test'
import { FrameAssembler } from '../src/protocol'

function logLines(event: Record<string, unknown>, chunkLength = 36): string[] {
  const payload = encodeURIComponent(JSON.stringify(event))
  const chunks = payload.match(new RegExp(`.{1,${chunkLength}}`, 'g')) || []
  return chunks.map((chunk, index) =>
    `09-30 15:02:02.100 1234 1234 I A0514C/com.quectel.ioe/QuecInspector: QNI1|session1|7|${index + 1}/${chunks.length}|${chunk}`)
}

function bareLogLines(event: Record<string, unknown>): string[] {
  return logLines(event).map((line) => line.replace('A0514C/com.quectel.ioe/', 'A0514c/'))
}

test('reassembles out-of-order and duplicate HiLog frames', () => {
  const assembler = new FrameAssembler()
  const request = {
    phase: 'response', id: 42, method: 'POST', url: 'https://example.com/login',
    requestHeaders: { Authorization: 'Bearer token' }, requestBody: '姓名=李', status: 200
  }
  const lines = logLines(request)
  const order = [lines.length - 1, ...lines.slice(0, -1).map((_, index) => index)]
  let actual = null
  for (const index of order) actual = assembler.addLine(lines[index], 'device-1') || actual
  assert.equal(actual?.requestBody, '姓名=李')
  assert.equal(actual?.bundleName, 'com.quectel.ioe')
  assert.equal(actual?.key, 'device-1|com.quectel.ioe|session1|42')
  for (const line of lines) assert.equal(assembler.addLine(line, 'device-1'), null)
})

test('ignores unrelated and malformed logs', () => {
  const assembler = new FrameAssembler()
  assert.equal(assembler.addLine('A0514C/com.demo/OtherTag: hello', 'device-1'), null)
  assert.equal(assembler.addLine('A0514C/com.demo/QuecInspector: QNI1|session1|7|2/1|bad', 'device-1'), null)
  assert.equal(assembler.addLine('A0514C/com.demo/QuecInspector: QNI1|session1|7|1/1|%ZZ', 'device-1'), null)
})

test('accepts device logs without a bundle prefix and reads bundle from the event', () => {
  const assembler = new FrameAssembler()
  const event = { phase: 'response', id: 3, method: 'GET', url: 'https://example.com',
    bundleName: 'com.quectel.ioe', status: 200 }
  const results = bareLogLines(event).map((line) => assembler.addLine(line, '127.0.0.1:5557')).filter(Boolean)
  assert.equal(results.length, 1)
  const actual = results[0]
  assert.ok(actual)
  assert.equal(actual.bundleName, 'com.quectel.ioe')
  assert.equal(actual.device, '127.0.0.1:5557')
})

test('shows older bundleless events under an unknown app', () => {
  const assembler = new FrameAssembler()
  const event = { phase: 'request', id: 4, method: 'GET', url: 'https://example.com' }
  const results = bareLogLines(event).map((line) => assembler.addLine(line, '127.0.0.1:5557')).filter(Boolean)
  assert.equal(results.length, 1)
  const actual = results[0]
  assert.ok(actual)
  assert.equal(actual.bundleName, '未知应用')
})
