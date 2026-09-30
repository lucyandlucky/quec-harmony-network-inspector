import { useEffect, useRef, useState } from 'react'
import { buildCurl } from '../curl'
import type { InspectorEvent } from '../types'
import activityIcon from '../icons/activity.svg'
import copyIcon from '../icons/copy.svg'
import { dateTimeOf, durationOf, requestPath, statusOf, timeOf } from './format'

type DetailTab = 'overview' | 'headers' | 'body' | 'curl'

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-'
  if (Array.isArray(value)) return value.map(String).join('\n')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function InfoGrid({ entries }: { entries: Array<[string, unknown]> }) {
  return <dl className="info-grid">{entries.map(([name, value]) =>
    <div className="info-row" key={name}><dt>{name}</dt><dd>{displayValue(value)}</dd></div>
  )}</dl>
}

function HeaderGrid({ headers }: { headers?: Record<string, unknown> }) {
  const entries = Object.entries(headers || {})
  return entries.length ? <InfoGrid entries={entries} /> : <div className="muted">(none)</div>
}

function BodyBlock({ body, type }: { body?: string; type?: string }) {
  if (body === undefined || body === null) return <div className="muted">(none)</div>
  let value = body
  if (type === 'json' || type === 'text') {
    try { value = JSON.stringify(JSON.parse(body), null, 2) } catch { /* keep raw text */ }
  }
  return <pre className="code-block">{value}</pre>
}

function DetailContent({ item, tab }: { item: InspectorEvent; tab: DetailTab }) {
  const curl = buildCurl(item)
  if (tab === 'overview') return <>
    <section className="content-section"><h3>请求</h3><InfoGrid entries={[
      ['方法', item.method], ['地址', item.url], ['包名', item.bundleName], ['设备', item.device]
    ]} /></section>
    <section className="content-section"><h3>响应</h3><InfoGrid entries={[
      ['HTTP 状态', item.status], ['耗时', durationOf(item)],
      ['完成时间', item.phase === 'request' ? '-' : dateTimeOf(item.time)], ['错误', item.error]
    ]} /></section>
  </>
  if (tab === 'headers') return <>
    <section className="content-section"><h3>请求头</h3><HeaderGrid headers={item.requestHeaders} /></section>
    <section className="content-section"><h3>响应头</h3><HeaderGrid headers={item.responseHeaders} /></section>
  </>
  if (tab === 'body') return <>
    <section className="content-section"><h3>请求体</h3><BodyBlock body={item.requestBody} type={item.requestBodyType} /></section>
    <section className="content-section"><h3>响应体</h3><BodyBlock body={item.responseBody} type={item.responseBodyType} /></section>
  </>
  return <section className="content-section"><h3>cURL</h3>
    {curl.command ? <pre className="code-block curl">{curl.command}</pre> : <div className="error-text">{curl.error}</div>}
  </section>
}

export function RequestDetail({ item }: { item: InspectorEvent | null }) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCopied(false)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    return () => { if (copyTimer.current) clearTimeout(copyTimer.current) }
  }, [item?.key])

  if (!item) return <main className="detail-pane">
    <div className="detail-empty">
      <div className="empty-symbol"><img src={activityIcon} alt="" /></div>
      <h2>选择一个请求</h2><p>暂无请求详情</p>
    </div>
  </main>

  const status = statusOf(item)
  const curl = buildCurl(item)
  const tabs: Array<[DetailTab, string]> = [
    ['overview', '概览'], ['headers', '请求头 / 响应头'], ['body', 'Body'], ['curl', 'cURL']
  ]

  async function copyCurl(): Promise<void> {
    if (!curl.command) return
    await window.inspector.copy(curl.command)
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  return <main className="detail-pane">
    <div className="detail-view">
      <header className="detail-header">
        <div className="detail-heading">
          <div className="detail-eyebrow"><span>{item.bundleName}</span><span>{timeOf(item.startedAt)}</span></div>
          <div className="detail-title-row"><span className="method-label">{item.method}</span><h2 title={requestPath(item.url)}>{requestPath(item.url)}</h2></div>
          <div className="detail-url">{item.url}</div>
        </div>
        <button className="command-button" type="button" title="复制 cURL" disabled={!curl.command} onClick={() => void copyCurl()}>
          <img src={copyIcon} alt="" /><span>{copied ? '已复制' : '复制 cURL'}</span>
        </button>
      </header>
      <div className="detail-summary">
        <div className="summary-item"><span>状态</span><strong className={status.className === 'error' ? 'bad' : status.className === 'pending' ? 'pending' : 'good'}>{status.label}</strong></div>
        <div className="summary-item"><span>耗时</span><strong>{durationOf(item)}</strong></div>
        <div className="summary-item"><span>开始时间</span><strong>{dateTimeOf(item.startedAt)}</strong></div>
      </div>
      <nav className="tabs" aria-label="请求详情">
        {tabs.map(([key, label]) => <button key={key} type="button" className={`tab${activeTab === key ? ' active' : ''}`}
          aria-current={activeTab === key ? 'page' : undefined} onClick={() => setActiveTab(key)}>{label}</button>)}
      </nav>
      <div className="detail-content"><DetailContent item={item} tab={activeTab} /></div>
    </div>
  </main>
}
