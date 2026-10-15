import { useMemo, useState } from 'react'
import JsonView from '@uiw/react-json-view'

export function BodyViewer({ body, type }: { body?: string; type?: string }) {
  const [showSource, setShowSource] = useState(false)
  const json = useMemo((): object | null => {
    if (body === undefined || (type !== 'json' && type !== 'text')) return null
    try {
      const value: unknown = JSON.parse(body)
      return value !== null && typeof value === 'object' ? value : null
    } catch {
      return null
    }
  }, [body, type])

  if (body === undefined || body === null) return <div className="muted">(none)</div>
  if (!json) return <pre className="code-block">{body}</pre>

  return <div className="body-viewer">
    <div className="body-toolbar" role="group" aria-label="Body 显示方式">
      <button type="button" aria-pressed={!showSource} onClick={() => setShowSource(false)}>JSON 树</button>
      <button type="button" aria-pressed={showSource} onClick={() => setShowSource(true)}>原始文本</button>
    </div>
    {showSource ? <pre className="code-block">{body}</pre> :
      <div className="json-body" aria-label="JSON Body">
        <JsonView value={json} collapsed={2} displayDataTypes={false}
          enableClipboard={false} highlightUpdates={false} shortenTextAfterLength={80}
          style={{ fontSize: 12, lineHeight: 1.8 }} />
      </div>}
  </div>
}
