import React, { useEffect, useRef } from 'react'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import type { ContextMenuAction } from '../types'

interface ContextMenuProps {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

/**
 * ContextMenu Component
 *
 * Custom context menu that appears on right-click
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  actions,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const menuItems: MenuProps['items'] = actions.map(action => ({
    key: action.key,
    label: action.label,
    icon: action.icon,
    danger: action.danger,
    onClick: () => {
      action.onClick()
      onClose()
    }
  }))

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 10000,
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        borderRadius: '4px'
      }}
    >
      <Menu items={menuItems} style={{ border: 'none' }} />
    </div>
  )
}
