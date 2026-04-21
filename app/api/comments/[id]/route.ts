import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

type Status = 'Open' | 'In Progress' | 'Clarify' | 'Done'
const VALID_STATUSES: Status[] = ['Open', 'In Progress', 'Clarify', 'Done']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: commentId } = await params
    if (!commentId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const body = await req.json()
    const newStatus: Status = body.status
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 })
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('comments')
      .select('status')
      .eq('id', commentId)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const oldStatus = existing.status

    const { error: updateError } = await supabase
      .from('comments')
      .update({ status: newStatus })
      .eq('id', commentId)
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (oldStatus !== newStatus) {
      const { error: historyError } = await supabase
        .from('status_changes')
        .insert({
          comment_id: commentId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: user.email,         // ✅ correct column
          changed_at: new Date().toISOString(),
        })

      if (historyError) {
        console.error('[PATCH /api/comments/[id]] History insert error:', historyError)
        return NextResponse.json({ error: `History insert failed: ${historyError.message}` }, { status: 500 })
     }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err) {
    console.error('[PATCH /api/comments/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}