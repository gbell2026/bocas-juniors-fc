'use client'
import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { MasonryGrid } from './masonry-grid'
import type { Media } from '@/lib/supabase/types'

function cloudinaryUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/${publicId}`
}
function cloudinaryVideoUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/q_auto/${publicId}.mp4`
}

export function GalleryClient({ items }: { items: Media[] }) {
  const [index, setIndex] = useState(-1)

  const slides = items.map(item =>
    item.type === 'video'
      ? { type: 'video' as const, sources: [{ src: cloudinaryVideoUrl(item.cloudinary_public_id), type: 'video/mp4' }] }
      : { src: cloudinaryUrl(item.cloudinary_public_id), alt: item.caption ?? '' }
  )

  return (
    <>
      <MasonryGrid items={items} onSelect={(item) => setIndex(items.indexOf(item))} />
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
