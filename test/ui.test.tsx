import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '../src/renderer/App'
import type { ConnectionStatus, InspectorBridge, InspectorEvent } from '../src/types'

afterEach(cleanup)

function response(device: string, id: number, path: string): InspectorEvent {
  return {
    phase: 'response', id, time: id, startedAt: id, durationMs: 388,
    method: 'GET', url: `https://example.com${path}`, status: 200,
    requestHeaders: { Authorization: 'Bearer token' }, responseBody: '{"code":200}', responseBodyType: 'json',
    bundleName: 'com.quectel.ioe', device, sessionId: 'session', key: `${device}|com.quectel.ioe|session|${id}`
  }
}

test('selecting 5557 shows only its requests and keeps details and cURL usable', async () => {
  const eventListeners = new Set<(event: InspectorEvent) => void>()
  const statusListeners = new Set<(status: ConnectionStatus) => void>()
  const connect = vi.fn(async (serial: string) => {
    for (const listener of statusListeners) listener({ state: 'connected', serial })
    return { error: '' }
  })
  const copy = vi.fn(async (_value: string) => {})
  const bridge: InspectorBridge = {
    listDevices: async () => ({ devices: ['127.0.0.1:5555', '127.0.0.1:5557'], error: '' }),
    connect,
    disconnect: async () => {},
    copy,
    onEvent: (listener) => { eventListeners.add(listener); return () => { eventListeners.delete(listener) } },
    onStatus: (listener) => { statusListeners.add(listener); return () => { statusListeners.delete(listener) } }
  }
  window.inspector = bridge
  render(<App />)

  await waitFor(() => expect(connect).toHaveBeenCalledWith('127.0.0.1:5555'))
  fireEvent.change(screen.getByLabelText('设备'), { target: { value: '127.0.0.1:5557' } })
  await waitFor(() => expect(connect).toHaveBeenCalledWith('127.0.0.1:5557'))
  act(() => {
    for (const listener of eventListeners) {
      listener(response('127.0.0.1:5555', 1, '/old'))
      listener(response('127.0.0.1:5557', 2, '/new'))
      listener(response('127.0.0.1:5557', 3, '/latest'))
    }
  })

  const list = screen.getByRole('region', { name: '请求列表' })
  expect(within(list).getByText('/new')).toBeTruthy()
  expect(within(list).getByText('/latest')).toBeTruthy()
  expect(within(list).queryByText('/old')).toBeNull()
  expect(within(list).getByText('显示 2 条')).toBeTruthy()
  expect(within(list).getAllByTitle(/^GET https:\/\/example.com/).map((row) => row.textContent)).toEqual([
    expect.stringContaining('/new'), expect.stringContaining('/latest')
  ])
  expect(screen.getAllByText('388 ms').length).toBeGreaterThan(0)
  expect(screen.getByRole('heading', { name: '/latest' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: '请求头 / 响应头' }))
  expect(screen.getByText('Bearer token')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Body' }))
  expect(screen.getByText(/"code": 200/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'cURL' }))
  expect(screen.getByText(/curl -X 'GET' 'https:\/\/example.com\/latest'/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '复制 cURL' }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining('https://example.com/latest')))
})
