import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Select, message } from 'antd'
import type { ColumnInfo } from '../types'

interface AddRowDialogProps {
  visible: boolean
  columns: ColumnInfo[]
  primaryKey: string
  onCancel: () => void
  onConfirm: (rowData: Record<string, any>) => Promise<void>
}

export const AddRowDialog: React.FC<AddRowDialogProps> = ({
  visible,
  columns,
  primaryKey,
  onCancel,
  onConfirm
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // Reset form when dialog opens
  useEffect(() => {
    if (visible) {
      form.resetFields()
      // Set default values for columns
      const initialValues: Record<string, any> = {}
      columns.forEach(col => {
        if (col.column_default !== null && col.column_default !== undefined) {
          // Parse default value
          let defaultValue = col.column_default
          // Remove quotes if present
          if (
            typeof defaultValue === 'string' &&
            defaultValue.startsWith("'") &&
            defaultValue.endsWith("'")
          ) {
            defaultValue = defaultValue.slice(1, -1)
          }
          initialValues[col.column_name] = defaultValue
        } else if (col.is_nullable === 'YES') {
          initialValues[col.column_name] = null
        }
      })
      form.setFieldsValue(initialValues)
    }
  }, [visible, columns, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // Process values: convert empty strings to null for nullable fields
      const processedValues: Record<string, any> = {}
      columns.forEach(col => {
        const value = values[col.column_name]

        // Handle null/undefined
        if (value === undefined || value === null || value === '') {
          if (col.is_nullable === 'YES') {
            processedValues[col.column_name] = null
          } else if (
            col.column_default !== null &&
            col.column_default !== undefined
          ) {
            // Use default value
            processedValues[col.column_name] = col.column_default
          } else {
            // Required field without default
            processedValues[col.column_name] = value
          }
        } else {
          processedValues[col.column_name] = value
        }
      })

      setLoading(true)
      await onConfirm(processedValues)
      form.resetFields()
      setLoading(false)
    } catch (error) {
      setLoading(false)
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  // Determine input type based on column data type
  const getInputComponent = (col: ColumnInfo) => {
    const dataType = col.data_type.toLowerCase()

    // Boolean types
    if (dataType === 'boolean' || dataType === 'bool') {
      return (
        <Select placeholder="Select value">
          <Select.Option value={true}>TRUE</Select.Option>
          <Select.Option value={false}>FALSE</Select.Option>
          {col.is_nullable === 'YES' && (
            <Select.Option value={null}>NULL</Select.Option>
          )}
        </Select>
      )
    }

    // Numeric types
    if (
      dataType.includes('int') ||
      dataType === 'real' ||
      dataType === 'numeric' ||
      dataType === 'decimal' ||
      dataType === 'double' ||
      dataType === 'float'
    ) {
      return (
        <InputNumber
          style={{ width: '100%' }}
          placeholder={`Enter ${col.column_name}`}
        />
      )
    }

    // Text types - use textarea for TEXT/BLOB
    if (dataType === 'text' || dataType === 'blob') {
      return (
        <Input.TextArea rows={1} placeholder={`Enter ${col.column_name}`} />
      )
    }

    // Default to text input
    return <Input placeholder={`Enter ${col.column_name}`} />
  }

  // Get validation rules for a column
  const getValidationRules = (col: ColumnInfo) => {
    const rules: any[] = []

    // Check if field is required
    const hasDefault =
      col.column_default !== null && col.column_default !== undefined
    const isAutoIncrement =
      col.is_primary_key && col.data_type.toLowerCase() === 'integer'

    if (col.is_nullable === 'NO' && !hasDefault && !isAutoIncrement) {
      rules.push({
        required: true,
        message: `${col.column_name} is required`
      })
    }

    return rules
  }

  return (
    <Modal
      title="Add New Row"
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
      okText="Add Row"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {columns.map(col => {
          // Skip auto-increment primary keys
          const isAutoIncrement =
            col.is_primary_key &&
            col.data_type.toLowerCase() === 'integer' &&
            col.column_name === primaryKey

          if (isAutoIncrement) {
            return null
          }

          const hasDefault =
            col.column_default !== null && col.column_default !== undefined

          return (
            <Form.Item
              key={col.column_name}
              name={col.column_name}
              label={
                <span>
                  {col.column_name}
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                    {col.data_type}
                    {col.is_primary_key && ' (PK)'}
                    {col.is_nullable === 'NO' && !hasDefault && ' *'}
                    {hasDefault && ` (default: ${col.column_default})`}
                  </span>
                </span>
              }
              rules={getValidationRules(col)}
            >
              {getInputComponent(col)}
            </Form.Item>
          )
        })}
      </Form>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: '#f5f5f5',
          borderRadius: 4
        }}
      >
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>• Fields marked with * are required</div>
          <div>• Auto-increment fields will be generated automatically</div>
          <div>• Leave optional fields empty to use default values or NULL</div>
        </div>
      </div>
    </Modal>
  )
}
