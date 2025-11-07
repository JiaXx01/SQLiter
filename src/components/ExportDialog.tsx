import React, { useState } from 'react'
import { Modal, Form, InputNumber, Select, Space, message } from 'antd'
import type { FilterCondition, ColumnInfo } from '../types'
import { FilterBuilder } from './FilterBuilder'

interface ExportDialogProps {
  visible: boolean
  tableName: string
  columns: ColumnInfo[]
  currentFilters: FilterCondition[]
  onCancel: () => void
  onConfirm: (options: ExportOptions) => void
}

export interface ExportOptions {
  filters: FilterCondition[]
  limit: number | null
  format: 'xlsx'
}

/**
 * ExportDialog Component
 * 
 * Allows users to configure export options:
 * - Apply filters to export only matching data
 * - Set a limit on the number of rows to export
 * - Choose export format (currently only XLSX)
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  visible,
  tableName,
  columns,
  currentFilters,
  onCancel,
  onConfirm
}) => {
  const [form] = Form.useForm()
  const [filters, setFilters] = useState<FilterCondition[]>(currentFilters)

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      
      const options: ExportOptions = {
        filters: filters,
        limit: values.limit || null,
        format: values.format || 'xlsx'
      }

      onConfirm(options)
    } catch {
      message.error('Please check the form fields')
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setFilters(currentFilters)
    onCancel()
  }

  const handleFilterChange = (newFilters: FilterCondition[]) => {
    setFilters(newFilters)
  }

  return (
    <Modal
      title={`Export Table: ${tableName}`}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={800}
      okText="Export"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          format: 'xlsx',
          limit: null
        }}
      >
        <Form.Item
          label="Export Format"
          name="format"
          rules={[{ required: true, message: 'Please select export format' }]}
        >
          <Select>
            <Select.Option value="xlsx">Excel (.xlsx)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Row Limit"
          name="limit"
          help="Leave empty to export all rows (within filter)"
        >
          <InputNumber
            min={1}
            placeholder="No limit"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="Filter Conditions">
          <FilterBuilder
            columns={columns}
            conditions={filters}
            onChange={handleFilterChange}
          />
        </Form.Item>

        <div style={{ marginTop: 16, color: '#666', fontSize: '12px' }}>
          <Space direction="vertical" size={4}>
            <div>• Filters will be applied to determine which rows to export</div>
            <div>• Row limit will be applied after filtering</div>
            <div>• All visible columns will be included in the export</div>
          </Space>
        </div>
      </Form>
    </Modal>
  )
}

