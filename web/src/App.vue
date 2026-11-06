<script setup lang="ts">
import { ref, onMounted } from 'vue'

const sessions = ref<unknown[]>([])

onMounted(async () => {
  const res = await fetch('/api/sessions')
  sessions.value = await res.json()
})
</script>

<template>
  <h1>Sessions</h1>
  <p>Loaded {{ sessions.length }} sessions from the API.</p>
</template>
