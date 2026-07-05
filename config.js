const isProduction = true; // keep false for now, switch when deploying

const CONFIG = {
    API_URL: isProduction 
        ? "https://library-new-backend.onrender.com/api" 
        : "http://localhost:5002/api",
    SOCKET_URL: isProduction
        ? "https://library-new-backend.onrender.com"
        : "http://localhost:5002",
    MODEL_URL: isProduction 
        ? "/models" 
        : "/library_2_frontend_face/models"
};

window.CONFIG = CONFIG;