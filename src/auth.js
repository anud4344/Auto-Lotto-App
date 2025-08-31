// Authentication to connect to localStorage and backend 
export const TOKEN_KEY = 'auth_token'; 

// JSON web tokens (JWT) are used to connect to the browser's localStorage
// to persistently save the token saying that user has successfully authenticated.
// I.e. user has logged in so we save that info to browser. 
export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
}

// Need to READ JWT from localStorage 
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// On logout, need to remove the JWT 
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// Function to say true or false if current user is authenticated 
export function isAuthed() {
    return !!getToken();
}