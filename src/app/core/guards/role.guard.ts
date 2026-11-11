import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (expectedRole: 'cliente' | 'tecnico'): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated) {
      return router.createUrlTree(['/auth/login']);
    }

    if (auth.userRole === expectedRole) {
      return true;
    }

    // Si no tiene el rol esperado, redirigir al inicio o dashboard correspondiente
    return router.createUrlTree(['/search']);
  };
};

