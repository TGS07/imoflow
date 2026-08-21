import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublic = request.nextUrl.pathname === '/login'
    || request.nextUrl.pathname.startsWith('/f/')
    || request.nextUrl.pathname === '/termos'
    || request.nextUrl.pathname === '/privacidade'
    || request.nextUrl.pathname === '/documentacao'
  const isAdmin = request.nextUrl.pathname.startsWith('/admin')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAdmin && user && user.email !== process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  // Exclui assets internos do Next, a API e quaisquer ficheiros estáticos
  // (qualquer caminho com extensão: manifest.webmanifest, sw.js, ícones .png,
  // offline.html, etc.) para que o PWA e os recursos públicos não sejam
  // redirecionados para /login.
  matcher: ['/((?!_next/static|_next/image|api/|.*\\.[\\w]+$).*)'],
}
