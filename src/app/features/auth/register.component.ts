import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  fullName = '';
  email = '';
  phone = '';
  password = '';
  role: UserRole = 'cliente';
  specialty = 'Plomería';
  hourlyRate = 35000;
  bio = '';
  acceptTerms = false;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    if (!this.fullName || !this.email || !this.password) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    if (!this.acceptTerms) {
      this.errorMessage = 'Debes aceptar los términos y la política de tratamiento de datos.';
      return;
    }

    try {
      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      const res = await this.auth.register({
        fullName: this.fullName,
        email: this.email,
        phone: this.phone,
        password: this.password,
        role: this.role,
        specialty: this.specialty,
        hourlyRate: this.hourlyRate,
        bio: this.bio
      });

      if (res.success) {
        if (res.requiresEmailConfirmation) {
          this.successMessage = res.message || 'Hemos enviado un correo de confirmación. Por favor verifica tu bandeja de entrada para activar tu cuenta.';
        } else {
          if (this.role === 'tecnico') {
            this.router.navigate(['/technician-profile']);
          } else {
            this.router.navigate(['/search']);
          }
        }
      } else {
        this.errorMessage = res.error || 'Error al procesar el registro.';
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Ocurrió un error inesperado durante el registro.';
    } finally {
      this.loading = false;
    }
  }
}

