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
// const dev = process.env.NODE_ENV === 'development';

// export const SOCKET_ENABLED = process.env.NODE_ENV === 'development';

// export const API_URL = dev ? 'http://localhost:5000' : '';   // 👈 EMPTY in prod

// // Keep sockets pointing directly to your backend (needs HTTPS later)
// export const SOCKET_URL =
//   process.env.REACT_APP_SOCKET_URL || (dev ? 'http://localhost:5000' : 'https://142.93.175.252:5000');

// NA nuwe subdomain gekry is
const dev =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV === "development") ||
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.DEV);

const viteApi =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_API_URL;
const craApi =
  typeof process !== "undefined" &&
  process.env &&
  process.env.REACT_APP_API_URL;

const PROD_API_FALLBACK = "https://api.orkasolar.co.za";

export const API_URL = dev
  ? "http://localhost:5000"
  : viteApi || craApi || PROD_API_FALLBACK;

// Socket.IO Works fine when you give it the same HTTPS origin as the API.
// It will upgrade to WSS automatically behind NGINX.
export const SOCKET_ENABLED = dev ? true : true;
export const SOCKET_URL = dev ? "http://localhost:5000" : API_URL;
