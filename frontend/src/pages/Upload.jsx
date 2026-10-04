import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, ArrowRight, CheckCircle2, FileText, Loader2, Sparkles, UploadCloud, X,
} from 'lucide-react'
import { invoiceApi, getErrorMessage, formatINR } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const ACCEPT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
const MAX_BYTES = 10 * 1024 * 1024

let counter = 0
const nextId = () => `f${++counter}`

function validate(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ACCEPT.includes(ext)) return 'Only PDF, PNG, JPG or WEBP files are allowed'
  if (file.size > MAX_BYTES) return 'File is larger than 10 MB'
  if (file.size === 0) return 'File is empty'
  return null
}

function formatSize(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function FileRow({ item, onRemove }) {
  const { file, status, progress, invoice, error, existingId } = item
  const reading = status === 'uploading' && progress >= 100

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <FileText className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-ink-900">{file.name}</p>
            {(status === 'queued' || status === 'error' || status === 'done') && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label="Remove"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-ink-400">{formatSize(file.size)}</p>

          {status === 'queued' && <p className="mt-2 text-xs text-ink-500">Waiting in queue...</p>}

          {status === 'uploading' && (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all duration-300 ${
                    reading ? 'animate-pulse' : ''
                  }`}
                  style={{ width: `${Math.max(progress, 6)}%` }}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand-700">
                {reading ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    AI is reading the invoice. This can take a few seconds.
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading {progress}%
                  </>
                )}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {error}
                {existingId && (
                  <>
                    {' '}
                    <Link to={`/app/invoices/${existingId}`} className="font-semibold underline">
                      View invoice #{existingId}
                    </Link>
                  </>
                )}
              </span>
            </div>
          )}

          {status === 'done' && invoice && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Uploaded
                </span>
                <span className="text-ink-700">{invoice.vendor?.name ?? 'Vendor not found'}</span>
                <span className="font-mono text-xs text-ink-500">{invoice.invoice_number ?? 'No invoice no.'}</span>
                <span className="font-semibold text-ink-900">{formatINR(invoice.total_amount)}</span>
                <StatusBadge status={invoice.status} />
              </div>

              {invoice.validation_notes && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  {invoice.validation_notes.split('\n')[0]}
                  {invoice.validation_notes.includes('\n') && ' (and more)'}
                </p>
              )}

              <Link
                to={`/app/invoices/${invoice.id}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                {invoice.status === 'needs_review' ? 'Review and fix' : 'Open invoice'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.li>
  )
}

export default function Upload() {
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState([])

  const patch = (id, changes) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))

  async function upload(item) {
    patch(item.id, { status: 'uploading', progress: 0 })
    try {
      const invoice = await invoiceApi.upload(item.file, (p) => patch(item.id, { progress: p }))
      patch(item.id, { status: 'done', invoice })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['my-approvals'] })
    } catch (err) {
      patch(item.id, {
        status: 'error',
        error: getErrorMessage(err, 'Upload failed'),
        existingId: err.response?.data?.detail?.invoice_id ?? null,
      })
    }
  }

  // Ek time par ek hi file upload hoti hai (Gemini free tier ki rate limit ka dhyan)
  useEffect(() => {
    if (items.some((i) => i.status === 'uploading')) return
    const next = items.find((i) => i.status === 'queued')
    if (next) upload(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  function addFiles(fileList) {
    const added = Array.from(fileList).map((file) => {
      const problem = validate(file)
      return {
        id: nextId(),
        file,
        status: problem ? 'error' : 'queued',
        progress: 0,
        error: problem,
      }
    })
    setItems((prev) => [...added, ...prev])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const finished = items.filter((i) => i.status === 'done' || i.status === 'error').length

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Upload invoices</h2>
        <p className="mt-1 text-ink-500">
          Drop vendor bills here. AI extracts the details, checks GST and duplicates, then routes the
          bill for approval.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-all ${
          dragging
            ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10'
            : 'border-ink-300 bg-white hover:border-brand-400 hover:bg-brand-50/40'
        }`}
      >
        <span
          className={`grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg transition-transform ${
            dragging ? 'scale-110' : ''
          } bg-gradient-to-br from-brand-500 to-violet-500 shadow-brand-500/30`}
        >
          <UploadCloud className="h-8 w-8" />
        </span>
        <p className="mt-5 text-base font-semibold text-ink-900">
          {dragging ? 'Drop to upload' : 'Drag and drop invoices here'}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          or <span className="font-semibold text-brand-600">browse files</span>
        </p>
        <p className="mt-4 text-xs text-ink-400">PDF, PNG, JPG or WEBP · up to 10 MB each</p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
              This session · {finished}/{items.length} done
            </h3>
            {finished === items.length && (
              <button
                type="button"
                onClick={() => setItems([])}
                className="text-sm font-medium text-ink-500 hover:text-ink-900"
              >
                Clear list
              </button>
            )}
          </div>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <FileRow key={item.id} item={item} onRemove={removeItem} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  )
}