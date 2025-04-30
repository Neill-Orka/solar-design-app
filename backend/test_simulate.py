import requests

# URL of your local Flask app
url = "http://localhost:5000/api/simulate"

# Test payload
payload = {
    "client_id": 1,
    "system": {
        "panel_kw": 10,
        "battery_kwh": 5,
        "system_type": "hybrid"
    }
}

# Send POST request
response = requests.post(url, json=payload)

# Print the result
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
