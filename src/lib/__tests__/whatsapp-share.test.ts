import { whatsappShareUrl } from '../whatsapp-share'

describe('whatsappShareUrl', () => {
  it('builds a wa.me link with the text URL-encoded', () => {
    expect(whatsappShareUrl('Games off today')).toBe(
      'https://wa.me/?text=Games%20off%20today'
    )
  })

  it('encodes newlines and WhatsApp bold markers', () => {
    const url = whatsappShareUrl('*Rained off*\n\nSee you next week')
    expect(url).toBe('https://wa.me/?text=*Rained%20off*%0A%0ASee%20you%20next%20week')
    expect(decodeURIComponent(url.split('text=')[1])).toBe('*Rained off*\n\nSee you next week')
  })
})
