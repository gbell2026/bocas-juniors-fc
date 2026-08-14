'use client'
import { useRef, useState } from 'react'
import { submitMediaRecord } from '@/app/actions/media-submissions'
import { useLocale } from '@/lib/i18n/locale-context'
import { translateError } from '@/lib/i18n/error-messages'
import type { en } from '@/lib/i18n/en'

const MAX_BYTES = 50 * 1024 * 1024 // 50MB

type FileEntry = {
  id: string
  file: File
  preview: string
  caption: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

type Phase = 'selecting' | 'uploading' | 'complete'

function makeEntry(file: File): FileEntry {
  const isImage = file.type.startsWith('image/')
  return {
    id: crypto.randomUUID(),
    file,
    preview: isImage ? URL.createObjectURL(file) : '',
    caption: '',
    progress: 0,
    status: 'pending',
  }
}

function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress: (pct: number) => void,
  t: typeof en['gallery']
): Promise<{ publicId: string | null; error: string | null }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', uploadPreset)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.public_id) resolve({ publicId: data.public_id, error: null })
        else resolve({ publicId: null, error: data.error?.message ?? t.uploadFailed })
      } catch {
        resolve({ publicId: null, error: t.uploadFailed })
      }
    }
    xhr.onerror = () => resolve({ publicId: null, error: t.networkError })
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`)
    xhr.send(fd)
  })
}

export function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, t } = useLocale()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [submitterName, setSubmitterName] = useState('')
  const [phase, setPhase] = useState<Phase>('selecting')
  const [sizeErrors, setSizeErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function reset() {
    setFiles(prev => {
      prev.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
      return []
    })
    setSubmitterName('')
    setPhase('selecting')
    setSizeErrors([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function addFiles(incoming: File[]) {
    const rejected: string[] = []
    const valid: FileEntry[] = []
    for (const f of incoming) {
      if (f.size > MAX_BYTES) rejected.push(f.name)
      else valid.push(makeEntry(f))
    }
    setSizeErrors(rejected.length ? [t.gallery.tooLarge(rejected.join(', '))] : [])
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }

  function removeFile(id: string) {
    setFiles(prev => {
      const entry = prev.find(f => f.id === id)
      if (entry?.preview) URL.revokeObjectURL(entry.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  async function handleUpload() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    setPhase('uploading')
    let anySucceeded = false

    for (const entry of files) {
      updateEntry(entry.id, { status: 'uploading' })
      const { publicId, error: uploadError } = await uploadToCloudinary(
        entry.file,
        cloudName,
        uploadPreset,
        (pct) => updateEntry(entry.id, { progress: pct }),
        t.gallery
      )
      if (!publicId) {
        updateEntry(entry.id, { status: 'error', error: uploadError ?? t.gallery.uploadFailed })
        continue
      }
      const type = entry.file.type.startsWith('video/') ? 'video' : 'photo'
      const { error: dbError } = await submitMediaRecord({
        cloudinaryPublicId: publicId,
        type,
        caption: entry.caption || undefined,
        submitterName: submitterName || undefined,
      })
      if (dbError) updateEntry(entry.id, { status: 'error', error: translateError(locale, dbError), progress: 100 })
      else {
        updateEntry(entry.id, { status: 'done', progress: 100 })
        anySucceeded = true
      }
    }

    if (anySucceeded) setPhase('complete')
    else setPhase('selecting')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-line">
          <h2 className="font-heading text-brand-ink uppercase tracking-wider text-lg">{t.gallery.submitPhoto}</h2>
          <button
            aria-label={t.gallery.close}
            onClick={handleClose}
            className="text-brand-muted hover:text-brand-ink text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {phase === 'complete' ? (
            <div className="text-center py-8">
              <p className="text-brand-ink font-bold text-lg mb-2">{t.gallery.thanksTitle}</p>
              <p className="text-brand-muted text-sm mb-6">{t.gallery.thanksBody}</p>
              <button onClick={handleClose} className="btn-primary">{t.gallery.close}</button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center text-brand-muted hover:border-brand-primary transition cursor-pointer ${isDragging ? 'border-brand-primary' : 'border-brand-line'}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setIsDragging(false)
                  addFiles(Array.from(e.dataTransfer.files))
                }}
              >
                <p className="text-sm font-bold uppercase tracking-wider">{t.gallery.tapToAdd}</p>
                <p className="text-xs mt-1">{t.gallery.dragOrDrop}</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)) }}
              />

              {/* Size errors */}
              {sizeErrors.map((err) => (
                <p key={err} className="text-brand-primary text-xs mt-2">{err}</p>
              ))}

              {/* File previews */}
              {files.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {files.map(entry => (
                      <div key={entry.id} className="relative">
                        <div className="aspect-square bg-brand-creamAlt rounded overflow-hidden">
                          {entry.preview
                            ? <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-brand-mutedWarm text-2xl">▶</div>
                          }
                        </div>
                        <button
                          onClick={() => removeFile(entry.id)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-brand-primary"
                          aria-label={t.gallery.removeFile(entry.file.name)}
                        >
                          ×
                        </button>
                        {/* Progress bar */}
                        {entry.status === 'uploading' && (
                          <div className="mt-1 bg-brand-creamAlt rounded-full h-1">
                            <div
                              className="bg-brand-primary rounded-full h-1 transition-all"
                              style={{ width: `${entry.progress}%` }}
                            />
                          </div>
                        )}
                        {entry.status === 'done' && (
                          <p className="text-brand-primaryDeep text-[10px] mt-1 text-center">{t.gallery.uploaded}</p>
                        )}
                        {entry.status === 'error' && (
                          <p className="text-brand-primary text-[10px] mt-1">{entry.error}</p>
                        )}
                        <input
                          className="input w-full mt-1 text-xs py-1"
                          placeholder={t.gallery.captionPlaceholder}
                          value={entry.caption}
                          onChange={e => updateEntry(entry.id, { caption: e.target.value })}
                          disabled={phase === 'uploading'}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Name field */}
                  <div className="mt-4">
                    <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs block mb-1">
                      {t.gallery.nameLabel}
                    </label>
                    <input
                      className="input w-full"
                      placeholder={t.gallery.namePlaceholder}
                      value={submitterName}
                      onChange={e => setSubmitterName(e.target.value)}
                      disabled={phase === 'uploading'}
                    />
                  </div>
                </>
              )}

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || phase === 'uploading'}
                className="btn-primary w-full mt-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'uploading' ? t.gallery.uploading : t.gallery.uploadButton(files.length)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
