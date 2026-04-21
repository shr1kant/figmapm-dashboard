'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/lib/theme-context'
import { createBrowserClient } from '@/lib/supabase'

type HistoryRow = {
  id: string
  comment_id: string
  changed_by_email: string | null
  old_status: string
  new_status: string
  changed_at: string
  comments: {
    message: string
    order_id: number | null
    figma_user_name: string | null
  } | null
}

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Open':        { color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' },
  'In Progress': { color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  'Clarify':     { color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
  'Done':        { color: '#059669', bg: '#d1fae5', border: '#a7f3d0' },
}

// ✅ Helper: sets all 4 border sides to same color
function setBorderColor(el: HTMLElement, color: string) {
  el.style.borderTopColor    = color
  el.style.borderRightColor  = color
  el.style.borderBottomColor = color
  el.style.borderLeftColor   = color
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || { color: '#666', bg: '#f5f5f5', border: '#e5e5e5' }
  return (
    <span style={{ fontSize: '10px', fontWeight: '600', color: s.color, background: s.bg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: s.border, borderRightColor: s.border, borderBottomColor: s.border, borderLeftColor: s.border, borderRadius: '4px', padding: '2px 7px', whiteSpace: 'nowrap' as const }}>
      {status}
    </span>
  )
}

function FigPMLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#1e1e1e"/>
      <rect x="7" y="7" width="3.5" height="18" rx="1.75" fill="#7B61FF"/>
      <rect x="7" y="7" width="13" height="3.5" rx="1.75" fill="#7B61FF"/>
      <rect x="7" y="13.25" width="9" height="3" rx="1.5" fill="#A78BFA"/>
      <circle cx="22" cy="22" r="3.5" fill="#7B61FF" opacity="0.85"/>
    </svg>
  )
}

function SunIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
}
function MoonIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
}

