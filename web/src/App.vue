<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface Session {
  id: string
  title: string
  startsAt: string
  capacity: number
  seatsRemaining: number
  registrationOpensAt: string
  registrationClosesAt: string
}

interface Status {
  ok: boolean
  text: string
}

// Friendly text per API error code. Anything else falls back to the server's message.
const ERROR_TEXT: Record<string, string> = {
  SESSION_FULL: 'Sorry, this session is full.',
  REGISTRATION_CLOSED: 'Registration for this session has closed.',
  REGISTRATION_NOT_OPEN: 'Registration for this session has not opened yet.',
  ALREADY_REGISTERED: 'You are already registered for this session.',
  SESSION_NOT_FOUND: 'This session no longer exists.',
}

const sessions = ref<Session[]>([])
const email = ref('')
const loadError = ref('')
const statuses = ref<Record<string, Status>>({})

const fmt = (iso: string) => new Date(iso).toLocaleString()

async function load() {
  try {
    const res = await fetch('/api/sessions')
    if (!res.ok) throw new Error()
    sessions.value = await res.json()
    loadError.value = ''
  } catch {
    loadError.value = 'Could not load sessions.'
  }
}

async function register(session: Session) {
  try {
    const res = await fetch(`/api/sessions/${session.id}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })
    const body = await res.json().catch(() => ({}))

    if (res.ok) {
      statuses.value[session.id] = { ok: true, text: 'You are registered!' }
      sessions.value = sessions.value.map((s) => (s.id === session.id ? body : s))
      return
    }

    // Validation errors (400) have no `code` and `message` is an array.
    const fallback = Array.isArray(body.message) ? body.message.join(', ') : body.message
    statuses.value[session.id] = {
      ok: false,
      text: ERROR_TEXT[body.code] ?? fallback ?? 'Something went wrong.',
    }
    // Seats may have changed (e.g. someone else took the last one).
    if (body.code === 'SESSION_FULL') await load()
  } catch {
    statuses.value[session.id] = { ok: false, text: 'Network error. Please try again.' }
  }
}

onMounted(load)
</script>

<template>
  <h1>Upcoming sessions</h1>

  <label>
    Your email:
    <input v-model="email" type="email" placeholder="you@example.com" />
  </label>

  <p v-if="loadError" style="color: red">{{ loadError }}</p>
  <p v-else-if="sessions.length === 0">No upcoming sessions.</p>

  <ul>
    <li v-for="s in sessions" :key="s.id" style="margin-bottom: 1rem">
      <strong>{{ s.title }}</strong><br />
      Starts: {{ fmt(s.startsAt) }}<br />
      Registration: {{ fmt(s.registrationOpensAt) }} to {{ fmt(s.registrationClosesAt) }}<br />
      Seats remaining: {{ s.seatsRemaining }} / {{ s.capacity }}<br />
      <button @click="register(s)">Register</button>
      <span v-if="statuses[s.id]" :style="{ color: statuses[s.id]?.ok ? 'green' : 'red' }">
        {{ statuses[s.id]?.text }}
      </span>
    </li>
  </ul>
</template>
