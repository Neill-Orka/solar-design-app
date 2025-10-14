import axios from "axios";
import { API_URL } from "../../apiConfig";

export async function createInvoice(
  projectId: number,
  payload: {
    type: "deposit" | "delivery" | "final";
    quote_number?: string;
    quote_version?: number;
    percent?: number;
    due_in_days?: number;
    billing?: {
      name?: string;
      company?: string;
      vat_no?: string;
      address?: string;
    };
  }
) {
  const { data } = await axios.post(
    `${API_URL}/api/projects/${projectId}/invoices`,
    payload
  );
  return data as { invoice_id: number; invoice_number: string };
}

export async function getInvoice(invoiceId: number) {
  const { data } = await axios.get(`${API_URL}/api/invoices/${invoiceId}`);
  return data;
}

export async function getProject(projectId: number) {
  const { data } = await axios.get(`${API_URL}/api/projects/${projectId}`);
  return data;
}

export async function getJobCard(jobCardId: number) {
  const { data } = await axios.get(`${API_URL}/api/jobcards/${jobCardId}`);
  return data;
}
