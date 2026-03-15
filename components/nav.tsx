'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/log', label: 'Log' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Left: logo + nav */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group"
          >
            <span className="h-5 w-5 rounded bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground select-none">
              F
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              FitLog
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative text-sm px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-1 -bottom-[1px] h-px bg-primary rounded-full" />
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: sign out */}
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
