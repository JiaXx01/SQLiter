import React, { useRef } from 'react'
import { Button, Tabs, Alert, Spin, Space } from 'antd'
import { PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useTabStore } from '../stores/useTabStore'
import { useSchemaStore } from '../stores/useSchemaStore'
import { ResizableBox } from './ResizableBox'
import { ResultsGrid } from './ResultsGrid'
import type { SqlEditorTab } from '../types'

interface SqlEditorPanelProps {
  tabKey: string
}

/**
 * SqlEditorPanel Component
 *
 * SQL editor with Monaco editor, execution, and results display
 */
export const SqlEditorPanel: React.FC<SqlEditorPanelProps> = ({ tabKey }) => {
  const tab = useTabStore(state =>
    state.tabs.find(t => t.key === tabKey && t.type === 'sql_editor')
  ) as SqlEditorTab | undefined

  const updateSqlTabState = useTabStore(state => state.updateSqlTabState)
  const executeSqlForTab = useTabStore(state => state.executeSqlForTab)
  const schemaMap = useSchemaStore(state => state.schemaMap)

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  if (!tab) {
    return <div>Tab not found</div>
  }

  /**
   * Handle editor mount - setup autocomplete
   */
  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: any
  ) => {
    editorRef.current = editor

    // Register SQL autocomplete provider
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const suggestions: any[] = []

        // Get the text before the cursor to provide context-aware suggestions
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        })

        // Check if we're after a table name (for column suggestions)
        const tableMatch = textUntilPosition.match(/(\w+)\.\s*$/i)

        if (tableMatch) {
          // User typed "tableName." - show only columns for that table
          const tableName = tableMatch[1]
          const columns = schemaMap.get(tableName)

          if (columns) {
            columns.forEach(columnName => {
              suggestions.push({
                label: columnName,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: columnName,
                detail: `Column in ${tableName}`,
                documentation: `${tableName}.${columnName}`
              })
            })
          }
        } else {
          // General suggestions: tables, columns with table prefix, and keywords

          // Add table names
          schemaMap.forEach((columns, tableName) => {
            suggestions.push({
              label: tableName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: tableName,
              detail: 'Table',
              documentation: `Table: ${tableName} (${columns.length} columns)`,
              sortText: `1_${tableName}` // Prioritize tables
            })

            // Add columns with table prefix
            columns.forEach(columnName => {
              suggestions.push({
                label: `${tableName}.${columnName}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `${tableName}.${columnName}`,
                detail: `Column in ${tableName}`,
                filterText: `${tableName}.${columnName} ${columnName}`, // Allow searching by column name only
                sortText: `2_${tableName}_${columnName}`
              })
            })
          })

          // Add SQL keywords
          const keywords = [
            'SELECT',
            'FROM',
            'WHERE',
            'INSERT INTO',
            'UPDATE',
            'DELETE FROM',
            'JOIN',
            'LEFT JOIN',
            'RIGHT JOIN',
            'INNER JOIN',
            'OUTER JOIN',
            'ON',
            'AND',
            'OR',
            'NOT',
            'IN',
            'LIKE',
            'BETWEEN',
            'ORDER BY',
            'GROUP BY',
            'HAVING',
            'LIMIT',
            'OFFSET',
            'CREATE TABLE',
            'ALTER TABLE',
            'DROP TABLE',
            'INDEX',
            'VIEW',
            'AS',
            'DISTINCT',
            'COUNT',
            'SUM',
            'AVG',
            'MAX',
            'MIN',
            'NULL',
            'IS NULL',
            'IS NOT NULL',
            'ASC',
            'DESC',
            'UNION',
            'UNION ALL',
            'INTERSECT',
            'EXCEPT'
          ]

          keywords.forEach(keyword => {
            suggestions.push({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              detail: 'SQL Keyword',
              sortText: `3_${keyword}` // Lower priority than tables/columns
            })
          })
        }

        return { suggestions }
      },
      triggerCharacters: ['.', ' '] // Trigger autocomplete on dot and space
    })

    // Setup keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeSqlForTab(tabKey)
    })
  }

  /**
   * Handle SQL text change
   */
  const handleEditorChange = (value: string | undefined) => {
    updateSqlTabState(tabKey, { sql: value || '' })
  }

  /**
   * Execute SQL
   */
  const handleExecute = () => {
    executeSqlForTab(tabKey)
  }

  /**
   * Render results tabs
   */
  const renderResults = () => {
    if (tab.results.length === 0) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999'
          }}
        >
          No results yet. Write a query and click Execute.
        </div>
      )
    }

    if (tab.results.length === 1) {
      const result = tab.results[0]

      if (result.error) {
        return (
          <Alert
            message="SQL Error"
            description={result.error}
            type="error"
            showIcon
            style={{ margin: '16px' }}
          />
        )
      }

      if (result.rows) {
        return <ResultsGrid data={result.rows} />
      }

      return (
        <Alert
          message="Query Executed Successfully"
          description={`Affected rows: ${result.rowCount}`}
          type="success"
          showIcon
          style={{ margin: '16px' }}
        />
      )
    }

    // Multiple results
    const resultItems = tab.results.map((result, index) => {
      let content

      if (result.error) {
        content = (
          <Alert
            message="SQL Error"
            description={result.error}
            type="error"
            showIcon
            style={{ margin: '16px' }}
          />
        )
      } else if (result.rows) {
        content = <ResultsGrid data={result.rows} />
      } else {
        content = (
          <Alert
            message="Query Executed Successfully"
            description={`Affected rows: ${result.rowCount}`}
            type="success"
            showIcon
            style={{ margin: '16px' }}
          />
        )
      }

      return {
        key: `result-${index}`,
        label: result.error
          ? `❌ Result ${index + 1}`
          : `✓ Result ${index + 1}`,
        children: content
      }
    })

    return <Tabs items={resultItems} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa'
        }}
      >
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={tab.isLoading}
          >
            Execute
          </Button>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleExecute}
            loading={tab.isLoading}
            title="Execute (Ctrl/Cmd + Enter)"
          >
            Run (⌘↵)
          </Button>
        </Space>
      </div>

      {/* Editor and Results */}
      <ResizableBox
        topContent={
          <div style={{ height: '100%', position: 'relative' }}>
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={tab.sql}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true
              }}
            />
          </div>
        }
        bottomContent={
          <Spin spinning={tab.isLoading}>
            <div style={{ height: '100%', overflowY: 'auto' }}>
              {renderResults()}
            </div>
          </Spin>
        }
        initialHeight={50} // 50% split
      />
    </div>
  )
}
