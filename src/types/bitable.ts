export type SortOrder = 'asc' | 'desc'

export interface FieldSpec {
  field_name: string
  type?: string
  property?: any
}

export interface UpsertPayload {
  appToken: string
  tableId: string
  data: Record<string, any>
  uniqueKey: string
  sortField?: { name: string; order?: SortOrder }
}

