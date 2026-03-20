'use client'
import { useState } from 'react'
import { RegistrationForm } from '@/components/register/registration-form'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'

export default function RegisterPage() {
  const [step, setStep] = useState<'register' | 'pay'>('register')
  const [ids, setIds] = useState<{ playerId: string; parentId: string; parentName: string; playerName: string } | null>(null)

  if (step === 'pay' && ids) {
    return (
      <main className="py-12 px-4">
        <PaymentOptionsPanel
          playerId={ids.playerId}
          parentId={ids.parentId}
          parentName={ids.parentName}
          playerName={ids.playerName}
        />
      </main>
    )
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
