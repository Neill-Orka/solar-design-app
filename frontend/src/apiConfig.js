// src/apiConfig.js
const dev = process.env.NODE_ENV === 'development';

export const API_URL = 

process.env.REACT_APP_API_URL

? process.env.REACT_APP_API_URL
: (dev 
    ? 'http://localhost:5000'
    : '/api'
  );