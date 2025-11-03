import React from 'react'
import { Tabs } from 'antd'
import { useTabStore } from '../stores/useTabStore'
import { SqlEditorPanel } from './SqlEditorPanel'
import { TableViewPanel } from './TableViewPanel'
import { TableStructurePanel } from './TableStructurePanel'
import type { Tab } from '../types'

/**
 * Workspace Component
 *
 * Manages all open tabs (SQL editors, table views, structure views)
 */
export const Workspace: React.FC = () => {
  const { tabs, activeKey, setActiveKey, removeTab } = useTabStore()

  /**
   * Render tab content based on tab type
   */
  const renderTabContent = (tab: Tab) => {
    switch (tab.type) {
      case 'sql_editor':
        return <SqlEditorPanel tabKey={tab.key} />
      case 'table_view':
        return <TableViewPanel tabKey={tab.key} />
      case 'table_structure':
        return <TableStructurePanel tabKey={tab.key} />
      default:
        return <div>Unknown tab type</div>
    }
  }

  /**
   * Handle tab edit (close)
   */
  const onEdit = (targetKey: any, action: 'add' | 'remove') => {
    if (action === 'remove') {
      removeTab(targetKey as string)
    }
  }

  const tabItems = tabs.map(tab => ({
    key: tab.key,
    label: tab.title,
    children: renderTabContent(tab),
    closable: true
  }))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {tabs.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999',
            fontSize: '16px'
          }}
        >
          No tabs open. Select a table from the Schema Explorer or create a new
          query.
        </div>
      ) : (
        <Tabs
          type="editable-card"
          activeKey={activeKey || undefined}
          onChange={setActiveKey}
          onEdit={onEdit}
          items={tabItems}
          hideAdd
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          className="workspace-tabs"
        />
      )}
    </div>
  )
}
