import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // Verifica si el cliente tiene credenciales configuradas distintas a placeholder
  get isConfigured(): boolean {
    return (
      Boolean(environment.supabaseUrl) &&
      Boolean(environment.supabaseKey) &&
      !environment.supabaseUrl.includes('placeholder') &&
      !environment.supabaseKey.includes('placeholder')
    );
  }
}

