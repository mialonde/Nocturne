import { useEffect, useState } from 'react'
import type { BreathState } from '../../types'

export function useBreathState(getBreathState: () => BreathState | null, active: boolean): BreathState | null {
  const [state, setState] = useState<BreathState | null>(() => getBreathState())

  useEffect(() => {
    let frame = 0
    let lastUpdate = 0
    const tick = (now: number) => {
      if (now - lastUpdate > 80) {
        lastUpdate = now
        setState(getBreathState())
      }
      frame = requestAnimationFrame(tick)
    }
    if (active) {
      frame = requestAnimationFrame(tick)
    } else {
      setState(getBreathState())
    }
    return () => cancelAnimationFrame(frame)
  }, [active, getBreathState])

  return state
}