export default function ChangelogPage() {
  const { fileKey } = useParams<{ fileKey: string }>()
  const router = useRouter()
  const { colors, theme, toggle } = useTheme()
  const supabase = createBrowserClient()

  const [history, setHistory]     = useState<HistoryRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [fileName, setFileName]   = useState('')

  useEffect(() => { if (fileKey) fetchHistory() }, [fileKey])

  async function fetchHistory() {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/history?fileKey=${fileKey}`)
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { setError(data.error || 'Failed to load history'); setLoading(false); return }
      setHistory(data.history || [])

      const fRes  = await fetch(`/api/comments?fileKey=${fileKey}`)
      const fText = await fRes.text()
      const fData = fText ? JSON.parse(fText) : {}
      setFileName(fData.file_name || fileKey)
    } catch (err) {
      console.error(err); setError('Network error loading history.')
    }
    setLoading(false)
  }

  async function handleRestore(commentId: string, restoreToStatus: string, historyRowId: string) {
    setRestoring(historyRowId)
    try {
      const res  = await fetch(`/api/comments/${commentId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreToStatus }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { alert(data.error || 'Restore failed'); setRestoring(null); return }
      await fetchHistory()
    } catch (err) {
      console.error(err); alert('Network error during restore.')
    }
    setRestoring(null)
  }

  function truncate(str: string, n: number) {
    return str.length > n ? str.slice(0, n) + '…' : str
  }

  const grouped: Record<string, HistoryRow[]> = {}
  history.forEach(row => {
    const dateKey = new Date(row.changed_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(row)
  })

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, -apple-system, sans-serif', background: colors.bg, transition: 'background 0.2s' }}>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; }`}</style>

      {/* Toolbar */}
      <div style={{
        height: '48px',
        background: colors.toolbar,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: colors.toolbarBorder,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        transition: 'background 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <button onClick={() => router.push(`/dashboard/files/${fileKey}`)}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: colors.textFaint, padding: '4px 6px', borderRadius: '4px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.tagBg; (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = colors.textFaint }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <FigPMLogo size={20} />
          <span style={{ fontSize: '12px', color: colors.textFaint, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>FigPM</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ fontSize: '12px', color: colors.textFaint, cursor: 'pointer' }} onClick={() => router.push(`/dashboard/files/${fileKey}`)}>{fileName || fileKey}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ fontSize: '12px', fontWeight: '500', color: colors.text }}>Changelog</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: colors.textFaint, background: colors.tagBg, padding: '2px 8px', borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder }}>
            {history.length} event{history.length !== 1 ? 's' : ''}
          </span>

          <button onClick={toggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted }}
            onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.toolbarBorder); (e.currentTarget as HTMLElement).style.color = colors.textMuted }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button onClick={fetchHistory}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted, fontWeight: '500' }}
            onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.toolbarBorder); (e.currentTarget as HTMLElement).style.color = colors.textMuted }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 4px' }}>Changelog</h1>
          <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>All status changes for this file, newest first. Restore any comment to a previous state.</p>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '10px' }}>
            {/* ✅ Spinner — all 4 side colors */}
            <div style={{
              width: '24px', height: '24px',
              borderWidth: '2px', borderStyle: 'solid',
              borderTopColor: '#7B61FF',
              borderRightColor: colors.cardBorder,
              borderBottomColor: colors.cardBorder,
              borderLeftColor: colors.cardBorder,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: '12px', color: colors.textFaint }}>Loading history...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: theme === 'dark' ? '#2d1515' : '#fef2f2', borderWidth: '1px', borderStyle: 'solid', borderTopColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRightColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderBottomColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderLeftColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRadius: '8px', padding: '14px', color: theme === 'dark' ? '#f87171' : '#dc2626', fontSize: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <p style={{ fontSize: '13px', fontWeight: '500', color: colors.textMuted, margin: '0 0 4px' }}>No history yet</p>
            <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>Changes will appear here once you start updating comment statuses</p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {Object.entries(grouped).map(([dateLabel, rows]) => (
              <div key={dateLabel}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}>{dateLabel}</span>
                  <div style={{ flex: 1, height: '1px', background: colors.toolbarBorder }} />
                </div>

                <div style={{ background: colors.card, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.cardBorder, borderRightColor: colors.cardBorder, borderBottomColor: colors.cardBorder, borderLeftColor: colors.cardBorder, borderRadius: '8px', overflow: 'hidden' }}>

                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 160px 180px 90px', padding: '8px 16px', background: colors.tagBg, borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: colors.cardBorder }}>
                    {['Time', 'Comment', 'Changed by', 'Status change', ''].map(h => (
                      <span key={h} style={{ fontSize: '10px', fontWeight: '600', color: colors.textFaint, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{h}</span>
                    ))}
                  </div>

                  {/* Rows */}
                  {rows.map((row, i) => (
                    <div key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 160px 180px 90px',
                        padding: '10px 16px',
                        borderBottomWidth: i < rows.length - 1 ? '1px' : '0',
                        borderBottomStyle: 'solid',
                        borderBottomColor: colors.divider,
                        alignItems: 'center',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = colors.tagBg}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '11px', color: colors.textFaint, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(row.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                        {row.comments?.order_id != null && (
                          <span style={{ fontSize: '10px', fontWeight: '600', color: '#7B61FF', background: theme === 'dark' ? '#2e1f5e' : '#ede9fe', borderWidth: '1px', borderStyle: 'solid', borderTopColor: '#ddd6fe', borderRightColor: '#ddd6fe', borderBottomColor: '#ddd6fe', borderLeftColor: '#ddd6fe', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
                            #{row.comments.order_id}
                          </span>
                        )}
                        <span style={{ fontSize: '12px', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {truncate(row.comments?.message || row.comment_id, 48)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#7B61FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                          {(row.changed_by_email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '11px', color: colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                          {row.changed_by_email?.split('@')[0] || 'Unknown'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusBadge status={row.old_status} />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        <StatusBadge status={row.new_status} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRestore(row.comment_id, row.old_status, row.id)}
                          disabled={restoring === row.id}
                          title={`Restore to "${row.old_status}"`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '10px', fontWeight: '500',
                            color: restoring === row.id ? colors.textFaint : '#7B61FF',
                            background: 'none',
                            borderWidth: '1px', borderStyle: 'solid',
                            borderTopColor: restoring === row.id ? colors.cardBorder : '#7B61FF33',
                            borderRightColor: restoring === row.id ? colors.cardBorder : '#7B61FF33',
                            borderBottomColor: restoring === row.id ? colors.cardBorder : '#7B61FF33',
                            borderLeftColor: restoring === row.id ? colors.cardBorder : '#7B61FF33',
                            borderRadius: '4px', padding: '3px 8px',
                            cursor: restoring === row.id ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap' as const
                          }}
                          onMouseEnter={e => {
                            if (restoring !== row.id) {
                              const el = e.currentTarget as HTMLElement
                              el.style.background = '#7B61FF'
                              el.style.color = 'white'
                              setBorderColor(el, '#7B61FF')
                            }
                          }}
                          onMouseLeave={e => {
                            if (restoring !== row.id) {
                              const el = e.currentTarget as HTMLElement
                              el.style.background = 'none'
                              el.style.color = '#7B61FF'
                              setBorderColor(el, '#7B61FF33')
                            }
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/></svg>
                          {restoring === row.id ? '...' : 'Restore'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}