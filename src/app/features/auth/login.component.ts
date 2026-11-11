import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  // Inputs 100% vacíos por defecto (se ven los placeholders)
  email = '';
  password = '';
  selectedRole: 'cliente' | 'tecnico' = 'cliente';
  loading = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated) {
      if (this.auth.userRole === 'tecnico') {
        this.router.navigate(['/service-request']);
      } else {
        this.router.navigate(['/search']);
      }
    }
  }

  selectRole(role: 'cliente' | 'tecnico'): void {
    this.selectedRole = role;
    this.errorMessage = '';
    // Mantiene los campos vacíos con su placeholder limpio
  }

  async onSubmit(): Promise<void> {
    const cleanEmail = (this.email || '').trim();
    const cleanPassword = (this.password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      this.errorMessage = 'Por favor ingresa tu correo y contraseña.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      this.errorMessage = 'Por favor ingresa un formato de correo electrónico válido (ej. usuario@ejemplo.com).';
      return;
    }

    try {
      this.loading = true;
      this.errorMessage = '';

      const res = await this.auth.login(cleanEmail, cleanPassword);

      if (res.success) {
        const user = this.auth.currentUser;
        if (user?.role === 'tecnico') {
          this.router.navigate(['/service-request']);
        } else {
          this.router.navigate(['/search']);
        }
      } else {
        this.errorMessage = res.error || 'Correo o contraseña incorrectos.';
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Error inesperado al conectar con el servidor.';
    } finally {
      this.loading = false;
    }
  }
}
