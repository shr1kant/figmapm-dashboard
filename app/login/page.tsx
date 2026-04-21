'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const supabase = createBrowserClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f8f9fa', fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111', margin: '0 0 6px' }}>
            FigPM
          </h1>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            Sign in to your dashboard
          </p>
        </div>

        {sent ? (
          <div style={{
            padding: '16px', background: '#f0fdf4', borderRadius: '8px',
            border: '1px solid #bbf7d0', fontSize: '14px', color: '#166534'
          }}>
            Magic link sent to <strong>{email}</strong>.<br />
            Check your inbox and click the link to sign in.
          </div>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '14px',
                  border: '1px solid #d1d5db', borderRadius: '7px',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '13px', color: '#dc2626', padding: '8px 12px',
                background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                padding: '10px', background: loading ? '#93c5fd' : '#2563eb',
                color: '#fff', border: 'none', borderRadius: '7px',
                fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}