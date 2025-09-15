export type JobCardStatus = 'open' | 'completed' | 'invoiced' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export type JobCardUI = {
  id: number;
  title: string;
  description: string;
  status: JobCardStatus;
  priority: JobPriority;
  category_id: number | null;

  owner_id: number | null;

  client_id: number | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;

  start_at: string | null;
  complete_at: string | null;

  labourers_count: number;
  labour_hours: number;
  labour_rate_per_hour: number;

  materials_used: boolean;
  time_entries: Array<{
    id: number;
    user_id: number;
    user_name?: string;
    hours: number;
    hourly_rate_at_time: number;
    amount: number;
  }>;

  materials: Array<{
    id: number;
    product_id: number;
    product_label?: string;
    quantity: number;
    unit_cost_at_time: number;
    unit_price_at_time: number;
    line_total: number;
    note?: string;
  }>;

  did_travel: boolean;
  vehicle_id: number | null;
  travel_distance_km: number;

  coc_required: boolean;

  attachments: Array<{
    id: number;
    filename: string;
    url: string;
    content_type?: string;
    size_bytes?: number;
    created_at?: string;
  }>;

  checklist: Array<{ key: string; label: string; checked: boolean }>;

  notes_internal: string;

  created_at: string;
  updated_at: string;
};
