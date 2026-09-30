import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionStatus, InspectorEvent } from '../types'
import activityIcon from '../icons/activity.svg'
import cableIcon from '../icons/cable.svg'
import chevronIcon from '../icons/chevron-down.svg'
import pauseIcon from '../icons/pause.svg'
import playIcon from '../icons/play.svg'
import refreshIcon from '../icons/refresh-cw.svg'
import searchIcon from '../icons/search.svg'
import trashIcon from '../icons/trash-2.svg'
import { durationOf, requestHost, requestPath, statusOf } from './format'
import { RequestDetail } from './RequestDetail'
import { filterRequests, requestsForDevice } from './requests'

const emptyConnection: ConnectionStatus = { state: 'disconnected', message: '未连接设备' }

export function App() {
  const [devices, setDevices] = useState<string[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [selectedDevice, setSelectedDevice] = useState('')
  const selectedDeviceRef = useRef('')
  const [connection, setConnection] = useState<ConnectionStatus>(emptyConnection)
  const connectionRef = useRef<ConnectionStatus>(emptyConnection)
  const connectSequence = useRef(0)
  const [transactions, setTransactions] = useState<Map<string, InspectorEvent>>(() => new Map())
  const [selectedKey, setSelectedKey] = useState('')
  const [search, setSearch] = useState('')
  const [appFilter, setAppFilter] = useState('')

  function applyConnection(status: ConnectionStatus): void {
    connectionRef.current = status
    setConnection(status)
  }

  async function connectDevice(serial: string): Promise<void> {
    if (!serial) return
    const sequence = ++connectSequence.current
    applyConnection({ state: 'connecting', serial, message: '连接中' })
    try {
      const result = await window.inspector.connect(serial)
      if (result.error && sequence === connectSequence.current && selectedDeviceRef.current === serial) {
        applyConnection({ state: 'error', serial, message: result.error })
      }
    } catch (error) {
      if (sequence === connectSequence.current && selectedDeviceRef.current === serial) {
        applyConnection({ state: 'error', serial, message: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  async function refreshDevices(): Promise<void> {
    setLoadingDevices(true)
    try {
      const result = await window.inspector.listDevices()
      setDevices(result.devices)
      const current = selectedDeviceRef.current
      const next = result.devices.includes(current) ? current : result.devices[0] || ''
      if (next !== current) {
        selectedDeviceRef.current = next
        setSelectedDevice(next)
        setSelectedKey('')
        setSearch('')
        setAppFilter('')
      }
      if (!next) {
        ++connectSequence.current
        await window.inspector.disconnect()
        applyConnection({ state: result.error ? 'error' : 'disconnected', message: result.error || '未连接设备' })
      } else if (connectionRef.current.serial !== next ||
        (connectionRef.current.state !== 'connected' && connectionRef.current.state !== 'connecting')) {
        await connectDevice(next)
      }
    } catch (error) {
      applyConnection({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoadingDevices(false)
    }
  }

  useEffect(() => {
    const offEvent = window.inspector.onEvent((event) => {
      setTransactions((previous) => {
        const next = new Map(previous)
        next.set(event.key, { ...next.get(event.key), ...event })
        while (next.size > 1000) next.delete(next.keys().next().value!)
        return next
      })
    })
    const offStatus = window.inspector.onStatus((status) => {
      if (status.serial && status.serial !== selectedDeviceRef.current) return
      applyConnection(status)
    })
    void refreshDevices()
    return () => { offEvent(); offStatus() }
  }, [])

  const deviceRequests = useMemo(() => requestsForDevice(transactions.values(), selectedDevice), [transactions, selectedDevice])
  const appNames = useMemo(() => [...new Set(deviceRequests.map((item) => item.bundleName))].sort(), [deviceRequests])
  const filteredRequests = useMemo(() => filterRequests(deviceRequests, appFilter, search), [deviceRequests, appFilter, search])
  const selectedItem = deviceRequests.find((item) => item.key === selectedKey) || deviceRequests.at(-1) || null
  const connected = connection.state === 'connected' && connection.serial === selectedDevice

  function selectDevice(serial: string): void {
    selectedDeviceRef.current = serial
    setSelectedDevice(serial)
    setSelectedKey('')
    setSearch('')
    setAppFilter('')
    void connectDevice(serial)
  }

  async function toggleConnection(): Promise<void> {
    if (connected) {
      ++connectSequence.current
      await window.inspector.disconnect()
      applyConnection({ state: 'disconnected', serial: selectedDevice, message: selectedDevice })
    } else {
      await connectDevice(selectedDevice)
    }
  }

  function clearRequests(): void {
    setTransactions((previous) => {
      const next = new Map(previous)
      for (const [key, item] of next) {
        if (item.device === selectedDevice) next.delete(key)
      }
      return next
    })
    setSelectedKey('')
  }

  const connectionLabel = connected ? '采集中' : connection.state === 'connecting' ? '连接中' :
    connection.state === 'error' ? '连接失败' : '未连接'

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><img src={activityIcon} alt="" /></div>
        <div className="brand-copy"><strong>Quec Network Inspector</strong><span>HarmonyOS</span></div>
      </div>
      <div className="device-tools">
        <div className="device-select-wrap">
          <img src={cableIcon} alt="" />
          <select aria-label="设备" value={selectedDevice} onChange={(event) => selectDevice(event.target.value)}>
            {!devices.length && <option value="">{loadingDevices ? '查找设备中' : '无可用设备'}</option>}
            {devices.map((serial) => <option key={serial} value={serial}>{serial}</option>)}
          </select>
          <img className="select-chevron" src={chevronIcon} alt="" />
        </div>
        <button className="icon-button" type="button" title="刷新设备" aria-label="刷新设备"
          onClick={() => void refreshDevices()}><img src={refreshIcon} alt="" /></button>
        <button className="icon-button" type="button" title={connected ? '断开设备' : '连接设备'}
          aria-label={connected ? '断开设备' : '连接设备'} disabled={!selectedDevice}
          onClick={() => void toggleConnection()}><img src={connected ? pauseIcon : playIcon} alt="" /></button>
        <div className={`connection-status ${connected ? 'online' : connection.state === 'error' ? 'error' : 'offline'}`}>
          <span className="status-dot" /><span>{connectionLabel}</span>
        </div>
      </div>
    </header>

    <div className="workbench">
      <section className="request-pane" aria-label="请求列表">
        <div className="pane-top">
          <div className="pane-heading"><h1>请求</h1><span className="count">{deviceRequests.length}</span></div>
          <button className="icon-button" type="button" title="清空请求" aria-label="清空请求"
            onClick={clearRequests}><img src={trashIcon} alt="" /></button>
        </div>
        <div className="filters">
          <label className="search-box"><img src={searchIcon} alt="" />
            <input type="search" placeholder="搜索 URL" aria-label="搜索请求" value={search}
              onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="app-select-wrap">
            <select aria-label="按包名筛选" value={appFilter} onChange={(event) => setAppFilter(event.target.value)}>
              <option value="">全部应用</option>
              {appNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select><img src={chevronIcon} alt="" />
          </div>
        </div>
        <div className="request-columns" aria-hidden="true"><span>方法 / 请求</span><span>状态</span><span>耗时</span></div>
        <div className="request-list">
          {!filteredRequests.length ? <div className="list-empty">
            <img src={activityIcon} alt="" /><strong>暂无请求</strong>
            <span>{connected ? '等待请求' : '未连接设备'}</span>
          </div> : filteredRequests.map((item) => {
            const status = statusOf(item)
            return <button key={item.key} className={`request-row${selectedItem?.key === item.key ? ' selected' : ''}`}
              type="button" title={`${item.method} ${item.url}`} onClick={() => setSelectedKey(item.key)}>
              <span className="request-name">
                <span className="request-primary"><span className={`method ${item.method}`}>{item.method}</span>
                  <span className="request-path">{requestPath(item.url)}</span></span>
                <span className="request-subtitle">{item.bundleName} · {requestHost(item.url)}</span>
              </span>
              <span className={`request-status ${status.className}`}>{status.label}</span>
              <span className="request-duration">{durationOf(item)}</span>
            </button>
          })}
        </div>
        <div className="pane-footer"><span>显示 {filteredRequests.length} 条</span>
          <span>{connection.message || selectedDevice || '未连接设备'}</span></div>
      </section>
      <RequestDetail item={selectedItem} />
    </div>
  </div>
}
