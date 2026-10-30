export interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
  created_time?: number;
  last_modified_time?: number;
}
export interface RecordListResponse {
  ok: boolean;
  items: BitableRecord[];
  total: number | null;
  hasMore: boolean;
  pageToken: string | null;
  message?: string;
}