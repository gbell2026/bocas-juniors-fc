'use client'
import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { MasonryGrid } from './masonry-grid'
import type { Media } from '@/lib/supabase/types'

type Filter = 'all' | 'photo' | 'video'

function cloudinaryUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/${publicId}`
}
function cloudinaryVideoUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/q_auto/${publicId}.mp4`
}

const tabs: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'photo' },
  { label: 'Videos', value: 'video' },
]

export function GalleryClient({ items }: { items: Media[] }) {
  const [index, setIndex] = useState(-1)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)

  const slides = items.map(item =>
    item.type === 'video'
      ? { type: 'video' as const, sources: [{ src: cloudinaryVideoUrl(item.cloudinary_public_id), type: 'video/mp4' }] }
      : { src: cloudinaryUrl(item.cloudinary_public_id), alt: item.caption ?? '' }
  )

  return (
    <>
      <div className="flex gap-2 px-4 py-4">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition ${
              filter === tab.value
                ? 'bg-brand-primary text-white'
                : 'border border-brand-line text-brand-muted hover:border-brand-primary hover:text-brand-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <MasonryGrid items={filtered} onSelect={(item) => setIndex(items.indexOf(item))} />
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={slides}
        plugins={[Video]}
      />
    </>
  )
}
