import Image from 'next/image'
import Link from 'next/link'

// Replace SPONSOR_1 etc. with actual Cloudinary public IDs after uploading sponsor logos
const sponsors: string[] = []

export default function HomePage() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[500px] flex items-center justify-center text-center overflow-hidden">
        <Image
          src="/beach-hero.jpg"
          alt="Bocas Juniors FC training on the beach"
          fill
          className="object-cover"
          style={{ objectPosition: 'center 35%' }}
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,4,24,0.38) 0%, rgba(8,4,24,0.52) 50%, rgba(8,4,24,0.82) 100%)',
          }}
        />
        <div className="relative flex flex-col items-center px-6 py-16">
          <Image
            src="/logo.png"
            width={120}
            height={120}
            alt="Bocas Juniors FC"
            className="mb-5 drop-shadow-2xl"
          />
          <h1
            className="font-heading text-white uppercase tracking-widest"
            style={{ fontSize: '4.5rem', lineHeight: 1 }}
          >
            Bocas Juniors FC
          </h1>
          <p className="text-brand-cyan font-bold uppercase tracking-[0.3em] text-xs mt-3">
            Youth Football · Bocas del Toro, Panama
          </p>
          <div className="flex gap-4 mt-7 flex-wrap justify-center">
            <Link href="/register" className="btn-primary">
              Register Your Child
            </Link>
            <Link href="/gallery" className="btn-secondary">
              View Gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="py-12 px-4 text-center bg-brand-surface">
          <h2 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Our Sponsors</h2>
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
      <section className="py-14 px-4 bg-brand-surface border-t-[3px] border-brand-cyan text-center">
        <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Ready to Join?</h2>
        <p className="text-white/60 mb-7">Register your child and pay the membership fee online.</p>
        <Link href="/register" className="btn-primary">Register Now</Link>
      </section>
    </main>
  )
}
