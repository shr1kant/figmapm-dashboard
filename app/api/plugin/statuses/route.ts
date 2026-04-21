import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Validate PAT and return user_id
async function getUserFromPAT(supabase: any, pat: string) {
  const { data, error } = await supabase
    .from('figma_tokens')
    .select('user_id')
    .eq('figma_access_token', pat)
    .single()
  if (error || !data) return null
  return data.user_id
}

// GET — fetch all statuses for a file
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const pat      = req.headers.get('x-figma-token')
    const fileKey  = req.nextUrl.searchParams.get('fileKey')

    if (!pat)     return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })
    if (!fileKey) return NextResponse.json({ error: 'Missing fileKey' }, { status: 400 })

    const userId = await getUserFromPAT(supabase, pat)
    if (!userId)  return NextResponse.json({ error: 'PAT not recognised' }, { status: 401 })

    const { data, error } = await supabase
      .from('comments')
      .select('id, status')
      .eq('file_key', fileKey)
      .eq('user_id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Return as { commentId: status } map
    const statuses: Record<string, string> = {}
    ;(data || []).forEach((row: any) => {
      statuses[row.id] = row.status
    })

    return NextResponse.json({ statuses })
  } catch (err) {
    console.error('[GET /api/plugin/statuses]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — update a single comment status
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const pat      = req.headers.get('x-figma-token')

    if (!pat) return NextResponse.json({ error: 'Missing PAT' }, { status: 401 })

    const userId = await getUserFromPAT(supabase, pat)
    if (!userId) return NextResponse.json({ error: 'PAT not recognised' }, { status: 401 })

    const { commentId, status, fileKey } = await req.json()
    if (!commentId || !status || !fileKey) {
      return NextResponse.json({ error: 'Missing commentId, status, or fileKey' }, { status: 400 })
    }

    const validStatuses = ['Open', 'In Progress', 'Clarify', 'Done']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Get current status for changelog
    const { data: existing } = await supabase
      .from('comments')
      .select('status')
      .eq('id', commentId)
      .eq('user_id', userId)
      .single()

    const oldStatus = existing?.status || 'Open'

    // Upsert comment — creates if not exists, updates if exists
    const { error: upsertError } = await supabase
      .from('comments')
      .upsert({
        id:       commentId,
        file_key: fileKey,
        user_id:  userId,
        status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Log to changelog
    if (oldStatus !== status) {
      const { data: userRow } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      await supabase.from('status_changes').insert({
        comment_id: commentId,
        old_status: oldStatus,
        new_status: status,
        changed_by: userRow?.email || userId,
        changed_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PATCH /api/plugin/statuses]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}