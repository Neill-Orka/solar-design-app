// src/features/jobcards/components/JobCardFormMobile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller, SubmitHandler, SubmitErrorHandler } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  JobCardFormSchema,
  JobCardFormValues,
  jobCardDefaults,
} from "../schemas";
import type {
  JobCard,
  JobCategory,
  JobStatus,
  Vehicle,
  JobCardAttachment,
  Client
} from "../types";
import { createClient, listCategories, listClients, listVehicles } from "../api";
import "./jobcard-create.mobile.css";
import ProductPickerModal from "./ProductPickerModal";
import type { Product } from "../types";
import axios from "axios";

/** === utilities for datetime-local <-> ISO === */
const pad = (n: number) => String(n).padStart(2, "0");
const toInputDT = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};
const localToISO = (local: string | null) => {
  if (!local) return null;
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0).toISOString();
};
const normalizeISO = (v: unknown): string | null => {
  if (!v) return null;
  try {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
};

const statusClass: Record<JobStatus, string> = {
  draft: "secondary",
  scheduled: "info",
  in_progress: "primary",
  paused: "warning",
  completed: "success",
  cancelled: "dark",
  invoiced: "success",
};

type Props = {
  initial?: Partial<JobCard>;
  onSubmit: SubmitHandler<JobCardFormValues>;
  onCancel?: () => void;
};

export default function JobCardFormMobile({ initial, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<JobCardFormValues>({
    resolver: zodResolver(JobCardFormSchema),
    defaultValues: jobCardDefaults,
    mode: "onSubmit",
  });
  
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    // ensure owner_id in form state for Zod
    if (initial?.owner_id && initial.owner_id > 0) {
      setValue("owner_id", initial.owner_id, { shouldValidate: false });
    }
  }, [initial?.owner_id, setValue]);

  // API CALLS
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const data = await listClients(ac.signal);
        setClients(data);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  // Functions to fill data
  
  // Simple local client filter
  const filteredClients = clients.filter(c => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return false;
    const hay = `${c.client_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  function fillFromClient(c : Client) {
    setSelectedClient(c);
    setValue("client_id", c.id, { shouldDirty: true, shouldValidate: false });

    setValue("client_name" as any, c.client_name ?? "");
    setValue("client_email" as any, c.email ?? "");
    setValue("client_phone" as any, c.phone ?? "");
    setValue("client_street" as any, c.address?.street ?? "");
    setValue("client_town" as any, c.address?.town ?? "");
    setClientQuery(c.client_name);
    setClientOpen(false);
  }

  const onInvalid: SubmitErrorHandler<JobCardFormValues> = (errs) => {
    console.log('Form errors:', errs);
    const firstKey = Object.keys(errs)[0] as keyof JobCardFormValues;
    const msg = (errs[firstKey]?.message as string) || 'Validation error';
    alert(`${firstKey}: ${msg}`);
  };

  // ensure client exists before validation
  const onSave = async () => {
    // guarantee owner_id is present for Zod
    if (!getValues().owner_id && initial?.owner_id) {
      setValue("owner_id", initial.owner_id, { shouldValidate: false });
    }

    let { client_id } = getValues();

    if (!client_id || Number(client_id) <= 0) {
      // build payload from the "visual" client fields
      const vals = getValues();

      const payload = {
        client_name: (vals as any).client_name || "",
        email: (vals as any).client_email || "",
        phone: (vals as any).client_phone || "",
        address: {
          street: (vals as any).client_street || "",
          town: (vals as any).client_town || "",
          province: "",
          country: "South Africa"
        },
        company: (vals as any).client_company || "",
        vat_number: (vals as any).client_vat_number || "",
      };

      // Only create if the user actually typed "something"
      const userTypedSomething = payload.client_name || payload.email || payload.phone;
      if (userTypedSomething) {
        try {
          const res = await createClient(payload);
          setValue("client_id", res.client_id, { shouldDirty: true, shouldValidate: true });
        } catch (e: any) {
          alert(e?.response?.data?.error || "Failed to create client");
          return;
        }
      } else {
        alert("Please select a client or enter details to create one.");
        return;
      }
    }

    await Promise.resolve();

    await handleSubmit(onSubmit, onInvalid)();
  }


  // lookups
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    Promise.allSettled([listCategories(), listVehicles()]).then(([cats, vehs]) => {
      if (cats.status === "fulfilled") setCategories(cats.value.filter((c) => c.active));
      if (vehs.status === "fulfilled") setVehicles(vehs.value.filter((v) => v.active));
    });
  }, []);

  const [technicianHours, setTechnicianHours] = useState<Record<string, number>>({
    "Jurgens": 0,
    "Justin": 0
  });

  const [materialsOpen, setMaterialsOpen] = useState(false);
  type MatLine = { product_id: number; name: string; unit_price: number; qty: number };
  const [materialLines, setMaterialLines] = useState<MatLine[]>([]);

  const materialTotal = materialLines.reduce((s, l) => s + l.unit_price * l.qty, 0);

  // when the user clicks "add products"
  const handleAddProducts = (items: { product: Product; qty: number }[]) => {
    setMaterialLines(prev => {
      const byId = new Map(prev.map(x => [x.product_id, x]));
      for (const { product, qty } of items) {
        if (!qty) continue;
        const price = Number(product.price ?? product.unit_cost ?? 0);
        const name = [product.brand, product.model].filter(Boolean).join(" • ") || `#${product.id}`;
        if (byId.has(product.id)) {
          byId.get(product.id)!.qty += qty;
        } else {
          byId.set(product.id, { product_id: product.id, name, unit_price: price, qty });
        }
      }
      return Array.from(byId.values());
    });
  };

  // hydrate from initial (edit mode)
  useEffect(() => {
    if (!initial) return;
    reset({
      ...jobCardDefaults,
      client_id: Number(initial.client_id ?? 0),
      owner_id: Number(initial.owner_id ?? 1),
      category_id: initial.category_id ?? null,
      title: initial.title ?? "",
      description: initial.description ?? "",
      start_at: normalizeISO(initial.start_at),
      complete_at: normalizeISO(initial.complete_at),
      labourers_count: initial.labourers_count ?? 0,
      labour_hours: initial.labour_hours ?? 0,
      labour_rate_per_hour: initial.labour_rate_per_hour ?? 0,
      materials_used: !!initial.materials_used,
      did_travel: !!initial.did_travel,
      vehicle_id: initial.vehicle_id ?? null,
      travel_distance_km: initial.travel_distance_km ?? 0,
      coc_required: !!initial.coc_required,
      status: (initial.status as JobCardFormValues["status"]) ?? "draft",
    });
  }, [initial, reset]);

  // computed (badges)
  const didTravel = watch("did_travel");
  const status = watch("status");
  const selVehicleId = watch("vehicle_id");
  const selVehicle = vehicles.find((v) => v.id === (selVehicleId ? Number(selVehicleId) : -1));
  const labourersCount = Number(watch("labourers_count") || 0);
  const labourHours = Number(watch("labour_hours") || 0);
  const labourRate = Number(watch("labour_rate_per_hour") || 0);
  const labourTotal = labourHours * labourRate * labourersCount;
  const travelKm = Number(watch("travel_distance_km") || 0);
  const travelRate = Number(selVehicle?.rate_per_km || 0);
  const travelTotal = didTravel ? travelKm * travelRate : 0;
  const grandTotal = labourTotal + travelTotal;

  const setTechHours = (name: string, hours: number) => {
    setTechnicianHours(prev => ({
      ...prev,
      [name]: prev[name] === hours ? 0 : hours
    }));
  };

  return (
    <>
    <div className="jcM-appbar">
      <button className="jcM-back" onClick={() => navigate("/jobcards")} aria-label="Back to job cards">
        <i className="bi bi-chevron-left"></i>
        <span>Back</span>
      </button>
      <h1 className="jcM-title">Job Cards</h1>
      <div className="jcM-deviceslot" />
    </div>

    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="jcM-wrap">
      {/* header summary */}
      <div className="jcM-summary">
        <span className={`badge bg-${statusClass[status]}`}>{status.replace("_", " ")}</span>
        <span className="badge text-bg-light">Labour: R {labourTotal.toFixed(2)}</span>
        {didTravel && <span className="badge text-bg-light">Travel: R {travelTotal.toFixed(2)}</span>}
        <span className="badge text-bg-dark">Est. R {grandTotal.toFixed(2)}</span>
      </div>

      {/* CLIENT (visual only for now) */}
      <section className="jcM-card">
        <h6 className="jcM-section">CLIENT</h6>

        {/* hidden field so Zod can validate client_id */}
        <input type="hidden" {...register("owner_id", { valueAsNumber: true })} />
        <input type="hidden" {...register("client_id", {valueAsNumber: true })} />
        
        <div className="jcM-autoComplete">
          <input className="form-control form-control-sm mt-2" placeholder="Full Name" 
            value={clientQuery}
            onChange={(e) => { setClientQuery(e.target.value); setClientOpen(true); setSelectedClient(null); setValue("client_id", 0); setValue("client_name" as any, e.target.value);}}
            onFocus={() => setClientOpen(!!clientQuery)}
            onBlur={() => setTimeout(() => setClientOpen(false), 120)}
          />
          {clientOpen && filteredClients.length > 0 && (
            <ul className="jcM-aclist list-group" role="listbox">
              {filteredClients.map((c) => (
                <li
                  key={c.id}
                  className="list-group-item list-group-item-action"
                  role="option"
                  onMouseDown={(e) => e.preventDefault()} // keep focus for click
                  onClick={() => fillFromClient(c)}
                >
                  <div className="fw-semibold">{c.client_name}</div>
                  <div className="small text-muted">
                    {c.email || "—"} · {c.phone || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>  

        {/* Email */}
        <input
          className="form-control form-control-sm mt-2"
          placeholder="Email Address"
          type="email"
          {...register("client_email" as any)}
          onChange={(e) => setSelectedClient(null)}
        />

        {/* Phone */}
        <input
          className="form-control form-control-sm mt-2"
          placeholder="Phone Number"
          {...register("client_phone" as any)}
          onChange={(e) => setSelectedClient(null)}
        />

        <div className="jcM-grid2 mt-2">
          <input
            className="form-control form-control-sm"
            placeholder="Street"
            {...register("client_street" as any)}
            onChange={(e) => setSelectedClient(null)}
          />
          <input
            className="form-control form-control-sm"
            placeholder="City"
            {...register("client_town" as any)}
            onChange={(e) => setSelectedClient(null)}
          />
        </div>

        {selectedClient && (
          <div className="d-flex align-items-center gap-2 mt-2">
            <span className="badge text-bg-success">Selected: {selectedClient.client_name}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => { setSelectedClient(null); setClientQuery(""); setValue("client_id", 0); }}
              >
                Clear
            </button>
          </div>
        )}

      </section>

      {/* JOB DETAILS */}
      <section className="jcM-card">
        <h6 className="jcM-section">JOB DETAILS</h6>

        <input 
          className="form-control form-control-sm mb-2"
          placeholder="Job title (e.g., Replace DB isolator)"
          {...register("title", { required: "Title is required" })}
        />
        {errors.title && (
          <small className="text-danger">{String(errors.title.message)}</small>
        )}

        <div className="jcM-grid2">
          <Controller
            name="start_at"
            control={control}
            defaultValue={null}
            render={({ field: { value, onChange } }) => (
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={toInputDT(value)}
                onChange={(e) => onChange(localToISO(e.target.value))}
                placeholder="Start Date"
              />
            )}
          />
          <Controller
            name="complete_at"
            control={control}
            defaultValue={null}
            render={({ field: { value, onChange } }) => (
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={toInputDT(value)}
                onChange={(e) => onChange(localToISO(e.target.value))}
                placeholder="End Date"
              />
            )}
          />
        </div>

        <textarea
          rows={3}
          className="form-control form-control-sm mt-2"
          placeholder="Job Description"
          {...register("description")}
      />

        {/* Category as radio list (like mock) */}
        <div className="jcM-radioList mt-2">
          {categories.length ? (
            categories.map((c) => (
              <label key={c.id} className="jcM-radioItem">
                <input type="radio" value={c.id} {...register("category_id", { valueAsNumber: true })} />
                <span>{c.name}</span>
              </label>
            ))
          ) : (
            <small className="text-muted">
              No categories loaded. Make sure you're signed in and have categories configured.
            </small>
          )}
        </div>
      </section>

      {/* HOURS quick dots (visual like screenshot) */}
      <section className="jcM-card">
        <h6 className="jcM-section">HOURS</h6>
        <div className="jcM-hoursHeader">
          <span className="jcM-tech" />
          <div className="jcM-dotbar"> 
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span key={n} className="jcM-num">{n}</span>
            ))}
          </div>
        </div>

        {["Jurgens", "Justin"].map((name) => (
          <div key={name} className="jcM-hoursRow">
            <span className="jcM-tech">{name}</span>
            <div className="jcM-dotbar">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <input
                  key={n}
                  type="radio"
                  name={`hours_${name}`}
                  value={n}
                  className="jcM-dot"
                  onClick={() => setTechHours(name, n)}
                  aria-label={`${name} ${n}h`}
                  checked={technicianHours[name] === n && technicianHours[name] !== 0}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* LABOUR */}
      <section className="jcM-card">
        <h6 className="jcM-section">ASSISTANTS</h6>
        <div className="jcM-grid3">
          <div>
            <label className="jcM-label">People</label>
            <input
              type="number"
              min={0}
              className="form-control form-control-sm"
              {...register("labourers_count", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="jcM-label">Hours</label>
            <input
              type="number"
              min={0}
              step="0.25"
              className="form-control form-control-sm"
              {...register("labour_hours", { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className="jcM-label">Rate / Hour</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="form-control form-control-sm"
              {...register("labour_rate_per_hour", { valueAsNumber: true })}
            />
          </div>
        </div>
      </section>

      {/* TRAVEL */}
      <section className="jcM-card">
        <h6 className="jcM-section">TRAVEL</h6>
        <div className="form-check form-switch mb-2">
          <input className="form-check-input" type="checkbox" id="did_travel" {...register("did_travel")} />
          <label className="form-check-label" htmlFor="did_travel">Enable travel</label>
        </div>

        {didTravel && (
          <div className="jcM-grid3">
            <div>
              <label className="jcM-label">Vehicle</label>
              <select className="form-select form-select-sm" {...register("vehicle_id", { valueAsNumber: true })}>
                <option value="">— select —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.registration ? `• ${v.registration}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="jcM-label">Distance (km)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                className="form-control form-control-sm"
                {...register("travel_distance_km", { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="jcM-label">Rate / km</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-control form-control-sm"
                value={selVehicle?.rate_per_km ?? ""}
                readOnly
              />
            </div>
          </div>
        )}
      </section>

      {/* MATERIALS & COC */}
      <section className="jcM-card">
<div className="card shadow-sm mb-3">
  <div className="card-body">
    <div className="d-flex justify-content-between align-items-center mb-2">
      <h5 className="card-title mb-0">Materials</h5>
      <span className="badge text-bg-secondary">R {materialTotal.toFixed(2)}</span>
    </div>

    <div className="form-check form-switch mb-2">
      <input className="form-check-input" type="checkbox" id="materials_used" {...register('materials_used')} />
      <label className="form-check-label" htmlFor="materials_used">Materials used</label>
    </div>

    {watch('materials_used') && (
      <>
        <button type="button" className="btn btn-sm btn-outline-primary mb-2" onClick={() => setMaterialsOpen(true)}>
          + Add products
        </button>

        {materialLines.length > 0 ? (
          <ul className="list-group">
            {materialLines.map((l, i) => (
              <li key={i} className="list-group-item d-flex align-items-center justify-content-between gap-2">
                <div className="flex-grow-1">
                  <div className="fw-semibold">{l.name}</div>
                  <small className="text-muted">R {l.unit_price.toFixed(2)} × </small>
                  <input
                    type="number"
                    min={0}
                    className="form-control form-control-sm d-inline-block"
                    style={{ width: 80 }}
                    value={l.qty}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value || 0));
                      setMaterialLines(lines => lines.map((x, idx) => idx === i ? { ...x, qty: v } : x));
                    }}
                  />
                </div>
                <div className="text-nowrap">R {(l.unit_price * l.qty).toFixed(2)}</div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => setMaterialLines(lines => lines.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted small">No materials added yet.</div>
        )}
      </>
    )}
  </div>
</div>
        <div className="d-flex align-items-center justify-content-between mt-2">
          <h6 className="jcM-section mb-0">COC</h6>
          <div className="form-check form-switch m-0">
            <input className="form-check-input" type="checkbox" id="coc_required" {...register("coc_required")} />
          </div>
        </div>
      </section>

      {/* PHOTOS (placeholder on create) */}
      <section className="jcM-card">
        <h6 className="jcM-section">PHOTOS</h6>
        <div className="alert alert-warning py-2 mb-2">
          Save the job card first, then add photos.
        </div>

        <div className="jcM-photoRow">
          <div className="jcM-photo ph" />
          <div className="jcM-photo ph" />
        </div>
      </section>

      {/* Sticky actions */}
      <div className="jcM-stickyBar">
        {onCancel && (
          <button type="button" className="btn btn-outline-secondary flex-fill" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
        <button type="button" className="btn btn-primary flex-fill" onClick={onSave} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isDirty ? "Save changes" : "Save"}
        </button>
      </div>


      <ProductPickerModal 
        open={materialsOpen}
        onClose={() => setMaterialsOpen(false)}
        onAdd={handleAddProducts}
      />
    </form>
    </>
  );
}
