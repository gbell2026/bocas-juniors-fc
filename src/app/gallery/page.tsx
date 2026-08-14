import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { GalleryPageClient } from '@/components/gallery/gallery-page-client'
import { getLocale } from '@/lib/i18n/get-locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: media } = await supabase
    .from('media')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('uploaded_at', { ascending: false })
  const locale = await getLocale()
  const t = locale === 'es' ? es : en

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.gallery.title} subtitle={t.gallery.subtitle} />
      <GalleryPageClient items={media ?? []} />
    </main>
  )
}
