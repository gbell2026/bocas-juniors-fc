import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { LocaleProvider } from './locale-context'
import type { Locale } from './locale'

export function renderWithLocale(ui: ReactElement, locale: Locale = 'en') {
  return render(<LocaleProvider initialLocale={locale}>{ui}</LocaleProvider>)
}
