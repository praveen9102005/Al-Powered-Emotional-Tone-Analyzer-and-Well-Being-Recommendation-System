const API_BASE =
    import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

export async function api(path, { token, ...options } = {}) {
    const isFormData =
        typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
        ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {...options, headers });
    } catch {
        throw new Error('Cannot reach the API. Start the FastAPI backend on port 8000.');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Something went wrong. Please try again.');
    }
    return data;
}