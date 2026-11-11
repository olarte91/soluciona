import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, NgZone, Signal, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatMessage, ServiceRequest } from '../../core/models/service.model';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat-room.component.html',
  styleUrl: './chat-room.component.css'
})
export class ChatRoomComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  conversations: ServiceRequest[] = [];
  selectedRequestId: string = '';
  activeRequest: ServiceRequest | null = null;
  readonly messages: Signal<ChatMessage[]>;
  readonly mobileShowChat = signal(false);
  newContent: string = '';
  isSending: boolean = false;
  private shouldScroll: boolean = false;
  private unsubscribeRequests?: () => void;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    this.messages = this.chatService.messages;

    effect(() => {
      this.messages();
      this.shouldScroll = true;
    });
  }

  get isTechnician(): boolean {
    return this.auth.currentUser?.role === 'tecnico';
  }

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      const paramId = params['id'];
      if (paramId) {
        this.selectConversation(paramId, true);
      }
    });

    // Suscripción reactiva en tiempo real a la lista de solicitudes / conversaciones
    this.unsubscribeRequests = this.chatService.subscribeToRequests((updatedList) => {
      this.conversations = updatedList || [];
      if (this.selectedRequestId) {
        this.activeRequest = this.conversations.find((c) => c.id === this.selectedRequestId) || (this.conversations.length > 0 ? this.conversations[0] : null);
      } else if (this.conversations.length > 0) {
        this.selectConversation(this.conversations[0].id, false);
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.chatService.unsubscribeFromMessages();
    if (this.unsubscribeRequests) {
      this.unsubscribeRequests();
    }
  }

  selectConversation(requestId: string, openOnMobile: boolean = true): void {
    this.selectedRequestId = requestId;
    this.activeRequest = this.conversations.find((c) => c.id === requestId) || this.conversations[0] || null;
    if (openOnMobile) {
      this.mobileShowChat.set(true);
    }
    this.chatService.subscribeToMessages(requestId);
    this.shouldScroll = true;
    this.cdr.markForCheck();
  }

  backToConversations(): void {
    this.mobileShowChat.set(false);
  }

  getCounterpartName(req: ServiceRequest): string {
    if (this.isTechnician) {
      return req.address ? `Cliente (${req.address.split(',')[0]})` : 'Cliente';
    }
    return `Técnico de ${req.specialty_required || 'Servicio'}`;
  }

  getCounterpartInitials(req: ServiceRequest): string {
    const name = this.getCounterpartName(req);
    return name.charAt(0);
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  isMyMessage(msg: ChatMessage): boolean {
    const currentUserId = this.auth.currentUser?.id;
    if (currentUserId) {
      return msg.sender_id === currentUserId;
    }
    return this.isTechnician ? msg.sender_id.includes('tech') : msg.sender_id.includes('client');
  }

  async sendMessage(): Promise<void> {
    if (!this.newContent.trim() || !this.selectedRequestId) return;

    const content = this.newContent.trim();
    this.newContent = '';
    this.isSending = true;

    await this.chatService.sendMessage(this.selectedRequestId, content);
    this.isSending = false;
    this.shouldScroll = true;
    this.cdr.markForCheck();
  }
}
