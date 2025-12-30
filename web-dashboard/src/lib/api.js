import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://q-tech-production.up.railway.app/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // Handle network errors
    if (!error.response) {
      const networkError = {
        success: false,
        error: {
          message: 'Network error. Please check your connection and try again.',
        },
      };
      return Promise.reject(networkError);
    }

    // Handle 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const forbiddenError = {
        success: false,
        error: {
          message: 'You do not have permission to perform this action.',
        },
      };
      return Promise.reject(forbiddenError);
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      const notFoundError = {
        success: false,
        error: {
          message: 'The requested resource was not found.',
        },
      };
      return Promise.reject(notFoundError);
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      const serverError = {
        success: false,
        error: {
          message: 'Server error. Please try again later.',
        },
      };
      return Promise.reject(serverError);
    }

    // Return the error response data if available, otherwise return a generic error
    return Promise.reject(
      error.response?.data || {
        success: false,
        error: {
          message: error.message || 'An unexpected error occurred',
        },
      }
    );
  }
);

export default apiClient;

