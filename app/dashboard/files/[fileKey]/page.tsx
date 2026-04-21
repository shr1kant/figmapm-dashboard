'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme-context'

type Status = 'Open' | 'In Progress' | 'Clarify' | 'Done'

type Comment = {
  id: string
  file_key: string
  figma_user_name: string | null
  message: string
  parent_id: string | null
  order_id: number | null
  status: Status
  created_at: string
}

const COLUMNS: { key: Status; label: string; color: string; bg: string; dot: string; border: string; tagBg: string }[] = [
  { key: 'Open',        label: 'Open',        color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6', border: '#bfdbfe', tagBg: '#dbeafe' },
  { key: 'In Progress', label: 'In Progress', color: '#d97706', bg: '#fffbeb', dot: '#f59e0b', border: '#fde68a', tagBg: '#fef3c7' },
  { key: 'Clarify',     label: 'Clarify',     color: '#7c3aed', bg: '#f5f3ff', dot: '#8b5cf6', border: '#ddd6fe', tagBg: '#ede9fe' },
  { key: 'Done',        label: 'Done',        color: '#059669', bg: '#ecfdf5', dot: '#10b981', border: '#a7f3d0', tagBg: '#d1fae5' },
]

const DARK_COLUMNS: { key: Status; label: string; color: string; bg: string; dot: string; border: string; tagBg: string }[] = [
  { key: 'Open',        label: 'Open',        color: '#60a5fa', bg: '#1e3a5f', dot: '#3b82f6', border: '#1e40af', tagBg: '#1e3a5f' },
  { key: 'In Progress', label: 'In Progress', color: '#fbbf24', bg: '#3d2e00', dot: '#f59e0b', border: '#92400e', tagBg: '#3d2e00' },
  { key: 'Clarify',     label: 'Clarify',     color: '#a78bfa', bg: '#2e1f5e', dot: '#8b5cf6', border: '#4c1d95', tagBg: '#2e1f5e' },
  { key: 'Done',        label: 'Done',        color: '#34d399', bg: '#064e3b', dot: '#10b981', border: '#065f46', tagBg: '#064e3b' },
]

function setBorderColor(el: HTMLElement, color: string) {
  el.style.borderTopColor    = color
  el.style.borderRightColor  = color
  el.style.borderBottomColor = color
  el.style.borderLeftColor   = color
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

export default function FileKanbanPage() {
  const { fileKey } = useParams<{ fileKey: string }>()
  const router = useRouter()
  const supabase = createBrowserClient()
  const { colors, theme, toggle } = useTheme()

  const [comments, setComments]   = useState<Comment[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [fileName, setFileName]   = useState('')
  const [updating, setUpdating]   = useState<string | null>(null)
  const [isLive, setIsLive]       = useState(false)

  // Resolve modal state
  const [resolveTarget, setResolveTarget] = useState<Comment | null>(null)
  const [resolving, setResolving]         = useState(false)
  const [resolveError, setResolveError]   = useState('')

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const cols = theme === 'dark' ? DARK_COLUMNS : COLUMNS

  useEffect(() => {
    if (!fileKey) return
    fetchComments()
    subscribeToRealtime()
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    }
  }, [fileKey])

  async function fetchComments() {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/comments?fileKey=${fileKey}`)
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { setError(data.error || `Error ${res.status}`); setLoading(false); return }
      setComments(data.comments || [])
      setFileName(data.file_name || fileKey)
    } catch (err) {
      console.error(err); setError('Failed to load comments.')
    }
    setLoading(false)
  }

  function subscribeToRealtime() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`comments:${fileKey}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments', filter: `file_key=eq.${fileKey}` },
        (payload) => {
          const updated = payload.new as Comment
          setComments(prev => prev.map(c => c.id === updated.id ? { ...c, status: updated.status } : c))
        }
      )
      .subscribe(status => setIsLive(status === 'SUBSCRIBED'))
    channelRef.current = channel
  }

  async function handleStatusChange(commentId: string, newStatus: Status) {
    setUpdating(commentId)
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, status: newStatus } : c))
    try {
      const res  = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) { console.error('Status update failed:', data.error); fetchComments() }
    } catch (err) { console.error(err); fetchComments() }
    setUpdating(null)
  }

  async function handleResolveConfirm() {
    if (!resolveTarget) return
    setResolving(true)
    setResolveError('')
    try {
      const res  = await fetch(`/api/comments/${resolveTarget.id}/resolve`, { method: 'POST' })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) {
        setResolveError(data.error || 'Failed to resolve. Try again.')
        setResolving(false)
        return
      }
      // Remove from board
      setComments(prev => prev.filter(c => c.id !== resolveTarget.id))
      setResolveTarget(null)
    } catch (err) {
      console.error(err)
      setResolveError('Network error. Try again.')
    }
    setResolving(false)
  }

  const topLevelComments = (status: Status) =>
    comments.filter(c => c.status === status && !c.parent_id)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, -apple-system, sans-serif', background: colors.bg, transition: 'background 0.2s' }}>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        select:focus { outline: none; }
      `}</style>

      {/* ── Resolve Confirm Modal ── */}
      {resolveTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
          onClick={e => { if (e.target === e.currentTarget && !resolving) setResolveTarget(null) }}
        >
          <div style={{
            background: colors.card,
            borderWidth: '1px', borderStyle: 'solid',
            borderTopColor: colors.cardBorder,
            borderRightColor: colors.cardBorder,
            borderBottomColor: colors.cardBorder,
            borderLeftColor: colors.cardBorder,
            borderRadius: '10px',
            padding: '20px',
            width: '100%', maxWidth: '380px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: theme === 'dark' ? '#3d1515' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: colors.text, margin: 0 }}>Resolve comment?</p>
                <p style={{ fontSize: '11px', color: colors.textFaint, margin: 0 }}>This is irreversible</p>
              </div>
            </div>

            {/* Comment preview */}
            <div style={{
              background: colors.tagBg,
              borderWidth: '1px', borderStyle: 'solid',
              borderTopColor: colors.cardBorder,
              borderRightColor: colors.cardBorder,
              borderBottomColor: colors.cardBorder,
              borderLeftColor: colors.cardBorder,
              borderRadius: '6px',
              padding: '10px 12px',
              marginBottom: '12px',
            }}>
              {resolveTarget.order_id != null && (
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#059669', background: theme === 'dark' ? '#064e3b' : '#d1fae5', borderWidth: '1px', borderStyle: 'solid', borderTopColor: theme === 'dark' ? '#065f46' : '#a7f3d0', borderRightColor: theme === 'dark' ? '#065f46' : '#a7f3d0', borderBottomColor: theme === 'dark' ? '#065f46' : '#a7f3d0', borderLeftColor: theme === 'dark' ? '#065f46' : '#a7f3d0', borderRadius: '3px', padding: '1px 5px', marginBottom: '6px', display: 'inline-block' }}>
                  #{resolveTarget.order_id}
                </span>
              )}
              <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {resolveTarget.message}
              </p>
            </div>

            <p style={{ fontSize: '11px', color: colors.textFaint, marginBottom: '14px', lineHeight: '1.6' }}>
              The comment will be <strong style={{ color: colors.textMuted }}>resolved in Figma</strong> and removed from this board. This cannot be undone.
            </p>

            {resolveError && (
              <p style={{ fontSize: '11px', color: '#f87171', marginBottom: '10px', padding: '7px 10px', background: theme === 'dark' ? '#2d1515' : '#fef2f2', borderRadius: '5px' }}>
                ⚠️ {resolveError}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setResolveTarget(null); setResolveError('') }}
                disabled={resolving}
                style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '500', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.cardBorder, borderRightColor: colors.cardBorder, borderBottomColor: colors.cardBorder, borderLeftColor: colors.cardBorder, borderRadius: '6px', cursor: resolving ? 'not-allowed' : 'pointer', color: colors.textMuted, opacity: resolving ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleResolveConfirm}
                disabled={resolving}
                style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '600', background: resolving ? '#7f1d1d' : '#dc2626', border: 'none', borderRadius: '6px', cursor: resolving ? 'not-allowed' : 'pointer', color: '#fff', opacity: resolving ? 0.7 : 1, transition: 'background 0.15s' }}
              >
                {resolving ? 'Resolving...' : 'Yes, Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        height: '48px', background: colors.toolbar,
        borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: colors.toolbarBorder,
        display: 'flex', alignItems: 'center', padding: '0 16px',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, transition: 'background 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: colors.textFaint, padding: '4px 6px', borderRadius: '4px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = colors.tagBg; (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = colors.textFaint }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <FigPMLogo size={20} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: colors.textFaint, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>FigPM</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span style={{ fontSize: '12px', fontWeight: '500', color: colors.text, maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || fileKey}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: isLive ? '#10b981' : colors.textFaint, background: isLive ? (theme === 'dark' ? '#064e3b' : '#ecfdf5') : colors.tagBg, padding: '2px 7px', borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderTopColor: isLive ? '#a7f3d0' : colors.toolbarBorder, borderRightColor: isLive ? '#a7f3d0' : colors.toolbarBorder, borderBottomColor: isLive ? '#a7f3d0' : colors.toolbarBorder, borderLeftColor: isLive ? '#a7f3d0' : colors.toolbarBorder, marginLeft: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isLive ? '#10b981' : colors.textFaint, display: 'inline-block', animation: isLive ? 'pulse 2s infinite' : 'none' }} />
            {isLive ? 'Live' : 'Connecting...'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: colors.textFaint, background: colors.tagBg, padding: '2px 8px', borderRadius: '10px', borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder }}>
            {comments.filter(c => !c.parent_id).length} comments
          </span>
          <button onClick={toggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted }}
            onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.toolbarBorder); (e.currentTarget as HTMLElement).style.color = colors.textMuted }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={() => router.push(`/dashboard/files/${fileKey}/changelog`)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted, fontWeight: '500' }}
            onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.toolbarBorder); (e.currentTarget as HTMLElement).style.color = colors.textMuted }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Changelog
          </button>
          <button onClick={fetchComments}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', background: colors.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.toolbarBorder, borderRightColor: colors.toolbarBorder, borderBottomColor: colors.toolbarBorder, borderLeftColor: colors.toolbarBorder, borderRadius: '5px', cursor: 'pointer', color: colors.textMuted, fontWeight: '500' }}
            onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.color = colors.text }}
            onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.toolbarBorder); (e.currentTarget as HTMLElement).style.color = colors.textMuted }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Kanban body */}
      <div style={{ flex: 1, padding: '20px', overflowX: 'auto' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderWidth: '2px', borderStyle: 'solid', borderTopColor: '#7B61FF', borderRightColor: colors.cardBorder, borderBottomColor: colors.cardBorder, borderLeftColor: colors.cardBorder, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>Fetching comments from Figma...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: theme === 'dark' ? '#2d1515' : '#fef2f2', borderWidth: '1px', borderStyle: 'solid', borderTopColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRightColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderBottomColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderLeftColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRadius: '8px', padding: '14px 16px', color: theme === 'dark' ? '#f87171' : '#dc2626', fontSize: '12px', maxWidth: '480px' }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(240px, 1fr))', gap: '12px', alignItems: 'start', minWidth: '960px' }}>
            {cols.map(col => (
              <div key={col.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', padding: '0 2px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.dot, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: col.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '600', color: col.color, background: col.tagBg, borderRadius: '8px', padding: '1px 6px', borderWidth: '1px', borderStyle: 'solid', borderTopColor: col.border, borderRightColor: col.border, borderBottomColor: col.border, borderLeftColor: col.border }}>
                    {topLevelComments(col.key).length}
                  </span>
                </div>
                <div style={{ height: '2px', background: col.dot, borderRadius: '1px', marginBottom: '10px', opacity: 0.35 }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {topLevelComments(col.key).length === 0 ? (
                    <div style={{ borderWidth: '1px', borderStyle: 'dashed', borderTopColor: colors.emptyBorder, borderRightColor: colors.emptyBorder, borderBottomColor: colors.emptyBorder, borderLeftColor: colors.emptyBorder, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', color: colors.textFaint, margin: 0 }}>No comments</p>
                    </div>
                  ) : (
                    topLevelComments(col.key).map(comment => (
                      <div key={comment.id}
                        style={{ background: colors.card, borderWidth: '1px', borderStyle: 'solid', borderTopColor: colors.cardBorder, borderRightColor: colors.cardBorder, borderBottomColor: colors.cardBorder, borderLeftColor: colors.cardBorder, borderRadius: '8px', padding: '12px', opacity: updating === comment.id ? 0.55 : 1, transition: 'all 0.15s', boxShadow: `0 1px 3px rgba(0,0,0,${theme === 'dark' ? '0.2' : '0.04'})` }}
                        onMouseEnter={e => { setBorderColor(e.currentTarget as HTMLElement, '#7B61FF'); (e.currentTarget as HTMLElement).style.boxShadow = colors.cardHoverShadow }}
                        onMouseLeave={e => { setBorderColor(e.currentTarget as HTMLElement, colors.cardBorder); (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px rgba(0,0,0,${theme === 'dark' ? '0.2' : '0.04'})` }}
                      >
                        {/* Card top row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          {comment.order_id != null && (
                            <span style={{ fontSize: '10px', fontWeight: '600', color: col.color, background: col.tagBg, padding: '1px 6px', borderRadius: '4px', borderWidth: '1px', borderStyle: 'solid', borderTopColor: col.border, borderRightColor: col.border, borderBottomColor: col.border, borderLeftColor: col.border }}>
                              #{comment.order_id}
                            </span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#7B61FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                              {(comment.figma_user_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '11px', color: colors.textFaint }}>{comment.figma_user_name || 'Unknown'}</span>
                          </div>
                        </div>

                        {/* Message */}
                        <p style={{ fontSize: '12px', color: colors.text, margin: '0 0 10px', lineHeight: '1.55', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {comment.message}
                        </p>

                        {/* Card footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: colors.divider }}>
                          <span style={{ fontSize: '10px', color: colors.textFaint }}>
                            {new Date(comment.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* ✅ Resolve button — only on Done cards */}
                            {comment.status === 'Done' && (
                              <button
                                onClick={() => { setResolveTarget(comment); setResolveError('') }}
                                title="Resolve in Figma"
                                style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '500', color: '#f87171', background: theme === 'dark' ? '#2d1515' : '#fef2f2', borderWidth: '1px', borderStyle: 'solid', borderTopColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRightColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderBottomColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderLeftColor: theme === 'dark' ? '#7f1d1d' : '#fecaca', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dc2626'; (e.currentTarget as HTMLElement).style.color = '#fff'; setBorderColor(e.currentTarget as HTMLElement, '#dc2626') }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = theme === 'dark' ? '#2d1515' : '#fef2f2'; (e.currentTarget as HTMLElement).style.color = '#f87171'; setBorderColor(e.currentTarget as HTMLElement, theme === 'dark' ? '#7f1d1d' : '#fecaca') }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                Resolve
                              </button>
                            )}
                            <select value={comment.status} disabled={updating === comment.id}
                              onChange={e => handleStatusChange(comment.id, e.target.value as Status)}
                              style={{ fontSize: '10px', fontWeight: '600', color: col.color, background: col.tagBg, borderWidth: '1px', borderStyle: 'solid', borderTopColor: col.border, borderRightColor: col.border, borderBottomColor: col.border, borderLeftColor: col.border, borderRadius: '4px', padding: '2px 5px', cursor: 'pointer' }}
                            >
                              <option value="Open">Open</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Clarify">Clarify</option>
                              <option value="Done">Done</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 12px' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontSize: '13px', fontWeight: '500', color: colors.textMuted, margin: '0 0 4px' }}>No comments found</p>
            <p style={{ fontSize: '12px', color: colors.textFaint, margin: 0 }}>Make sure your PAT is valid and this file has unresolved comments</p>
          </div>
        )}
      </div>
    </div>
  )
}