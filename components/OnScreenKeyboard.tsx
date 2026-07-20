'use client'

import { useState, useCallback } from 'react'
import { useJukeboxStore } from '@/lib/store'

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
  label, onPress, flex = 1, variant = 'default', fontSize = 18, accentRGB,
}: {
  label: string
  onPress: () => void
  flex?: number
  variant?: Variant
  fontSize?: number
  accentRGB: string
}) {
  const [pressed, setPressed] = useState(false)

  const bg: Record<Variant, string> = {
    default: `rgba(${accentRGB},0.07)`,
    accent:  `rgba(${accentRGB},0.15)`,
    active:  `rgba(${accentRGB},0.28)`,
    danger:  'rgba(255,80,80,0.1)',
  }
  const bgPressed: Record<Variant, string> = {
    default: `rgba(${accentRGB},0.45)`,
    accent:  `rgba(${accentRGB},0.55)`,
    active:  `rgba(${accentRGB},0.65)`,
    danger:  'rgba(255,80,80,0.45)',
  }
  const border: Record<Variant, string> = {
    default: `rgba(${accentRGB},0.22)`,
    accent:  `rgba(${accentRGB},0.35)`,
    active:  `rgba(${accentRGB},0.6)`,
    danger:  'rgba(255,80,80,0.3)',
  }
  const color = variant === 'danger' ? 'rgba(255,120,120,0.85)' : `rgba(${accentRGB},0.9)`
  const shadow = (variant === 'active' || pressed) ? `0 0 10px rgba(${accentRGB},0.35)` : 'none'

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
  const { keyboardVisible, setKeyboardVisible, onKeyPress, uiTheme } = useJukeboxStore()
  const [numMode, setNumMode] = useState(false)
  const [shifted, setShifted] = useState(false)

  if (!keyboardVisible) return null

  const isModern = uiTheme === 'modern'
  // Modern uses pink instead of the Standard theme's gold
  const accentRGB = isModern ? '255,45,120' : '201,162,39'

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
      background: isModern ? 'rgba(8,6,10,0.98)' : 'rgba(10,5,0,0.98)',
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
                accentRGB={accentRGB}
              />
            ))}

            {/* Backspace on last row */}
            {ri === rows.length - 1 && (
              <>
                <div style={{ width: 6, flexShrink: 0 }} />
                <Key label="⌫" onPress={() => onKeyPress?.('BACKSPACE')} flex={1.6} variant="accent" fontSize={22} accentRGB={accentRGB} />
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
            accentRGB={accentRGB}
          />
          {!numMode && (
            <Key
              label="⇧"
              onPress={() => setShifted(s => !s)}
              flex={1}
              variant={shifted ? 'active' : 'accent'}
              fontSize={22}
              accentRGB={accentRGB}
            />
          )}
          <Key
            label="SPACE"
            onPress={() => onKeyPress?.(' ')}
            flex={4}
            fontSize={13}
            accentRGB={accentRGB}
          />
          <Key
            label="CLR"
            onPress={() => onKeyPress?.('CLEAR')}
            flex={1}
            variant="danger"
            fontSize={13}
            accentRGB={accentRGB}
          />
          <Key
            label="DONE"
            onPress={() => setKeyboardVisible(false)}
            flex={1.6}
            variant="accent"
            fontSize={13}
            accentRGB={accentRGB}
          />
        </div>
      </div>
    </div>
  )
}
