import { LoaderCircle } from 'lucide-react'
import { useNocturneStore } from '../store/useNocturneStore'

export function ContextLostNotice() {
  const contextLost = useNocturneStore((state) => state.contextLost)
  if (!contextLost) return null
  return (
    <div className="context-lost" role="status">
      <LoaderCircle className="spin" size={16} strokeWidth={1.4} aria-hidden="true" />
      <div>
        <strong>Restoring the visual field</strong>
        <span>Audio continues. The browser is attempting to recover the graphics context.</span>
      </div>
    </div>
  )
}
