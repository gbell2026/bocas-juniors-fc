import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = ['/profile', '/admin', '/roster'].some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin-only guard — must use a raw service role client here.
  // Two reasons: (1) RLS on user_roles has `using (false)` — only service role can read it.
  // (2) `next/headers` is unavailable in middleware, so the shared createSupabaseServiceClient()
  //     utility (which calls cookies() from next/headers) cannot be used here. Do not refactor
  //     this to use that utility — it will break at runtime.
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    const { createClient } = await import('@supabase/supabase-js')
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: roleRow } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (roleRow?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Coach/admin guard — same reasoning and pattern as the /admin block above.
  if (user && request.nextUrl.pathname.startsWith('/roster')) {
    const { createClient } = await import('@supabase/supabase-js')
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: roleRow } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (roleRow?.role !== 'admin' && roleRow?.role !== 'coach') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/profile/:path*', '/admin/:path*', '/roster/:path*'],
}
