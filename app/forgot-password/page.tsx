'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PacerLogo } from '@/components/pacer-logo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <PacerLogo />
          <h1 className="text-xl font-semibold text-foreground">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {sent ? 'Check your inbox' : "We'll send you a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-border bg-card px-6 py-8 space-y-2">
              <p className="text-sm text-foreground font-medium">Email sent to <span className="text-primary">{email}</span></p>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to set a new password. Check your spam folder if you don&apos;t see it.
              </p>
            </div>
            <Link href="/login" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10 bg-card border-border/60"
              />
            </div>

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                ← Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
