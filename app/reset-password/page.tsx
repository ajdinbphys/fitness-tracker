'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PacerLogo } from '@/components/pacer-logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  // Supabase writes the session from the URL hash automatically on auth state change
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) { setError(error.message); return }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <PacerLogo />
          <h1 className="text-xl font-semibold text-foreground">New password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Choose a strong password</p>
        </div>

        {!ready ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-border border-t-muted-foreground animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            <p className="text-xs text-muted-foreground">
              If nothing happens, the link may have expired.{' '}
              <Link href="/forgot-password" className="text-foreground hover:text-primary transition-colors">
                Request a new one
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="h-10 bg-card border-border/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Confirm password
              </Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="h-10 bg-card border-border/60"
              />
            </div>

            <Button type="submit" className="w-full h-10" disabled={loading || !password || !confirm}>
              {loading ? 'Updating…' : 'Set new password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
