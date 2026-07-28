import { PageHeader } from '@/components/page-header'

const contacts = [
  {
    name: 'Gilles Benyon-Bell',
    role: 'Manager',
    email: 'g.bell2010@gmail.com',
    phone: '+44 7462 557960 (WhatsApp)',
  },
  {
    name: 'Josh Floryance',
    role: 'Coach',
    email: null,
    phone: null,
  },
  {
    name: 'Jorge Vega',
    role: 'Coach',
    email: null,
    phone: null,
  },
]

export default function ContactPage() {
  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Contact Us" subtitle="Get in touch with the team" />
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
