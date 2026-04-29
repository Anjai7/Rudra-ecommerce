import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach auth token
apiClient.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    // Get token from Supabase session
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    );
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      config.headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  }

  // Dev logging
  if (process.env.NODE_ENV === 'development') {
    console.info(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  }

  return config;
});

// Response interceptor: handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired — try refresh
      if (typeof window !== 'undefined') {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        );
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          // Redirect to login
          window.location.href = '/auth/login';
        } else {
          // Retry original request
          return apiClient(error.config);
        }
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('[API Error]', error.response?.data || error.message);
    }

    return Promise.reject(error);
  },
);
