// src/features/jobcards/schemas.ts
import { z } from 'zod';

const isoOrNull = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.string().datetime().nullable()
);

export const JobCardFormSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  owner_id: z.coerce.number().int().positive(),
  category_id: z.coerce.number().int().positive().nullable().default(null),

  title: z.string().max(120).nullable().default(''),
  description: z.string().nullable().default(''),

  start_at: isoOrNull.default(null),
  complete_at: isoOrNull.default(null),

  labourers_count: z.coerce.number().int().min(0).default(0),
  labour_hours: z.coerce.number().min(0).default(0),
  labour_rate_per_hour: z.coerce.number().min(0).default(0),

  materials_used: z.coerce.boolean().default(false),

  did_travel: z.coerce.boolean().default(false),
  vehicle_id: z.coerce.number().int().positive().nullable().default(null),
  travel_distance_km: z.coerce.number().min(0).default(0),

  coc_required: z.coerce.boolean().default(false),

  status: z.enum([
    'draft','scheduled','in_progress','paused','completed','cancelled','invoiced'
  ]).default('draft'),
});

export type JobCardFormValues = z.infer<typeof JobCardFormSchema>;

// Single source of truth for form defaults (prevents undefined)
export const jobCardDefaults: JobCardFormValues = {
  client_id: 0,
  owner_id: 1,
  category_id: null,
  title: '',
  description: '',
  start_at: null,
  complete_at: null,
  labourers_count: 0,
  labour_hours: 0,
  labour_rate_per_hour: 0,
  materials_used: false,
  did_travel: false,
  vehicle_id: null,
  travel_distance_km: 0,
  coc_required: false,
  status: 'draft',
};
