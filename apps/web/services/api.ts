/**
 * Shared Axios instance for all frontend API calls.
 * Configured with the backend base URL and default JSON headers.
 */
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  headers: { "Content-Type": "application/json" },
});
