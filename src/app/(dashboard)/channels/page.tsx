import { Suspense } from 'react'
import { ChannelsView } from '@/components/views/channels-view'

export default function ChannelsPage() {
  return (
    <Suspense>
      <ChannelsView />
    </Suspense>
  )
}
