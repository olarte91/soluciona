export type UserRole = 'cliente' | 'tecnico';

export interface UserProfile {
  id: string; // UUID from auth.users
  email: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  created_at: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  // Campos opcionales para rol tecnico en el registro
  specialty?: string;
  bio?: string;
  hourlyRate?: number;
  latitude?: number;
  longitude?: number;
}

