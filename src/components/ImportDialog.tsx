import React, { useState } from 'react'
import {
  Modal,
  Upload,
  Alert,
  Table,
  Space,
  Button,
  message,
  Typography,
  Tag
} from 'antd'
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import type { ColumnInfo } from '../types'
import * as XLSX from 'xlsx'

const { Dragger } = Upload
const { Text } = Typography

interface ImportDialogProps {
  visible: boolean
  tableName: string
  columns: ColumnInfo[]
  onCancel: () => void
  onConfirm: (data: Record<string, any>[]) => Promise<void>
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
  const [confirming, setConfirming] = useState(false)

  const handleCancel = () => {
    setFileList([])
    setParsedData([])
    setFieldMappings([])
    setValidationErrors([])
    onCancel()
  }

  const handleOk = async () => {
    if (validationErrors.length > 0) {
      message.error('Please fix validation errors before importing')
      return
    }

    if (parsedData.length === 0) {
      message.error('No data to import')
      return
    }

    try {
      setConfirming(true)
      await onConfirm(parsedData)
      handleCancel()
    } finally {
      setConfirming(false)
    }
  }

  const isNumericType = (dataType: string): boolean => {
    const upperDataType = dataType.toUpperCase()
    return (
      upperDataType.includes('INT') ||
      upperDataType.includes('NUMERIC') ||
      upperDataType.includes('REAL') ||
      upperDataType.includes('FLOAT') ||
      upperDataType.includes('DOUBLE') ||
      upperDataType.includes('DECIMAL')
    )
  }

  const isBooleanType = (dataType: string): boolean => {
    const upperDataType = dataType.toUpperCase()
    return upperDataType === 'BOOLEAN' || upperDataType === 'BOOL'
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
        col.is_nullable === 'NO' && !col.column_default && !col.is_primary_key // Assuming PK might be auto-increment
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
        errors.push(
          `Excel column "${excelCol}" does not match any table column`
        )
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

    // Validate data types with first 20 rows for better early feedback
    if (data.length > 0) {
      const sampleRows = data.slice(0, 20)
      mappings.forEach(mapping => {
        if (mapping.matched) {
          sampleRows.forEach((row, index) => {
            const sampleValue = row[mapping.excelColumn]
            if (
              sampleValue === null ||
              sampleValue === undefined ||
              sampleValue === ''
            ) {
              return
            }

            if (
              isNumericType(mapping.dataType) &&
              Number.isNaN(Number(sampleValue))
            ) {
              errors.push(
                `Column "${mapping.excelColumn}" expects numeric values, row ${
                  index + 1
                } has "${sampleValue}"`
              )
            }

            if (
              isBooleanType(mapping.dataType) &&
              !['true', 'false', '1', '0'].includes(
                String(sampleValue).trim().toLowerCase()
              )
            ) {
              errors.push(
                `Column "${mapping.excelColumn}" expects boolean values, row ${
                  index + 1
                } has "${sampleValue}"`
              )
            }
          })
        }
      })

      // De-duplicate possible repeated errors for readability
      if (errors.length > 0) {
        const uniqueErrors = Array.from(new Set(errors))
        return { mappings, errors: uniqueErrors }
      }
    }

    return { mappings, errors }
  }

  const handleFileChange: UploadProps['onChange'] = info => {
    let newFileList = [...info.fileList]

    // Only keep the latest file
    newFileList = newFileList.slice(-1)

    setFileList(newFileList)
    setParsedData([])
    setFieldMappings([])
    setValidationErrors([])

    if (info.file.status === 'removed') {
      return
    }

    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj

      if (!file) {
        message.error('Unable to read uploaded file')
        return
      }

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
          const { mappings, errors } = validateFields(
            excelColumns,
            jsonData as Record<string, any>[]
          )

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
                  mappedRow[mapping.tableColumn] = value === '' ? null : value
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
          setParsedData([])
          setFieldMappings([])
          setValidationErrors([])
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

  const handleDownloadTemplate = () => {
    // Auto-increment primary keys are usually omitted during import
    const templateColumns = columns.filter(
      col => !(col.is_primary_key && col.data_type.toLowerCase() === 'integer')
    )

    if (templateColumns.length === 0) {
      message.warning('No available columns to generate import template')
      return
    }

    const getExampleValue = (dataType: string): string => {
      const type = dataType.toLowerCase()
      if (
        type.includes('int') ||
        type.includes('numeric') ||
        type.includes('real') ||
        type.includes('float') ||
        type.includes('double') ||
        type.includes('decimal')
      ) {
        return '123'
      }
      if (type === 'boolean' || type === 'bool') {
        return 'true'
      }
      if (type.includes('date') || type.includes('time')) {
        return '2026-01-01'
      }
      return 'example text'
    }

    const descriptionRow = templateColumns.reduce<Record<string, string>>(
      (acc, col) => {
        const required =
          col.is_nullable === 'NO' && !col.column_default ? 'required' : 'optional'
        acc[col.column_name] = `${col.data_type} | ${required}`
        return acc
      },
      {}
    )
    const exampleRow = templateColumns.reduce<Record<string, string>>(
      (acc, col) => {
        acc[col.column_name] = getExampleValue(col.data_type)
        return acc
      },
      {}
    )
    const templateRow = templateColumns.reduce<Record<string, string>>(
      (acc, col) => {
        acc[col.column_name] = ''
        return acc
      },
      {}
    )

    const worksheet = XLSX.utils.json_to_sheet([
      descriptionRow,
      exampleRow,
      templateRow
    ])
    worksheet['!cols'] = templateColumns.map(col => ({
      wch: Math.max(col.column_name.length, 15)
    }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
    XLSX.writeFile(workbook, `${tableName}_import_template.xlsx`)
    message.success('Import template downloaded (with type and example rows)')
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
      confirmLoading={confirming}
      okButtonProps={{
        disabled:
          confirming || validationErrors.length > 0 || parsedData.length === 0
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            Download Import Template
          </Button>
        </div>

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
            description={`Ready to import ${
              parsedData.length
            } rows. First row: ${JSON.stringify(parsedData[0]).substring(
              0,
              100
            )}...`}
            type="success"
            showIcon
          />
        )}

        {/* Instructions */}
        <div style={{ color: '#666', fontSize: '12px' }}>
          <Text strong>Import Requirements:</Text>
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>
              Excel column names must match table column names
              (case-insensitive)
            </li>
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
