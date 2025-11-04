import React from 'react'
import { Layout } from 'antd'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'

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
 * Implemented using react-resizable library
 */
export const ResizableSider: React.FC<ResizableSiderProps> = ({
  children,
  minWidth = 200,
  maxWidth = 600,
  defaultWidth = 280,
  theme = 'light',
  style = {}
}) => {
  const [width, setWidth] = React.useState(defaultWidth)

  const onResize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
    setWidth(data.size.width)
  }

  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[minWidth, 0]}
      maxConstraints={[maxWidth, Infinity]}
      onResize={onResize}
      axis="x"
      resizeHandles={['e']}
      handle={
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '2px',
            cursor: 'col-resize',
            backgroundColor: 'transparent',
            zIndex: 10,
            transition: 'background-color 0.2s'
          }}
          className="custom-handle custom-handle-e"
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#1890ff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        />
      }
    >
      <div style={{ width: `${width}px`, position: 'relative' }}>
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
      </div>
    </Resizable>
  )
}
