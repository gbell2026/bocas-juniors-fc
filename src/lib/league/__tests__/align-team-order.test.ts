import { alignTeamOrders } from '../align-team-order'

describe('alignTeamOrders', () => {
  it('orders shared clubs identically across divisions, anchor first', () => {
    const result = alignTeamOrders(
      [
        { divisionId: 'u10', teams: [
          { teamId: 'u10-toucans', clubId: 'toucans' },
          { teamId: 'u10-caranero', clubId: 'caranero' },
          { teamId: 'u10-expresso', clubId: 'expresso' },
        ] },
        { divisionId: 'u14', teams: [
          { teamId: 'u14-caranero', clubId: 'caranero' },
          { teamId: 'u14-toucans', clubId: 'toucans' },
          { teamId: 'u14-bastimentos', clubId: 'bastimentos' },
        ] },
      ],
      'toucans'
    )
    if (!result.ok) throw new Error('expected ok result')

    const u10 = result.orderedTeamIds.get('u10')!
    const u14 = result.orderedTeamIds.get('u14')!

    expect(u10[0]).toBe('u10-toucans')
    expect(u14[0]).toBe('u14-toucans')
    // Caranero (shared) lands at the same index in both divisions' arrays
    expect(u10.indexOf('u10-caranero')).toBe(u14.indexOf('u14-caranero'))
    // Each division's array only contains that division's own team IDs
    expect(u10).toEqual(['u10-toucans', 'u10-caranero', 'u10-expresso'])
    expect(u14).toEqual(['u14-toucans', 'u14-caranero', 'u14-bastimentos'])
  })

  it('returns an error when divisions have different team counts', () => {
    const result = alignTeamOrders(
      [
        { divisionId: 'u10', teams: [{ teamId: 'a', clubId: 'x' }, { teamId: 'b', clubId: 'y' }] },
        { divisionId: 'u14', teams: [{ teamId: 'c', clubId: 'x' }] },
      ],
      'x'
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.error).toBeTruthy()
  })

  it('returns an error when the anchor club has no team in one of the divisions', () => {
    const result = alignTeamOrders(
      [
        { divisionId: 'u10', teams: [{ teamId: 'a', clubId: 'toucans' }, { teamId: 'b', clubId: 'caranero' }] },
        { divisionId: 'u14', teams: [{ teamId: 'c', clubId: 'caranero' }, { teamId: 'd', clubId: 'bastimentos' }] },
      ],
      'toucans'
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.error).toBeTruthy()
  })

  it('handles more than two divisions consistently', () => {
    const result = alignTeamOrders(
      [
        { divisionId: 'u10', teams: [{ teamId: 'u10-a', clubId: 'toucans' }, { teamId: 'u10-b', clubId: 'caranero' }] },
        { divisionId: 'u12', teams: [{ teamId: 'u12-a', clubId: 'caranero' }, { teamId: 'u12-b', clubId: 'toucans' }] },
        { divisionId: 'u14', teams: [{ teamId: 'u14-a', clubId: 'toucans' }, { teamId: 'u14-b', clubId: 'caranero' }] },
      ],
      'toucans'
    )
    if (!result.ok) throw new Error('expected ok result')
    for (const divisionId of ['u10', 'u12', 'u14']) {
      expect(result.orderedTeamIds.get(divisionId)![0]).toContain(divisionId)
    }
  })

  it('returns an empty map for an empty division list', () => {
    const result = alignTeamOrders([], 'toucans')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.orderedTeamIds.size).toBe(0)
  })
})
