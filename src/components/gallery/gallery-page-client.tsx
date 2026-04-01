'use client'
import { useState } from 'react'
import { GalleryClient } from './gallery-client'
import { UploadModal } from './upload-modal'
import type { Media } from '@/lib/supabase/types'

export function GalleryPageClient({ items }: { items: Media[] }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="px-4 pt-4">
        <button
          onClick={() => setModalOpen(true)}
          className="btn-secondary"
        >
          Submit a Photo/Video
        </button>
      </div>
      <GalleryClient items={items} />
      <UploadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
