import { PageHeader } from '@/components/page-header'
import { getLocale } from '@/lib/i18n/get-locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

export default async function ContactPage() {
  const locale = await getLocale()
  const t = locale === 'es' ? es : en

  const contacts = [
    {
      name: 'Gilles Benyon-Bell',
      role: t.contact.manager,
      email: 'g.bell2010@gmail.com',
      phone: '+44 7462 557960 (WhatsApp)',
    },
    {
      name: 'Josh Floryance',
      role: t.contact.coach,
      email: null,
      phone: null,
    },
    {
      name: 'Jorge Vega',
      role: t.contact.coach,
      email: null,
      phone: null,
    },
  ]

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.contact.title} subtitle={t.contact.subtitle} />
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
        {contacts.map(c => (
          <div
            key={c.name}
            className="bg-brand-tint border border-brand-line border-l-[3px] border-l-brand-primary rounded p-5"
          >
            <h2 className="text-brand-ink font-black text-base">{c.name}</h2>
            <p className="text-brand-primaryDeep font-bold uppercase tracking-widest text-xs mt-1 mb-2">{c.role}</p>
            {c.email && (
              <p className="text-sm">
                <a href={`mailto:${c.email}`} className="text-brand-primary underline">
                  {c.email}
                </a>
              </p>
            )}
            {c.phone && <p className="text-brand-muted text-sm mt-1">{c.phone}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
