# services/tariff_engine.py
from datetime import datetime, time
from decimal import Decimal, getcontext

getcontext().prec = 12

# --- 1. Define Tariff Constants ---
HIGH_SEASON_MONTHS = {6, 7, 8}

# Time-of-Use blocks for weekdays
WEEKDAY_TOU_HIGH = {
    'peak':     [(time(6), time(7, 59, 59)), (time(17), time(19, 59, 59))],
    'standard': [(time(8), time(16, 59, 59)), (time(20), time(21, 59, 59))],
    'off_peak': [(time(0), time(5, 59, 59)), (time(22), time(23, 59, 59))]
}

SATURDAY_TOU_HIGH = {
    'standard': [(time(7), time(11, 59, 59))],
    'off_peak': [(time(0), time(6, 59, 59)), (time(12), time(23, 59, 59))]
} 

SUNDAY_TOU_HIGH = {
    'standard': [(time(17), time(18, 59, 59))],
    'off_peak': [(time(0), time(16, 59, 59)), (time(19), time(23, 59, 59))]
}

WEEKDAY_TOU_LOW = {
    'peak':     [(time(7), time(8, 59, 59)), (time(18), time(20, 59, 59))],
    'standard': [(time(6), time(6, 59, 59)), (time(9), time(17, 59, 59)), (time(21), time(22, 59, 59))],
    'off_peak': [(time(0), time(5, 59, 59)), (time(22), time(23, 59, 59))]
}

SATURDAY_TOU_LOW = {
    'standard': [(time(7), time(11, 59, 59)), (time(18), time(19, 59, 59))],
    'off_peak': [(time(0), time(6, 59, 59)), (time(12), time(17, 59, 59)), (time(20), time(23, 59, 59))]
} 

SUNDAY_TOU_LOW = {
    'standard': [(time(18), time(19, 59, 59))],
    'off_peak': [(time(0), time(17, 59, 59)), (time(20), time(23, 59, 59))]
}

class TariffEngine:
    """
    A comprehensive engine to process and calculate costs based on complex tariff structures.
    """

    def __init__(self, tariff_json: dict):
        self.tariff_name = tariff_json.get('name', 'Unknown Tariff')
        self.processed_rates = self._process_rates(tariff_json.get('rates', []))

    def _process_rates(self, rates_list: list) -> dict:
        """Transforms the flat list of rate objects into a structured dictionary for fast lookups."""
        processed = {
            'energy': {
                'high': {'peak': Decimal(0), 'standard': Decimal(0), 'off_peak': Decimal(0)},
                'low': {'peak': Decimal(0), 'standard': Decimal(0), 'off_peak': Decimal(0)},
                'all': {'all': Decimal(0)}
            },
            'fixed': {'all': {'all': Decimal(0)}},
            'demand': {
                'high': {'peak': Decimal(0), 'standard': Decimal(0), 'off_peak': Decimal(0)},
                'low': {'peak': Decimal(0), 'standard': Decimal(0), 'off_peak': Decimal(0)},
                'all': {'all': Decimal(0)}
            }
        }
        for rate in rates_list:
            category, value_str, unit, season, tou = (
                rate.get('charge_category'), rate.get('rate_value', '0'),
                rate.get('rate_unit', ''), rate.get('season', 'all'),
                rate.get('time_of_use', 'all')
            )
            if not category or not value_str: continue
            
            value = Decimal(value_str)
            if 'c/kWh' in unit: value /= 100

            if category in processed:
                target_dict = processed[category]
                # Handle specific seasonal/ToU rates
                if season != 'all' and tou != 'all' and season in target_dict and tou in target_dict[season]:
                    target_dict[season][tou] += value
                # Handle 'all-all' rates that apply universally within a category
                elif season == 'all' and tou == 'all':
                    target_dict['all']['all'] += value

        return processed

    def _get_time_attributes(self, timestamp: datetime) -> (str, str):
        """Determines the season and ToU block for a given timestamp."""
        season = 'high' if timestamp.month in HIGH_SEASON_MONTHS else 'low'
        date_str = timestamp.strftime('%Y-%m-%d')
        day_of_week = timestamp.weekday()  # Monday is 0, Sunday is 6

        # Select the correct ToU map based on season and day of the week
        tou_map = None
        # A public holiday follows the Sunday schedule
        if season == 'high':
            if day_of_week == 5: tou_map = SATURDAY_TOU_HIGH
            elif day_of_week == 6: tou_map = SUNDAY_TOU_HIGH
            else: tou_map = WEEKDAY_TOU_HIGH
        else:  # Low season
            if day_of_week == 5: tou_map = SATURDAY_TOU_LOW
            elif day_of_week == 6: tou_map = SUNDAY_TOU_LOW
            else: tou_map = WEEKDAY_TOU_LOW
        
        # Find the corresponding ToU block for the current time
        current_time = timestamp.time()
        # Default to off_peak if no specific block is found
        tou_block = 'off_peak'
        for block, time_ranges in tou_map.items():
            for start, end in time_ranges:
                if start <= current_time <= end:
                    tou_block = block
                    # Break inner loop once matched
                    break
            else:
                # Continue if the inner loop wasn't broken
                continue
            # Break outer loop once matched
            break

        return season, tou_block

    def get_energy_rate_r_per_kwh(self, timestamp: datetime) -> Decimal:
        """Gets the total applicable energy rate (R/kWh) for a specific timestamp."""
        season, tou_block = self._get_time_attributes(timestamp)
        time_based_rate = self.processed_rates['energy'][season].get(tou_block, Decimal(0))
        ancillary_rate = self.processed_rates['energy']['all'].get('all', Decimal(0))
        return time_based_rate + ancillary_rate

    def get_fixed_rate_r_per_day(self) -> Decimal:
        """Gets the total daily fixed charge in Rands."""
        return self.processed_rates['fixed']['all'].get('all', Decimal(0))

    def get_demand_rate_r_per_kva_per_month(self, timestamp: datetime) -> Decimal:
        """Gets the total applicable demand rate (R/kVA/month) for a specific timestamp."""
        season, tou_block = self._get_time_attributes(timestamp)
        time_based_rate = self.processed_rates['demand'][season].get(tou_block, Decimal(0))
        ancillary_rate = self.processed_rates['demand']['all'].get('all', Decimal(0))
        return time_based_rate + ancillary_rate

