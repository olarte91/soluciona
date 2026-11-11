import { Routes } from '@angular/router';
import { SearchComponent } from './features/search/search.component';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { TechnicianProfileComponent } from './features/technician-profile/technician-profile.component';
import { ServiceRequestListComponent } from './features/service-request/service-request-list.component';
import { ServiceRequestCreateComponent } from './features/service-request/service-request-create.component';
import { ChatRoomComponent } from './features/chat/chat-room.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Ruta inicial: pantalla de login si no está registrado/autenticado (Requerimiento 8)
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  
  // Rutas protegidas solo para usuarios autenticados
  { path: 'search', component: SearchComponent, canActivate: [authGuard] },
  { path: 'service-request', component: ServiceRequestListComponent, canActivate: [authGuard] },
  { path: 'service-request/new', component: ServiceRequestCreateComponent, canActivate: [authGuard] },
  { path: 'technician-profile', component: TechnicianProfileComponent, canActivate: [authGuard] },
  { path: 'chat', component: ChatRoomComponent, canActivate: [authGuard] },
  { path: 'chat/:id', component: ChatRoomComponent, canActivate: [authGuard] },
  
  { path: '**', redirectTo: 'auth/login' }
];
