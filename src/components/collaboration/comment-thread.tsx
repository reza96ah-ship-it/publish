'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, CheckCircle2, Circle, Send, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatJalaliTime } from '@/lib/jalali'
import { cn } from '@/lib/utils'

interface Comment {
  id: string
  contentId: string
  userId: string
  userName: string
  body: string
  parentId: string | null
  resolved: boolean
  createdAt: string
  replies?: Comment[]
}

interface CommentThreadProps {
  contentId: string
  className?: string
}

function CommentAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-7 shrink-0">
      <AvatarFallback className="text-2xs bg-accent/10 text-accent">
        {name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  )
}

function CommentItem({
  comment,
  contentId,
  depth = 0,
}: {
  comment: Comment
  contentId: string
  depth?: number
}) {
  const qc = useQueryClient()
  const [showReply, setShowReply] = useState(false)
  const [showReplies, setShowReplies] = useState(true)
  const [replyText, setReplyText] = useState('')

  const resolveMutation = useMutation({
    mutationFn: (resolved: boolean) =>
      api(`/api/content/${contentId}/comments/${comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', contentId] }),
  })

  const replyMutation = useMutation({
    mutationFn: (text: string) =>
      api(`/api/content/${contentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text, parentId: comment.id }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', contentId] })
      setReplyText('')
      setShowReply(false)
    },
  })

  const replies = comment.replies ?? []

  return (
    <div className={cn('group', depth > 0 && 'border-s-2 border-border ps-3')}>
      <div className={cn('flex gap-2.5', comment.resolved && 'opacity-60')}>
        <CommentAvatar name={comment.userName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-ink-primary">{comment.userName}</span>
            <span className="text-2xs text-ink-tertiary num-tabular">
              {formatJalaliTime(new Date(comment.createdAt))}
            </span>
            {comment.resolved && (
              <span className="text-2xs text-success bg-success-soft rounded-full px-1.5 py-0.5">حل شد</span>
            )}
          </div>
          <p className="text-sm text-ink-secondary mt-0.5 leading-relaxed">{comment.body}</p>

          {/* Actions */}
          {depth === 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={() => resolveMutation.mutate(!comment.resolved)}
                disabled={resolveMutation.isPending}
                className="flex items-center gap-1 text-2xs text-ink-tertiary hover:text-ink-primary transition-colors n-focus-ring rounded"
              >
                {comment.resolved
                  ? <Circle className="size-3" />
                  : <CheckCircle2 className="size-3 text-success" />}
                {comment.resolved ? 'باز کردن' : 'حل شد'}
              </button>
              {!comment.resolved && (
                <button
                  onClick={() => setShowReply((v) => !v)}
                  className="text-2xs text-ink-tertiary hover:text-ink-primary transition-colors n-focus-ring rounded"
                >
                  پاسخ
                </button>
              )}
              {replies.length > 0 && (
                <button
                  onClick={() => setShowReplies((v) => !v)}
                  className="flex items-center gap-0.5 text-2xs text-ink-tertiary hover:text-ink-primary transition-colors n-focus-ring rounded"
                >
                  <ChevronDown className={cn('size-3 transition-transform', !showReplies && '-rotate-90')} />
                  {replies.length} پاسخ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply form */}
      {showReply && (
        <div className="mt-2 ms-9 flex gap-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="پاسخ بنویسید…"
            rows={2}
            className="text-sm resize-none"
          />
          <Button
            size="sm"
            onClick={() => replyMutation.mutate(replyText)}
            disabled={!replyText.trim() || replyMutation.isPending}
            className="shrink-0"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Nested replies */}
      {showReplies && replies.length > 0 && (
        <div className="mt-2 ms-9 space-y-3">
          {replies.map((r) => (
            <CommentItem key={r.id} comment={r} contentId={contentId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CommentThread({ contentId, className }: CommentThreadProps) {
  const qc = useQueryClient()
  const [newComment, setNewComment] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ['comments', contentId],
    queryFn: () => api(`/api/content/${contentId}/comments`),
    enabled: !!contentId,
  })

  const postMutation = useMutation({
    mutationFn: (text: string) =>
      api(`/api/content/${contentId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', contentId] })
      setNewComment('')
    },
  })

  const topLevel = comments.filter((c) => !c.parentId)
  const withReplies = topLevel.map((c) => ({
    ...c,
    replies: comments.filter((r) => r.parentId === c.id),
  }))
  const visible = showResolved ? withReplies : withReplies.filter((c) => !c.resolved)
  const resolvedCount = topLevel.filter((c) => c.resolved).length

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-accent" />
          <span className="text-sm font-semibold text-ink-primary">نظرات</span>
          {topLevel.length > 0 && (
            <span className="text-2xs text-ink-tertiary bg-surface-subtle rounded-full px-1.5 py-0.5">
              {topLevel.length}
            </span>
          )}
        </div>
        {resolvedCount > 0 && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-ink-tertiary hover:text-ink-primary transition-colors n-focus-ring rounded"
          >
            {showResolved ? 'مخفی کردن حل شده‌ها' : `نمایش ${resolvedCount} حل شده`}
          </button>
        )}
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="flex gap-2.5">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-6 text-ink-tertiary">
          <MessageSquare className="size-7 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {topLevel.length === 0 ? 'هنوز نظری ثبت نشده' : 'همه نظرات حل شده‌اند'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((c) => (
            <CommentItem key={c.id} comment={c} contentId={contentId} />
          ))}
        </div>
      )}

      {/* New comment */}
      <div className="border-t border-border pt-3 space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="نظر خود را بنویسید…"
          rows={2}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && newComment.trim()) {
              postMutation.mutate(newComment)
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-2xs text-ink-tertiary">Ctrl+Enter برای ارسال</span>
          <Button
            size="sm"
            onClick={() => postMutation.mutate(newComment)}
            disabled={!newComment.trim() || postMutation.isPending}
          >
            <Send className="size-3.5 me-1.5" />
            ارسال
          </Button>
        </div>
      </div>
    </div>
  )
}
