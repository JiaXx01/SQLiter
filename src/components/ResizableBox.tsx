import React, { useState } from 'react'

interface ResizableBoxProps {
  topContent: React.ReactNode
  bottomContent: React.ReactNode
  initialHeight?: number // percentage (0-100)
}

/**
 * ResizableBox Component
 *
 * Simple vertical split panel with draggable divider
 */
export const ResizableBox: React.FC<ResizableBoxProps> = ({
  topContent,
  bottomContent,
  initialHeight = 50
}) => {
  const [topHeight, setTopHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const container = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const newHeight = ((e.clientY - container.top) / container.height) * 100

    // Clamp between 10% and 90%
    const clampedHeight = Math.min(Math.max(newHeight, 10), 90)
    setTopHeight(clampedHeight)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Panel */}
      <div style={{ height: `${topHeight}%`, overflow: 'hidden' }}>
        {topContent}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: '8px',
          backgroundColor: '#f0f0f0',
          cursor: 'row-resize',
          borderTop: '1px solid #d9d9d9',
          borderBottom: '1px solid #d9d9d9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '3px',
            backgroundColor: '#bfbfbf',
            borderRadius: '2px'
          }}
        />
      </div>

      {/* Bottom Panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>{bottomContent}</div>
    </div>
  )
}
