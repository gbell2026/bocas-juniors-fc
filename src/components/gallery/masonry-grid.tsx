'use client'
import Masonry from 'react-masonry-css'
import { MediaTile } from './media-tile'
import type { Media } from '@/lib/supabase/types'

const breakpoints = { default: 3, 1024: 2, 640: 1 }

type Props = { items: Media[]; onSelect: (item: Media) => void }

export function MasonryGrid({ items, onSelect }: Props) {
  const sorted = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  })

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="flex gap-[2px]"
      columnClassName="flex flex-col gap-[2px]"
    >
      {sorted.map(item => (
        <MediaTile key={item.id} item={item} onClick={() => onSelect(item)} />
      ))}
    </Masonry>
  )
}
