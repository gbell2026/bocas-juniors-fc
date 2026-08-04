'use client'
import { useState } from 'react'
import { AddChildForm } from './add-child-form'

export function AddChildSection() {
  const [showForm, setShowForm] = useState(false)

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)} className="btn-secondary text-sm w-full">
        + Add a Child
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
