import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating-stars.component.html',
  styleUrl: './rating-stars.component.css'
})
export class RatingStarsComponent {
  @Input() rating: number = 0;
  @Input() interactive: boolean = false;
  @Input() showNumber: boolean = true;
  @Output() ratingChange = new EventEmitter<number>();

  stars = [1, 2, 3, 4, 5];
  hoverRating: number = 0;

  setRating(val: number): void {
    if (this.interactive) {
      this.rating = val;
      this.ratingChange.emit(val);
    }
  }
}

