# routes/optimize.py
from flask import Blueprint, request, jsonify
from models import db, Product, Projects, OptimizationRun
from services.simulation_engine import simulate_system_inner
from datetime import datetime
from services.financial_calcs import calculate_financial_model
import itertools, math, json

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
BOS_FACTOR      = 0.20         # ~20% extra for mounting, wiring, consumables, etc.
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
    allow_export = system_type == "grid"              # export only for grid-tied

    project = Projects.query.get_or_404(project_id)

    PANEL_PRICE_PER_KW = _panel_price_per_kw()

    # ------------------------------------------------------------------ #
    # Candidate equipment sets
    # ------------------------------------------------------------------ #
    panel_kw_step  = 2
    kwp_options    = list(range(panel_kw_step, int(roof_kw_max)+1, panel_kw_step))

    inverters      = Product.query.filter_by(category="inverter").all()
    batteries      = Product.query.filter_by(category="battery").all()

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
                design = {
                    "kwp"     : kwp,
                    "inv_id"  : inv.id,
                    "bat_id"  : bat.id if bat else None,
                    "bat_kwh" : bat.capacity_kwh if bat else 0
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

                panel_ppk = _panel_price_per_kw()
                equipment_capex = (kwp * panel_ppk) + inv.price + (bat.price if bat else 0)

                # include BoS costs
                capex = equipment_capex * (1 + BOS_FACTOR)

                # compute first-year savings
                annual_savings = _annual_savings(project, sim, allow_export)

                # dynamic payback
                payback = capex / annual_savings if annual_savings and annual_savings > 0 else math.inf

                # Then your scoring
                score = objective(project, sim, design, inv, bat, system_type, allow_export)
                
                if score < best_score:
                    best_score = score
                    best_design = {
                        "kwp":              kwp,
                        "inv_id":           inv.id,
                        "inv_model":        f"{inv.brand} {inv.model}",   # ← human‐readable
                        "bat_id":           bat.id if bat else None,
                        "bat_kwh":          design["bat_kwh"],
                        "capex":            capex,
                        "payback_years":    payback,                      # ← new field
                        "kpis":             sim
                    }

    # ------------- persist run in DB ---------------------------------------
    run = OptimizationRun(project_id   = project_id,
                          system_type  = system_type,
                          inputs_json  = data,
                          best_json    = best_design)
    db.session.add(run);  db.session.commit()

    return jsonify(best_design), 200

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
