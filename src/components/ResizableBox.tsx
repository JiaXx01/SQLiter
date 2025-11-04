import React, { useState, useRef, useEffect } from 'react'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'

interface ResizableBoxProps {
  topContent: React.ReactNode
  bottomContent: React.ReactNode
  initialHeight?: number // percentage (0-100)
}

/**
 * ResizableBox Component
 *
 * Simple vertical split panel with draggable divider
 * Implemented using react-resizable library
 */
export const ResizableBox: React.FC<ResizableBoxProps> = ({
  topContent,
  bottomContent,
  initialHeight = 50
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [topHeight, setTopHeight] = useState(0)

  // Initialize heights on mount and window resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight
        setContainerHeight(height)
        setTopHeight((height * initialHeight) / 100)
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [initialHeight])

  const onResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setTopHeight(data.size.height)
  }

  const minConstraint = containerHeight * 0.1 // 10%
  const maxConstraint = containerHeight * 0.9 // 90%

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {containerHeight > 0 && (
        <>
          <Resizable
            width={0}
            height={topHeight}
            minConstraints={[0, minConstraint]}
            maxConstraints={[Infinity, maxConstraint]}
            onResize={onResize}
            axis="y"
            resizeHandles={['s']}
            handle={
              <div
                style={{
                  height: '8px',
                  backgroundColor: '#f0f0f0',
                  cursor: 'row-resize',
                  borderTop: '1px solid #d9d9d9',
                  borderBottom: '1px solid #d9d9d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 10
                }}
                className="custom-handle custom-handle-s"
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
            }
          >
            <div style={{ height: `${topHeight}px`, overflow: 'hidden' }}>
              {topContent}
            </div>
          </Resizable>

          {/* Bottom Panel */}
          <div
            style={{
              height: `${containerHeight - topHeight}px`,
              overflow: 'hidden'
            }}
          >
            {bottomContent}
          </div>
        </>
      )}
    </div>
  )
}
