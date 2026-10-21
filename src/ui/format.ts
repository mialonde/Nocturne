export function formatDurationMs(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatClock(seconds: number): string {
  return formatDurationMs(seconds * 1000)
}

export function formatLongDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) return `${hours} hr ${minutes} min`
  if (minutes > 0) return `${minutes} min ${rest} sec`
  return `${rest} sec`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const megabytes = bytes / (1024 * 1024)
  if (megabytes < 9.95) return `${megabytes.toFixed(1)} MB`
  return `${Math.round(megabytes)} MB`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return formatBytes(bytes)
}
