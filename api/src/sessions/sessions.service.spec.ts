import { Clock } from './clock';
import { CreateSessionDto } from './sessions.dto';
import { ApiError } from './sessions.errors';
import { SessionsService } from './sessions.service';

const OPENS = '2026-06-01T00:00:00.000Z';
const CLOSES = '2026-06-09T00:00:00.000Z';
const STARTS = '2026-06-10T18:00:00.000Z';

let now: Date;
let service: SessionsService;

// A Clock whose time the tests control.
const clock = { now: () => now } as Clock;

const setNow = (iso: string) => {
  now = new Date(iso);
};

function newSession(overrides: Partial<CreateSessionDto> = {}) {
  return service.create({
    title: 'Workshop',
    startsAt: STARTS,
    capacity: 2,
    registrationOpensAt: OPENS,
    registrationClosesAt: CLOSES,
    ...overrides,
  });
}

// Runs fn, expects it to throw an ApiError, and returns its error code.
function errorCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    return ((e as ApiError).getResponse() as { code: string }).code;
  }
  throw new Error('Expected the call to throw');
}

beforeEach(() => {
  setNow('2026-06-05T12:00:00.000Z'); // inside the window by default
  service = new SessionsService(clock);
});

describe('capacity', () => {
  it('accepts registrations up to capacity and rejects the next one', () => {
    const { id } = newSession({ capacity: 2 });

    service.register(id, 'a@x.com');
    const afterSecond = service.register(id, 'b@x.com');

    expect(afterSecond.seatsRemaining).toBe(0);
    expect(errorCode(() => service.register(id, 'c@x.com'))).toBe(
      'SESSION_FULL',
    );
  });

  it('never exceeds capacity across many attempts', () => {
    const { id } = newSession({ capacity: 3 });

    for (let i = 0; i < 20; i++) {
      try {
        service.register(id, `user${i}@x.com`);
      } catch {
        // expected once full
      }
    }

    expect(service.listUpcoming()[0]?.seatsRemaining).toBe(0);
  });

  it('frees a seat when someone unregisters', () => {
    const { id } = newSession({ capacity: 1 });
    service.register(id, 'a@x.com');

    service.unregister(id, 'a@x.com');

    expect(service.register(id, 'b@x.com').seatsRemaining).toBe(0);
  });
});

describe('registration window', () => {
  it('rejects registration before the window opens', () => {
    const { id } = newSession();
    setNow('2026-05-31T23:59:59.999Z');

    expect(errorCode(() => service.register(id, 'a@x.com'))).toBe(
      'REGISTRATION_NOT_OPEN',
    );
  });

  it('accepts registration exactly when the window opens (inclusive)', () => {
    const { id } = newSession();
    setNow(OPENS);

    expect(service.register(id, 'a@x.com').seatsRemaining).toBe(1);
  });

  it('accepts registration 1ms before the window closes', () => {
    const { id } = newSession();
    setNow('2026-06-08T23:59:59.999Z');

    expect(service.register(id, 'a@x.com').seatsRemaining).toBe(1);
  });

  it('rejects registration exactly when the window closes (exclusive)', () => {
    const { id } = newSession();
    setNow(CLOSES);

    expect(errorCode(() => service.register(id, 'a@x.com'))).toBe(
      'REGISTRATION_CLOSED',
    );
  });

  it('does not consume a seat when registration is rejected', () => {
    const { id } = newSession({ capacity: 1 });
    setNow(CLOSES);
    errorCode(() => service.register(id, 'a@x.com'));

    setNow('2026-06-05T12:00:00.000Z');
    expect(service.register(id, 'b@x.com').seatsRemaining).toBe(0);
  });
});

describe('duplicate registration', () => {
  it('rejects the same email twice, ignoring case and whitespace', () => {
    const { id } = newSession({ capacity: 5 });
    service.register(id, 'A@x.com');

    expect(errorCode(() => service.register(id, '  a@X.com '))).toBe(
      'ALREADY_REGISTERED',
    );
  });

  it('does not use up a seat on a duplicate attempt', () => {
    const { id } = newSession({ capacity: 2 });
    service.register(id, 'a@x.com');
    errorCode(() => service.register(id, 'a@x.com'));

    expect(service.register(id, 'b@x.com').seatsRemaining).toBe(0);
  });

  it('reports ALREADY_REGISTERED rather than SESSION_FULL for a registered user', () => {
    const { id } = newSession({ capacity: 1 });
    service.register(id, 'a@x.com');

    expect(errorCode(() => service.register(id, 'a@x.com'))).toBe(
      'ALREADY_REGISTERED',
    );
  });
});

describe('unregister', () => {
  it('rejects an email that is not registered', () => {
    const { id } = newSession();

    expect(errorCode(() => service.unregister(id, 'a@x.com'))).toBe(
      'NOT_REGISTERED',
    );
  });

  it('is allowed after registration closes but before the session starts', () => {
    const { id } = newSession();
    service.register(id, 'a@x.com');
    setNow('2026-06-09T12:00:00.000Z');

    expect(() => service.unregister(id, 'a@x.com')).not.toThrow();
  });

  it('is rejected once the session has started', () => {
    const { id } = newSession();
    service.register(id, 'a@x.com');
    setNow(STARTS);

    expect(errorCode(() => service.unregister(id, 'a@x.com'))).toBe(
      'SESSION_STARTED',
    );
  });
});

describe('create and list', () => {
  it.each([
    ['closes before it opens', { registrationClosesAt: OPENS }],
    ['closes after the session starts', { registrationClosesAt: '2026-06-11T00:00:00.000Z' }],
  ])('rejects a window that %s', (_label, overrides) => {
    expect(errorCode(() => newSession(overrides))).toBe('INVALID_WINDOW');
  });

  it('lists only upcoming sessions, soonest first, without participant data', () => {
    newSession({ title: 'Later', startsAt: '2026-06-20T18:00:00.000Z' });
    newSession({ title: 'Sooner' });
    setNow('2026-06-05T12:00:00.000Z');

    const titles = service.listUpcoming().map((s) => s.title);
    expect(titles).toEqual(['Sooner', 'Later']);

    setNow('2026-06-15T00:00:00.000Z'); // "Sooner" has started
    expect(service.listUpcoming().map((s) => s.title)).toEqual(['Later']);
    expect(Object.keys(service.listUpcoming()[0]!)).not.toContain('participants');
  });
});

describe('unknown session', () => {
  it('returns SESSION_NOT_FOUND', () => {
    expect(errorCode(() => service.register('nope', 'a@x.com'))).toBe(
      'SESSION_NOT_FOUND',
    );
  });
});
