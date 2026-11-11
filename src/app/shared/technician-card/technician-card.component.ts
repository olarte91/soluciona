import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NearbyTechnician } from '../../core/models/technician.model';
import { RatingStarsComponent } from '../rating-stars/rating-stars.component';

@Component({
  selector: 'app-technician-card',
  standalone: true,
  imports: [CommonModule, RatingStarsComponent],
  templateUrl: './technician-card.component.html',
  styleUrl: './technician-card.component.css'
})
export class TechnicianCardComponent {
  @Input({ required: true }) technician!: NearbyTechnician;
  @Output() onSelect = new EventEmitter<NearbyTechnician>();
  @Output() onContact = new EventEmitter<NearbyTechnician>();
}
