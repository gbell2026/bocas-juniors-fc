'use client'
import { useState } from 'react'
import { AddChildForm } from './add-child-form'
import { useLocale } from '@/lib/i18n/locale-context'

export function AddChildSection() {
  const { t } = useLocale()
  const [showForm, setShowForm] = useState(false)

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="btn-secondary text-sm w-full">
        {t.profile.addChild.button}
      </button>
    )
  }

  return (
    <AddChildForm
      onSuccess={() => window.location.reload()}
      onCancel={() => setShowForm(false)}
    />
  )
}
