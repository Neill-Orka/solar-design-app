# routes/optimize.py
from flask import Blueprint, request, jsonify
from models import db, Product, Projects, OptimizationRun, EnergyData
from services.simulation_engine import simulate_system_inner
from datetime import datetime
# from services.financial_calcs import calculate_financial_model
import math 

optimize_bp = Blueprint("optimize", __name__)

# --------------------------------------------------------------------------
#  USER-CONFIGURABLE DEFAULTS
# --------------------------------------------------------------------------
TARIFF_NOW      = 2.2          # R / kWh  (first-year Eskom tariff)
TARIFF_ESC      = 0.12         # 12 % annual escalation
YEARS           = 20           # projection horizon
DERATE          = 0.85         # overall PV performance ratio
BAT_EFF         = 0.92
BAT_DOD         = 0.90         # usable depth-of-discharge
BOS_FACTOR      = 1.79         # ~20% extra for mounting, wiring, consumables, etc.
# --------------------------------------------------------------------------



# --- helper: fetch first panel product to get price/W  --------------------
def _panel_price_per_kw():
    panel = Product.query.filter_by(category="panel").first()
    if panel and panel.price and panel.power_w:
        return panel.price / panel.power_w * 1000   # R / kWp
    # sensible fallback if no panel in DB
    return 3500                                    # R / kWp (≈ R 3.50 / W)

# ========================================================================== #
#                              MAIN ENDPOINT                                 #
# ========================================================================== #
@optimize_bp.route("/optimize", methods=["POST"])
def optimize():
    data         = request.get_json()
    project_id   = data["project_id"]
    system_type  = data["system_type"]                # grid / hybrid / off-grid
    roof_kw_max  = data.get("roof_kw_limit", 100)     # kWp search upper bound
    allow_export = bool(data.get("export_enabled", False))         # export to grid
    eskom_tariff = float(data.get("eskom_tariff", TARIFF_NOW))
    feed_in_tariff = float(data.get("feed_in_tariff", TARIFF_NOW * 0.45))
    sample_size = int(data.get("sample_size", 10)) # number of simulation runs

    project = Projects.query.get_or_404(project_id)

    PANEL_PRICE_PER_KW = _panel_price_per_kw()
    samples = []

    # ------------------------------------------------------------------ #'
    # Pre-filter batteries for off-grid/hybrid systems
    # ------------------------------------------------------------------ #
    if system_type in ("off-grid", "hybrid"):
        # load raw demand series to compute average daily kWh
        records       = EnergyData.query.filter_by(project_id=project_id).order_by(EnergyData.timestamp).all()
        kwh_total     = sum(r.demand_kw for r in records) * 0.5  # half-hour steps
        days_recorded = max((records[-1].timestamp - records[0].timestamp).days, 1)
        avg_daily_kwh = kwh_total / days_recorded

        # define required battery capacity
        if system_type == "off-grid":
            AUTONOMY_DAYS      = 2
            required_batt_kwh  = avg_daily_kwh * AUTONOMY_DAYS / (BAT_EFF * BAT_DOD)
        else:  # hybrid assume 2 h critical load at 40% peak
            peak_kw = max(r.demand_kw for r in records)
            critical_kw = peak_kw * 0.4
            BACKUP_HOURS       = 2
            required_batt_kwh  = critical_kw * BACKUP_HOURS / (BAT_EFF * BAT_DOD)

        # filter the battery list in-place
        batteries = Product.query.filter_by(category="battery").all()
        batteries = [b for b in batteries if (b.capacity_kwh or 0) >= required_batt_kwh]
        if system_type == "off-grid" and not batteries:
            return jsonify({"error": "No battery large enough for required autonomy"}), 400
    else:
        batteries = Product.query.filter_by(category="battery").all()

    # ------------------------------------------------------------------ #
    # Candidate equipment sets
    # ------------------------------------------------------------------ #
    panel_kw_step  = 2
    kwp_options    = list(range(panel_kw_step, int(roof_kw_max)+1, panel_kw_step))

    inverters      = Product.query.filter_by(category="inverter").all()

    best_score     = math.inf
    best_design    = None

    for kwp in kwp_options:
        # inverter rating rule-of-thumb 0.85–1.30 × PV
        inv_candidates = [inv for inv in inverters
                          if 0.85*kwp <= inv.rating_kva <= 1.3*kwp]
        if not inv_candidates:
            continue

        bat_candidates = [None] if system_type == "grid" else batteries
        for inv in inv_candidates:
            for bat in bat_candidates:
                batt_kwh = bat.capacity_kwh if bat else 0
                design = {
                    "kwp"     : kwp,
                    "inv_id"  : inv.id,
                    "bat_id"  : bat.id if bat else None,
                    "bat_kwh" : batt_kwh
                }

                # ---- simulate full year with your real engine -------------
                sim = simulate_system_inner(
                    project_id        = project_id,
                    panel_kw          = kwp,
                    battery_kwh       = design["bat_kwh"],
                    system_type       = system_type,
                    inverter_kva      = inv.rating_kva,
                    allow_export      = allow_export
                )

                if "error" in sim:                       # data problem
                    return jsonify(sim), 500
                
                # ------ Skip infeasible designs --------------------------
                if system_type in ("off-grid", "hybrid") and sim.get("unmet", 0) > 0:
                    continue

                equipment_capex = (kwp * PANEL_PRICE_PER_KW) + inv.price + (bat.price if bat else 0)
                # include BoS costs
                capex = equipment_capex * (1 + BOS_FACTOR)
                
                # get annual savings fia financial model
                fm = calculate_financial_model(
                    project=project,
                    sim_response=sim,
                    eskom_tariff=eskom_tariff,
                    export_enabled=allow_export,
                    feed_in_tariff=feed_in_tariff
                )

                annual_sav = fm["annual_savings"]
                payback = capex / annual_sav if annual_sav and annual_sav > 0 else math.inf

                # Collect a sample entry if we haven't filled it yet
                if len(samples) < sample_size:
                    samples.append({
                        "kwp":              kwp,
                        "inv_model":        f"{inv.brand} {inv.model}",   # ← human‐readable
                        "bat_kwh":          design["bat_kwh"],
                        "capex":            capex,
                        "annual_savings":   annual_sav,
                        "payback_years":    payback,                      # ← new field
                    })

                # score = payback (lower is better)
                
                if payback < best_score:
                    best_score, best_design = payback, {
                        **design,
                        "inv_model":        f"{inv.brand} {inv.model}",   # ← human‐readable
                        "capex":            capex,
                        "annual_savings":   annual_sav,
                        "payback_years":    payback,                      # ← new field
                        "kpis":             sim
                    }

    # ------------- persist run in DB ---------------------------------------
    run = OptimizationRun(project_id   = project_id,
                          system_type  = system_type,
                          inputs_json  = data,
                          best_json    = best_design)
    db.session.add(run); 
    db.session.commit()

    return jsonify({"best": best_design, "samples": samples}), 200

