import type { ApiResult, ExecuteRequest, ExecuteResponse } from '../types'

/**
 * API Service
 *
 * This connects to the backend API endpoint: POST https://erp.kutongda.com/_DB_GUI/api/execute
 * The backend executes SQL statements and returns the results directly.
 */

// API Configuration
const API_EXECUTE_ENDPOINT = `/_sqlite_gui/api/execute`

/**
 * Main API execute function
 * Sends SQL to backend and receives execution results
 */
export async function executeSQL(
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const { sql } = request

  // Validate SQL input
  if (!sql || !sql.trim()) {
    return [
      {
        rows: null,
        rowCount: 0,
        error: 'No SQL statement provided'
      }
    ]
  }

  try {
    // Make POST request to backend
    const response = await fetch(API_EXECUTE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    })

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text()
      return [
        {
          rows: null,
          rowCount: 0,
          error: `HTTP Error ${response.status}: ${
            errorText || response.statusText
          }`
        }
      ]
    }

    // Parse response as JSON
    const data = await response.json()

    // Handle different response formats from backend

    // Case 1: Backend returns array of ApiResult objects (with rows, rowCount, error)
    // Format: [{ rows: [...], rowCount: number, error: null }]
    if (Array.isArray(data) && data.length > 0 && 'rows' in data[0]) {
      return data as ExecuteResponse
    }

    // Case 2: Backend returns data rows directly as an array
    // Format: [{ table_name: "xxx" }, { table_name: "yyy" }]
    if (Array.isArray(data)) {
      return [
        {
          rows: data,
          rowCount: data.length,
          error: null
        }
      ]
    }

    // Case 3: Backend returns a single ApiResult object
    // Format: { rows: [...], rowCount: number, error: null }
    if (data && typeof data === 'object' && 'rows' in data) {
      return [data as ApiResult]
    }

    // Case 4: Backend returns a single object (treat as single row result)
    // Format: { someField: "value" }
    if (data && typeof data === 'object') {
      return [
        {
          rows: [data],
          rowCount: 1,
          error: null
        }
      ]
    }

    // Unexpected response format
    return [
      {
        rows: null,
        rowCount: 0,
        error: 'Unexpected response format from server'
      }
    ]
  } catch (error) {
    // Handle network errors, JSON parse errors, etc.
    return [
      {
        rows: null,
        rowCount: 0,
        error: `Request failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      }
    ]
  }
}

/**
 * Convenience wrapper for Axios-like interface
 */
export const apiService = {
  execute: (sql: string) => executeSQL({ sql })
}
