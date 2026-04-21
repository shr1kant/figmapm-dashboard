import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

async function getUserFromPAT(supabase: any, pat: string) {
  const { data, error } = await supabase
    .from('figma_tokens')
    .select('user_id')
    .eq('figma_access_token', pat)
    .single()
  if (error || !data) return null
  return data.user_id
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const pat      = req.headers.get('x-figma-token')

    if (!pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

    const userId = await getUserFromPAT(supabase, pat)
    if (!userId) return NextResponse.json({ error: 'PAT not recognised' }, { status: 401 })

    const { commentId, fileKey } = await req.json()
    if (!commentId || !fileKey) {
      return NextResponse.json({ error: 'Missing commentId or fileKey' }, { status: 400 })
    }

    // Mark resolved
    await supabase
      .from('comments')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', userId)

    // Log to changelog
    const { data: userRow } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    await supabase.from('status_changes').insert({
      comment_id: commentId,
      old_status: 'Done',
      new_status: 'Resolved',
      changed_by: userRow?.email || userId,
      changed_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/plugin/resolve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}