'use client'
import { useRef, useState } from 'react'
import { saveMediaRecord } from '@/app/actions/admin'

export function MediaUploader({ uploadedBy }: { uploadedBy: string }) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setMessage(null)

    const signRes = await fetch('/api/cloudinary/sign', { method: 'POST', body: '{}' })
    if (!signRes.ok) { setMessage('Upload auth failed'); setUploading(false); return }
    const { signature, timestamp, cloudName, apiKey, folder } = await signRes.json()

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('signature', signature)
      fd.append('timestamp', timestamp)
      fd.append('api_key', apiKey)
      fd.append('folder', folder)

      const resourceType = isVideo ? 'video' : 'image'
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: 'POST', body: fd }
      )
      const data = await res.json()
      if (data.public_id) {
        await saveMediaRecord({
          cloudinaryPublicId: data.public_id,
          type: isVideo ? 'video' : 'photo',
          uploadedBy,
        })
      }
    }

    setUploading(false)
    setMessage('Upload complete!')
    window.location.reload()
  }

  return (
    <section
      className="border-2 border-dashed border-brand-line rounded-lg p-6 text-center"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
    >
      <p className="text-brand-muted mb-3">Drag and drop photos/videos, or click to select</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-primary"
      >
        {uploading ? 'Uploading…' : 'Select Files'}
      </button>
      {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
    </section>
  )
}
