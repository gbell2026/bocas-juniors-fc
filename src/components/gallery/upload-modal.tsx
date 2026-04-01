'use client'
import { useRef, useState, useCallback } from 'react'
import { submitMediaRecord } from '@/app/actions/media-submissions'

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
  onProgress: (pct: number) => void
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
        else resolve({ publicId: null, error: data.error?.message ?? 'Upload failed' })
      } catch {
        resolve({ publicId: null, error: 'Upload failed' })
      }
    }
    xhr.onerror = () => resolve({ publicId: null, error: 'Network error' })
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`)
    xhr.send(fd)
  })
}

export function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [submitterName, setSubmitterName] = useState('')
  const [phase, setPhase] = useState<Phase>('selecting')
  const [sizeErrors, setSizeErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function reset() {
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
    setFiles([])
    setSubmitterName('')
    setPhase('selecting')
    setSizeErrors([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  const addFiles = useCallback((incoming: File[]) => {
    const rejected: string[] = []
    const valid: FileEntry[] = []
    for (const f of incoming) {
      if (f.size > MAX_BYTES) rejected.push(f.name)
      else valid.push(makeEntry(f))
    }
    setSizeErrors(rejected.length ? [`${rejected.join(', ')} too large (max 50MB)`] : [])
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }, [])

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

    for (const entry of files) {
      updateEntry(entry.id, { status: 'uploading' })
      const { publicId, error: uploadError } = await uploadToCloudinary(
        entry.file,
        cloudName,
        uploadPreset,
        (pct) => updateEntry(entry.id, { progress: pct })
      )
      if (!publicId) {
        updateEntry(entry.id, { status: 'error', error: uploadError ?? 'Upload failed' })
        continue
      }
      const type = entry.file.type.startsWith('video/') ? 'video' : 'photo'
      const { error: dbError } = await submitMediaRecord({
        cloudinaryPublicId: publicId,
        type,
        caption: entry.caption || undefined,
        submitterName: submitterName || undefined,
      })
      if (dbError) updateEntry(entry.id, { status: 'error', error: dbError, progress: 100 })
      else updateEntry(entry.id, { status: 'done', progress: 100 })
    }

    setPhase('complete')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-brand-surface w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-border">
          <h2 className="font-heading text-white uppercase tracking-wider text-lg">Submit a Photo/Video</h2>
          <button
            aria-label="close"
            onClick={handleClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {phase === 'complete' ? (
            <div className="text-center py-8">
              <p className="text-white font-bold text-lg mb-2">Thanks for sharing!</p>
              <p className="text-white/50 text-sm mb-6">Your photos will appear once approved.</p>
              <button onClick={handleClose} className="btn-primary">Close</button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center text-white/50 hover:border-brand-cyan transition cursor-pointer ${isDragging ? 'border-brand-primary' : 'border-brand-border'}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setIsDragging(false)
                  addFiles(Array.from(e.dataTransfer.files))
                }}
              >
                <p className="text-sm font-bold uppercase tracking-wider">Tap to add photos/videos</p>
                <p className="text-xs mt-1">or drag and drop · max 50MB per file</p>
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
              {sizeErrors.map((err, i) => (
                <p key={i} className="text-brand-primary text-xs mt-2">{err}</p>
              ))}

              {/* File previews */}
              {files.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {files.map(entry => (
                      <div key={entry.id} className="relative">
                        <div className="aspect-square bg-brand-border rounded overflow-hidden">
                          {entry.preview
                            ? <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">▶</div>
                          }
                        </div>
                        <button
                          onClick={() => removeFile(entry.id)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-brand-primary"
                          aria-label={`remove ${entry.file.name}`}
                        >
                          ×
                        </button>
                        {/* Progress bar */}
                        {entry.status === 'uploading' && (
                          <div className="mt-1 bg-brand-border rounded-full h-1">
                            <div
                              className="bg-brand-primary rounded-full h-1 transition-all"
                              style={{ width: `${entry.progress}%` }}
                            />
                          </div>
                        )}
                        {entry.status === 'done' && (
                          <p className="text-brand-cyan text-[10px] mt-1 text-center">✓ Uploaded</p>
                        )}
                        {entry.status === 'error' && (
                          <p className="text-brand-primary text-[10px] mt-1">{entry.error}</p>
                        )}
                        <input
                          className="input w-full mt-1 text-xs py-1"
                          placeholder="Add a caption…"
                          value={entry.caption}
                          onChange={e => updateEntry(entry.id, { caption: e.target.value })}
                          disabled={phase === 'uploading'}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Name field */}
                  <div className="mt-4">
                    <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs block mb-1">
                      Your name (optional)
                    </label>
                    <input
                      className="input w-full"
                      placeholder="Your name"
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
                {phase === 'uploading'
                  ? 'Uploading…'
                  : `Upload${files.length > 0 ? ` ${files.length} file${files.length > 1 ? 's' : ''}` : ''}`
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