# --------------------------------------------------------------------------
#  Objective function
# --------------------------------------------------------------------------
def objective(project, sim, design, inverter, battery, system_type, allow_export):
    """Smaller score is better."""
    panel_ppk = _panel_price_per_kw()

    capex = (design["kwp"] * panel_ppk +
             inverter.price +
             (battery.price if battery else 0))

    if system_type == "off-grid":
        if sum(sim["import_from_grid"]) > 0 or sim["kpis"].get("unmet", 0) > 0:
            return 1e9                         # infeasible
        return capex                           # minimise capex

    # ------------ grid or hybrid  -----------------------------------------
    annual_savings = _annual_savings(project, sim, allow_export)
    escalated = sum(annual_savings * ((1+TARIFF_ESC)**y) for y in range(YEARS))
    # maximise NPV → minimise negative NPV
    return -(escalated - capex)

# --------------------------------------------------------------------------
#  Annual savings calculation
# --------------------------------------------------------------------------
def _annual_savings(project, sim, allow_export):
    fm = calculate_financial_model(
            project          = project,
            sim_response     = sim,
            eskom_tariff     = TARIFF_NOW,
            export_enabled   = allow_export,
            feed_in_tariff   = TARIFF_NOW * 0.45   # simple 45 % FiT
         )
    # fm returns annual_savings already rounded — use it directly
    return fm["annual_savings"]
