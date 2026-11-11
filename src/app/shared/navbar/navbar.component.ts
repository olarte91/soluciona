import { Component, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  readonly currentUser: Signal<UserProfile | null>;
  readonly mobileMenuOpen = signal(false);

  constructor(public auth: AuthService, private router: Router) {
    this.currentUser = this.auth.currentUserSignal;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  navigateHome(): void {
    this.closeMobileMenu();
    const user = this.auth.currentUser;
    if (!user) {
      this.router.navigate(['/auth/login']);
    } else if (user.role === 'tecnico') {
      this.router.navigate(['/service-request']);
    } else {
      this.router.navigate(['/search']);
    }
  }

  async logout(): Promise<void> {
    this.closeMobileMenu();
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
