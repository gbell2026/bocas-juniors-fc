import { cookies } from 'next/headers'
import { parseLocale, type Locale } from './locale'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return parseLocale(cookieStore.get('locale')?.value)
}
