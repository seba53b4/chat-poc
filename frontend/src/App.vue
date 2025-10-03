<script setup>
import { ref, onMounted } from "vue";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // ajustá si usás otro puerto
const messages = ref([]);
const input = ref("");

// simular un "usuario" local con id random
const localUserId = Math.random().toString(36).substring(2, 8);

onMounted(() => {
  // escuchar mensajes que envía el server
  socket.on("chat:message", (msg) => {
    messages.value.unshift(msg); // agrego al inicio (orden inverso por createdAt desc)
  });

  // opcional: pedir historial inicial vía REST
  fetch("http://localhost:3000/api/messages?limit=20")
    .then((res) => res.json())
    .then((data) => {
      // backend devuelve orden DESC → lo invertimos para mostrar cronológico
      messages.value = data.reverse();
    });
});

function sendMessage() {
  if (input.value.trim()) {
    socket.emit(
      "chat:send",
      { userId: localUserId, content: input.value },
      (ack) => {
        if (!ack.ok) {
          console.error("Error al enviar:", ack.error);
        }
      }
    );
    input.value = "";
  }
}
</script>

<template>
  <div class="chat">
    <h1>💬 Chat POC</h1>
    <div class="messages">
      <div v-for="m in messages" :key="m.id" class="msg">
        <strong>{{ m.userId }}:</strong>
        {{ m.content }}
        <span class="time">
          {{ new Date(m.createdAt).toLocaleTimeString() }}
        </span>
      </div>
    </div>
    <div class="input-area">
      <input
        v-model="input"
        @keyup.enter="sendMessage"
        placeholder="Escribe un mensaje..."
      />
      <button @click="sendMessage">Enviar</button>
    </div>
  </div>
</template>

<style>
.chat {
  width: 400px;
  margin: auto;
  padding: 20px;
  border: 1px solid #ccc;
  display: flex;
  flex-direction: column;
}
.messages {
  flex: 1;
  height: 300px;
  overflow-y: auto;
  margin-bottom: 10px;
  border: 1px solid #eee;
  padding: 5px;
  display: flex;
  flex-direction: column-reverse; /* el último abajo */
}
.msg {
  margin-bottom: 6px;
}
.time {
  font-size: 0.75rem;
  color: #888;
  margin-left: 6px;
}
.input-area {
  display: flex;
  gap: 6px;
}
input {
  flex: 1;
  padding: 6px;
}
button {
  padding: 6px 12px;
}
</style>
