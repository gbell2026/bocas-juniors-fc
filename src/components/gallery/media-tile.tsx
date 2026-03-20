import type { Media } from '@/lib/supabase/types'

function cloudinaryUrl(publicId: string, width: number) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/w_${width},q_auto,f_auto/${publicId}`
}

function cloudinaryVideoThumb(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/w_600,q_auto,f_jpg/${publicId}`
}

type Props = { item: Media; onClick: () => void }

export function MediaTile({ item, onClick }: Props) {
  const isVideo = item.type === 'video'
  const src = isVideo ? cloudinaryVideoThumb(item.cloudinary_public_id) : cloudinaryUrl(item.cloudinary_public_id, 600)

  return (
    <button onClick={onClick} className="relative block w-full overflow-hidden group">
      <img
        src={src}
        alt={item.caption ?? ''}
        className="w-full h-auto block"
        loading="lazy"
      />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </button>
  )
}
