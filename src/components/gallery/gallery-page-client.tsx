'use client'
import { useState } from 'react'
import { GalleryClient } from './gallery-client'
import { UploadModal } from './upload-modal'
import type { Media } from '@/lib/supabase/types'
import { useLocale } from '@/lib/i18n/locale-context'

export function GalleryPageClient({ items }: { items: Media[] }) {
  const { t } = useLocale()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="px-4 pt-4">
        <button
          onClick={() => setModalOpen(true)}
          className="btn-secondary"
        >
          {t.gallery.submitPhoto}
        </button>
      </div>
      <GalleryClient items={items} />
      <UploadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
