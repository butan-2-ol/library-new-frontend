const isElectron = navigator.userAgent.includes('Electron');

const CONFIG = {
    API_URL: "/api",
    SOCKET_URL: window.location.origin,
    MODEL_URL: isElectron
        ? "app-resources://models"
        : "/models"
};

window.CONFIG = CONFIG;