import Link from 'next/link'

// Replace SPONSOR_1 etc. with actual Cloudinary public IDs after uploading sponsor logos
const sponsors: string[] = [] // e.g. ['bocas-juniors/sponsor-1', 'bocas-juniors/sponsor-2']

export default function HomePage() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  return (
    <main>
      {/* Hero */}
      <section className="bg-brand-primary text-white py-20 px-4 text-center">
        {/* Replace with actual logo: <Image src="/logo.png" alt="Bocas Juniors FC" width={120} height={120} className="mx-auto mb-4" /> */}
        <h1 className="text-4xl font-bold mb-4">Bocas Juniors FC</h1>
        <p className="text-xl mb-8 opacity-90">Youth football on the island</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register" className="bg-brand-secondary text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            Register Your Child
          </Link>
          <Link href="/gallery" className="bg-white text-brand-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            View Gallery
          </Link>
        </div>
      </section>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="py-12 px-4 text-center">
          <h2 className="text-lg font-semibold text-gray-500 mb-6 uppercase tracking-wide">Our Sponsors</h2>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {sponsors.map((id, i) => (
              <img
                key={i}
                src={`https://res.cloudinary.com/${cloud}/image/upload/h_80,q_auto,f_auto/${id}`}
                alt={`Sponsor ${i + 1}`}
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-12 px-4 bg-gray-50 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to join?</h2>
        <p className="text-gray-600 mb-6">Register your child and pay the membership fee online.</p>
        <Link href="/register" className="btn-primary">Register Now</Link>
      </section>
    </main>
  )
}
