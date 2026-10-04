import { useEffect, useState } from 'react'
import { AlertCircle, Download, ExternalLink, Loader2 } from 'lucide-react'
import { invoiceApi } from '../api/client'

export default function FilePreview({ invoiceId, filename }) {
  const [state, setState] = useState('loading')
  const [url, setUrl] = useState(null)
  const [type, setType] = useState('')

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    setState('loading')

    invoiceApi
      .fileBlob(invoiceId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
        setType(blob.type)
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [invoiceId])

  const isPdf = type === 'application/pdf'

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
        <p className="truncate text-sm font-medium text-ink-700">{filename}</p>
        {state === 'ready' && (
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Open in new tab"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-white hover:text-ink-900"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={url}
              download={filename}
              title="Download"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-white hover:text-ink-900"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      <div className="relative flex-1 bg-ink-100">
        {state === 'loading' && (
          <div className="absolute inset-0 grid place-items-center text-ink-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-ink-500">
            <AlertCircle className="h-6 w-6 text-red-500" />
            Could not load the file. It may have been moved or deleted from the server.
          </div>
        )}
        {state === 'ready' && isPdf && (
          <iframe title="Invoice preview" src={url} className="absolute inset-0 h-full w-full border-0" />
        )}
        {state === 'ready' && !isPdf && (
          <div className="absolute inset-0 overflow-auto p-3">
            <img src={url} alt="Invoice" className="mx-auto h-auto max-w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  )
}