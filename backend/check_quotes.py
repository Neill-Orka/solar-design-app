#!/usr/bin/env python3

from models import db, Document, DocumentKind
from app import app

with app.app_context():
    print('Documents in DB:')
    docs = Document.query.all()
    print(f'Total documents: {len(docs)}')
    
    for d in docs:
        print(f'ID: {d.id}, Kind: {d.kind}, Number: {d.number}, Status: {d.status}')
    
    print('\nQuotes only:')
    quotes = Document.query.filter_by(kind=DocumentKind.QUOTE).all()
    print(f'Total quotes: {len(quotes)}')
    
    for q in quotes:
        print(f'Quote ID: {q.id}, Number: {q.number}, Status: {q.status}, Project: {q.project_id}')
