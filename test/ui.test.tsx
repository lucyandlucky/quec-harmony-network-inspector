import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '../src/renderer/App'
import { BodyViewer } from '../src/renderer/BodyViewer'
import type { ConnectionStatus, InspectorBridge, InspectorEvent } from '../src/types'

afterEach(cleanup)

test('JSON bodies collapse nested fields and shorten long strings without losing the source', () => {
  const longText = `long-value-${'x'.repeat(200)}`
  const body = JSON.stringify({ code: 200, data: { total: 47, list: [{ name: 'device' }] }, longText, lastField: true }, null, 4)
  render(<BodyViewer body={body} type="json" />)

  expect(screen.getByText('"total"')).toBeTruthy()
  expect(screen.getByText('"list"')).toBeTruthy()
  expect(screen.queryByText('"device"')).toBeNull()
  fireEvent.click(screen.getByText('"data"'))
  expect(screen.queryByText('"total"')).toBeNull()
  expect(screen.getByText('"lastField"')).toBeTruthy()
  fireEvent.click(screen.getByText('"data"'))
  expect(screen.getByText('"total"')).toBeTruthy()

  expect(screen.queryByText(`"${longText}"`)).toBeNull()
  fireEvent.click(screen.getByText(/^"long-value-x+\.\.\.$/))
  expect(screen.getByText(`"${longText}"`)).toBeTruthy()
  fireEvent.click(screen.getByText(`"${longText}"`))
  expect(screen.queryByText(`"${longText}"`)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: '原始文本' }))
  expect(screen.queryByLabelText('JSON Body')).toBeNull()
  expect(document.querySelector('pre')?.textContent).toBe(body)
  fireEvent.click(screen.getByRole('button', { name: 'JSON 树' }))
  expect(screen.getByLabelText('JSON Body')).toBeTruthy()
})

test.each([
  ['json', '{invalid json'], ['text', '<html>response</html>'],
  ['json', 'null'], ['json', '42'], ['text', '"plain string"'], ['binary', 'eyJjb2RlIjoyMDB9']
])('non-object body (%s, %s) remains readable as text', (type, body) => {
  render(<BodyViewer body={body} type={type} />)
  expect(document.querySelector('pre')?.textContent).toBe(body)
  expect(screen.queryByRole('button', { name: 'JSON 树' })).toBeNull()
})

test('JSON arrays and empty or missing bodies remain readable', () => {
  const view = render(<BodyViewer body='["first","second"]' type="text" />)
  expect(screen.getByText('"first"')).toBeTruthy()
  expect(screen.getByText('"second"')).toBeTruthy()
  view.rerender(<BodyViewer body="" type="json" />)
  expect(document.querySelector('pre')?.textContent).toBe('')
  view.rerender(<BodyViewer />)
  expect(screen.getByText('(none)')).toBeTruthy()
})

function response(device: string, id: number, path: string): InspectorEvent {
  return {
    phase: 'response', id, time: id, startedAt: id, durationMs: 388,
    method: 'GET', url: `https://example.com${path}`, status: 200,
    requestHeaders: { Authorization: 'Bearer token' }, requestBody: '{"email":"a@example.com"}', requestBodyType: 'json',
    responseHeaders: { 'Content-Type': 'application/json' }, responseBody: '{"code":200}', responseBodyType: 'json',
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
  const showRequestMenu = vi.fn(async (_options: { url: string; curl: string }) => {})
  const bridge: InspectorBridge = {
    listDevices: async () => ({ devices: ['127.0.0.1:5555', '127.0.0.1:5557'], error: '' }),
    connect,
    disconnect: async () => {},
    copy,
    showRequestMenu,
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

  fireEvent.click(screen.getByRole('button', { name: '请求' }))
  expect(screen.getByText('Request Headers')).toBeTruthy()
  expect(screen.getByText('Bearer token')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Body' }))
  expect(screen.getByText('"email"')).toBeTruthy()
  expect(screen.getByText('"a@example.com"')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '响应' }))
  expect(screen.getByText('Response Headers')).toBeTruthy()
  expect(screen.getByText('application/json')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Body' }))
  expect(screen.getByText('"code"')).toBeTruthy()
  expect(within(screen.getByLabelText('JSON Body')).getByText('200')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'cURL' }))
  expect(screen.getByText(/curl -X 'GET' 'https:\/\/example.com\/latest'/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '复制 cURL' }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith(expect.stringContaining('https://example.com/latest')))

  fireEvent.contextMenu(within(list).getByTitle('GET https://example.com/new'))
  expect(screen.getByRole('heading', { name: '/new' })).toBeTruthy()
  expect(showRequestMenu).toHaveBeenCalledWith({
    url: 'https://example.com/new',
    curl: expect.stringContaining("curl -X 'GET' 'https://example.com/new'")
  })
})
