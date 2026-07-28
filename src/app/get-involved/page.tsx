import { PageHeader } from '@/components/page-header'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'

export default function GetInvolvedPage() {
  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader
        title="Get Involved"
        subtitle="Support the Tangerine Toucans — on and off the pitch"
      />
      <div className="max-w-xl mx-auto px-4 py-10">
        <GetInvolvedForm />
      </div>
    </main>
  )
}
