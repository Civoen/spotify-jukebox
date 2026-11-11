'use client'

import { useEffect } from 'react'

// Stops ordinary browser behaviours leaking through on the touchscreen:
// the long-press / right-click menu, dragging images or links off the page,
// and pinch / double-tap zoom. Text fields keep working normally.
export default function KioskGuards() {
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest('input, textarea, [contenteditable="true"]')

    const onContextMenu = (e: Event) => { if (!isField(e.target)) e.preventDefault() }
    const onDragStart = (e: Event) => {
      // Queue rows opt in to dragging with draggable="true" for reordering
      const t = e.target
      if (t instanceof HTMLElement && t.closest('[draggable="true"]')) return
      e.preventDefault()
    }
    const onGesture = (e: Event) => e.preventDefault()
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault() }

    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('dragstart', onDragStart)
    document.addEventListener('gesturestart', onGesture)
    document.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('dragstart', onDragStart)
      document.removeEventListener('gesturestart', onGesture)
      document.removeEventListener('wheel', onWheel)
    }
  }, [])

  return null
}
