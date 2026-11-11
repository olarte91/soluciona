import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { NearbyTechnician } from '../models/technician.model';
import { MOCK_ARMENIA_TECHNICIANS } from '../data/mock-armenia-technicians';

@Injectable({
  providedIn: 'root'
})
export class GeoService {
  // Coordenadas centrales por defecto: Plaza de Bolívar, Armenia, Quindío
  public readonly DEFAULT_LAT = 4.5389;
  public readonly DEFAULT_LNG = -75.6725;
  public readonly DEFAULT_RADIUS = 15; // 15 km de cobertura urbana en Armenia

  constructor(private supabase: SupabaseService) {}

  public getCurrentCoordinates(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (err) => {
            console.warn('Geolocalización GPS denegada o no disponible, usando centro de Armenia:', err.message);
            resolve({ lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG });
          },
          { timeout: 7000 }
        );
      } else {
        resolve({ lat: this.DEFAULT_LAT, lng: this.DEFAULT_LNG });
      }
    });
  }

  public async getNearbyTechnicians(
    userLat: number,
    userLng: number,
    radiusKm: number = this.DEFAULT_RADIUS,
    specialtyFilter?: string
  ): Promise<NearbyTechnician[]> {
    let results: NearbyTechnician[] = [];

    if (this.supabase.isConfigured) {
      // 1. Consultar directamente las tablas technician_profiles y profiles
      try {
        const { data, error } = await this.supabase.client
          .from('technician_profiles')
          .select(`
            id,
            user_id,
            specialty,
            bio,
            hourly_rate,
            latitude,
            longitude,
            is_verified,
            rating_avg,
            reviews_count,
            profiles (
              full_name
            )
          `);

        if (!error && Array.isArray(data) && data.length > 0) {
          results = data.map((item: any) => {
            const lat = Number(item.latitude) || this.DEFAULT_LAT;
            const lng = Number(item.longitude) || this.DEFAULT_LNG;
            const dist = this.calculateHaversine(userLat, userLng, lat, lng);
            const rawAvg = item.rating_avg != null && Number(item.rating_avg) > 0 ? Number(item.rating_avg) : 5.0;

            return {
              technician_id: item.user_id || item.id,
              full_name: item.profiles?.full_name || 'Técnico Especialista en Armenia',
              specialty: item.specialty || 'Servicios Generales',
              is_verified: !!item.is_verified,
              rating_avg: Math.round(rawAvg * 10) / 10,
              latitude: lat,
              longitude: lng,
              distance_km: Math.round(dist * 10) / 10,
              bio: item.bio || 'Prestador de servicios técnicos en Armenia, Quindío.',
              hourly_rate: Number(item.hourly_rate) || 35000
            };
          }).filter((t) => t.distance_km <= radiusKm);
        }
      } catch (err) {
        console.warn('Aviso consultando technician_profiles en Supabase:', err);
      }

      // 2. Si no hubo resultados directos, intentar función RPC
      if (results.length === 0) {
        try {
          const rpcPromise = this.supabase.client.rpc('get_nearby_technicians', {
            user_lat: userLat,
            user_lng: userLng,
            radius_km: radiusKm
          });

          const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout RPC')), 2500)
          );

          const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
          if (!error && Array.isArray(data) && data.length > 0) {
            results = data.map((d: any) => ({
              ...d,
              rating_avg: d.rating_avg != null ? Math.round(Number(d.rating_avg) * 10) / 10 : 5.0
            }));
          }
        } catch {}
      }
    }

    // 3. Respaldo de demostración geolocalizada en Armenia solo si no hay técnicos registrados en la base
    if (results.length === 0) {
      results = MOCK_ARMENIA_TECHNICIANS.map((t) => {
        const d = this.calculateHaversine(userLat, userLng, t.latitude, t.longitude);
        return { ...t, distance_km: Math.round(d * 10) / 10 };
      }).filter((t) => t.distance_km <= radiusKm);
    }

    if (specialtyFilter && specialtyFilter !== 'todos') {
      results = results.filter((t) => t.specialty.toLowerCase().includes(specialtyFilter.toLowerCase()));
    }

    results.sort((a, b) => a.distance_km - b.distance_km);
    return results;
  }

  // Fórmula Haversine en TypeScript para fallback
  public calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

