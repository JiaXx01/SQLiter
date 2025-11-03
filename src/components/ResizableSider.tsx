import React, { useState, useRef, useEffect } from 'react'
import { Layout } from 'antd'

const { Sider } = Layout

interface ResizableSiderProps {
  children: React.ReactNode
  minWidth?: number
  maxWidth?: number
  defaultWidth?: number
  theme?: 'light' | 'dark'
  style?: React.CSSProperties
}

/**
 * ResizableSider Component
 *
 * A resizable sidebar that allows users to drag the right edge to adjust width
 */
export const ResizableSider: React.FC<ResizableSiderProps> = ({
  children,
  minWidth = 200,
  maxWidth = 600,
  defaultWidth = 280,
  theme = 'light',
  style = {}
}) => {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const siderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
      setWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  return (
    <div
      ref={siderRef}
      style={{
        position: 'relative',
        width: `${width}px`,
        flexShrink: 0
      }}
    >
      <Sider
        width={width}
        theme={theme}
        style={{
          ...style,
          width: '100%',
          maxWidth: 'none',
          minWidth: 'none',
          flex: 'none'
        }}
      >
        {children}
      </Sider>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: 'transparent',
          zIndex: 10,
          transition: isResizing ? 'none' : 'background-color 0.2s'
        }}
        onMouseEnter={e => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = '#1890ff'
          }
        }}
        onMouseLeave={e => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {/* Visual indicator when resizing */}
        {isResizing && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '4px',
              backgroundColor: '#1890ff'
            }}
          />
        )}
      </div>
    </div>
  )
}
