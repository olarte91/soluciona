import { NearbyTechnician } from '../models/technician.model';

/**
 * Datos mock piloto (TRL5) para Armenia, Quindío cuando no hay registros en Supabase o se corre en modo demo.
 */
export const MOCK_ARMENIA_TECHNICIANS: NearbyTechnician[] = [
  {
    technician_id: 'tech-1',
    full_name: 'Carlos Alberto Restrepo',
    specialty: 'Plomería',
    is_verified: true,
    rating_avg: 4.9,
    latitude: 4.5420,
    longitude: -75.6680,
    distance_km: 0.6,
    bio: 'Especialista en fugas, motobombas y tuberías de alta presión. 12 años en el Quindío.',
    hourly_rate: 35000
  },
  {
    technician_id: 'tech-2',
    full_name: 'Jhon Jairo Morales',
    specialty: 'Electricidad',
    is_verified: true,
    rating_avg: 4.8,
    latitude: 4.5310,
    longitude: -75.6790,
    distance_km: 1.2,
    bio: 'Técnico electricista certificado Conte. Cortocircuitos, cableado estructurado e iluminación LED.',
    hourly_rate: 40000
  },
  {
    technician_id: 'tech-3',
    full_name: 'Hernán Darío Valencia',
    specialty: 'Pintura',
    is_verified: true,
    rating_avg: 4.7,
    latitude: 4.5510,
    longitude: -75.6610,
    distance_km: 1.8,
    bio: 'Pintura de fachadas, interiores, estuco veneciano e impermeabilización de terrazas.',
    hourly_rate: 30000
  },
  {
    technician_id: 'tech-4',
    full_name: 'Albeiro Cardona',
    specialty: 'Albañilería',
    is_verified: false,
    rating_avg: 4.5,
    latitude: 4.5260,
    longitude: -75.6820,
    distance_km: 2.1,
    bio: 'Enchapes de cerámica, porcelanato, reparaciones de muros y repellos en Armenia.',
    hourly_rate: 38000
  },
  {
    technician_id: 'tech-5',
    full_name: 'Guillermo León Echeverri',
    specialty: 'Plomería',
    is_verified: true,
    rating_avg: 4.95,
    latitude: 4.5580,
    longitude: -75.6550,
    distance_km: 2.9,
    bio: 'Destape de cañerías con sonda eléctrica, griferías y calentadores de paso.',
    hourly_rate: 36000
  },
  {
    technician_id: 'tech-6',
    full_name: 'Mauricio Blandón',
    specialty: 'Cerrajería',
    is_verified: true,
    rating_avg: 4.6,
    latitude: 4.5360,
    longitude: -75.6740,
    distance_km: 0.4,
    bio: 'Apertura de cerraduras de seguridad, duplicados y cambio de guardas 24/7.',
    hourly_rate: 30000
  }
];

