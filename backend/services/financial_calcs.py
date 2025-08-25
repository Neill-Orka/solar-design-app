# services/financial_calcs.py
from datetime import datetime
from models import db, Tariffs, TariffRates, Projects
import logging
from datetime import datetime
from calendar import monthrange
from .tariff_engine import TariffEngine
from decimal import Decimal

def _serialize_tariff_for_engine(tariff: Tariffs) -> dict:
    if not tariff:
        return {'rates': []}
    return {
        'name': tariff.name,
        'rates': [
            {
                'charge_category': rate.charge_category,
                'rate_value': str(rate.rate_value),
                'rate_unit': rate.rate_unit,
                'season': rate.season,
                'time_of_use': rate.time_of_use,
            } for rate in tariff.rates.all()
        ]
    }

def calculate_financial_model(project, sim_response, eskom_tariff, export_enabled, feed_in_tariff):
    try:
        demand = sim_response["demand"]
        export = sim_response["export_to_grid"]
        import_kw = sim_response["import_from_grid"]
        timestamps = sim_response["timestamps"]

        degradation_rate = 0.005
        system_cost = project.project_value_excl_vat or 0

        base_savings = 0
        monthly_costs = {}

        for i in range(len(demand)):
            ts = datetime.fromisoformat(timestamps[i])
            month = ts.strftime('%Y-%m')

            base_cost = demand[i] * 0.5 * eskom_tariff
            import_cost = import_kw[i] * 0.5 * eskom_tariff
            savings = base_cost - import_cost

            if export_enabled:
                savings += export[i] * 0.5 * feed_in_tariff

            base_savings += savings

            if month not in monthly_costs:
                monthly_costs[month] = {"old_cost": 0, "new_cost": 0}

            monthly_costs[month]["old_cost"] += base_cost
            monthly_costs[month]["new_cost"] += import_cost - (export[i] * 0.5 * feed_in_tariff if export_enabled else 0)

        yearly_savings = []
        total_savings = 0

        for year in range(2025, 2025 + 20):
            degraded_savings = base_savings * ((1 - degradation_rate) ** (year - 2025))
            yearly_savings.append({"year": year, "savings": round(degraded_savings)})
            total_savings += degraded_savings

        roi_20yr = ((total_savings / system_cost) - 1) * 100 if system_cost > 0 else 0
        payback_years = system_cost / base_savings if base_savings > 0 else 0

        # Calculate yield_year1 (financial yield) = annual_savings / project_value_excl_vat
        project_value = project.project_value_excl_vat or system_cost
        yield_year1 = (base_savings / project_value) * 100 if project_value > 0 else 0

        cost_comparison = [
            {"period": month, "old_cost": round(v["old_cost"], 2), "new_cost": round(v["new_cost"], 2)}
            for month, v in sorted(monthly_costs.items())
        ]

        return {
            "annual_savings": round(base_savings),
            "yield_year1": round(yield_year1, 1),
            "payback_years": payback_years,
            "roi_20yr": roi_20yr,
            "yearly_savings": yearly_savings,
            "cost_comparison": cost_comparison
        }

    except Exception as e:
        return {"error": str(e)}

