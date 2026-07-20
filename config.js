// 1. Environment Detection
const isElectron = navigator.userAgent.includes('Electron');
const isLocalBrowser = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. Set to 'true' while developing on your machine; set to 'false' before packaging the production .exe
const IS_DEV = true;

// 3. Resolve the Base HTTP Domain
const BASE_HTTP = IS_DEV 
    ? "http://localhost:5002" 
    : "https://library-new-backend.onrender.com";

// 4. Unified Configuration
const CONFIG = {
    // Electron MUST use absolute URLs (http/https). Browsers on Vercel can use relative or absolute.
    API_URL: isElectron 
        ? `${BASE_HTTP}/api`
        : (isLocalBrowser ? "http://localhost:5002/api" : `${BASE_HTTP}/api`),

    SOCKET_URL: isElectron 
        ? BASE_HTTP 
        : (isLocalBrowser ? "http://localhost:5002" : BASE_HTTP),

    MODEL_URL: isElectron 
        ? "app-resources://models" 
        : "/models"
};

window.CONFIG = CONFIG;