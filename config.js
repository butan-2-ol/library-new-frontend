// 1. Detect runtime environment automatically
const isElectron = navigator.userAgent.includes('Electron');
const isLocalBrowser = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// 2. Automatically resolve host domain:
// If running in local browser OR Electron dev mode -> localhost
// Otherwise (Vercel, deployed domain) -> Render backend
const PRODUCTION_BACKEND = "https://library-new-backend.onrender.com";
const LOCAL_BACKEND = "http://localhost:5002";

const BASE_HTTP = isLocalBrowser ? LOCAL_BACKEND : PRODUCTION_BACKEND;

// 3. Unified Configuration
const CONFIG = {
    API_URL: isElectron 
        ? `${BASE_HTTP}/api`
        : (isLocalBrowser ? `${LOCAL_BACKEND}/api` : `${PRODUCTION_BACKEND}/api`),

    SOCKET_URL: isElectron 
        ? BASE_HTTP 
        : (isLocalBrowser ? LOCAL_BACKEND : PRODUCTION_BACKEND),

    MODEL_URL: isElectron 
        ? "app-resources://models" 
        : "/models"
};

window.CONFIG = CONFIG;