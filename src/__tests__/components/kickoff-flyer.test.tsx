import { render, screen, within } from '@testing-library/react'
import { KickoffFlyer } from '@/components/flyer/kickoff-flyer'
import type { KickoffFlyer as KickoffFlyerData } from '@/app/actions/flyer'

const base: KickoffFlyerData = {
  sundayIso: '2026-09-06',
  divisions: [
    {
      id: 'd1',
      name: 'U10 Division (as of Jan 2027)',
      shortLabel: 'U10',
      teams: [
        { name: 'Tangerine Toucans', badge: null },
        { name: 'Isla Colón FC', badge: null },
      ],
      fixtures: [
        {
          id: 'f1',
          kickoff: '09:30',
          homeTeam: 'Tangerine Toucans',
          awayTeam: 'Isla Colón FC',
          homeBadge: null,
          awayBadge: null,
        },
      ],
    },
  ],
}

describe('KickoffFlyer', () => {
  it('shows the league name, the coming Sunday date and the kick-off title', () => {
    render(<KickoffFlyer flyer={base} locale="en" />)
    expect(screen.getByText('Liga Isleñitos de Bocas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /sunday kick-off/i })).toBeInTheDocument()
    expect(screen.getByText(/6 September 2026/i)).toBeInTheDocument()
  })

  it('lists the division (without the DB qualifier), teams and the fixture with its kick-off time', () => {
    render(<KickoffFlyer flyer={base} locale="en" />)
    expect(screen.getByText('U10 Division')).toBeInTheDocument()
    expect(screen.queryByText(/as of Jan 2027/i)).not.toBeInTheDocument()
    const fixture = screen.getByRole('listitem')
    expect(within(fixture).getByText('Tangerine Toucans')).toBeInTheDocument()
    expect(within(fixture).getByText('Isla Colón FC')).toBeInTheDocument()
    expect(within(fixture).getByText(/9:30/)).toBeInTheDocument()
  })

  it('makes sponsors with a URL clickable and leaves ones without a URL unlinked', () => {
    render(<KickoffFlyer flyer={base} locale="en" />)
    expect(screen.getByRole('link', { name: 'Tesoro Escondido' })).toHaveAttribute(
      'href',
      'https://www.tesoro-escondido.com/'
    )
    expect(screen.getByRole('link', { name: 'Tangerine International' })).toHaveAttribute(
      'href',
      'https://tangerine.international'
    )
    expect(screen.getByAltText('Bocas Dance Collective')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bocas Dance Collective' })).not.toBeInTheDocument()
  })

  it('falls back to a message when there are no fixtures this Sunday', () => {
    render(<KickoffFlyer flyer={{ sundayIso: '2026-09-06', divisions: [] }} locale="en" />)
    expect(screen.getByText(/no fixtures scheduled for this sunday/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('offers image and PDF downloads', () => {
    render(<KickoffFlyer flyer={base} locale="en" />)
    expect(screen.getByRole('button', { name: /download image/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled()
  })
})
