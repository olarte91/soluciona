import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ServiceRequest, ServiceStatus } from '../../core/models/service.model';
import { ReviewModalComponent } from '../reviews/review-modal.component';

@Component({
  selector: 'app-service-request-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReviewModalComponent],
  templateUrl: './service-request-list.component.html',
  styleUrl: './service-request-list.component.css'
})
export class ServiceRequestListComponent implements OnInit, OnDestroy {
  requests: ServiceRequest[] = [];
  loading = false;
  selectedStatus: string = 'todas';
  selectedRequestForReview: ServiceRequest | null = null;
  private unsubscribeRequests?: () => void;

  tabs = [
    { id: 'todas', label: 'Todas' },
    { id: 'abierta', label: 'Abiertas' },
    { id: 'en_proceso', label: 'En Proceso' },
    { id: 'completada', label: 'Completadas' }
  ];

  constructor(
    private chatService: ChatService,
    public auth: AuthService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // 1. Suscripción reactiva en tiempo real a solicitudes (WebSockets + Polling + Cross-Tab)
    this.unsubscribeRequests = this.chatService.subscribeToRequests((updatedList) => {
      this.requests = updatedList || [];
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    if (this.unsubscribeRequests) {
      this.unsubscribeRequests();
    }
  }

  get isTechnician(): boolean {
    return this.auth.currentUser?.role === 'tecnico';
  }

  async loadData(): Promise<void> {
    try {
      const data = await this.chatService.getServiceRequests();
      this.zone.run(() => {
        this.requests = data || [];
        this.loading = false;
        this.cdr.markForCheck();
      });
    } catch (err) {
      console.warn('Error cargando solicitudes:', err);
      this.zone.run(() => {
        this.loading = false;
        this.cdr.markForCheck();
      });
    }
  }

  getTabCount(statusId: string): number {
    if (statusId === 'todas') return this.requests.length;
    return this.requests.filter((r) => r.status === statusId).length;
  }

  get filteredRequests(): ServiceRequest[] {
    if (!this.selectedStatus || this.selectedStatus === 'todas') {
      return this.requests;
    }
    return this.requests.filter((r) => r.status === this.selectedStatus);
  }

  getStatusBadgeClass(status: ServiceStatus): string {
    switch (status) {
      case 'abierta':
        return 'bg-blue-100 text-blue-800';
      case 'en_proceso':
        return 'bg-amber-100 text-amber-900';
      case 'completada':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelada':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  async changeStatus(req: ServiceRequest, status: ServiceStatus): Promise<void> {
    // 1. Actualizar estado local inmediatamente
    req.status = status;
    this.cdr.markForCheck();

    // 2. Si se finaliza el trabajo, abrir INMEDIATAMENTE el modal de calificación (para cliente o técnico)
    if (status === 'completada') {
      this.openReviewModal(req);
    }

    // 3. Persistir en Supabase en segundo plano
    try {
      await this.chatService.updateRequestStatus(req.id, status);
    } catch (err) {
      console.warn('Error al actualizar estado en Supabase:', err);
    }
  }

  openReviewModal(req: ServiceRequest): void {
    this.selectedRequestForReview = req;
    this.cdr.markForCheck();
  }

  onReviewSubmitted(): void {
    this.selectedRequestForReview = null;
    this.loadData();
  }
}
