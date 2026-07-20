// 1. Detect runtime environment automatically
const isElectron = navigator.userAgent.includes('Electron');
const isLocalBrowser = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

const PRODUCTION_BACKEND = "https://library-new-backend.onrender.com";
const LOCAL_BACKEND = "http://localhost:5002";

// 2. TOGGLE THIS FLAG:
// Set to 'true' while running locally.
// Set to 'false' before building your final executable for distribution.
const IS_DEV = true;

// 3. Resolve host domain
const BASE_HTTP = (isLocalBrowser || (isElectron && IS_DEV)) 
    ? LOCAL_BACKEND 
    : PRODUCTION_BACKEND;

// 4. Unified Configuration
const CONFIG = {
    API_URL: `${BASE_HTTP}/api`,
    SOCKET_URL: BASE_HTTP,
    MODEL_URL: isElectron ? "app-resources://models" : "/models"
};

window.CONFIG = CONFIG;