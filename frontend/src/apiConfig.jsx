// // src/apiConfig.js
// const dev = process.env.NODE_ENV === 'development';

// export const API_URL = process.env.REACT_APP_API_URL
//   ? process.env.REACT_APP_API_URL
//   : (dev ? 'http://localhost:5000' : '/api');

// // Full origin for WebSocket server (set this in the Vercel envs)
// export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL
//   || (dev ? 'http://localhost:5000' : 'http://142.93.175.252:5000');


// WEBSOCKET FIXES
// src/apiConfig.js
const dev = process.env.NODE_ENV === 'development';

export const SOCKET_ENABLED = process.env.NODE_ENV === 'development';

export const API_URL = dev ? 'http://localhost:5000' : '';   // 👈 EMPTY in prod

// Keep sockets pointing directly to your backend (needs HTTPS later)
export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || (dev ? 'http://localhost:5000' : 'https://142.93.175.252:5000');
