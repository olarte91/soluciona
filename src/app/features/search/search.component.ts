import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { GeoService } from '../../core/services/geo.service';
import { AuthService } from '../../core/services/auth.service';
import { NearbyTechnician } from '../../core/models/technician.model';
import { TechnicianCardComponent } from '../../shared/technician-card/technician-card.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TechnicianCardComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainerRef!: ElementRef;

  userLat = 4.5389; // Armenia Plaza de Bolívar
  userLng = -75.6725;
  radiusKm = 15;
  selectedSpecialty = 'todos';

  technicians: NearbyTechnician[] = [];
  loading = false;
  isDetectingLocation = false;
  
  mobileTab: 'list' | 'map' = 'list';
  selectedTechnician: NearbyTechnician | null = null;

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private userMarker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;
  private techMarkers: { [id: string]: L.Marker } = {};

  constructor(
    private geo: GeoService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userLat = this.geo.DEFAULT_LAT;
    this.userLng = this.geo.DEFAULT_LNG;
    this.loadTechnicians();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.warn('Error destruyendo mapa:', e);
      }
      this.map = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.map) {
      setTimeout(() => this.map?.invalidateSize(), 100);
    }
  }

  setMobileTab(tab: 'list' | 'map'): void {
    this.mobileTab = tab;
    if (tab === 'map') {
      setTimeout(() => {
        if (!this.map) {
          this.initMap();
        } else {
          this.map.invalidateSize();
        }
      }, 100);
    }
  }

  private initMap(): void {
    if (!this.mapContainerRef?.nativeElement) return;
    const container = this.mapContainerRef.nativeElement;

    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.warn('Error removiendo mapa anterior:', e);
      }
      this.map = null;
    }

    // Evitar error 'Map container is already initialized'
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      // Inicializar mapa centrado en Armenia
      this.map = L.map(container, {
        center: [this.userLat, this.userLng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Capa de tiles OpenStreetMap estándar (sin subdominios obsoletos)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors | Soluciona Armenia'
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);

      this.updateUserMapElements();
      this.renderTechnicianMarkers();

      // Recalcular tamaño de viewport inmediatamente y a los 200ms y 450ms
      setTimeout(() => this.map?.invalidateSize(), 150);
      setTimeout(() => this.map?.invalidateSize(), 450);
    } catch (err) {
      console.warn('Error inicializando mapa:', err);
    }
  }

  private updateUserMapElements(): void {
    if (!this.map) return;

    // Remover anterior si existe
    if (this.userMarker) this.userMarker.remove();
    if (this.radiusCircle) this.radiusCircle.remove();

    // Marcador de usuario (Punto Azul con pulso)
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: `
        <div style="background-color: #2563eb; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(37,99,235,0.6);"></div>
      `,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    this.userMarker = L.marker([this.userLat, this.userLng], { icon: userIcon })
      .addTo(this.map)
      .bindPopup(`<strong>Tu Ubicación</strong><br>Armenia, Quindío`);

    // Círculo de cobertura por radio
    this.radiusCircle = L.circle([this.userLat, this.userLng], {
      radius: this.radiusKm * 1000,
      color: '#4f46e5',
      fillColor: '#818cf8',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4, 6'
    }).addTo(this.map);
  }

  private renderTechnicianMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();

    this.technicians.forEach((tech) => {
      // Color según especialidad
      let markerColor = '#4f46e5';
      if (tech.specialty.includes('Plomería')) markerColor = '#0284c7';
      if (tech.specialty.includes('Electricidad')) markerColor = '#eab308';
      if (tech.specialty.includes('Pintura')) markerColor = '#ec4899';
      if (tech.specialty.includes('Albañilería')) markerColor = '#f97316';

      const techIcon = L.divIcon({
        className: 'custom-tech-marker',
        html: `
          <div style="background-color: ${markerColor}; color: white; width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.25);">
            🔧
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const verifiedBadge = tech.is_verified
        ? `<span style="background: #dcfce7; color: #166534; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">✓ Verificado</span>`
        : `<span style="background: #fef3c7; color: #92400e; font-size: 10px; padding: 2px 6px; border-radius: 4px;">Pendiente</span>`;

      const popupContent = `
        <div style="padding: 4px; font-family: sans-serif; min-width: 170px;">
          <div style="font-weight: 800; font-size: 13px; margin-bottom: 2px;">${tech.full_name}</div>
          <div style="margin-bottom: 6px;">${verifiedBadge}</div>
          <div style="font-size: 11px; color: #4b5563; margin-bottom: 2px;"><strong>Oficio:</strong> ${tech.specialty}</div>
          <div style="font-size: 11px; color: #4b5563; margin-bottom: 2px;"><strong>Distancia:</strong> ${tech.distance_km} km</div>
          <div style="font-size: 11px; color: #d97706; font-weight: bold; margin-bottom: 8px;">★ ${tech.rating_avg} / 5.0</div>
          <button id="btn-contact-${tech.technician_id}" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">
            Solicitar Servicio
          </button>
        </div>
      `;

      const lat = Number(tech.latitude) || this.userLat || 4.5389;
      const lng = Number(tech.longitude) || this.userLng || -75.6725;

      const marker = L.marker([lat, lng], { icon: techIcon })
        .bindPopup(popupContent);

      marker.on('click', () => {
        this.selectedTechnician = tech;
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-contact-${tech.technician_id}`);
        if (btn) {
          btn.onclick = () => this.contactTechnician(tech);
        }
      });

      this.techMarkers[tech.technician_id] = marker;
      this.markersLayer!.addLayer(marker);
    });
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  setRadius(r: number): void {
    this.radiusKm = r;
    this.onFilterChange();
  }

  async loadTechnicians(): Promise<void> {
    try {
      this.loading = true;
      this.technicians = await this.geo.getNearbyTechnicians(
        this.userLat,
        this.userLng,
        this.radiusKm,
        this.selectedSpecialty
      );
    } catch (err) {
      console.warn('Error cargando técnicos:', err);
    } finally {
      this.loading = false;
      this.renderTechnicianMarkers();
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 150);
    }
  }

  onFilterChange(): void {
    this.loadTechnicians();
    this.updateUserMapElements();
  }

  async detectLocation(): Promise<void> {
    this.isDetectingLocation = true;
    const coords = await this.geo.getCurrentCoordinates();
    this.userLat = coords.lat;
    this.userLng = coords.lng;
    this.isDetectingLocation = false;

    if (this.map) {
      this.map.setView([this.userLat, this.userLng], 14);
    }
    this.updateUserMapElements();
    this.loadTechnicians();
  }

  focusTechnicianOnMap(tech: NearbyTechnician): void {
    this.selectedTechnician = tech;
    this.mobileTab = 'map';

    setTimeout(() => {
      if (!this.map) {
        this.initMap();
      }

      const lat = Number(tech.latitude) || this.userLat || 4.5389;
      const lng = Number(tech.longitude) || this.userLng || -75.6725;

      // 1. Scroll suave directo al contenedor del mapa
      const mapSection = document.getElementById('mapSection') || this.mapContainerRef?.nativeElement;
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // 2. Invalidar tamaño para forzar a Leaflet a dibujar los tiles de OpenStreetMap
      if (this.map) {
        this.map.invalidateSize();
        this.map.setView([lat, lng], 16, { animate: true });

        // 3. Abrir el popup del marcador
        if (this.techMarkers[tech.technician_id]) {
          this.techMarkers[tech.technician_id].openPopup();
        }
      }
    }, 150);
  }

  contactTechnician(tech: NearbyTechnician): void {
    // Si no está autenticado, llevar a login
    if (!this.auth.isAuthenticated) {
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: `/service-request/new?techId=${tech.technician_id}` } });
      return;
    }
    // Redirigir a crear solicitud preasignando el técnico
    this.router.navigate(['/service-request/new'], {
      queryParams: {
        techId: tech.technician_id,
        specialty: tech.specialty,
        name: tech.full_name
      }
    });
  }
}

