const isElectron = navigator.userAgent.includes('Electron');

// 1. Detect if we are running locally in a web browser (like Live Server)
const isLocalBrowser = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

const CONFIG = {
    // 2. Route dynamically: 
    // If Electron/Vercel Monorepo -> use relative path
    // If Live Server -> point explicitly to your local Node server port (e.g., 3000)
    // Otherwise -> point to your production hosted backend URL
    API_URL: isElectron 
        ? "/api" 
        : isLocalBrowser 
            ? "http://localhost:5002/api"  // 
            
            : "https://library-new-backend.onrender.com/api", // 
            
    SOCKET_URL: isElectron
        ? window.location.origin
        : isLocalBrowser
            ? "http://localhost:5002"
            : "https://library-new-backend.onrender.com",

    MODEL_URL: isElectron
        ? "app-resources://models"
        : "/models"
};

window.CONFIG = CONFIG;