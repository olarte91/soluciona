import { UserProfile } from './user.model';
import { TechnicianProfile } from './technician.model';

export type ServiceStatus = 'abierta' | 'en_proceso' | 'completada' | 'cancelada';

export interface ServiceRequest {
  id: string; // UUID
  client_id: string;
  technician_id?: string | null;
  specialty_required: string;
  description: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  status: ServiceStatus;
  created_at: string;
  client?: UserProfile;
  technician?: TechnicianProfile | UserProfile;
}

export interface ChatMessage {
  id: string; // UUID
  request_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  sender?: UserProfile;
}

export interface Review {
  id: string; // UUID
  request_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number; // 1 to 5
  comment?: string | null;
  created_at: string;
  reviewer?: UserProfile;
}

