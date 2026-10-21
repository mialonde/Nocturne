import { useEffect } from 'react'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'
import type { FullscreenShortcut } from '../../types'

function matchesFullscreenShortcut(
  event: KeyboardEvent,
  shortcut: FullscreenShortcut,
): boolean {
  const key = event.key.toLowerCase()
  const ctrl = event.ctrlKey || event.metaKey
  if (shortcut === 'f') return key === 'f' && !ctrl && !event.shiftKey && !event.altKey
  if (shortcut === 'shift+f') return key === 'f' && event.shiftKey && !ctrl && !event.altKey
  if (shortcut === 'ctrl+shift+f') {
    return key === 'f' && ctrl && event.shiftKey && !event.altKey
  }
  return key === 'f' && event.altKey && !ctrl && !event.shiftKey
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
}

function isInteractiveButton(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, a, input, textarea, select, [role="slider"], [role="switch"]'))
}

export function useKeyboardShortcuts(): void {
  const runtime = useNocturneRuntime()
  const fullscreenShortcut = useNocturneStore((state) => state.fullscreenShortcut)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const state = useNocturneStore.getState()
        if (state.activePanel) {
          event.preventDefault()
          state.setPanel(null)
          return
        }
        if (document.fullscreenElement) {
          event.preventDefault()
          void runtime.toggleFullscreen()
          return
        }
        if (state.isUiHidden) {
          event.preventDefault()
          state.setUiHidden(false)
        }
        return
      }

      if (event.defaultPrevented || event.repeat) return

      if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isInteractiveButton(event.target)) return
        event.preventDefault()
        const state = useNocturneStore.getState()
        if (!state.experienceStarted) {
          void runtime.beginExperience()
        } else {
          void runtime.togglePlayback()
        }
        return
      }

      if (isTextEntry(event.target)) return

      if (matchesFullscreenShortcut(event, fullscreenShortcut)) {
        event.preventDefault()
        void runtime.toggleFullscreen()
        return
      }

      if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTextEntry(event.target)) return
        const state = useNocturneStore.getState()
        if (!state.experienceStarted) return
        event.preventDefault()
        state.setUiHidden(!state.isUiHidden)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fullscreenShortcut, runtime])
}
