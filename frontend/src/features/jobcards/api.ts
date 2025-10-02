import axios from 'axios';
import { API_URL } from '../../../../frontend/src/apiConfig';
import type { JobCard, JobCardUpsert, JobCategory, Vehicle, TechnicianProfile, Product, Client } from './types';

const http = axios.create({ baseURL: `${API_URL}/api` });

export function setAuthToken(token?: string | null) {
    if (token) http.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    else delete http.defaults.headers.common['Authorization'];
}

http.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token && !config.headers?.Authorization) {
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    }
    return config;
});

// auto refresh on 401 once, then retry 
let isRefreshing = false;
let queued: Array<(t: string | null) => void> = [];

http.interceptors.response.use(
    (res) => res,
    async (err) => {
        const status = err?.response?.status;
        const original = err.config;

        if (status === 401 && !original._retry) {
            original._retry = true;

            if (!isRefreshing) {
                isRefreshing = true;
                try {
                    const refresh_token = localStorage.getItem('refresh_token');
                    if (!refresh_token) throw new Error('No refresh token');

                    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token });
                    const newToken = data.access_token as string;

                    localStorage.setItem('access_token', newToken);
                    setAuthToken(newToken);

                    queued.forEach((fn) => fn(newToken));
                    queued = [];
                } catch (e) {
                    queued.forEach((fn) => fn(null));
                    queued = [];
                    // drop tokens so app can redirect to login
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    setAuthToken(null);
                    return Promise.reject(e);
                } finally {
                    isRefreshing = false;
                }
            }

            return new Promise((resolve, reject) => {
                queued.push((token) => {
                    if (!token) return reject(err);
                    original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}`};
                    resolve(http(original));
                });
            });
        }   

        return Promise.reject(err);
    }
);

export async function listJobCards(): Promise<JobCard[]> {
    const { data } = await http.get('/jobcards');
    return data;
}

export async function getJobCard(id: number): Promise<JobCard> {
    const { data } = await http.get(`/jobcards/${id}`);
    return data;
}

export async function createJobCard(payload: JobCardUpsert): Promise<JobCard> {
    const { data } = await http.post(`/jobcards`, payload);
    return data;
}

export async function updateJobCard(id: number, payload: Partial<JobCardUpsert>): Promise<JobCard> {
    const { data } = await http.put(`/jobcards/${id}`, payload);
    return data;
}

export async function deleteJobCard(id: number): Promise<void> {
    await http.delete(`/jobcards/${id}`);
}

export async function listCategories(): Promise<JobCategory[]> {
    const { data } = await http.get(`/jobcategories`);
    return data;
}

export async function addCategory(name: string): Promise<JobCategory> {
    const { data } = await http.post(`/jobcategories`, { name });
    return data;
}

export async function updateCategory(id: number, name: string): Promise<JobCategory> {
    const { data } = await http.put(`/jobcategories/${id}`, { name });
    return data;
}

export async function deleteCategory(id: number): Promise<void> {
    await http.delete(`/jobcategories/${id}`);
}

export async function listVehicles(): Promise<Vehicle[]> {
    const { data } = await http.get(`/vehicles`);
    return data;
}

export async function addVehicle(vehicle: Vehicle): Promise<Vehicle> {
    const { data } = await http.post(`/vehicles`, vehicle);
    return data;
}

export async function updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle> {
    const { data } = await http.put(`/vehicles/${id}`, vehicle);
    return data;
}

export async function deleteVehicle(id: number): Promise<void> {
    await http.delete(`/vehicles/${id}`);
}

export async function listTechnicians(): Promise<TechnicianProfile[]> {
    const { data } = await http.get(`/technicians`);
    return data;
}

export async function addTechnician(tech: TechnicianProfile): Promise<TechnicianProfile> {
    const { data } = await http.post(`/technicians`, tech);
    return data;
}

export async function updateTechnician(id: number, tech: Partial<TechnicianProfile>): Promise<TechnicianProfile> {
    const { data } = await http.put(`/technicians/${id}`, tech);
    return data;
}

export async function deleteTechnician(id: number): Promise<void> {
    await http.delete(`/technicians/${id}`);
}

export async function listProducts(params? : {
    q?: string;
    category?: string;
    limit?: number;
    offset?: number;
}): Promise<Product[]> {
    const { data } = await http.get(`/products`, { params });
    return data;
}


// Clients API calls

// GET /clients
export async function listClients(signal?: AbortSignal): Promise<Client[]> {
    const { data } = await http.get(`/clients`, { signal });
    return data;
}

// GET /clients/:id
export async function getClient(id: number): Promise<Client> {
    const { data } = await http.get(`/clients/${id}`);
    return data;
}

// POST /clients
export async function createClient(payload: Omit<Client, "id">): Promise<{ message: string; client_id: number }> {
  const { data } = await http.post(`/clients`, payload);
  return data;
}

// PUT /clients/:id
export async function updateClient(id: number, payload: Partial<Client>): Promise<{ message: string }> {
  const { data } = await http.put(`/clients/${id}`, payload);
  return data;
}

// DELETE /clients/:id  (JWT + admin on server)
export async function deleteClient(id: number): Promise<{ message: string }> {
  const { data } = await http.delete(`/clients/${id}`);
  return data;
}


// Client's Projects API CALLS
export async function listClientProjects(clientId: number): Promise<any[]> {
    const { data } = await http.get(`/projects?client_id=${clientId}`);
    return data;
}

// Materials / Accepted Quotes API Calls
export async function getAcceptedQuotes(projectId: number): Promise<any[]> {
  const { data } = await http.get(`/jobcards/projects/${projectId}/accepted_quotes`);
  return data;
}

export async function getQuoteLineItems(quoteId: number): Promise<any> {
  const { data } = await http.get(`/jobcards/quotes/${quoteId}/line_items`);
  return data;
}

export async function uploadMaterialReceipt(
  jobCardId: number, 
  materialId: number, 
  file: File
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data } = await http.post(
    `/jobcards/${jobCardId}/material-receipts/${materialId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return data;
}

export async function createJobCardMaterial(payload: {
  job_card_id: number;
  product_id: number;
  quantity: number;
  unit_price_at_time?: number;
  unit_cost_at_time?: number;
  note?: string;
}): Promise<any> {
  const { data } = await http.post('/jobcards/materials', payload);
  return data;
}

export { http }; 