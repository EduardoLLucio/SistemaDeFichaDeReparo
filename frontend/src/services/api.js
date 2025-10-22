import axios from "axios";


const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";
const USE_COOKIE = process.env.REACT_APP_USE_COOKIE === 'true';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: { Accept: "application/json" },
    withCredentials: USE_COOKIE,
    
});

// Anexa o token Bearer
api.interceptors.request.use(
    (config) => {
        config.headers = config.headers || {};
        if (!USE_COOKIE) {
            const token = localStorage.getItem("token");
            if (token && !config.headers['Authorization']) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);


//Trata 401 globalmente
api.interceptors.response.use(
    (res) => res,
    (err) => {
        try{
            if (err?.response?.status === 401) {
                localStorage.removeItem("token");          // logout
                if (window.location.pathname !== "/") {    // volta para o login
                    window.location.replace("/");
                }
            }
        } catch (e) {
            console.error("Erro no interceptor de resposta:", e);
        }
        return Promise.reject(err);
    }
);
export default api;