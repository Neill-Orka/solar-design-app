#!/usr/bin/env python3

import requests

try:
    response = requests.get('http://127.0.0.1:5000/api/quotes/16')
    print(f'Status Code: {response.status_code}')
    if response.status_code == 200:
        print('Quote found successfully!')
        data = response.json()
        print(f'Quote ID: {data["id"]}, Number: {data["number"]}')
        print(f'Project ID: {data["project_id"]}')
    else:
        print(f'Error Response: {response.text}')
except Exception as e:
    print(f'Connection Error: {e}')
