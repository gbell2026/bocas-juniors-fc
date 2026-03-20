import { createSupabaseServerClient } from '@/lib/supabase/server'
import { GalleryClient } from '@/components/gallery/gallery-client'

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: media } = await supabase
    .from('media')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('uploaded_at', { ascending: false })

  return (
    <main>
      <h1 className="text-2xl font-bold px-4 py-6">Gallery</h1>
      <GalleryClient items={media ?? []} />
    </main>
  )
}
