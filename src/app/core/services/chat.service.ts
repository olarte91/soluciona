import { Injectable, NgZone, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ChatMessage, ServiceRequest, ServiceStatus, Review } from '../models/service.model';
import { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private activeChannel: RealtimeChannel | null = null;
  private readonly _messages = signal<ChatMessage[]>([]);
  public readonly messages = this._messages.asReadonly();

  private readonly STORAGE_KEY = 'soluciona_user_requests';

  // Colecciones vacías: Solo se muestran los datos reales de la base de datos de Supabase
  private mockRequests: ServiceRequest[] = [];
  private mockMessages: Record<string, ChatMessage[]> = {};

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private zone: NgZone
  ) {}

  public getCachedRequests(): ServiceRequest[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filtrar cualquier solicitud demo previa (req-001, req-002, etc.)
          const clean = parsed.filter(
            (r) => !r.id.startsWith('req-00') && !r.id.startsWith('req-demo') && r.client_id !== 'demo-client-01'
          );
          if (clean.length !== parsed.length) {
            this.saveCachedRequests(clean);
          }
          return clean;
        }
      }
    } catch {}
    return [];
  }

  public saveCachedRequests(requests: ServiceRequest[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(requests));
    } catch {}
  }

  public async getServiceRequests(): Promise<ServiceRequest[]> {
    const user = this.auth.currentUser;

    if (!this.supabase.isConfigured || !user) {
      return this.getCachedRequests();
    }

    try {
      let query = this.supabase.client.from('service_requests').select('*');
      if (user.role === 'cliente') {
        // En Supabase traemos ÚNICAMENTE las solicitudes reales del cliente
        query = query.eq('client_id', user.id);
      } else {
        // Para técnicos traemos solicitudes asignadas o abiertas en Armenia
        query = query.or(`technician_id.eq.${user.id},status.eq.abierta`);
      }

      // Timeout de 3s para proteger la interfaz
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 3000)
      );

      const res: any = await Promise.race([
        query.order('created_at', { ascending: false }),
        timeoutPromise
      ]);

      if (res && !res.error && Array.isArray(res.data)) {
        // Guardar ÚNICAMENTE las solicitudes reales de la base de datos
        this.saveCachedRequests(res.data);
        return res.data;
      }

      return this.getCachedRequests();
    } catch (err) {
      console.warn('Error cargando solicitudes desde Supabase:', err);
      return this.getCachedRequests();
    }
  }

  public subscribeToRequests(callback: (requests: ServiceRequest[]) => void): () => void {
    // 1. Enviar datos de inmediato (0 ms)
    const initial = this.getCachedRequests();
    callback(initial);

    // 2. Actualización fresca desde Supabase
    this.getServiceRequests().then((fresh) => {
      this.zone.run(() => {
        callback(fresh);
      });
    });

    // 3. Suscripción WebSocket a cambios en la tabla service_requests
    let channel: RealtimeChannel | null = null;
    if (this.supabase.isConfigured) {
      channel = this.supabase.client
        .channel('realtime:service_requests')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'service_requests' },
          async () => {
            const updated = await this.getServiceRequests();
            this.zone.run(() => {
              callback(updated);
            });
          }
        )
        .subscribe();
    }

    // 4. Sincronización instantánea entre pestañas del mismo navegador (storage event)
    const storageHandler = (e: StorageEvent) => {
      if (e.key === this.STORAGE_KEY) {
        const updated = this.getCachedRequests();
        this.zone.run(() => {
          callback(updated);
        });
      }
    };
    window.addEventListener('storage', storageHandler);

    // 5. Polling periódico de seguridad cada 3.5 segundos para garantizar recepción sin recargar
    const pollInterval = setInterval(async () => {
      const fresh = await this.getServiceRequests();
      this.zone.run(() => {
        callback(fresh);
      });
    }, 3500);

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      window.removeEventListener('storage', storageHandler);
      clearInterval(pollInterval);
    };
  }

  public async createServiceRequest(req: {
    specialty_required: string;
    description: string;
    address: string;
    latitude?: number;
    longitude?: number;
    technician_id?: string;
  }): Promise<{ success: boolean; data?: ServiceRequest; error?: string }> {
    const user = this.auth.currentUser;
    const clientId = user?.id;

    if (!clientId) {
      return { success: false, error: 'Debes iniciar sesión para publicar una solicitud.' };
    }

    if (!this.supabase.isConfigured) {
      const newReq: ServiceRequest = {
        id: crypto.randomUUID(),
        client_id: clientId,
        technician_id: req.technician_id || null,
        specialty_required: req.specialty_required,
        description: req.description,
        address: req.address,
        latitude: req.latitude || 4.5389,
        longitude: req.longitude || -75.6725,
        status: 'abierta',
        created_at: new Date().toISOString()
      };
      const current = this.getCachedRequests();
      current.unshift(newReq);
      this.saveCachedRequests(current);
      return { success: true, data: newReq };
    }

    try {
      const { data, error } = await this.supabase.client
        .from('service_requests')
        .insert({
          client_id: clientId,
          technician_id: req.technician_id || null,
          specialty_required: req.specialty_required,
          description: req.description,
          address: req.address,
          latitude: req.latitude || 4.5389,
          longitude: req.longitude || -75.6725,
          status: 'abierta'
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (data) {
        const current = this.getCachedRequests();
        current.unshift(data);
        this.saveCachedRequests(current);
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con la base de datos' };
    }
  }

  public async updateRequestStatus(requestId: string, status: ServiceStatus): Promise<boolean> {
    const user = this.auth.currentUser;
    const current = this.getCachedRequests();
    const found = current.find((r) => r.id === requestId);
    if (found) {
      found.status = status;
      if (user?.role === 'tecnico' && !found.technician_id) {
        found.technician_id = user.id;
      }
      this.saveCachedRequests(current);
    }

    if (!this.supabase.isConfigured) {
      return true;
    }

    try {
      const updateData: any = { status };
      if (user?.role === 'tecnico') {
        updateData.technician_id = user.id;
      }
      const { error } = await this.supabase.client
        .from('service_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) {
        console.warn('Aviso actualizando solicitud en Supabase:', error.message);
      }
      return true;
    } catch {
      return true;
    }
  }

  private activePollingTimer: any = null;

  public getCachedMessages(requestId: string): ChatMessage[] {
    try {
      const raw = localStorage.getItem(`soluciona_chat_${requestId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public saveCachedMessages(requestId: string, msgs: ChatMessage[]): void {
    try {
      localStorage.setItem(`soluciona_chat_${requestId}`, JSON.stringify(msgs));
    } catch {}
  }

  public subscribeToMessages(requestId: string): void {
    this.unsubscribeFromMessages();

    // 1. Mostrar inmediatamente mensajes en memoria local (0 ms)
    const cached = this.getCachedMessages(requestId);
    this._messages.set(cached);

    // 2. Traer historial actualizado desde Supabase
    this.loadMessages(requestId);

    // 3. Suscribir a WebSocket Realtime de Supabase
    if (this.supabase.isConfigured) {
      this.activeChannel = this.supabase.client
        .channel(`request:${requestId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `request_id=eq.${requestId}`
          },
          (payload) => {
            this.zone.run(() => {
              const newMsg = payload.new as ChatMessage;
              const current = this._messages();
              if (!current.some((m) => m.id === newMsg.id)) {
                const updated = [...current, newMsg];
                this._messages.set(updated);
                this.saveCachedMessages(requestId, updated);
              }
            });
          }
        )
        .subscribe();

      // 4. Polling periódico de seguridad cada 3.5 segundos mientras esté en la sala de chat
      this.activePollingTimer = setInterval(() => {
        this.loadMessages(requestId, true);
      }, 3500);
    }
  }

  public unsubscribeFromMessages(): void {
    if (this.activeChannel) {
      this.activeChannel.unsubscribe();
      this.activeChannel = null;
    }
    if (this.activePollingTimer) {
      clearInterval(this.activePollingTimer);
      this.activePollingTimer = null;
    }
  }

  public async loadMessages(requestId: string, isSilent: boolean = false): Promise<ChatMessage[]> {
    if (!this.supabase.isConfigured) {
      const msgs = this.getCachedMessages(requestId);
      this.zone.run(() => {
        this._messages.set(msgs);
      });
      return msgs;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .order('sent_at', { ascending: true });

      if (error) {
        if (!isSilent) console.warn('Aviso cargando mensajes de Supabase:', error.message);
        return this.getCachedMessages(requestId);
      }

      const remoteMsgs: ChatMessage[] = data || [];
      const cached = this.getCachedMessages(requestId);

      // Combinar remotos y locales sin duplicados por ID
      const map = new Map<string, ChatMessage>();
      for (const m of cached) map.set(m.id, m);
      for (const m of remoteMsgs) map.set(m.id, m);

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      );

      this.saveCachedMessages(requestId, merged);
      this.zone.run(() => {
        this._messages.set(merged);
      });
      return merged;
    } catch (e: any) {
      if (!isSilent) console.warn('Error al cargar mensajes:', e);
      return this.getCachedMessages(requestId);
    }
  }

  public async sendMessage(requestId: string, content: string): Promise<boolean> {
    const user = this.auth.currentUser;
    const senderId = user?.id || 'demo-user-' + Math.random().toString(36).substring(2, 6);

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      request_id: requestId,
      sender_id: senderId,
      content,
      sent_at: new Date().toISOString()
    };

    // 1. ACTUALIZACIÓN REACTIVA INMEDIATA EN PANTALLA (Optimistic UI)
    this.zone.run(() => {
      const current = this._messages();
      const updated = [...current, newMsg];
      this._messages.set(updated);
      this.saveCachedMessages(requestId, updated);
    });

    if (!this.supabase.isConfigured) {
      return true;
    }

    try {
      // 2. Si el remitente es un técnico y la solicitud no tenía técnico asignado, se vincula
      if (user?.role === 'tecnico') {
        await this.supabase.client
          .from('service_requests')
          .update({ technician_id: user.id })
          .eq('id', requestId);
      }

      // 3. Persistir en la tabla messages de Supabase
      const { error } = await this.supabase.client.from('messages').insert({
        id: newMsg.id,
        request_id: requestId,
        sender_id: senderId,
        content: content,
        sent_at: newMsg.sent_at
      });

      if (error) {
        console.warn('Error al persistir mensaje en Supabase:', error.message);
      }

      return true;
    } catch (e) {
      console.warn('Excepción al enviar mensaje a Supabase:', e);
      return true;
    }
  }

  public async submitReview(review: {
    request_id: string;
    reviewed_id: string;
    rating: number;
    comment: string;
  }): Promise<{ success: boolean; error?: string }> {
    const user = this.auth.currentUser;
    const reviewerId = user?.id || 'demo-client-01';

    if (!this.supabase.isConfigured) {
      console.log('Calificación simulada guardada con éxito:', { ...review, reviewer_id: reviewerId });
      return { success: true };
    }

    try {
      // 1. Guardar la reseña en la tabla reviews
      const { error } = await this.supabase.client.from('reviews').insert({
        request_id: review.request_id,
        reviewer_id: reviewerId,
        reviewed_id: review.reviewed_id,
        rating: review.rating,
        comment: review.comment
      });

      if (error) {
        console.warn('Aviso insertando reseña en Supabase:', error.message);
      }

      // 2. Calcular nuevo promedio y conteo de reseñas
      const { data: allReviews } = await this.supabase.client
        .from('reviews')
        .select('rating')
        .eq('reviewed_id', review.reviewed_id);

      let newAvg = review.rating;
      let newCount = 1;

      if (allReviews && allReviews.length > 0) {
        const sum = allReviews.reduce((acc, r) => acc + Number(r.rating), 0);
        newAvg = Math.round((sum / allReviews.length) * 10) / 10;
        newCount = allReviews.length;
      }

      // 3. Actualizar inmediatamente technician_profiles en Supabase
      await this.supabase.client
        .from('technician_profiles')
        .update({
          rating_avg: newAvg,
          reviews_count: newCount
        })
        .or(`user_id.eq.${review.reviewed_id},id.eq.${review.reviewed_id}`);

      return { success: true };
    } catch (err: any) {
      console.warn('Excepción al enviar calificación:', err);
      return { success: true };
    }
  }
}

