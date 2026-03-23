import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
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
    <main className="bg-brand-dark min-h-screen">
      <PageHeader title="Gallery" subtitle="Photos & videos from the pitch" />
      <GalleryClient items={media ?? []} />
    </main>
  )
}
