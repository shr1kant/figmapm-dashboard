'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme-context'

type FigmaFile = {
  id: string
  figma_file_key: string
  file_name: string
  created_at: string
}

function extractFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

function extractFileName(url: string): string {
  const match = url.match(/figma\.com\/(?:design|file)\/[a-zA-Z0-9]+\/([^?]+)/)
  if (!match) return 'Untitled'
  return decodeURIComponent(match[1].replace(/-/g, ' '))
}

function FigPMLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#1e1e1e"/>
      <rect x="7" y="7" width="3.5" height="18" rx="1.75" fill="#7B61FF"/>
      <rect x="7" y="7" width="13" height="3.5" rx="1.75" fill="#7B61FF"/>
      <rect x="7" y="13.25" width="9" height="3" rx="1.5" fill="#A78BFA"/>
      <circle cx="22" cy="22" r="3.5" fill="#7B61FF" opacity="0.85"/>
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function DashboardPage() {
  const { colors, theme, toggle } = useTheme()

  const [userEmail, setUserEmail] = useState('')
  const [files, setFiles]         = useState<FigmaFile[]>([])
  const [showModal, setShowModal] = useState(false)
  const [figmaUrl, setFigmaUrl]   = useState('')
  const [pat, setPat]             = useState('')
  const [adding, setAdding]       = useState(false)
  const [addError, setAddError]   = useState('')
  const [activeNav, setActiveNav] = useState('Files')

  const supabase = createBrowserClient()
  const router   = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email || '')
      loadFiles()
    })
  }, [])

  async function loadFiles() {
    try {
      const res  = await fetch('/api/files')
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      setFiles(data.files || [])
    } catch (err) {
      console.error('loadFiles error:', err)
      setFiles([])
    }
  }

  function handleFileClick(fileKey: string) {
    router.push(`/dashboard/files/${fileKey}`)
  }

  async function handleAddFile(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError('')

    const figma_file_key = extractFileKey(figmaUrl)
    if (!figma_file_key) {
      setAddError('Invalid Figma URL. Paste a valid figma.com/design/... link.')
      setAdding(false)
      return
    }
    const file_name = extractFileName(figmaUrl)

    try {
      const res  = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figma_file_key, file_name, thumbnail_url: null, pat })
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { setAddError(data.error || 'Something went wrong'); setAdding(false); return }
      setShowModal(false); setFigmaUrl(''); setPat(''); setAdding(false); loadFiles()
    } catch (err) {
      console.error(err)
      setAddError('Network error — check console.')
      setAdding(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { label: 'Files', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg> },
    { label: 'Comments', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label: 'Settings', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, -apple-system, sans-serif', background: colors.bg, transition: 'background 0.2s' }}>

      {/* Dark sidebar — stays dark in both modes */}
      <div style={{ width: '240px', background: colors.sidebar, display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: `1px solid ${colors.sidebarBorder}`, transition: 'background 0.2s' }}>

        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.sidebarBorder}`, display: 'flex', alignItems: 'center', gap: '10px', height: '48px' }}>
          <FigPMLogo size={24} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#e5e5e5', letterSpacing: '-0.01em' }}>FigPM</span>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map(item => (
            <div key={item.label} onClick={() => setActiveNav(item.label)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 16px', cursor: 'pointer', color: activeNav === item.label ? '#ffffff' : '#888888', background: activeNav === item.label ? colors.navActive : 'transparent', fontSize: '13px', fontWeight: activeNav === item.label ? '500' : '400', borderRadius: '4px', margin: '1px 6px', transition: 'all 0.1s' }}
              onMouseEnter={e => { if (activeNav !== item.label) (e.currentTarget as HTMLElement).style.background = colors.navHover }}
              onMouseLeave={e => { if (activeNav !== item.label) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {item.icon}<span>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: `1px solid ${colors.sidebarBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', marginBottom: '4px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7B61FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '11px', color: '#888888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{userEmail}</span>
          </div>
          <button onClick={handleSignOut}
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'none', border: `1px solid ${colors.sidebarBorder}`, borderRadius: '5px', color: '#888888', cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#555'; (e.currentTarget as HTMLElement).style.color = '#e5e5e5' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = colors.sidebarBorder; (e.currentTarget as HTMLElement).style.color = '#888888' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Toolbar */}
        <div style={{ height: '48px', background: colors.toolbar, borderBottom: `1px solid ${colors.toolbarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, transition: 'background 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: colors.textFaint }}>Dashboard</span>
            <span style={{ fontSize: '12px', color: colors.textFaint }}>/</span>
            <span style={{ fontSize: '12px', fontWeight: '500', color: colors.text }}>Files</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* ✅ Dark mode toggle */}
            <button
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', background: colors.tagBg, border: `1px solid ${colors.toolbarBorder}`, borderRadius: '6px', cursor: 'pointer', color: colors.textMuted, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = colors.text; (e.currentTarget as HTMLElement).style.borderColor = '#7B61FF' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = colors.textMuted; (e.currentTarget as HTMLElement).style.borderColor = colors.toolbarBorder }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#7B61FF', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#6B4EFF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#7B61FF'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Figma file
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: colors.text, margin: '0 0 2px', transition: 'color 0.2s' }}>Your Files</h2>
            <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>{files.length} file{files.length !== 1 ? 's' : ''} connected</p>
          </div>

          {files.length === 0 ? (
            <div style={{ background: colors.card, border: `1px dashed ${colors.emptyBorder}`, borderRadius: '8px', padding: '48px', textAlign: 'center', transition: 'background 0.2s' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              <p style={{ fontSize: '13px', fontWeight: '500', color: colors.textMuted, margin: '0 0 4px' }}>No files connected</p>
              <p style={{ fontSize: '12px', color: colors.textFaint, margin: '0 0 16px' }}>Add a Figma file to start tracking comments</p>
              <button onClick={() => setShowModal(true)}
                style={{ padding: '7px 16px', background: '#7B61FF', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                + Add Figma file
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {files.map(file => (
                <div key={file.id} onClick={() => handleFileClick(file.figma_file_key)}
                  style={{ background: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#7B61FF'; (e.currentTarget as HTMLElement).style.boxShadow = colors.cardHoverShadow }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = colors.cardBorder; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  <div style={{ height: '110px', background: theme === 'dark' ? 'linear-gradient(135deg, #1e1530 0%, #261e3a 100%)' : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `1px solid ${colors.cardBorder}` }}>
                    <FigPMLogo size={36} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '500', color: colors.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file_name}</p>
                    <p style={{ fontSize: '11px', color: colors.textFaint, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.figma_file_key}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: colors.modalOverlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setAddError('') } }}>
          <div style={{ background: colors.modalBg, borderRadius: '10px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: `1px solid ${colors.cardBorder}`, transition: 'background 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 2px', color: colors.text }}>Add Figma File</h3>
                <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>Connect a file to start tracking comments</p>
              </div>
              <button onClick={() => { setShowModal(false); setAddError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = colors.tagBg}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <form onSubmit={handleAddFile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Figma File URL', type: 'text', value: figmaUrl, onChange: setFigmaUrl, placeholder: 'https://www.figma.com/design/...' },
                { label: 'Personal Access Token', type: 'password', value: pat, onChange: setPat, placeholder: 'figd_...' },
              ].map(field => (
                <div key={field.label}>
                  <label style={{ fontSize: '11px', fontWeight: '500', color: colors.textMuted, display: 'block', marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                    {field.label}
                  </label>
                  <input type={field.type} value={field.value} onChange={e => field.onChange(e.target.value)}
                    placeholder={field.placeholder} required
                    style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: `1px solid ${colors.inputBorder}`, borderRadius: '6px', outline: 'none', boxSizing: 'border-box' as const, color: colors.text, background: colors.inputBg, transition: 'border-color 0.15s' }}
                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#7B61FF'}
                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = colors.inputBorder}
                  />
                </div>
              ))}

              {addError && (
                <div style={{ fontSize: '12px', color: '#dc2626', padding: '8px 10px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>{addError}</div>
              )}

              <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                <button type="button" onClick={() => { setShowModal(false); setAddError('') }}
                  style={{ flex: 1, padding: '8px', background: colors.tagBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: colors.textMuted, fontWeight: '500' }}>
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  style={{ flex: 1, padding: '8px', background: adding ? '#a78bfa' : '#7B61FF', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: adding ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#6B4EFF' }}
                  onMouseLeave={e => { if (!adding) (e.currentTarget as HTMLElement).style.background = '#7B61FF' }}
                >
                  {adding ? 'Adding...' : 'Add File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}