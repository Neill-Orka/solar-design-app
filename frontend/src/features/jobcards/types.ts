export type JobStatus = 
    | 'draft' | 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'invoiced' ;

export interface TechnicianProfile {
    id: number;
    user_id: number;
    name: string | null;
    hourly_rate: number;
    active: boolean;
}

export interface JobCategory { id: number; name: string; active: boolean; }

export interface Vehicle {
    id: number;
    name: string;
    registration: string | null;
    rate_per_km: number;
    active: boolean;
}

export interface JobCardTimeEntry {
    id: number;
    job_card_id: number;
    user_id: number;
    user_name: string | null;
    hours: number;
    hourly_rate_at_time: number;
    amount: number;
}

export interface JobCardMaterial {
    id: number;
    job_card_id: number;
    product_id: number;
    product_name: string | null;
    quantity: number;
    unit_cost_at_time: number;
    unit_price_at_time: number;
    line_total: number;
    note: string | null;
}

export interface JobCardAttachment {
    id: number;
    job_card_id: number;
    filename: string;
    url: string;
    content_type: string | null;
    size_bytes: number | null;
    created_at: string | null;
}

export interface JobCard {
    id: number;
    client_id: number;
    owner_id: number | null;
    owner_name?: string;
    category_id: number | null;
    title: string | null;
    description: string | null;
    is_quoted: boolean;
    start_at: string | null;
    complete_at: string | null;
    client_name: string | null;
    client_email: string | null;
    client_address: string | null;
    client_phone: string | null;
    labourers_count: number;
    labour_hours: number;
    labour_rate_per_hour: number;
    materials_used: boolean;
    did_travel: boolean;
    vehicle_id: number | null;
    travel_distance_km: number;
    coc_required: boolean;
    status: JobStatus;
    created_at: string | null;
    updated_at: string | null;
    time_entries?: JobCardTimeEntry[];
    materials?: JobCardMaterial[];
    attachments?: JobCardAttachment[];
}

export interface Product {
    id: number;
    brand?: string;
    model?: string;
    category?: string;
    component_type?: string;
    unit_cost?: number | null;
    price?: number | null;
    margin?: number | null;
}

export type JobCardUpsert = Omit<JobCard,
    | 'id' 
    | 'created_at'
    | 'updated_at' 
    | 'time_entries' 
    | 'materials' 
    | 'attachments'
    | 'client_name'
    | 'client_address'
    | 'client_email'
    | 'client_phone'
> & {
    is_quoted: boolean;
};

export type Client = { 
    id: number;
    client_name: string;
    email?: string;
    phone?: string;
    address?: any;
    company?: string;
    vat_number?: string; 
}