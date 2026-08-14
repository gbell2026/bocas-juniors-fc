import { PageHeader } from '@/components/page-header'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'
import { getLocale } from '@/lib/i18n/get-locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

export default async function GetInvolvedPage() {
  const locale = await getLocale()
  const t = locale === 'es' ? es : en

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader
        title={t.getInvolved.title}
        subtitle={t.getInvolved.subtitle}
      />
      <div className="max-w-xl mx-auto px-4 py-10">
        <GetInvolvedForm />
      </div>
    </main>
  )
}
