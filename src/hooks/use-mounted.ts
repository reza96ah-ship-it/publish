import * as React from 'react'

/**
 * Returns true after the component has mounted on the client.
 * Use this to guard client-only values (e.g. next-themes resolvedTheme)
 * and avoid hydration mismatches.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