# --- Example Usage and Testing ---
if __name__ == '__main__':
    sample_tariff_json = {
        "id": 25, "name": "Complex TOU Tariff",
        "rates": [
            # High Season Energy
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "689.90", "season": "high", "time_of_use": "peak"},
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "209.89", "season": "high", "time_of_use": "standard"},
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "114.61", "season": "high", "time_of_use": "off_peak"},
            # Low Season Energy
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "225.90", "season": "low", "time_of_use": "peak"},
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "155.87", "season": "low", "time_of_use": "standard"},
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "99.38", "season": "low", "time_of_use": "off_peak"},
            # Fixed Charges
            {"charge_category": "fixed", "rate_unit": "R/POD/day", "rate_value": "9.44", "season": "all", "time_of_use": "all"},
            {"charge_category": "fixed", "rate_unit": "R/POD/day", "rate_value": "7.24", "season": "all", "time_of_use": "all"},
            # Ancillary Energy Charges (apply to every kWh)
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "0.90", "season": "all", "time_of_use": "all"},
            {"charge_category": "energy", "rate_unit": "c/kWh", "rate_value": "108.30", "season": "all", "time_of_use": "all"},
            # Demand Charge Example
            {"charge_category": "demand", "rate_unit": "R/kVA/month", "rate_value": "50.00", "season": "high", "time_of_use": "peak"}
        ]
    }
    
    engine = TariffEngine(sample_tariff_json)
    
    print(f"--- Testing Tariff Engine for: {engine.tariff_name} ---")
    
    test_cases = {
        "High Season - Weekday PEAK (Mon 7am)": datetime(2025, 7, 7, 7, 30),
        "High Season - SATURDAY Standard (Sat 8am)": datetime(2025, 7, 5, 8, 0),
        "High Season - SUNDAY Standard (Sun 5pm)": datetime(2025, 7, 6, 17, 30),
        "Low Season - Weekday PEAK (Tue 7pm)": datetime(2025, 4, 8, 19, 0),
        "Low Season - SATURDAY Standard (Sat 8pm)": datetime(2025, 4, 5, 20, 30),
        "Low Season - SUNDAY Off-Peak (Sun 9pm)": datetime(2025, 4, 6, 21, 30),
    }

    print("\n--- ENERGY RATE TESTS (R/kWh) ---")
    for name, ts in test_cases.items():
        rate = engine.get_energy_rate_r_per_kwh(ts)
        print(f"{name:<40}: R {rate:.4f}")
        
    print("\n--- FIXED RATE TESTS (R/day) ---")
    fixed_rate = engine.get_fixed_rate_r_per_day()
    print(f"Total Daily Fixed Charge: R {fixed_rate:.4f}")

    print("\n--- DEMAND RATE TESTS (R/kVA/month) ---")
    demand_ts = datetime(2025, 7, 7, 7, 30) # High Season, Peak
    demand_rate = engine.get_demand_rate_r_per_kva_per_month(demand_ts)
    print(f"Demand rate for {demand_ts.strftime('%B, %A at %H:%M')}: R {demand_rate:.4f}")

    demand_ts_offpeak = datetime(2025, 7, 7, 10, 30) # High Season, Standard
    demand_rate_offpeak = engine.get_demand_rate_r_per_kva_per_month(demand_ts_offpeak)
    print(f"Demand rate for {demand_ts_offpeak.strftime('%B, %A at %H:%M')}: R {demand_rate_offpeak:.4f} (should be 0)")