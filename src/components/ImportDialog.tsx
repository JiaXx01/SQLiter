import React, { useState } from 'react'
import {
  Modal,
  Upload,
  Alert,
  Table,
  Space,
  message,
  Typography,
  Tag
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import type { ColumnInfo } from '../types'
import * as XLSX from 'xlsx'

const { Dragger } = Upload
const { Text } = Typography

interface ImportDialogProps {
  visible: boolean
  tableName: string
  columns: ColumnInfo[]
  onCancel: () => void
  onConfirm: (data: Record<string, any>[]) => void
}

interface FieldMapping {
  excelColumn: string
  tableColumn: string
  matched: boolean
  dataType: string
}

/**
 * ImportDialog Component
 * 
 * Allows users to import data from Excel files with:
 * - Strict field validation
 * - Column mapping verification
 * - Data type checking
 * - Preview of data to be imported
 */
export const ImportDialog: React.FC<ImportDialogProps> = ({
  visible,
  tableName,
  columns,
  onCancel,
  onConfirm
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleCancel = () => {
    setFileList([])
    setParsedData([])
    setFieldMappings([])
    setValidationErrors([])
    onCancel()
  }

  const handleOk = () => {
    if (validationErrors.length > 0) {
      message.error('Please fix validation errors before importing')
      return
    }

    if (parsedData.length === 0) {
      message.error('No data to import')
      return
    }

    onConfirm(parsedData)
    handleCancel()
  }

  const validateFields = (
    excelColumns: string[],
    data: Record<string, any>[]
  ): { mappings: FieldMapping[]; errors: string[] } => {
    const errors: string[] = []
    const mappings: FieldMapping[] = []

    // Get required table columns (non-nullable, no default, not auto-increment)
    const requiredColumns = columns.filter(
      col =>
        col.is_nullable === 'NO' &&
        !col.column_default &&
        !col.is_primary_key // Assuming PK might be auto-increment
    )

    // Check each Excel column
    excelColumns.forEach(excelCol => {
      const tableCol = columns.find(
        col => col.column_name.toLowerCase() === excelCol.toLowerCase()
      )

      if (tableCol) {
        mappings.push({
          excelColumn: excelCol,
          tableColumn: tableCol.column_name,
          matched: true,
          dataType: tableCol.data_type
        })
      } else {
        mappings.push({
          excelColumn: excelCol,
          tableColumn: '',
          matched: false,
          dataType: ''
        })
        errors.push(`Excel column "${excelCol}" does not match any table column`)
      }
    })

    // Check for missing required columns
    requiredColumns.forEach(col => {
      const found = excelColumns.some(
        excelCol => excelCol.toLowerCase() === col.column_name.toLowerCase()
      )
      if (!found) {
        errors.push(
          `Required table column "${col.column_name}" is missing in Excel file`
        )
      }
    })

    // Check for extra table columns that are not in Excel (warnings only)
    const optionalMissingColumns = columns.filter(col => {
      const isInExcel = excelColumns.some(
        excelCol => excelCol.toLowerCase() === col.column_name.toLowerCase()
      )
      const isRequired = requiredColumns.some(
        reqCol => reqCol.column_name === col.column_name
      )
      return !isInExcel && !isRequired
    })

    if (optionalMissingColumns.length > 0) {
      // This is just a warning, not an error
      console.log(
        'Optional columns missing in Excel:',
        optionalMissingColumns.map(c => c.column_name)
      )
    }

    // Validate data types (basic validation)
    if (data.length > 0) {
      mappings.forEach(mapping => {
        if (mapping.matched) {
          const sampleValue = data[0][mapping.excelColumn]
          const dataType = mapping.dataType.toUpperCase()

          // Basic type checking
          if (
            sampleValue !== null &&
            sampleValue !== undefined &&
            sampleValue !== ''
          ) {
            if (
              (dataType.includes('INT') || dataType.includes('NUMERIC')) &&
              isNaN(Number(sampleValue))
            ) {
              errors.push(
                `Column "${mapping.excelColumn}" expects numeric values but contains non-numeric data`
              )
            }
          }
        }
      })
    }

    return { mappings, errors }
  }

  const handleFileChange = (info: any) => {
    let newFileList = [...info.fileList]

    // Only keep the latest file
    newFileList = newFileList.slice(-1)

    setFileList(newFileList)

    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj || info.file

      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          // Get first sheet
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            raw: false, // Keep values as strings for better validation
            defval: null // Use null for empty cells
          })

          if (jsonData.length === 0) {
            message.error('Excel file is empty')
            return
          }

          // Get Excel columns from first row
          const excelColumns = Object.keys(jsonData[0] as Record<string, any>)

          // Validate fields
          const { mappings, errors } = validateFields(excelColumns, jsonData)

          setFieldMappings(mappings)
          setValidationErrors(errors)

          if (errors.length === 0) {
            // Map Excel column names to table column names
            const mappedData = jsonData.map(row => {
              const mappedRow: Record<string, any> = {}
              mappings.forEach(mapping => {
                if (mapping.matched) {
                  const value = (row as Record<string, any>)[
                    mapping.excelColumn
                  ]
                  // Convert empty strings to null
                  mappedRow[mapping.tableColumn] =
                    value === '' ? null : value
                }
              })
              return mappedRow
            })

            setParsedData(mappedData)
            message.success(
              `Successfully parsed ${jsonData.length} rows from Excel file`
            )
          } else {
            setParsedData([])
            message.error('Field validation failed')
          }
        } catch (error) {
          message.error(
            `Failed to parse Excel file: ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      }

      reader.readAsBinaryString(file)
    }
  }

  const mappingColumns = [
    {
      title: 'Excel Column',
      dataIndex: 'excelColumn',
      key: 'excelColumn'
    },
    {
      title: 'Table Column',
      dataIndex: 'tableColumn',
      key: 'tableColumn',
      render: (text: string, record: FieldMapping) => (
        <Space>
          {record.matched ? (
            <>
              <Text>{text}</Text>
              <Tag color="green">Matched</Tag>
            </>
          ) : (
            <Tag color="red">Not Found</Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Data Type',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (text: string) => (text ? <Tag>{text}</Tag> : '-')
    }
  ]

  return (
    <Modal
      title={`Import Data to Table: ${tableName}`}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={900}
      okText="Import"
      cancelText="Cancel"
      okButtonProps={{
        disabled: validationErrors.length > 0 || parsedData.length === 0
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* File Upload */}
        <Dragger
          fileList={fileList}
          onChange={handleFileChange}
          beforeUpload={() => false} // Prevent auto upload
          accept=".xlsx,.xls"
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag Excel file to this area to upload
          </p>
          <p className="ant-upload-hint">
            Support for .xlsx and .xls files. Only the first sheet will be
            imported.
          </p>
        </Dragger>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert
            message="Validation Errors"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
          />
        )}

        {/* Field Mappings */}
        {fieldMappings.length > 0 && (
          <div>
            <Text strong style={{ marginBottom: 8, display: 'block' }}>
              Field Mapping:
            </Text>
            <Table
              columns={mappingColumns}
              dataSource={fieldMappings}
              rowKey="excelColumn"
              size="small"
              pagination={false}
            />
          </div>
        )}

        {/* Data Preview */}
        {parsedData.length > 0 && validationErrors.length === 0 && (
          <Alert
            message="Data Preview"
            description={`Ready to import ${parsedData.length} rows. First row: ${JSON.stringify(
              parsedData[0]
            ).substring(0, 100)}...`}
            type="success"
            showIcon
          />
        )}

        {/* Instructions */}
        <div style={{ color: '#666', fontSize: '12px' }}>
          <Text strong>Import Requirements:</Text>
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>Excel column names must match table column names (case-insensitive)</li>
            <li>All required (non-nullable) columns must be present</li>
            <li>Data types should match table column types</li>
            <li>Empty cells will be imported as NULL values</li>
            <li>Primary key columns can be omitted if auto-increment</li>
          </ul>
        </div>
      </Space>
    </Modal>
  )
}

