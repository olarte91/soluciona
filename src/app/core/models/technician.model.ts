import { UserProfile } from './user.model';

export interface TechnicianProfile {
  id: string; // UUID
  user_id: string;
  specialty: string;
  bio?: string | null;
  hourly_rate?: number | null;
  latitude: number;
  longitude: number;
  is_verified: boolean;
  id_document_url?: string | null;
  rating_avg: number;
  reviews_count: number;
  created_at: string;
  profile?: UserProfile;
}

export interface NearbyTechnician {
  technician_id: string;
  full_name: string;
  specialty: string;
  is_verified: boolean;
  rating_avg: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  bio?: string;
  hourly_rate?: number;
}

