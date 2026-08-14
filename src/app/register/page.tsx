'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { RegistrationForm } from '@/components/register/registration-form'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/i18n/locale-context'

type Step = 'register' | 'pay'
type Ids = { playerId: string; parentId: string; parentName: string; playerName: string }

function StepIndicator({ step }: { step: Step }) {
  const { t } = useLocale()
  return (
    <div className="flex">
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'register' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
        {t.register.stepPlayerInfo}
      </div>
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'pay' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
        {t.register.stepPayment}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useLocale()
  const [step, setStep] = useState<Step>('register')
  const [ids, setIds] = useState<Ids | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user))
  }, [])

  if (loggedIn) {
    return (
      <main className="bg-brand-cream min-h-screen">
        <PageHeader title={t.register.title} subtitle={t.register.subtitle} />
        <div className="py-8 px-4 max-w-md mx-auto text-center space-y-4">
          <p className="text-brand-ink">
            {t.register.alreadyLoggedIn}
          </p>
          <Link href="/profile" className="btn-primary inline-block">{t.register.goToProfile}</Link>
        </div>
      </main>
    )
  }

  if (step === 'pay' && ids) {
    return (
      <main className="bg-brand-cream min-h-screen">
        <PageHeader title={t.register.title} subtitle={t.register.subtitle} />
        <StepIndicator step="pay" />
        <div className="py-8 px-4">
          <PaymentOptionsPanel
            playerId={ids.playerId}
            parentId={ids.parentId}
            parentName={ids.parentName}
            playerName={ids.playerName}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.register.title} subtitle={t.register.subtitle} />
      <StepIndicator step="register" />
      <div className="py-8 px-4">
        <RegistrationForm
          onSuccess={(playerId, parentId, parentName, playerName) => {
            setIds({ playerId, parentId, parentName, playerName })
            setStep('pay')
          }}
        />
      </div>
    </main>
  )
}
