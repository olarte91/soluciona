import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServiceRequest } from '../../core/models/service.model';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';

@Component({
  selector: 'app-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RatingStarsComponent],
  templateUrl: './review-modal.component.html',
  styleUrl: './review-modal.component.css'
})
export class ReviewModalComponent {
  @Input({ required: true }) request!: ServiceRequest;
  @Output() onClose = new EventEmitter<void>();
  @Output() onSuccess = new EventEmitter<void>();

  rating: number = 5;
  comment: string = '';
  loading = false;
  errorMessage = '';

  constructor(
    private chatService: ChatService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  get isTechnician(): boolean {
    return this.auth.currentUser?.role === 'tecnico';
  }

  getRatingLabel(r: number): string {
    switch (r) {
      case 5: return '★★★★★ 5.0 de 5.0 — Excelente';
      case 4: return '★★★★☆ 4.0 de 5.0 — Muy Bueno';
      case 3: return '★★★☆☆ 3.0 de 5.0 — Aceptable';
      case 2: return '★★☆☆☆ 2.0 de 5.0 — Deficiente';
      case 1: return '★☆☆☆☆ 1.0 de 5.0 — Muy Malo';
      default: return 'Selecciona una puntuación';
    }
  }

  async submitReview(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    // 1. Determinar el destinatario real de la calificación:
    let targetReviewedId: string | null = null;

    if (this.isTechnician) {
      // El técnico evalúa al cliente
      targetReviewedId = this.request.client_id;
    } else {
      // El cliente evalúa al técnico
      targetReviewedId = this.request.technician_id || null;

      // Si no estaba en request.technician_id, lo buscamos en los mensajes del chat
      if (!targetReviewedId) {
        const msgs = this.chatService.getCachedMessages(this.request.id);
        const techMsg = msgs.find((m) => m.sender_id !== this.request.client_id);
        if (techMsg) {
          targetReviewedId = techMsg.sender_id;
        }
      }

      // Si aún no se localiza y Supabase está configurado, buscamos el técnico en technician_profiles
      if (!targetReviewedId) {
        const cachedTech = localStorage.getItem('soluciona_current_tech');
        if (cachedTech) {
          try {
            const parsed = JSON.parse(cachedTech);
            targetReviewedId = parsed.user_id || parsed.id;
          } catch {}
        }
      }
    }

    if (!targetReviewedId) {
      targetReviewedId = this.request.technician_id || this.request.client_id;
    }

    // Vincular formalmente al técnico en la solicitud si faltaba
    if (!this.isTechnician && targetReviewedId && !this.request.technician_id) {
      this.request.technician_id = targetReviewedId;
      this.chatService.updateRequestStatus(this.request.id, 'completada');
    }

    const res = await this.chatService.submitReview({
      request_id: this.request.id,
      reviewed_id: targetReviewedId,
      rating: this.rating,
      comment: this.comment
    });

    this.loading = false;
    this.cdr.markForCheck();

    if (res.success) {
      this.onSuccess.emit();
    } else {
      this.errorMessage = res.error || 'No fue posible guardar la calificación.';
    }
  }
}

