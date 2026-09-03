'use client'
import { useState } from 'react'

export type FlyerExportLabels = {
  downloadPng: string
  downloadPdf: string
  preparing: string
  downloadHint: string
  downloadError: string
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Rasterise the flyer card (found by id) at ~2–3x for a crisp export. Kept in
// the click handler and behind dynamic import() so html2canvas/jspdf never load
// on the server or in the initial bundle.
async function captureCard(targetId: string): Promise<HTMLCanvasElement> {
  const el = document.getElementById(targetId)
  if (!el) throw new Error(`flyer node #${targetId} not found`)
  const { default: html2canvas } = await import('html2canvas-pro')
  return html2canvas(el, {
    scale: Math.min(3, (window.devicePixelRatio || 1) * 2),
    useCORS: true,
    backgroundColor: '#FBF7F2',
    logging: false,
  })
}

export function FlyerExportToolbar({
  targetId,
  sundayIso,
  labels,
}: {
  targetId: string
  sundayIso: string
  labels: FlyerExportLabels
}) {
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileBase = `loma-espino-kickoff-${sundayIso}`

  async function downloadPng() {
    setBusy('png')
    setError(null)
    try {
      const canvas = await captureCard(targetId)
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('toBlob returned null')
      const url = URL.createObjectURL(blob)
      triggerDownload(url, `${fileBase}.png`)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (e) {
      console.error('Flyer PNG export failed:', e)
      setError(labels.downloadError)
    } finally {
      setBusy(null)
    }
  }

  async function downloadPdf() {
    setBusy('pdf')
    setError(null)
    try {
      const canvas = await captureCard(targetId)
      const { jsPDF } = await import('jspdf')
      const w = canvas.width
      const h = canvas.height
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
      pdf.save(`${fileBase}.pdf`)
    } catch (e) {
      console.error('Flyer PDF export failed:', e)
      setError(labels.downloadError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="text-center">
      <div className="flex justify-center gap-3 flex-wrap">
        <button onClick={downloadPng} disabled={busy !== null} className="btn-primary text-sm disabled:opacity-50">
          {busy === 'png' ? labels.preparing : labels.downloadPng}
        </button>
        <button onClick={downloadPdf} disabled={busy !== null} className="btn-secondary text-sm disabled:opacity-50">
          {busy === 'pdf' ? labels.preparing : labels.downloadPdf}
        </button>
      </div>
      <p className="text-brand-mutedWarm text-xs mt-2">{labels.downloadHint}</p>
      {error && <p className="text-brand-primaryDeep text-xs mt-1 font-bold">{error}</p>}
    </div>
  )
}
