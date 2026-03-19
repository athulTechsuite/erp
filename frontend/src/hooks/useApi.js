import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const useApi = () => {
  const { token, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiRequest = useCallback(async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        ...options,
      };

      if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, config);
      
      if (response.status === 401) {
        logout();
        throw new Error('Unauthorized access. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  const get = useCallback((endpoint) => {
    return apiRequest(endpoint, { method: 'GET' });
  }, [apiRequest]);

  const post = useCallback((endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: data,
    });
  }, [apiRequest]);

  const put = useCallback((endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: data,
    });
  }, [apiRequest]);

  const del = useCallback((endpoint) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  }, [apiRequest]);

  const patch = useCallback((endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PATCH',
      body: data,
    });
  }, [apiRequest]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    get,
    post,
    put,
    delete: del,
    patch,
    apiRequest,
  };
};

export const useApiCall = (endpoint, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { apiRequest } = useApi();

  const execute = useCallback(async (customEndpoint = endpoint, customOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiRequest(customEndpoint, { ...options, ...customOptions });
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, options, apiRequest]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
};

export const useFetch = (endpoint, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { get } = useApi();

  const refetch = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    setError(null);

    try {
      const result = await get(endpoint);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, get]);

  useEffect(() => {
    refetch();
  }, [refetch, ...dependencies]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export default useApi;