import React, { useState, useEffect } from 'react'
import { Button, Select, Input, Space, Collapse, Badge } from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  FilterOutlined,
  CheckOutlined,
  ClearOutlined
} from '@ant-design/icons'
import type {
  FilterCondition,
  FilterOperator,
  FilterLogic,
  ColumnInfo
} from '../types'

const { Option } = Select

interface FilterBuilderProps {
  columns: ColumnInfo[]
  conditions: FilterCondition[]
  onChange: (conditions: FilterCondition[]) => void
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Equals (=)' },
  { value: '!=', label: 'Not Equals (!=)' },
  { value: '>', label: 'Greater Than (>)' },
  { value: '<', label: 'Less Than (<)' },
  { value: '>=', label: 'Greater or Equal (>=)' },
  { value: '<=', label: 'Less or Equal (<=)' },
  { value: 'LIKE', label: 'Contains (LIKE)' },
  { value: 'NOT LIKE', label: 'Not Contains (NOT LIKE)' },
  { value: 'IN', label: 'In List (IN)' },
  { value: 'NOT IN', label: 'Not In List (NOT IN)' },
  { value: 'IS NULL', label: 'Is Null (IS NULL)' },
  { value: 'IS NOT NULL', label: 'Is Not Null (IS NOT NULL)' }
]

const LOGIC_OPERATORS: { value: FilterLogic; label: string }[] = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' }
]

/**
 * FilterBuilder Component
 *
 * Allows users to build WHERE clause conditions with a form-like interface
 */
export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  columns,
  conditions,
  onChange
}) => {
  // Use local state to avoid triggering refresh on every keystroke
  const [localConditions, setLocalConditions] =
    useState<FilterCondition[]>(conditions)

  // Sync with parent when conditions prop changes (e.g., after applying filter)
  useEffect(() => {
    setLocalConditions(conditions)
  }, [conditions])

  const handleAddCondition = () => {
    const newCondition: FilterCondition = {
      id: `filter_${Date.now()}`,
      field: columns[0]?.column_name || '',
      operator: '=',
      value: '',
      logic: 'AND'
    }
    setLocalConditions([...localConditions, newCondition])
  }

  const handleRemoveCondition = (id: string) => {
    const newConditions = localConditions.filter(c => c.id !== id)
    setLocalConditions(newConditions)
    // Don't immediately apply - let user click "Apply Filter" button
  }

  const handleFieldChange = (id: string, field: string) => {
    setLocalConditions(
      localConditions.map(c => (c.id === id ? { ...c, field } : c))
    )
  }

  const handleOperatorChange = (id: string, operator: FilterOperator) => {
    setLocalConditions(
      localConditions.map(c => (c.id === id ? { ...c, operator } : c))
    )
  }

  const handleValueChange = (id: string, value: string) => {
    setLocalConditions(
      localConditions.map(c => (c.id === id ? { ...c, value } : c))
    )
  }

  const handleLogicChange = (id: string, logic: FilterLogic) => {
    setLocalConditions(
      localConditions.map(c => (c.id === id ? { ...c, logic } : c))
    )
  }

  const handleApplyFilter = () => {
    onChange(localConditions)
  }

  const handleClearFilter = () => {
    setLocalConditions([])
    onChange([])
  }

  const needsValue = (operator: FilterOperator) => {
    return operator !== 'IS NULL' && operator !== 'IS NOT NULL'
  }

  // Check if there are unsaved changes
  const hasChanges =
    JSON.stringify(localConditions) !== JSON.stringify(conditions)

  // Count valid applied conditions
  const appliedValidConditionsCount = conditions.filter(condition => {
    const { operator, value } = condition
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      return true
    }
    return value && value.trim() !== ''
  }).length

  return (
    <Collapse
      defaultActiveKey={localConditions.length > 0 ? ['filter'] : []}
      items={[
        {
          key: 'filter',
          label: (
            <Space>
              <FilterOutlined />
              <span>Filter Conditions</span>
              {appliedValidConditionsCount > 0 && (
                <Badge
                  count={appliedValidConditionsCount}
                  style={{ backgroundColor: '#52c41a' }}
                />
              )}
              {hasChanges && (
                <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
                  (Unsaved Changes)
                </span>
              )}
            </Space>
          ),
          extra: (
            <Space onClick={e => e.stopPropagation()}>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddCondition}
              >
                Add Condition
              </Button>
              {/* Show "Apply Filter" button when there are changes */}
              {hasChanges && (
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleApplyFilter}
                >
                  Apply Filter
                </Button>
              )}
              {/* Show "Clear Filter" button only when there are applied conditions */}
              {conditions.length > 0 && (
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={handleClearFilter}
                >
                  Clear Filter
                </Button>
              )}
            </Space>
          ),
          children: (
            <>
              {localConditions.length === 0 ? (
                <div
                  style={{
                    color: '#999',
                    textAlign: 'center',
                    padding: '16px 0'
                  }}
                >
                  No filter conditions. Click "Add Condition" to start
                  filtering.
                </div>
              ) : (
                <div>
                  {localConditions.map((condition, index) => (
                    <div key={condition.id}>
                      <Space
                        style={{
                          width: '100%',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {/* Field Select */}
                        <Select
                          style={{ width: 150 }}
                          value={condition.field}
                          onChange={value =>
                            handleFieldChange(condition.id, value)
                          }
                          placeholder="Select Field"
                        >
                          {columns.map(col => (
                            <Option
                              key={col.column_name}
                              value={col.column_name}
                            >
                              {col.column_name}
                            </Option>
                          ))}
                        </Select>

                        {/* Operator Select */}
                        <Select
                          style={{ width: 150 }}
                          value={condition.operator}
                          onChange={value =>
                            handleOperatorChange(condition.id, value)
                          }
                        >
                          {OPERATORS.map(op => (
                            <Option key={op.value} value={op.value}>
                              {op.label}
                            </Option>
                          ))}
                        </Select>

                        {/* Value Input */}
                        {needsValue(condition.operator) && (
                          <Input
                            style={{ width: 200 }}
                            value={condition.value}
                            onChange={e =>
                              handleValueChange(condition.id, e.target.value)
                            }
                            placeholder={
                              condition.operator === 'LIKE' ||
                              condition.operator === 'NOT LIKE'
                                ? 'e.g.: %keyword%'
                                : condition.operator === 'IN' ||
                                  condition.operator === 'NOT IN'
                                ? 'e.g.: 1,2,3'
                                : 'Enter value'
                            }
                          />
                        )}

                        {/* Logic Operator (for all except last) */}
                        {index < localConditions.length - 1 && (
                          <Select
                            style={{ width: 80 }}
                            value={condition.logic}
                            onChange={value =>
                              handleLogicChange(condition.id, value)
                            }
                          >
                            {LOGIC_OPERATORS.map(logic => (
                              <Option key={logic.value} value={logic.value}>
                                {logic.label}
                              </Option>
                            ))}
                          </Select>
                        )}

                        {/* Delete Button */}
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveCondition(condition.id)}
                        />
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        }
      ]}
    />
  )
}
