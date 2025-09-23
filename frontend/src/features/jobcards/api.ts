import axios from 'axios';
import { API_URL } from '../../../../frontend/src/apiConfig';
import type { JobCard, JobCardUpsert, JobCategory, Vehicle, TechnicianProfile } from './types';

const API = `${API_URL}/api`;


export async function listJobCards(): Promise<JobCard[]> {
    const { data } = await axios.get(`${API}/jobcards`);
    return data;
}

export async function getJobCard(id: number): Promise<JobCard> {
    const { data } = await axios.get(`${API}/jobcards/${id}`);
    return data;
}

export async function createJobCard(payload: JobCardUpsert): Promise<JobCard> {
    const { data } = await axios.post(`${API}/jobcards`, payload);
    return data;
}

export async function updateJobCard(id: number, payload: Partial<JobCardUpsert>): Promise<JobCard> {
    const { data } = await axios.put(`${API}/jobcards/${id}`, payload);
    return data;
}

export async function deleteJobCard(id: number): Promise<void> {
    await axios.delete(`${API}/jobcards/${id}`);
}

export async function listCategories(): Promise<JobCategory[]> {
    const { data } = await axios.get(`${API}/jobcategories`);
    return data;
}

export async function addCategory(name: string): Promise<JobCategory> {
    const { data } = await axios.post(`${API}/jobcategories`, { name });
    return data;
}

export async function updateCategory(id: number, name: string): Promise<JobCategory> {
    const { data } = await axios.put(`${API}/jobcategories/${id}`, { name });
    return data;
}

export async function deleteCategory(id: number): Promise<void> {
    await axios.delete(`${API}/jobcategories/${id}`);
}

export async function listVehicles(): Promise<Vehicle[]> {
    const { data } = await axios.get(`${API}/vehicles`);
    return data;
}

export async function addVehicle(vehicle: Vehicle): Promise<Vehicle> {
    const { data } = await axios.post(`${API}/vehicles`, vehicle);
    return data;
}

export async function updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle> {
    const { data } = await axios.put(`${API}/vehicles/${id}`, vehicle);
    return data;
}

export async function deleteVehicle(id: number): Promise<void> {
    await axios.delete(`${API}/vehicles/${id}`);
}

export async function listTechnicians(): Promise<TechnicianProfile[]> {
    const { data } = await axios.get(`${API}/technicians`);
    return data;
}

export async function addTechnician(tech: TechnicianProfile): Promise<TechnicianProfile> {
    const { data } = await axios.post(`${API}/technicians`, tech);
    return data;
}

export async function updateTechnician(id: number, tech: Partial<TechnicianProfile>): Promise<TechnicianProfile> {
    const { data } = await axios.put(`${API}/technicians/${id}`, tech);
    return data;
}

export async function deleteTechnician(id: number): Promise<void> {
    await axios.delete(`${API}/technicians/${id}`);
}

