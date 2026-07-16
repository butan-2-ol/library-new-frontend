const isProduction = false;
const isElectron = navigator.userAgent.includes('Electron');

const CONFIG = {
    API_URL: isProduction 
        ? "https://library-new-backend.onrender.com/api" 
        : "http://localhost:5002/api",
    SOCKET_URL: isProduction
        ? "https://library-new-backend.onrender.com"
        : "http://localhost:5002",
    MODEL_URL: isElectron
        ? "app-resources://models"
        : isProduction
            ? "/models"
            : "/library_new_frontend/models"
};

window.CONFIG = CONFIG;