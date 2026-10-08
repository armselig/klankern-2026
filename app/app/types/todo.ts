import type { Database } from './database.types'

export type TodoList = Database['public']['Tables']['todo_lists']['Row']
export type TodoItem = Database['public']['Tables']['todo_items']['Row']
