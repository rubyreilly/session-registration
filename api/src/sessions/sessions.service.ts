import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Clock } from './clock';
import { CreateSessionDto, normalizeEmail } from './sessions.dto';
import { ApiError } from './sessions.errors';

interface Session {
  id: string;
  title: string;
  startsAt: number; // epoch ms
  capacity: number;
  registrationOpensAt: number;
  registrationClosesAt: number;
  participants: Set<string>;
}

@Injectable()
export class SessionsService {
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly clock: Clock) {}

  create(dto: CreateSessionDto) {
    const startsAt = new Date(dto.startsAt).getTime();
    const opens = new Date(dto.registrationOpensAt).getTime();
    const closes = new Date(dto.registrationClosesAt).getTime();

    if (!(opens < closes && closes <= startsAt)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'INVALID_WINDOW',
        'Registration must open before it closes, and close no later than the session start.',
      );
    }

    const session: Session = {
      id: randomUUID(),
      title: dto.title.trim(),
      startsAt,
      capacity: dto.capacity,
      registrationOpensAt: opens,
      registrationClosesAt: closes,
      participants: new Set(),
    };
    this.sessions.set(session.id, session);
    return this.toView(session);
  }

  listUpcoming() {
    const now = this.clock.now().getTime();
    return [...this.sessions.values()]
      .filter((s) => s.startsAt > now)
      .sort((a, b) => a.startsAt - b.startsAt)
      .map((s) => this.toView(s));
  }

  register(sessionId: string, rawEmail: string) {
    const session = this.getOrThrow(sessionId);
    const email = normalizeEmail(rawEmail);
    const now = this.clock.now().getTime();

    // Window is [opens, closes): opens inclusive, closes exclusive.
    if (now < session.registrationOpensAt) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'REGISTRATION_NOT_OPEN',
        'Registration has not opened yet.',
      );
    }
    if (now >= session.registrationClosesAt) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'REGISTRATION_CLOSED',
        'Registration is closed.',
      );
    }
    if (session.participants.has(email)) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'ALREADY_REGISTERED',
        'This email is already registered for the session.',
      );
    }
    if (session.participants.size >= session.capacity) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'SESSION_FULL',
        'This session is full.',
      );
    }

    // Check and insert happen synchronously, so concurrent requests can't interleave.
    session.participants.add(email);
    return this.toView(session);
  }

  unregister(sessionId: string, rawEmail: string) {
    const session = this.getOrThrow(sessionId);
    const email = normalizeEmail(rawEmail);

    if (this.clock.now().getTime() >= session.startsAt) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'SESSION_STARTED',
        'Cannot unregister after the session has started.',
      );
    }
    if (!session.participants.delete(email)) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'NOT_REGISTERED',
        'This email is not registered for the session.',
      );
    }
  }

  private getOrThrow(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'SESSION_NOT_FOUND',
        'Session not found.',
      );
    }
    return session;
  }

  // Public shape: never expose participant emails.
  private toView(s: Session) {
    return {
      id: s.id,
      title: s.title,
      startsAt: new Date(s.startsAt).toISOString(),
      capacity: s.capacity,
      seatsRemaining: s.capacity - s.participants.size,
      registrationOpensAt: new Date(s.registrationOpensAt).toISOString(),
      registrationClosesAt: new Date(s.registrationClosesAt).toISOString(),
    };
  }
}
