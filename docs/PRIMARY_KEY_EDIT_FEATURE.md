# Primary Key Edit Feature

## Overview

This document describes the implementation of allowing primary key value modifications with warning prompts.

## Changes Made

### 1. EditableGrid Component (`src/components/EditableGrid.tsx`)

#### Removed Restrictions

- **Before**: Primary keys were only editable when their value was `null` or `undefined`
- **After**: Primary keys are now editable just like any other column (except system column `rowid`)

#### Added Warning Dialog

When a user attempts to edit a non-null primary key value:

1. A confirmation modal appears with a warning message
2. The modal explains that modifying a primary key may affect data integrity and relationships
3. User must explicitly confirm to proceed
4. If cancelled, the value reverts to the original

**Implementation Details:**

- Added `Modal` and `ExclamationCircleOutlined` imports from `antd`
- Added `isPrimaryKey` prop to `EditableCellProps` interface
- Modified the `save()` function to check if the column is a primary key
- Shows `Modal.confirm()` with danger styling for primary key edits

#### Fixed Dirty Indicator for Primary Key Changes

Enhanced the `render()` function to properly display the "Modified" indicator (red triangle) when primary keys are changed:

**The Challenge:**

- When a primary key is modified (e.g., from `1` to `100`), the `dirtyChanges` Map key remains the original value (`1`)
- But `record[primaryKey]` now contains the new value (`100`)
- Direct lookup with the new value fails to find the dirty changes

**The Solution:**
Iterate through all `dirtyChanges` entries to find the matching row using three strategies:

1. **Direct match**: Check if the Map key equals the current PK value (for unchanged PKs)
2. **Changed PK match**: Check if the dirty changes contain a PK column change that equals the current PK value
3. **Null PK match**: For rows with null PKs, match by `rowid`

This ensures the red triangle indicator appears correctly for all modified cells, including primary key columns.

### 2. Tab Store (`src/stores/useTabStore.ts`)

#### Enhanced Change Tracking

Modified `updateCellValue()` to track original primary key values:

- When a primary key column is modified, stores the original value as `_originalPkValue`
- This allows the UPDATE statement to use the correct WHERE clause

#### Updated Save Logic

Modified `saveChangesForTableTab()` to handle primary key changes:

- Filters out internal tracking fields (those starting with `_`) from the SET clause
- Uses `_originalPkValue` (if present) in the WHERE clause instead of the current primary key value
- This ensures the correct row is updated even when the primary key itself changes

**Example SQL Generation:**

```sql
-- Original row: id=1, name='John'
-- User changes: id=1 -> id=100, name='John' -> name='Jane'

-- Generated SQL uses original PK value in WHERE:
UPDATE users SET id = 100, name = 'Jane' WHERE id = 1
```

## User Experience

### Editing Non-Primary Key Columns

- Works exactly as before
- Double-click to edit
- Press Enter or blur to save
- No warnings

### Editing Primary Key Columns

#### When Primary Key is NULL

- Works like any other column
- No warning shown (since setting a NULL primary key is less risky)
- Useful for populating initially empty primary keys

#### When Primary Key is NOT NULL

1. User double-clicks the primary key cell
2. User enters a new value
3. User presses Enter or clicks away
4. **Warning modal appears:**
   - Title: "Warning: Editing Primary Key"
   - Message: "You are about to modify a primary key value. This may affect data integrity and relationships. Are you sure you want to continue?"
   - Buttons: "Yes, Continue" (danger) and "Cancel"
5. If user clicks "Yes, Continue":
   - Change is marked as dirty (red triangle indicator)
   - User can save changes with the "Save Changes" button
6. If user clicks "Cancel":
   - Value reverts to original
   - No changes are made

## Technical Notes

### Internal Tracking Fields

The implementation uses a special field `_originalPkValue` in the dirty changes map:

- Prefixed with underscore to distinguish from actual column names
- Automatically filtered out when generating SQL SET clauses
- Only used for tracking the original primary key value for WHERE clauses

### Compatibility

- Works with all data types (numeric, string, etc.)
- Handles NULL primary keys correctly
- Compatible with SQLite's `rowid` system for tables without explicit primary keys
- Proper SQL escaping for string values

### Safety Features

1. **Warning Dialog**: Prevents accidental primary key modifications
2. **Original Value Tracking**: Ensures correct row is updated
3. **Dirty Change Indicator**: Visual feedback that changes are pending
4. **Batch Save**: All changes saved atomically
5. **Error Handling**: Any SQL errors are displayed to the user

## Testing Recommendations

1. **Basic Primary Key Edit**

   - Edit a numeric primary key
   - Edit a string primary key
   - Verify warning appears
   - Verify changes save correctly

2. **NULL Primary Key**

   - Edit a NULL primary key value
   - Verify no warning appears
   - Verify changes save correctly

3. **Multiple Changes**

   - Change primary key AND other columns in same row
   - Verify both changes save correctly
   - Verify WHERE clause uses original PK value

4. **Cancel Workflow**

   - Start editing primary key
   - Click "Cancel" in warning dialog
   - Verify value reverts to original

5. **Edge Cases**
   - Primary key with special characters (quotes, etc.)
   - Very long primary key values
   - Changing primary key multiple times before saving
