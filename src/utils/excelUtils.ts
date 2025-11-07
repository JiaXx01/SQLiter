import * as XLSX from 'xlsx'
import type { ColumnInfo } from '../types'

/**
 * Excel Utility Functions
 * 
 * Provides functions for exporting data to Excel and importing data from Excel
 */

/**
 * Export data to Excel file
 * 
 * @param data - Array of data objects to export
 * @param columns - Column information for formatting
 * @param fileName - Name of the file to download
 */
export function exportToExcel(
  data: Record<string, any>[],
  columns: ColumnInfo[],
  fileName: string
): void {
  if (data.length === 0) {
    throw new Error('No data to export')
  }

  // Remove internal __rowid__ field from export
  const cleanData = data.map(row => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __rowid__, ...rest } = row
    return rest
  })

  // Create worksheet from data
  const worksheet = XLSX.utils.json_to_sheet(cleanData)

  // Set column widths based on content
  const columnWidths = columns.map(col => ({
    wch: Math.max(
      col.column_name.length,
      15 // Minimum width
    )
  }))
  worksheet['!cols'] = columnWidths

  // Create workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')

  // Generate Excel file and trigger download
  XLSX.writeFile(workbook, fileName)
}

/**
 * Read Excel file and parse to JSON
 * 
 * @param file - File object from input
 * @returns Promise that resolves to array of data objects
 */
export function readExcelFile(
  file: File
): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
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

        resolve(jsonData as Record<string, any>[])
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsBinaryString(file)
  })
}

/**
 * Validate Excel data against table columns
 * 
 * @param excelData - Parsed Excel data
 * @param tableColumns - Table column definitions
 * @returns Validation result with errors if any
 */
export function validateExcelData(
  excelData: Record<string, any>[],
  tableColumns: ColumnInfo[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (excelData.length === 0) {
    errors.push('Excel file is empty')
    return { valid: false, errors }
  }

  // Get Excel columns from first row
  const excelColumns = Object.keys(excelData[0])

  // Get required table columns (non-nullable, no default)
  const requiredColumns = tableColumns.filter(
    col =>
      col.is_nullable === 'NO' &&
      !col.column_default &&
      !col.is_primary_key // Assuming PK might be auto-increment
  )

  // Check for missing required columns
  requiredColumns.forEach(col => {
    const found = excelColumns.some(
      excelCol => excelCol.toLowerCase() === col.column_name.toLowerCase()
    )
    if (!found) {
      errors.push(
        `Required column "${col.column_name}" is missing in Excel file`
      )
    }
  })

  // Check for unknown columns
  excelColumns.forEach(excelCol => {
    const found = tableColumns.some(
      col => col.column_name.toLowerCase() === excelCol.toLowerCase()
    )
    if (!found) {
      errors.push(`Excel column "${excelCol}" does not match any table column`)
    }
  })

  // Validate data types (basic validation)
  excelColumns.forEach(excelCol => {
    const tableCol = tableColumns.find(
      col => col.column_name.toLowerCase() === excelCol.toLowerCase()
    )

    if (tableCol) {
      const dataType = tableCol.data_type.toUpperCase()

      // Check first few rows for type consistency
      for (let i = 0; i < Math.min(5, excelData.length); i++) {
        const value = excelData[i][excelCol]

        if (value !== null && value !== undefined && value !== '') {
          // Check numeric types
          if (
            (dataType.includes('INT') ||
              dataType.includes('NUMERIC') ||
              dataType.includes('REAL') ||
              dataType.includes('FLOAT') ||
              dataType.includes('DOUBLE')) &&
            isNaN(Number(value))
          ) {
            errors.push(
              `Column "${excelCol}" expects numeric values but row ${
                i + 1
              } contains non-numeric data: "${value}"`
            )
            break
          }
        }
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Map Excel column names to table column names (case-insensitive)
 * 
 * @param excelData - Parsed Excel data
 * @param tableColumns - Table column definitions
 * @returns Mapped data with correct column names
 */
export function mapExcelColumnsToTable(
  excelData: Record<string, any>[],
  tableColumns: ColumnInfo[]
): Record<string, any>[] {
  return excelData.map(row => {
    const mappedRow: Record<string, any> = {}

    Object.keys(row).forEach(excelCol => {
      const tableCol = tableColumns.find(
        col => col.column_name.toLowerCase() === excelCol.toLowerCase()
      )

      if (tableCol) {
        const value = row[excelCol]
        // Convert empty strings to null
        mappedRow[tableCol.column_name] = value === '' ? null : value
      }
    })

    return mappedRow
  })
}

