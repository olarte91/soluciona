import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-service-request-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './service-request-create.component.html',
  styleUrl: './service-request-create.component.css'
})
export class ServiceRequestCreateComponent implements OnInit {
  specialtyRequired = 'Plomería';
  description = '';
  address = '';
  assignedTechId: string | null = null;
  assignedTechName: string | null = null;

  loading = false;
  errorMessage = '';

  constructor(
    private chatService: ChatService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['techId']) {
        this.assignedTechId = params['techId'];
      }
      if (params['specialty']) {
        this.specialtyRequired = params['specialty'];
      }
      if (params['name']) {
        this.assignedTechName = params['name'];
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.description || !this.address) {
      this.errorMessage = 'Por favor completa la descripción y la dirección.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const res = await this.chatService.createServiceRequest({
      specialty_required: this.specialtyRequired,
      description: this.description,
      address: this.address,
      technician_id: this.assignedTechId || undefined
    });

    this.loading = false;

    if (res.success && res.data) {
      this.router.navigate(['/chat', res.data.id]);
    } else {
      this.errorMessage = res.error || 'Error creando la solicitud de servicio.';
    }
  }
}

