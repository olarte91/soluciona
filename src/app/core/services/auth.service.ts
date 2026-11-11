import { Injectable, computed, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserProfile, RegisterDTO, UserRole } from '../models/user.model';
import { TechnicianProfile } from '../models/technician.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly _currentUser = signal<UserProfile | null>(null);
  public readonly currentUserSignal = this._currentUser.asReadonly();

  private readonly _currentTechProfile = signal<TechnicianProfile | null>(null);
  public readonly currentTechProfileSignal = this._currentTechProfile.asReadonly();

  public readonly isAuthenticatedSignal = computed(() => !!this._currentUser());

  constructor(private supabase: SupabaseService) {
    this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    // Si hay usuario en localStorage (útil tanto para Supabase como para modo demo)
    const cachedProfile = localStorage.getItem('soluciona_current_user');
    const cachedTech = localStorage.getItem('soluciona_current_tech');

    if (cachedProfile) {
      try {
        this._currentUser.set(JSON.parse(cachedProfile));
      } catch (e) {
        console.error('Error restaurando perfil en caché', e);
      }
    }

    if (cachedTech) {
      try {
        this._currentTechProfile.set(JSON.parse(cachedTech));
      } catch (e) {
        console.error('Error restaurando perfil técnico en caché', e);
      }
    }

    if (this.supabase.isConfigured) {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      if (session?.user) {
        await this.loadUserProfile(session.user.id);
      }

      this.supabase.client.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await this.loadUserProfile(session.user.id);
        } else {
          this.clearLocalSession();
        }
      });
    }
  }

  public async loadUserProfile(userId: string): Promise<UserProfile | null> {
    if (!this.supabase.isConfigured) {
      return this._currentUser();
    }

    try {
      const { data: profile, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        const userProfile = profile as UserProfile;
        this._currentUser.set(userProfile);
        localStorage.setItem('soluciona_current_user', JSON.stringify(userProfile));

        if (userProfile.role === 'tecnico') {
          const { data: techData } = await this.supabase.client
            .from('technician_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (techData) {
            this._currentTechProfile.set(techData as TechnicianProfile);
            localStorage.setItem('soluciona_current_tech', JSON.stringify(techData));
          }
        }

        return userProfile;
      }

      // Si no existe fila en profiles (PGRST116), la creamos automáticamente al instante
      const { data: authUserData } = await this.supabase.client.auth.getUser();
      const authUser = authUserData?.user;
      const email = authUser?.email || 'usuario@soluciona.co';
      const meta = authUser?.user_metadata || {};
      const fullName = meta['full_name'] || email.split('@')[0];
      const role: UserRole = meta['role'] === 'tecnico' ? 'tecnico' : 'cliente';

      const newProfile: UserProfile = {
        id: userId,
        email,
        full_name: fullName,
        phone: meta['phone'] || '3100000000',
        role,
        created_at: new Date().toISOString()
      };

      // Guardar en la base de datos
      try {
        await this.supabase.client.from('profiles').upsert(newProfile);
      } catch (upsertErr) {
        console.warn('Aviso guardando perfil automático:', upsertErr);
      }

      this._currentUser.set(newProfile);
      localStorage.setItem('soluciona_current_user', JSON.stringify(newProfile));

      if (role === 'tecnico') {
        const newTech: TechnicianProfile = {
          id: 'tech-' + userId,
          user_id: userId,
          specialty: meta['specialty'] || 'Servicios Generales',
          bio: meta['bio'] || 'Técnico certificado en Armenia, Quindío',
          hourly_rate: meta['hourly_rate'] || 35000,
          latitude: meta['latitude'] || 4.5389,
          longitude: meta['longitude'] || -75.6725,
          is_verified: false,
          rating_avg: 0,
          reviews_count: 0,
          created_at: new Date().toISOString()
        };

        try {
          await this.supabase.client.from('technician_profiles').upsert({
            user_id: userId,
            specialty: newTech.specialty,
            bio: newTech.bio,
            hourly_rate: newTech.hourly_rate,
            latitude: newTech.latitude,
            longitude: newTech.longitude,
            is_verified: false
          });
        } catch (techUpsertErr) {
          console.warn('Aviso guardando perfil técnico automático:', techUpsertErr);
        }

        this._currentTechProfile.set(newTech);
        localStorage.setItem('soluciona_current_tech', JSON.stringify(newTech));
      }

      return newProfile;
    } catch (e) {
      console.warn('Error recuperando o autogenerando perfil:', e);
      return null;
    }
  }

  private withTimeout<T>(promise: PromiseLike<T>, ms: number = 8000, errorMsg: string = 'Tiempo de espera agotado'): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
    ]);
  }

  public async register(dto: RegisterDTO): Promise<{ success: boolean; error?: string; message?: string; requiresEmailConfirmation?: boolean }> {
    // Modo de desarrollo / Demo si Supabase no está configurado todavía
    if (!this.supabase.isConfigured) {
      const mockId = 'demo-' + Math.random().toString(36).substring(2, 9);
      const newProfile: UserProfile = {
        id: mockId,
        email: dto.email,
        full_name: dto.fullName,
        phone: dto.phone || '3100000000',
        role: dto.role,
        created_at: new Date().toISOString()
      };

      this._currentUser.set(newProfile);
      localStorage.setItem('soluciona_current_user', JSON.stringify(newProfile));

      if (dto.role === 'tecnico') {
        const newTech: TechnicianProfile = {
          id: 'tech-' + mockId,
          user_id: mockId,
          specialty: dto.specialty || 'Plomería',
          bio: dto.bio || 'Técnico certificado en Armenia, Quindío',
          hourly_rate: dto.hourlyRate || 35000,
          latitude: dto.latitude || 4.5389,
          longitude: dto.longitude || -75.6725,
          is_verified: false,
          rating_avg: 0,
          reviews_count: 0,
          created_at: new Date().toISOString()
        };
        this._currentTechProfile.set(newTech);
        localStorage.setItem('soluciona_current_tech', JSON.stringify(newTech));
      }

      return { success: true };
    }

    try {
      // 1. Registro en Supabase Auth enviando todos los metadatos para el trigger de PostgreSQL
      const authResult = await this.withTimeout(
        this.supabase.client.auth.signUp({
          email: dto.email,
          password: dto.password,
          options: {
            data: {
              full_name: dto.fullName,
              role: dto.role,
              phone: dto.phone || '',
              specialty: dto.specialty || 'Servicios Generales',
              bio: dto.bio || '',
              hourly_rate: dto.hourlyRate || 35000,
              latitude: dto.latitude || 4.5389,
              longitude: dto.longitude || -75.6725
            }
          }
        }),
        8000,
        'Tiempo de espera agotado al conectar con Supabase. Verifica tu conexión a internet.'
      );

      const { data: authData, error: authError } = authResult;

      if (authError) {
        console.error('Detalle del error devuelto por Supabase Auth:', authError);
        let friendlyMsg = authError.message;
        const lower = friendlyMsg.toLowerCase();

        if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('duplicate')) {
          friendlyMsg = 'Este correo electrónico ya está registrado. Por favor inicia sesión con tu contraseña.';
        } else if (lower.includes('password') && (lower.includes('least') || lower.includes('short') || lower.includes('characters'))) {
          friendlyMsg = 'La contraseña debe tener mínimo 6 caracteres.';
        } else if (lower.includes('invalid email') || lower.includes('valid email')) {
          friendlyMsg = 'El formato del correo electrónico ingresado no es válido.';
        } else if (lower.includes('rate limit') || lower.includes('too many requests')) {
          friendlyMsg = 'Has realizado demasiados intentos en poco tiempo. Espera unos minutos antes de intentar de nuevo.';
        } else if (lower.includes('signup is disabled') || lower.includes('signups not allowed')) {
          friendlyMsg = 'El registro de nuevos usuarios está deshabilitado temporalmente en este proyecto de Supabase.';
        }

        return { success: false, error: friendlyMsg };
      }

      if (!authData.user) {
        return { success: false, error: 'No se recibió la confirmación del usuario desde Supabase.' };
      }

      const userId = authData.user.id;
      const hasSession = !!authData.session;

      // Crear el perfil base en caché local para navegación inmediata
      const newProfile: UserProfile = {
        id: userId,
        email: dto.email,
        full_name: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        created_at: new Date().toISOString()
      };
      this._currentUser.set(newProfile);
      localStorage.setItem('soluciona_current_user', JSON.stringify(newProfile));

      if (dto.role === 'tecnico') {
        const newTech: TechnicianProfile = {
          id: 'tech-' + userId,
          user_id: userId,
          specialty: dto.specialty || 'Servicios Generales',
          bio: dto.bio || '',
          hourly_rate: dto.hourlyRate || 35000,
          latitude: dto.latitude || 4.5389,
          longitude: dto.longitude || -75.6725,
          is_verified: false,
          rating_avg: 0,
          reviews_count: 0,
          created_at: new Date().toISOString()
        };
        this._currentTechProfile.set(newTech);
        localStorage.setItem('soluciona_current_tech', JSON.stringify(newTech));
      }

      // Si hay sesión activa (no requiere confirmación previa de correo), intentar sincronizar con base de datos
      if (hasSession) {
        try {
          await this.withTimeout(
            this.supabase.client.from('profiles').upsert({
              id: userId,
              email: dto.email,
              full_name: dto.fullName,
              phone: dto.phone,
              role: dto.role
            }),
            5000,
            'Tiempo de espera guardando perfil'
          );

          if (dto.role === 'tecnico') {
            await this.withTimeout(
              this.supabase.client.from('technician_profiles').upsert({
                user_id: userId,
                specialty: dto.specialty || 'Servicios Generales',
                bio: dto.bio || '',
                hourly_rate: dto.hourlyRate || 35000,
                latitude: dto.latitude || 4.5389,
                longitude: dto.longitude || -75.6725,
                is_verified: false
              }),
              5000,
              'Tiempo de espera guardando perfil técnico'
            );
          }
        } catch (e: any) {
          console.warn('Sincronización manual en base de datos omitida (gestionada por trigger):', e.message);
        }
      }

      return {
        success: true,
        requiresEmailConfirmation: !hasSession,
        message: !hasSession
          ? 'Cuenta creada con éxito. Por favor verifica tu correo electrónico para confirmar la activación.'
          : undefined
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error inesperado durante el registro.'
      };
    }
  }

  public async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase.isConfigured) {
      // Modo Demo local
      const isTech = email.toLowerCase().includes('tecnico');
      const mockId = isTech ? 'demo-tech-01' : 'demo-client-01';
      const role: UserRole = isTech ? 'tecnico' : 'cliente';
      const userProfile: UserProfile = {
        id: mockId,
        email,
        full_name: isTech ? 'Carlos Alberto Restrepo' : 'María Elena Gómez',
        phone: '3151234567',
        role,
        created_at: new Date().toISOString()
      };

      this._currentUser.set(userProfile);
      localStorage.setItem('soluciona_current_user', JSON.stringify(userProfile));

      if (role === 'tecnico') {
        const techData: TechnicianProfile = {
          id: 'tech-profile-demo-01',
          user_id: mockId,
          specialty: 'Plomería y Redes Hidráulicas',
          bio: 'Especialista en fugas, tuberías PVC e instalaciones hidrosanitarias en Armenia.',
          hourly_rate: 35000,
          latitude: 4.5389,
          longitude: -75.6725,
          is_verified: true,
          rating_avg: 4.8,
          reviews_count: 14,
          created_at: new Date().toISOString()
        };
        this._currentTechProfile.set(techData);
        localStorage.setItem('soluciona_current_tech', JSON.stringify(techData));
      }

      return { success: true };
    }

    try {
      const loginResult = await this.withTimeout(
        this.supabase.client.auth.signInWithPassword({
          email,
          password
        }),
        5000,
        'Tiempo de espera agotado al conectar con Supabase. Verifica tus credenciales o conexión.'
      );

      const { data, error } = loginResult;

      if (error || !data.user) {
        console.error('Detalle de error en login de Supabase:', error);
        let errorMsg = error?.message || 'Credenciales inválidas';
        const lower = errorMsg.toLowerCase();

        if (lower.includes('email not confirmed')) {
          errorMsg = 'El correo electrónico no ha sido confirmado aún. Por favor confirma el enlace enviado a tu correo o confírmalo desde el panel de Supabase.';
        } else if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
          errorMsg = 'Correo electrónico o contraseña incorrectos.';
        } else if (lower.includes('user not found')) {
          errorMsg = 'No existe ninguna cuenta registrada con este correo electrónico.';
        }

        return { success: false, error: errorMsg };
      }

      await this.loadUserProfile(data.user.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al iniciar sesión' };
    }
  }

  public async updateTechnicianProfile(updates: {
    fullName?: string;
    phone?: string;
    specialty?: string;
    bio?: string;
    hourlyRate?: number;
  }): Promise<{ success: boolean; error?: string }> {
    const user = this._currentUser();
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    try {
      // 1. Actualizar objeto de usuario en memoria y localStorage
      const updatedUser: UserProfile = {
        ...user,
        full_name: updates.fullName || user.full_name,
        phone: updates.phone !== undefined ? updates.phone : user.phone
      };
      this._currentUser.set(updatedUser);
      localStorage.setItem('soluciona_current_user', JSON.stringify(updatedUser));

      // 2. Actualizar objeto técnico
      const currentTech = this._currentTechProfile();
      const updatedTech: TechnicianProfile = {
        id: currentTech?.id || 'tech-' + user.id,
        user_id: user.id,
        specialty: updates.specialty || currentTech?.specialty || 'Servicios Generales',
        bio: updates.bio !== undefined ? updates.bio : currentTech?.bio,
        hourly_rate: updates.hourlyRate !== undefined ? updates.hourlyRate : currentTech?.hourly_rate,
        latitude: currentTech?.latitude || 4.5389,
        longitude: currentTech?.longitude || -75.6725,
        is_verified: currentTech?.is_verified || false,
        rating_avg: currentTech?.rating_avg || 5.0,
        reviews_count: currentTech?.reviews_count || 0,
        created_at: currentTech?.created_at || new Date().toISOString()
      };
      this._currentTechProfile.set(updatedTech);
      localStorage.setItem('soluciona_current_tech', JSON.stringify(updatedTech));

      // 3. Persistir en Supabase si está configurado con timeout rápido
      if (this.supabase.isConfigured) {
        try {
          await this.withTimeout(
            this.supabase.client
              .from('profiles')
              .update({
                full_name: updatedUser.full_name,
                phone: updatedUser.phone
              })
              .eq('id', user.id),
            2500,
            'Timeout profiles'
          );

          await this.withTimeout(
            this.supabase.client
              .from('technician_profiles')
              .upsert({
                user_id: user.id,
                specialty: updatedTech.specialty,
                bio: updatedTech.bio,
                hourly_rate: updatedTech.hourly_rate
              }),
            2500,
            'Timeout technician_profiles'
          );
        } catch (dbErr: any) {
          console.warn('Aviso sincronizando en base de datos (guardado local asegurado):', dbErr.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al actualizar el perfil' };
    }
  }

  public async uploadIdDocument(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    const user = this._currentUser();
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    if (!this.supabase.isConfigured) {
      // Simulación en modo demo
      const fakeUrl = `https://supabase.local/storage/v1/object/public/id-documents/${user.id}/${file.name}`;
      this.updateLocalTechDocument(fakeUrl);
      return { success: true, url: fakeUrl };
    }

    try {
      const filePath = `${user.id}/id_card_${Date.now()}_${file.name}`;
      const { data, error } = await this.supabase.client.storage
        .from('id-documents')
        .upload(filePath, file, { upsert: true });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: publicData } = this.supabase.client.storage
        .from('id-documents')
        .getPublicUrl(filePath);

      const fileUrl = publicData?.publicUrl || filePath;

      // Actualizar técnico
      await this.supabase.client
        .from('technician_profiles')
        .update({ id_document_url: fileUrl, is_verified: false })
        .eq('user_id', user.id);

      this.updateLocalTechDocument(fileUrl, false);

      return { success: true, url: fileUrl };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al cargar el documento' };
    }
  }

  private updateLocalTechDocument(fileUrl: string, isVerified?: boolean): void {
    const currentTech = this._currentTechProfile();
    if (!currentTech) return;

    const updated: TechnicianProfile = {
      ...currentTech,
      id_document_url: fileUrl,
      ...(isVerified !== undefined ? { is_verified: isVerified } : {})
    };
    this._currentTechProfile.set(updated);
    localStorage.setItem('soluciona_current_tech', JSON.stringify(updated));
  }

  public async logout(): Promise<void> {
    if (this.supabase.isConfigured) {
      await this.supabase.client.auth.signOut();
    }
    this.clearLocalSession();
  }

  private clearLocalSession(): void {
    this._currentUser.set(null);
    this._currentTechProfile.set(null);
    localStorage.removeItem('soluciona_current_user');
    localStorage.removeItem('soluciona_current_tech');
  }

  public get currentUser(): UserProfile | null {
    return this._currentUser();
  }

  public get isAuthenticated(): boolean {
    return !!this._currentUser();
  }

  public get userRole(): UserRole | null {
    return this._currentUser()?.role || null;
  }
}

