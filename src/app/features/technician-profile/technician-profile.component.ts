import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TechnicianProfile } from '../../core/models/technician.model';
import { RatingStarsComponent } from '../../shared/rating-stars/rating-stars.component';

@Component({
  selector: 'app-technician-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RatingStarsComponent],
  templateUrl: './technician-profile.component.html',
  styleUrl: './technician-profile.component.css'
})
export class TechnicianProfileComponent implements OnInit {
  // Datos editables
  fullName = '';
  phone = '';
  specialty = 'Plomería';
  hourlyRate = 35000;
  bio = '';
  isVerified = false;
  ratingAvg = 5.0;
  reviewsCount = 0;
  idDocumentUrl = '';

  isSaving = false;
  saveSuccessMessage = '';
  saveErrorMessage = '';

  selectedFile: File | null = null;
  isUploading = false;
  uploadSuccessMessage = '';
  uploadErrorMessage = '';

  constructor(public auth: AuthService) {}

  ngOnInit(): void {
    this.loadCurrentData();
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  private loadCurrentData(): void {
    const user = this.currentUser;
    if (user) {
      this.fullName = user.full_name || '';
      this.phone = user.phone || '';
    }

    // Intentar leer de technician profile cached
    const cachedTech = localStorage.getItem('soluciona_current_tech');
    if (cachedTech) {
      try {
        const tech: TechnicianProfile = JSON.parse(cachedTech);
        this.specialty = tech.specialty || this.specialty;
        this.hourlyRate = tech.hourly_rate || this.hourlyRate;
        this.bio = tech.bio || this.bio;
        this.isVerified = tech.is_verified || false;
        this.ratingAvg = tech.rating_avg || 5.0;
        this.reviewsCount = tech.reviews_count || 0;
        this.idDocumentUrl = tech.id_document_url || '';
      } catch (e) {}
    } else {
      this.bio = 'Especialista en reparaciones de instalaciones hidrosanitarias, plomería y redes en Armenia, Quindío.';
      this.isVerified = true;
      this.ratingAvg = 4.9;
      this.reviewsCount = 14;
    }
  }

  async saveProfileChanges(): Promise<void> {
    if (!this.fullName || !this.specialty) {
      this.saveErrorMessage = 'Nombre y especialidad son obligatorios.';
      return;
    }

    try {
      this.isSaving = true;
      this.saveSuccessMessage = '';
      this.saveErrorMessage = '';

      const res = await this.auth.updateTechnicianProfile({
        fullName: this.fullName,
        phone: this.phone,
        specialty: this.specialty,
        bio: this.bio,
        hourlyRate: this.hourlyRate
      });

      if (res.success) {
        this.saveSuccessMessage = '¡Perfil profesional actualizado exitosamente! Los cambios ya son visibles en Armenia.';
      } else {
        this.saveErrorMessage = res.error || 'Error al guardar los cambios.';
      }
    } catch (e: any) {
      this.saveErrorMessage = e.message || 'Error inesperado guardando el perfil.';
    } finally {
      this.isSaving = false;
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadSuccessMessage = '';
      this.uploadErrorMessage = '';
    }
  }

  async uploadDocument(): Promise<void> {
    if (!this.selectedFile) return;

    try {
      this.isUploading = true;
      this.uploadSuccessMessage = '';
      this.uploadErrorMessage = '';

      const res = await this.auth.uploadIdDocument(this.selectedFile);

      if (res.success) {
        this.uploadSuccessMessage = 'Documento cargado correctamente. Tu solicitud de verificación ha sido enviada.';
        this.idDocumentUrl = res.url || 'cargado';
        this.selectedFile = null;
      } else {
        this.uploadErrorMessage = res.error || 'Error al subir el archivo.';
      }
    } catch (e: any) {
      this.uploadErrorMessage = e.message || 'Error al procesar el archivo.';
    } finally {
      this.isUploading = false;
    }
  }
}
