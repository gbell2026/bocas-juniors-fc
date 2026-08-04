'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { RegistrationForm } from '@/components/register/registration-form'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'
import { createBrowserClient } from '@/lib/supabase/client'

type Step = 'register' | 'pay'
type Ids = { playerId: string; parentId: string; parentName: string; playerName: string }

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex">
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'register' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
        1. Player Info
      </div>
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'pay' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
        2. Payment
      </div>
    </div>
  )
}

export default function RegisterPage() {
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
        <PageHeader title="Register" subtitle="Sign your child up today" />
        <div className="py-8 px-4 max-w-md mx-auto text-center space-y-4">
          <p className="text-brand-ink">
            You&apos;re already logged in. Registering another child? Add them from your profile instead —
            no need to create a new account.
          </p>
          <Link href="/profile" className="btn-primary inline-block">Go to My Profile</Link>
        </div>
      </main>
    )
  }

  if (step === 'pay' && ids) {
    return (
      <main className="bg-brand-cream min-h-screen">
        <PageHeader title="Register" subtitle="Sign your child up today" />
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
      <PageHeader title="Register" subtitle="Sign your child up today" />
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
