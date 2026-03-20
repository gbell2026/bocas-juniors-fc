'use client'
import { useState } from 'react'
import { RegistrationForm } from '@/components/register/registration-form'

export default function RegisterPage() {
  const [step, setStep] = useState<'register' | 'pay'>('register')
  const [ids, setIds] = useState<{ playerId: string; parentId: string; parentName: string; playerName: string } | null>(null)

  if (step === 'pay' && ids) {
    // TODO: replaced in Task 7 with <PaymentOptionsPanel playerId={ids.playerId} parentId={ids.parentId} parentName={ids.parentName} playerName={ids.playerName} />
    return <main className="py-12 px-4"><p>Loading payment…</p></main>
  }

  return (
    <main className="py-12 px-4">
      <RegistrationForm
        onSuccess={(playerId, parentId, parentName, playerName) => {
          setIds({ playerId, parentId, parentName, playerName })
          setStep('pay')
        }}
      />
    </main>
  )
}