def run_quick_financials(sim_response: dict, system_cost: float, project: 'Projects') -> dict:
    try:
        # 1 Initiliaze the tariff engine
        tariff_data = {}
        if project.custom_flat_rate is not None:
            tariff_data = {
                'name': 'Custom Flat Rate',
                'rates': [{
                    'charge_category': 'energy', 'rate_value': str(project.custom_flat_rate * 100),
                    'rate_unit': 'c/kWh', 'season': 'all', 'time_of_use': 'all'
                }]
            }
        elif project.tariff_id is not None and project.tariff:
            tariff_data = _serialize_tariff_for_engine(project.tariff)

        if not tariff_data.get('rates'):
            return {"error": "No valid tariff data available for financial calculations."}
        
        engine = TariffEngine(tariff_data)

        # 2 Prepare for loop
        imports = sim_response["import_from_grid"]
        demand = sim_response["demand"]
        generation = sim_response["generation"]
        potential_generation = sim_response["potential_generation"]
        panel_kw = sim_response.get("panel_kw", 1)
        timestamps = [datetime.fromisoformat(ts) for ts in sim_response["timestamps"]]

        time_interval_hours = Decimal('0.5')
        degradation_rate = Decimal('0.005')

        # Dictionaries to store monthly aggregated data
        monthly_costs = {}
        monthly_max_demand = {}
        tariff_sample = []

        # 3 Loop through simulation & calculate dynamic costs
        for i, ts in enumerate(timestamps):
            month_key = ts.strftime('%Y-%m')

            if month_key not in monthly_costs:
                monthly_costs[month_key] = {
                    'old_energy_cost': Decimal(0), 'new_energy_cost': Decimal(0),
                    'old_demand_cost': Decimal(0), 'new_demand_cost': Decimal(0),
                    'old_fixed_cost': Decimal(0), 'new_fixed_cost': Decimal(0),
                    'total_old_bill': Decimal(0), 'total_new_bill': Decimal(0)
                }
            if month_key not in monthly_max_demand:
                monthly_max_demand[month_key] = {'old': Decimal(0), 'new': Decimal(0)}

            # Get the correct energy rate for the timestamp (ts)
            energy_rate_r_kwh = engine.get_energy_rate_r_per_kwh(ts)

            ## TESTING -> Populate the tariff sample for the first week (366 half-hours)
            if i < 366:
                tariff_sample.append({'timestamp': ts.isoformat(), 'rate': float(round(energy_rate_r_kwh, 4))})

            # Calculate energy costs for this interval
            monthly_costs[month_key]['old_energy_cost'] += Decimal(demand[i]) * (time_interval_hours) * energy_rate_r_kwh
            monthly_costs[month_key]['new_energy_cost'] += Decimal(imports[i]) * (time_interval_hours) * energy_rate_r_kwh

            # Check if a demand charge applies in this ts and update the monthly max demand
            demand_rate_r_kva = engine.get_demand_rate_r_per_kva_per_month(ts)
            if demand_rate_r_kva > 0:
                monthly_max_demand[month_key]['old'] = max(monthly_max_demand[month_key]['old'], Decimal(demand[i]))
                monthly_max_demand[month_key]['new'] = max(monthly_max_demand[month_key]['new'], Decimal(imports[i]))

        # 4 Calculate monthly fixed and demand charges 
        daily_fixed_rate = engine.get_fixed_rate_r_per_day()

        for month_key, values in monthly_costs.items():
            year, month = int(month_key.split('-')[0]), int(month_key.split('-')[1])
            days_in_month = monthrange(year, month)[1]

            # Calculate fixed costs for the month
            monthly_fixed_cost = Decimal(days_in_month) * daily_fixed_rate
            values['old_fixed_cost'] = monthly_fixed_cost
            values['new_fixed_cost'] = monthly_fixed_cost

            # Calculate demand costs for the month
            demand_ts = datetime(year, month, 15, 18, 30)
            demand_rate = engine.get_demand_rate_r_per_kva_per_month(demand_ts)

            values['old_demand_cost'] = monthly_max_demand[month_key]['old'] * demand_rate
            values['new_demand_cost'] = monthly_max_demand[month_key]['new'] * demand_rate

            # Calculate total monthly bills
            values['total_old_bill'] = values['old_energy_cost'] + values['old_demand_cost'] + values['old_fixed_cost']
            values['total_new_bill'] = values['new_energy_cost'] + values['new_demand_cost'] + values['new_fixed_cost']

        # 5 Calculate annual savings and ROI
        original_annual_cost = sum(v['total_old_bill'] for v in monthly_costs.values())
        new_annual_cost = sum(v['total_new_bill'] for v in monthly_costs.values())
        annual_savings = original_annual_cost - new_annual_cost

        # Calculate yield_year1 (financial yield) = annual_savings / project_value_excl_vat
        project_value = project.project_value_excl_vat or system_cost
        yield_year1 = (annual_savings / Decimal(project_value)) * 100 if project_value > 0 else Decimal('0')

        TARIFF_ESCALATION_RATE = Decimal('0.12') # Hardcoded 12% increase every year
        yearly_savings = []
        total_20yr_saving = Decimal(0)

        payback_years = Decimal(system_cost) / annual_savings if annual_savings > 0 else Decimal('inf')

        # Loop for 20 years
        for i in range(20):
            escalated_savings = annual_savings * ((1 + TARIFF_ESCALATION_RATE) ** i)
            degraded_savings = escalated_savings * ((1 - degradation_rate) ** i)
            
            total_20yr_saving += degraded_savings
            yearly_savings.append({
                "year": 2025 + i,
                "savings": float(round(degraded_savings, 2))
            })
            
        roi_20yr = ((total_20yr_saving - Decimal(system_cost)) / Decimal(system_cost)) * 100 if system_cost > 0 else Decimal('inf')

        # 6 Other values from sim response for meer metrics
        total_demand_kwh = sum(d * float(time_interval_hours) for d in demand)
        total_import_kwh = sum(imp * float(time_interval_hours) for imp in imports)
        total_generation_kwh = sum(g * float(time_interval_hours) for g in generation)
        potential_generation_kwh = sum(pg * float(time_interval_hours) for pg in potential_generation)
        
        pv_used_on_site_kwh = total_demand_kwh - total_import_kwh
        
        throttled_kwh = potential_generation_kwh - total_generation_kwh
        throttling_loss_percent = (throttled_kwh / potential_generation_kwh) * 100 if potential_generation_kwh > 0 else 0

        yield_incl_losses = total_generation_kwh / panel_kw / 365 if panel_kw > 0 else 0
        yield_excl_losses = potential_generation_kwh / panel_kw / 365 if panel_kw > 0 else 0

        self_consumption_rate = (pv_used_on_site_kwh / potential_generation_kwh) * 100 if total_generation_kwh > 0 else 0
        grid_independence_rate = (pv_used_on_site_kwh / total_demand_kwh) * 100 if total_demand_kwh > 0 else 0

        daytime_indices = [
            i for i, ts in enumerate(sim_response['timestamps'])
            if 7 <= datetime.fromisoformat(ts).hour < 18
        ]
        daytime_demand_kwh = sum(demand[i] * float(time_interval_hours) for i in daytime_indices)
        daytime_consumption_pct = (daytime_demand_kwh / total_demand_kwh) * 100 if total_demand_kwh > 0 else 0

        maintenance_rate = Decimal('0.01') # 1% of system cost per year
        total_lifetime_cost = Decimal(system_cost) + (Decimal(system_cost) * maintenance_rate * 20) # 20 years of maintenance
        total_lifetime_generation = sum(Decimal(total_generation_kwh) * ((1 - degradation_rate) ** i) for i in range(20))
        lcoe = (total_lifetime_cost / total_lifetime_generation) if total_lifetime_generation > 0 else Decimal('0')

        # Bill fluctuation analysis
        worst_month = max(monthly_costs.items(), key=lambda item: item[1]['total_new_bill'])
        best_month = min(monthly_costs.items(), key=lambda item: item[1]['total_new_bill'])
        bill_fluctuation = {
            'worst': {'month': worst_month[0], 'cost': float(round(worst_month[1]['total_new_bill'], 2))},
            'best': {'month': best_month[0], 'cost': float(round(best_month[1]['total_new_bill'], 2))}
        }

        battery_cycles = '-'
        if project.system_type in ['hybrid', 'off-grid']:
            battery_soc = sim_response.get('battery_soc', [])
            # FIX: Handle dict or number for battery_kwh
            battery_kwh = project.battery_kwh
            if isinstance(battery_kwh, dict):
                battery_capacity_kwh = float(battery_kwh.get('capacity', 0)) * float(battery_kwh.get('quantity', 1))
            else:
                battery_capacity_kwh = float(battery_kwh or 0)
            if battery_capacity_kwh > 0 and battery_soc:
                total_discharge_kwh = 0
                prev_soc = battery_soc[0]
                for soc in battery_soc[1:]:
                    if soc < prev_soc:
                        total_discharge_kwh += (prev_soc - soc) * battery_capacity_kwh / 100
                    prev_soc = soc
                battery_cycles = round(total_discharge_kwh / battery_capacity_kwh, 1) if battery_capacity_kwh > 0 else '-'

        # Cashflow analysis
        lifetime_cashflow = [{'year': 0, 'cashflow': -float(system_cost)}]
        cumulative = Decimal(-system_cost)

        for i in range(1, 21):
            # escalate savings at 12% and then degrade at 0.5% p.a.
            escalated = annual_savings * ((1 + TARIFF_ESCALATION_RATE) ** (i - 1))
            net_savings = escalated * ((1 - degradation_rate) ** (i - 1))
            cumulative += net_savings
            lifetime_cashflow.append({
                'year': i,
                'cashflow': float(round(cumulative, 2))
            })

        yearly_savings = [
            {"year": 2025 + i,
             "savings": float(round(annual_savings * ((1 - degradation_rate) ** i), 2))}
             for i in range(20)
        ]

        cost_comparison_data = [
            {
                "month": key,
                "old_cost": float(round(value['total_old_bill'], 2)),
                "new_cost": float(round(value['total_new_bill'], 2)),
                "old_bill_breakdown": {
                    "energy": float(round(value['old_energy_cost'], 2)),
                    "fixed": float(round(value['old_fixed_cost'], 2)),
                    "demand": float(round(value['old_demand_cost'], 2)),
                },
                "new_bill_breakdown": {
                    "energy": float(round(value['new_energy_cost'], 2)),
                    "fixed": float(round(value['new_fixed_cost'], 2)),
                    "demand": float(round(value['new_demand_cost'], 2)),
                }
            } for key, value in sorted(monthly_costs.items())
        ]

        return {
            # Financial KPIs
            "annual_savings": float(round(annual_savings, 2)),
            "yield_year1": float(round(yield_year1, 1)),
            "payback_period": float(round(payback_years, 1)) if payback_years != Decimal('inf') else 'N/A',
            "roi": float(round(roi_20yr, 1)) if roi_20yr != Decimal('inf') else 'N/A',
            "original_annual_cost": float(round(original_annual_cost, 2)),
            "new_annual_cost": float(round(new_annual_cost, 2)),
            "cost_comparison": cost_comparison_data,
            "yearly_savings": yearly_savings,
            "tariff_sample": tariff_sample,
            "roi": float(round(roi_20yr, 1)) if roi_20yr != Decimal('inf') else 'N/A',
            "lcoe": float(round(lcoe, 2)),
            "bill_fluctuation": bill_fluctuation,
            "lifetime_cashflow": lifetime_cashflow,

            # Technical KPIs
            "total_demand_kwh": round(total_demand_kwh),
            "total_generation_kwh": round(total_generation_kwh),
            "potential_generation_kwh": round(potential_generation_kwh),
            "total_import_kwh": round(total_import_kwh),
            "daytime_consumption_perc": round(daytime_consumption_pct, 1),
            "self_consumption_rate": round(self_consumption_rate, 1),
            "grid_independence_rate": round(grid_independence_rate, 1),
            "throttling_loss_percent": round(throttling_loss_percent, 1),
            "yield_incl_losses": round(yield_incl_losses, 2),
            "yield_excl_losses": round(yield_excl_losses, 2),
            "battery_cycles": battery_cycles,
        }
    except Exception as e:
        print(f"--- ERROR in run quick financials: {e}")
        import traceback
        traceback.print_exc()
        return {"error": "An unexpected error occurred during financial calculation."}