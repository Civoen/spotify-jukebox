'use client'

import { useState, useCallback } from 'react'
import { useJukeboxStore } from '@/lib/store'

const chromeH = 'linear-gradient(90deg, #e8d5b0 0%, #c9a460 20%, #f5e8c0 50%, #b8902a 80%, #e0c878 100%)'

const ALPHA_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
]

const NUM_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['-',"'",'.',',','!','?','/'],
  ['@','#','$','%','&','(',')'],
]

type Variant = 'default' | 'accent' | 'active' | 'danger'

function Key({
  label, onPress, flex = 1, variant = 'default', fontSize = 18,
}: {
  label: string
  onPress: () => void
  flex?: number
  variant?: Variant
  fontSize?: number
}) {
  const [pressed, setPressed] = useState(false)

  const bg: Record<Variant, string> = {
    default: 'rgba(201,162,39,0.07)',
    accent:  'rgba(201,162,39,0.15)',
    active:  'rgba(201,162,39,0.28)',
    danger:  'rgba(255,80,80,0.1)',
  }
  const bgPressed: Record<Variant, string> = {
    default: 'rgba(201,162,39,0.45)',
    accent:  'rgba(201,162,39,0.55)',
    active:  'rgba(201,162,39,0.65)',
    danger:  'rgba(255,80,80,0.45)',
  }
  const border: Record<Variant, string> = {
    default: 'rgba(201,162,39,0.22)',
    accent:  'rgba(201,162,39,0.35)',
    active:  'rgba(201,162,39,0.6)',
    danger:  'rgba(255,80,80,0.3)',
  }
  const color = variant === 'danger' ? 'rgba(255,120,120,0.85)' : 'rgba(201,162,39,0.9)'
  const shadow = (variant === 'active' || pressed) ? '0 0 10px rgba(201,162,39,0.35)' : 'none'

  const handlePress = useCallback(() => {
    setPressed(true)
    onPress()
    setTimeout(() => setPressed(false), 150)
  }, [onPress])

  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); handlePress() }}
      style={{
        flex,
        height: 56,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pressed ? bgPressed[variant] : bg[variant],
        border: `1px solid ${border[variant]}`,
        color,
        fontSize,
        fontFamily: 'monospace',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0,
        minWidth: 0,
        boxShadow: shadow,
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  )
}

export default function OnScreenKeyboard() {
  const { keyboardVisible, setKeyboardVisible, onKeyPress } = useJukeboxStore()
  const [numMode, setNumMode] = useState(false)
  const [shifted, setShifted] = useState(false)

  if (!keyboardVisible) return null

  const rows = numMode ? NUM_ROWS : ALPHA_ROWS

  const pressChar = (char: string) => {
    const out = (!numMode && shifted) ? char.toUpperCase() : char
    onKeyPress?.(out)
    if (shifted) setShifted(false)
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      background: 'rgba(10,5,0,0.98)',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.9)',
    }}>
      <div style={{ padding: '12px 8px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Character rows */}
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {/* Stagger row 2 for QWERTY feel */}
            {ri === 1 && !numMode && <div style={{ flex: 0.5, flexShrink: 0 }} />}

            {row.map((char) => (
              <Key
                key={char}
                label={!numMode && shifted ? char.toUpperCase() : char}
                onPress={() => pressChar(char)}
              />
            ))}

            {/* Backspace on last row */}
            {ri === rows.length - 1 && (
              <>
                <div style={{ width: 6, flexShrink: 0 }} />
                <Key label="⌫" onPress={() => onKeyPress?.('BACKSPACE')} flex={1.6} variant="accent" fontSize={22} />
              </>
            )}

            {ri === 1 && !numMode && <div style={{ flex: 0.5, flexShrink: 0 }} />}
          </div>
        ))}

        {/* Bottom control row */}
        <div style={{ display: 'flex', gap: 5 }}>
          <Key
            label={numMode ? 'ABC' : '123'}
            onPress={() => setNumMode(n => !n)}
            flex={1.4}
            variant="accent"
            fontSize={14}
          />
          {!numMode && (
            <Key
              label="⇧"
              onPress={() => setShifted(s => !s)}
              flex={1}
              variant={shifted ? 'active' : 'accent'}
              fontSize={22}
            />
          )}
          <Key
            label="SPACE"
            onPress={() => onKeyPress?.(' ')}
            flex={4}
            fontSize={13}
          />
          <Key
            label="CLR"
            onPress={() => onKeyPress?.('CLEAR')}
            flex={1}
            variant="danger"
            fontSize={13}
          />
          <Key
            label="DONE"
            onPress={() => setKeyboardVisible(false)}
            flex={1.6}
            variant="accent"
            fontSize={13}
          />
        </div>
      </div>
    </div>
  )
}
