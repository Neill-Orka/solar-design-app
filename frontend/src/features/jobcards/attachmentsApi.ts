// src/features/jobcards/attachmentsApi.ts
import axios from 'axios';
import type { JobCardAttachment } from './types';
import { API_URL } from '../../apiConfig'; // or your helper

const API = `${API_URL}/api`;

export async function uploadAttachment(jobId: number, file: File): Promise<JobCardAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await axios.post(`${API}/jobcards/${jobId}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteAttachment(jobId: number, attachmentId: number): Promise<void> {
  await axios.delete(`${API}/jobcards/${jobId}/attachments/${attachmentId}`);
}
