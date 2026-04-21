import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileKey = req.nextUrl.searchParams.get('fileKey')
    if (!fileKey) {
      return NextResponse.json({ error: 'fileKey is required' }, { status: 400 })
    }

    // Step 1: get all comments for this file + user
    const { data: fileComments, error: commentsErr } = await supabase
      .from('comments')
      .select('id, message, order_id, figma_user_name')
      .eq('file_key', fileKey)
      .eq('user_id', user.id)

    if (commentsErr) {
      return NextResponse.json({ error: commentsErr.message }, { status: 500 })
    }

    const commentIds = (fileComments ?? []).map((c) => c.id)
    if (commentIds.length === 0) {
      return NextResponse.json({ history: [] })
    }

    // Step 2: get status_changes for those comment IDs
    const { data: changes, error: changesErr } = await supabase
      .from('status_changes')
      .select('id, comment_id, old_status, new_status, changed_by, changed_at') // ✅ correct columns
      .in('comment_id', commentIds)
      .order('changed_at', { ascending: false })

    if (changesErr) {
      return NextResponse.json({ error: changesErr.message }, { status: 500 })
    }

    // Step 3: merge comment details in JS
    const commentMap = Object.fromEntries((fileComments ?? []).map((c) => [c.id, c]))

    const history = (changes ?? []).map((row) => ({
      ...row,
      changed_by_email: row.changed_by,   // ✅ already the email, just alias it
      comments: commentMap[row.comment_id] ?? null,
    }))

    return NextResponse.json({ history })
  } catch (err) {
    console.error('[GET /api/history] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}