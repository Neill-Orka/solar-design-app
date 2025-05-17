# import_inverters.py

from models import db, Product
from app import app  # Make sure your Flask app instance is defined in app.py
import pandas as pd
import re

def parse_brand_model(description):
    if not isinstance(description, str):
        return "", ""
    parts = description.split(" ", 1)
    return parts[0].strip(), parts[1].strip() if len(parts) > 1 else ""

def extract_rating_kva(text):
    if not isinstance(text, str):
        return None
    match = re.search(r'(\d{1,3}(?:\.\d+)?)\s*(kW|kVA)', text, re.IGNORECASE)
    if match:
        return float(match.group(1))
    return None

def import_inverters_from_excel(path):
    df = pd.read_excel(path, sheet_name='COS', skiprows=2)
    df = df.rename(columns={
        'Component Type': 'component_type',
        'Description': 'description',
        'Supplier': 'supplier',
        'Unit Cost': 'unit_cost',
        'Qty': 'quantity'
    })

    df = df[df['component_type'].str.lower().str.contains("inverter", na=False)]
    df = df[~df['description'].str.lower().str.contains("logger|support|commissioning|connection", na=False)]
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

            rating = extract_rating_kva(row["description"]) or extract_rating_kva(model)

            new_product = Product(
                category="inverter",
                brand=brand,
                model=model,
                cost=row["unit_cost"],
                price=row["unit_price"],
                rating_kva=rating,
                notes=f"Supplier: {row['supplier']}" if pd.notna(row["supplier"]) else None
            )
            db.session.add(new_product)
            count += 1
        db.session.commit()
        print(f"✅ Imported {count} new inverters.")

if __name__ == "__main__":
    import_inverters_from_excel("Products.xlsx")