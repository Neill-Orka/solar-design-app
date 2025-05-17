# import_batteries.py

from models import db, Product
from app import app
import pandas as pd
import re

def parse_brand_model(description):
    if not isinstance(description, str):
        return "", ""
    parts = description.split(" ", 1)
    return parts[0].strip(), parts[1].strip() if len(parts) > 1 else ""

def extract_capacity_kwh(text):
    if not isinstance(text, str):
        return None

    # Match standard kWh values like "10kWh", "200.2 kWh"
    match = re.search(r'(\d{1,4}(?:\.\d+)?)\s*kWh', text, re.IGNORECASE)
    if match:
        return float(match.group(1))

    return None

def import_batteries_from_excel(path):
    df = pd.read_excel(path, sheet_name='COS', skiprows=2)
    df = df.rename(columns={
        'Component Type': 'component_type',
        'Description': 'description',
        'Supplier': 'supplier',
        'Unit Cost': 'unit_cost',
        'Qty': 'quantity'
    })

    df = df[df['component_type'].str.lower().str.contains("battery", na=False)]
    df = df[~df['description'].str.lower().str.contains("rack|cable|support", na=False)]
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
    df['unit_cost'] = pd.to_numeric(df['unit_cost'], errors='coerce')
    df['unit_price'] = (df['unit_cost'] * 1.25).round(2)
    df = df.reset_index(drop=True)

    with app.app_context():
        count = 0
        for _, row in df.iterrows():
            brand, model = parse_brand_model(row["description"])
            if Product.query.filter_by(brand=brand, model=model).first():
                continue  # Skip duplicate

            capacity = extract_capacity_kwh(row["description"]) or extract_capacity_kwh(model)

            new_product = Product(
                category="battery",
                brand=brand,
                model=model,
                cost=row["unit_cost"],
                price=row["unit_price"],
                capacity_kwh=capacity,
                notes=f"Supplier: {row['supplier']}" if pd.notna(row["supplier"]) else None
            )
            db.session.add(new_product)
            count += 1
        db.session.commit()
        print(f"✅ Imported {count} new batteries.")

if __name__ == "__main__":
    import_batteries_from_excel("Products.xlsx")
