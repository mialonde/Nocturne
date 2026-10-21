import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useNocturneStore } from '../store/useNocturneStore'

export function ToastViewport() {
  const toast = useNocturneStore((state) => state.toast)
  const clearToast = useNocturneStore((state) => state.clearToast)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => {
      if (useNocturneStore.getState().toast?.id === toast.id) clearToast()
    }, 5200)
    return () => window.clearTimeout(timeout)
  }, [clearToast, toast])

  if (!toast) return null
  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast__mark" aria-hidden="true" />
      <p>{toast.message}</p>
      <button type="button" aria-label="Dismiss message" onClick={clearToast}>
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
