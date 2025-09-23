// src/features/jobcards/components/JobCardForm.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, SubmitHandler, SubmitErrorHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { JobCardFormSchema, JobCardFormValues, jobCardDefaults } from '../schemas';
import type { JobCard, JobCategory, Vehicle, JobStatus, JobCardAttachment } from '../types';
import { listCategories, listVehicles } from '../api';
import { uploadAttachment, deleteAttachment } from '../attachmentsApi';

type Props = {
  initial?: Partial<JobCard>;                  // pass full job when editing (has id + attachments)
  onSubmit: SubmitHandler<JobCardFormValues>;
  onCancel?: () => void;
};

// helpers for datetime-local <-> ISO
const toInputDT = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const toISO = (local: string | null) => (local ? new Date(local).toISOString() : null);

const statusClass: Record<JobStatus, string> = {
  draft: 'secondary',
  scheduled: 'info',
  in_progress: 'primary',
  paused: 'warning',
  completed: 'success',
  cancelled: 'dark',
  invoiced: 'success',
};

export default function JobCardForm({ initial, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardFormSchema),
    defaultValues: jobCardDefaults,
    mode: 'onSubmit',
  });

  // lookups
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    Promise.allSettled([listCategories(), listVehicles()]).then(([cats, vehs]) => {
      if (cats.status === 'fulfilled') setCategories(cats.value.filter(c => c.active));
      if (vehs.status === 'fulfilled') setVehicles(vehs.value.filter(v => v.active));
    });
  }, []);

  // attachments (edit mode only)
  const [attachments, setAttachments] = useState<JobCardAttachment[]>(initial?.attachments ?? []);
  useEffect(() => {
    if (initial?.attachments) setAttachments(initial.attachments);
  }, [initial?.attachments]);

  // hydrate from initial
  useEffect(() => {
    if (!initial) return;
    reset({
      ...jobCardDefaults,
      client_id: Number(initial.client_id ?? 0),
      owner_id: Number(initial.owner_id ?? 0),
      category_id: initial.category_id ?? null,
      title: initial.title ?? '',
      description: initial.description ?? '',
      start_at: initial.start_at ?? null,
      complete_at: initial.complete_at ?? null,
      labourers_count: initial.labourers_count ?? 0,
      labour_hours: initial.labour_hours ?? 0,
      labour_rate_per_hour: initial.labour_rate_per_hour ?? 0,
      materials_used: !!initial.materials_used,
      did_travel: !!initial.did_travel,
      vehicle_id: initial.vehicle_id ?? null,
      travel_distance_km: initial.travel_distance_km ?? 0,
      coc_required: !!initial.coc_required,
      status: (initial.status as JobCardFormValues['status']) ?? 'draft',
    });
  }, [initial, reset]);

  // wire datetime-local to ISO for zod .datetime()
  const startLocal = useMemo(() => toInputDT(watch('start_at')), [watch('start_at')]);
  const completeLocal = useMemo(() => toInputDT(watch('complete_at')), [watch('complete_at')]);

  const didTravel = watch('did_travel');
  const materialsUsed = watch('materials_used');
  const status = watch('status');
  const labourersCount = Number(watch('labourers_count') || 0);
  const labourHours = Number(watch('labour_hours') || 0);
  const labourRate = Number(watch('labour_rate_per_hour') || 0);
  const labourTotal = labourHours * labourRate * labourersCount;

  const selVehicleId = watch('vehicle_id');
  const selVehicle = vehicles.find(v => v.id === (selVehicleId ? Number(selVehicleId) : -1));
  const travelKm = Number(watch('travel_distance_km') || 0);
  const travelRate = Number(selVehicle?.rate_per_km || 0);
  const travelTotal = didTravel ? travelKm * travelRate : 0;

  const grandTotal = labourTotal + travelTotal; // materials are separate lines elsewhere

  const onInvalid: SubmitErrorHandler<JobCardFormValues> = () => {
    console.warn('Form errors:', errors);
  };

  const renderError = (key: keyof JobCardFormValues) =>
    errors[key] ? <small className="text-danger">{String(errors[key]?.message || 'Required')}</small> : null;

  // attachments handlers
  const canAttach = Boolean(initial?.id);
  const handlePickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canAttach || !initial?.id) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const f of files) {
      const up = await uploadAttachment(initial.id, f);
      setAttachments(prev => [up, ...prev]);
    }
    e.currentTarget.value = ''; // reset picker
  };
  const handleDeleteAttachment = async (att: JobCardAttachment) => {
    if (!canAttach || !initial?.id) return;
    await deleteAttachment(initial.id, att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="container-fluid px-2 pb-5">
      {/* hidden owner for schema */}
      <input type="hidden" {...register('owner_id', { valueAsNumber: true })} />

      {/* ===== TOP SUMMARY (badges) ===== */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <span className={`badge text-bg-${statusClass[status]}`}>Status: {status.replace('_',' ')}</span>
        <span className="badge text-bg-secondary">Labour: R {labourTotal.toFixed(2)}</span>
        {didTravel && <span className="badge text-bg-secondary">Travel: R {travelTotal.toFixed(2)}</span>}
        <span className="badge text-bg-dark">Est. total: R {grandTotal.toFixed(2)}</span>
      </div>

      {/* ============ BASIC INFO ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Basic info</h5>

          <div className="mb-3">
            <label className="form-label">Title</label>
            <input
              className={`form-control ${errors.title ? 'is-invalid' : ''}`}
              placeholder="e.g. Replace DB isolator, inspect wiring"
              {...register('title')}
            />
            {renderError('title')}
          </div>

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">Client ID</label>
              <input
                className={`form-control ${errors.client_id ? 'is-invalid' : ''}`}
                type="number"
                inputMode="numeric"
                placeholder="Client #"
                {...register('client_id', { valueAsNumber: true })}
              />
              {renderError('client_id')}
            </div>

            <div className="col-6">
              <label className="form-label">Category</label>
              <select className="form-select" {...register('category_id')}>
                <option value="">— none —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label">Status</label>
            <div className="d-flex flex-wrap gap-2">
              {(['draft','scheduled','in_progress','paused','completed','cancelled','invoiced'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn-sm btn-outline-${s === status ? statusClass[s] : 'secondary'}`}
                  onClick={() => setValue('status', s, { shouldDirty: true })}
                >
                  {s.replace('_',' ')}
                </button>
              ))}
            </div>
            {/* keep select for accessibility/fallback */}
            <select className="form-select mt-2" {...register('status')}>
              {(['draft','scheduled','in_progress','paused','completed','cancelled','invoiced'] as const).map(s => (
                <option key={s} value={s}>{s.replace('_',' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ============ TIMING ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Timing</h5>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Start</label>
              <input
                type="datetime-local"
                className="form-control"
                value={startLocal}
                onChange={e => setValue('start_at', toISO(e.target.value), { shouldDirty: true })}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Complete</label>
              <input
                type="datetime-local"
                className="form-control"
                value={completeLocal}
                onChange={e => setValue('complete_at', toISO(e.target.value), { shouldDirty: true })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============ LABOUR ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Labour</h5>
            <span className="badge text-bg-secondary">R {labourTotal.toFixed(2)}</span>
          </div>
          <div className="row g-2 mt-2">
            <div className="col-4">
              <label className="form-label">People</label>
              <input
                type="number"
                inputMode="numeric"
                className="form-control"
                min={0}
                {...register('labourers_count', { valueAsNumber: true })}
              />
            </div>
            <div className="col-4">
              <label className="form-label">Hours</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                className="form-control"
                min={0}
                {...register('labour_hours', { valueAsNumber: true })}
              />
            </div>
            <div className="col-4">
              <label className="form-label">Rate / hr</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="form-control"
                min={0}
                {...register('labour_rate_per_hour', { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============ MATERIALS ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Materials</h5>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="materials_used" {...register('materials_used')} />
            <label className="form-check-label" htmlFor="materials_used">Materials used</label>
          </div>
          {materialsUsed && (
            <div className="alert alert-info mt-2 py-2">
              Add material lines on the job card after saving.
            </div>
          )}
        </div>
      </div>

      {/* ============ TRAVEL ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">Travel</h5>
            {didTravel && <span className="badge text-bg-secondary">R {travelTotal.toFixed(2)}</span>}
          </div>

          <div className="form-check form-switch my-2">
            <input className="form-check-input" type="checkbox" id="did_travel" {...register('did_travel')} />
            <label className="form-check-label" htmlFor="did_travel">Travel included</label>
          </div>

          {didTravel && (
            <div className="row g-2">
              <div className="col-12">
                <label className="form-label">Vehicle</label>
                <select className="form-select" {...register('vehicle_id')}>
                  <option value="">— select —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name}{v.registration ? ` • ${v.registration}` : ''} {v.rate_per_km ? `• R${Number(v.rate_per_km).toFixed(2)}/km` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Distance (km)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  className="form-control"
                  min={0}
                  placeholder="e.g. 32.5"
                  {...register('travel_distance_km', { valueAsNumber: true })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ COMPLIANCE ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Compliance</h5>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="coc_required" {...register('coc_required')} />
            <label className="form-check-label" htmlFor="coc_required">CoC required</label>
          </div>
        </div>
      </div>

      {/* ============ NOTES ============ */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Notes</h5>
          <textarea
            rows={5}
            className="form-control"
            placeholder="Describe work done, faults found, safety notes, etc."
            {...register('description')}
          />
        </div>
      </div>

      {/* ============ PHOTOS ============ */}
      <div className="card shadow-sm mb-5">
        <div className="card-body">
          <h5 className="card-title mb-3">Photos</h5>
          {!canAttach && (
            <div className="alert alert-warning py-2">
              Save the job card first, then add photos.
            </div>
          )}
          <div className="d-flex flex-wrap gap-2 mb-2">
            {attachments.map(att => (
              <div key={att.id} className="position-relative" style={{ width: 120 }}>
                <a href={att.url} target="_blank" rel="noreferrer">
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="img-thumbnail"
                    style={{ width: 120, height: 120, objectFit: 'cover' }}
                  />
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-danger position-absolute"
                  style={{ top: 4, right: 4 }}
                  onClick={() => handleDeleteAttachment(att)}
                  disabled={!canAttach}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="d-flex gap-2">
            <label className={`btn btn-outline-primary ${!canAttach ? 'disabled' : ''}`}>
              <i className="bi bi-camera me-1" />
              Take/Upload photo
              <input
                type="file"
                accept="image/*"
                capture="environment"           // opens camera on phones
                multiple
                hidden
                onChange={handlePickFiles}
                disabled={!canAttach}
              />
            </label>
          </div>
          <small className="text-muted d-block mt-2">Tip: use the rear camera for clearer photos of labels/DBs.</small>
        </div>
      </div>

      {/* desktop actions */}
      <div className="d-none d-md-flex gap-2 justify-content-end mb-4">
        {onCancel && (
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : (isDirty ? 'Save changes' : 'Save')}
        </button>
      </div>

      {/* sticky mobile action bar */}
      <div className="d-md-none fixed-bottom bg-body border-top p-2">
        <div className="d-flex gap-2">
          {onCancel && (
            <button type="button" className="btn btn-outline-secondary flex-fill" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary flex-fill" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
