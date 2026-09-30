import assert from 'node:assert/strict'
import test from 'node:test'
import type { InspectorEvent } from '../src/types'
import { filterRequests, requestsForDevice } from '../src/renderer/requests'

function event(device: string, id: number, bundleName: string, url: string): InspectorEvent {
  return {
    phase: 'response', id, time: id, startedAt: id, method: 'GET', url, status: 200,
    bundleName, device, sessionId: 'session', key: `${device}|${bundleName}|session|${id}`
  }
}

test('device switch isolates requests and appends new records at the bottom', () => {
  const mixed = [
    event('127.0.0.1:5555', 1, 'com.older.app', 'https://example.com/old'),
    event('127.0.0.1:5557', 2, 'com.quectel.ioe', 'https://example.com/new'),
    event('127.0.0.1:5557', 3, 'com.other.app', 'https://example.com/other')
  ]
  const selected = requestsForDevice(mixed, '127.0.0.1:5557')
  assert.equal(selected.length, 2)
  assert.deepEqual(selected.map((item) => item.id), [2, 3])
  assert.deepEqual([...new Set(selected.map((item) => item.bundleName))].sort(), ['com.other.app', 'com.quectel.ioe'])
  assert.deepEqual(filterRequests(selected, 'com.quectel.ioe', 'NEW').map((item) => item.id), [2])
  assert.deepEqual(requestsForDevice(mixed, '127.0.0.1:5555').map((item) => item.id), [1])
})
