// Contact details — update these directly in this file or move to Supabase Studio (settings table)
const contacts = [
  { name: 'Head Coach', role: 'Head Coach', email: 'coach@bocasjuniorsfc.com', phone: '+507 555 0001' },
  { name: 'Club Admin', role: 'Administrator', email: 'admin@bocasjuniorsfc.com', phone: '+507 555 0002' },
]

export default function ContactPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Contact Us</h1>
      <div className="space-y-4">
        {contacts.map(c => (
          <div key={c.email} className="bg-gray-50 rounded-lg p-5">
            <h2 className="font-semibold text-lg">{c.name}</h2>
            <p className="text-gray-500 text-sm mb-3">{c.role}</p>
            <p><a href={`mailto:${c.email}`} className="text-brand-primary underline">{c.email}</a></p>
            <p>{c.phone}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
