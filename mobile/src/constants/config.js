/**
 * App Configuration
 * Update API_BASE_URL with your server IP address for device testing
 */

// For iOS Simulator / Android Emulator:
// export const API_BASE_URL = 'http://localhost:3000/api';

// For physical device (replace with your computer's IP address):
// Example: export const API_BASE_URL = 'http://192.168.1.100:3000/api';

// For production:
// export const API_BASE_URL = 'https://api.clsu-nexus.com/api';

// Production - Railway backend URL
export const API_BASE_URL = 'https://q-tech-production.up.railway.app/api';

// WebSocket URL - Must match API_BASE_URL domain
export const WS_URL = 'https://q-tech-production.up.railway.app';

// App Info
export const APP_NAME = 'QTech';
export const APP_VERSION = '1.0.0';

