// Contact details — update this file to add/change staff contacts
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
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Contact Us</h1>
      <div className="space-y-4">
        {contacts.map(c => (
          <div key={c.name} className="bg-gray-50 rounded-lg p-5">
            <h2 className="font-semibold text-lg">{c.name}</h2>
            <p className="text-gray-500 text-sm mb-3">{c.role}</p>
            {c.email && (
              <p><a href={`mailto:${c.email}`} className="text-brand-primary underline">{c.email}</a></p>
            )}
            {c.phone && <p>{c.phone}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
