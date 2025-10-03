<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const socket = io(backendUrl, { autoConnect: true });

const messages = ref([]);
const input = ref("");
const messagesContainer = ref(null);
const latestError = ref("");
const sending = ref(false);
const isHistoryLoading = ref(true);

const STORAGE_KEY = "chat-poc-user-id";
const localUserId = ref("");

if (typeof window !== "undefined") {
  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing) {
    localUserId.value = existing;
  } else {
    localUserId.value = `user-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(STORAGE_KEY, localUserId.value);
  }
}

const agent = {
  name: "Beata",
  status: "We are online!",
  avatar:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
};

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

function upsertMessage(message) {
  const index = messages.value.findIndex((m) => m.id === message.id);
  if (index >= 0) {
    messages.value.splice(index, 1, message);
  } else {
    messages.value.push(message);
  }
  messages.value.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  scrollToBottom();
}

async function loadHistory() {
  try {
    const response = await fetch(`${backendUrl}/api/messages?limit=50`);
    if (!response.ok) {
      throw new Error("Failed to load conversation");
    }
    const data = await response.json();
    const ordered = [...data].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    messages.value = ordered;
    scrollToBottom();
  } catch (err) {
    latestError.value =
      err instanceof Error ? err.message : "Unable to load chat history";
  } finally {
    isHistoryLoading.value = false;
  }
}

function sendMessage() {
  const messageText = input.value.trim();
  if (!messageText || sending.value) {
    return;
  }

  const payload = {
    userId: localUserId.value,
    content: messageText,
  };

  input.value = "";
  sending.value = true;

  socket.emit("chat:send", payload, (ack) => {
    sending.value = false;
    if (!ack?.ok) {
      latestError.value = ack?.error ?? "Unable to deliver message";
      return;
    }
    latestError.value = "";
  });
}

let messageHandler = null;

onMounted(() => {
  loadHistory();
  messageHandler = (message) => {
    latestError.value = "";
    upsertMessage(message);
  };
  socket.on("chat:message", messageHandler);
});

onBeforeUnmount(() => {
  if (messageHandler) {
    socket.off("chat:message", messageHandler);
  }
  socket.close();
});
</script>

<template>
  <div class="chat-shell">
    <section class="chat-card">
      <div class="chat-top">
        <header class="chat-header">
          <div class="chat-header__avatar">
            <img :src="agent.avatar" alt="Support agent avatar" />
          </div>
          <div class="chat-header__meta">
            <span class="chat-header__label">Chat with</span>
            <h1>{{ agent.name }}</h1>
            <p>{{ agent.status }}</p>
          </div>
          <button
            class="chat-header__action"
            type="button"
            aria-label="Conversation options"
          >
            ?
          </button>
        </header>
      </div>

      <main class="chat-body" ref="messagesContainer">
        <div v-if="isHistoryLoading" class="chat-placeholder">
          Loading conversation…
        </div>
        <div v-else-if="!messages.length" class="chat-placeholder">
          Say hi ?? — Beata is here to help.
        </div>
        <article
          v-for="message in messages"
          :key="message.id ?? message.createdAt"
          :class="[
            'chat-message',
            message.userId === localUserId
              ? 'chat-message--outgoing'
              : 'chat-message--incoming'
          ]"
        >
          <div class="chat-message__bubble">
            <p>{{ message.content }}</p>
            <span class="chat-message__time">
              {{ formatTime(message.createdAt) }}
            </span>
          </div>
        </article>
      </main>

      <footer class="chat-footer">
        <transition name="fade">
          <p v-if="latestError" class="chat-error">{{ latestError }}</p>
        </transition>

        <div class="chat-input">
          <input
            v-model="input"
            type="text"
            placeholder="Enter your message..."
            :disabled="sending"
            @keyup.enter="sendMessage"
          />
          <button
            class="chat-send"
            type="button"
            :disabled="sending || !input.trim()"
            @click="sendMessage"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3.4 20.6 21 12 3.4 3.4l-.9 6.5 9.3 2.1-9.3 2.1z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.chat-shell {
  width: min(420px, 100%);
  height: min(640px, calc(100vh - 96px));
  max-height: 640px;
}

.chat-card {
  background: #ffffff;
  border-radius: 28px;
  box-shadow: 0 32px 60px -30px rgba(77, 56, 199, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-height: 520px;
}

.chat-top {
  background: linear-gradient(135deg, #5b37ff, #9b4dff);
  padding: 24px 24px 24px;
  color: #ffffff;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chat-header__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.chat-header__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-header__meta {
  flex: 1;
}

.chat-header__label {
  font-size: 0.8rem;
  opacity: 0.8;
}

.chat-header__meta h1 {
  margin: 4px 0 2px;
  font-size: 1.4rem;
  font-weight: 600;
}

.chat-header__meta p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
}

.chat-header__action {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 6px;
}

.chat-header__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-body {
  flex: 1;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  background: #ffffff;
}

.chat-body::-webkit-scrollbar {
  width: 6px;
}

.chat-body::-webkit-scrollbar-thumb {
  background-color: rgba(91, 55, 255, 0.2);
  border-radius: 999px;
}

.chat-placeholder {
  text-align: center;
  color: #7a7d95;
  font-size: 0.9rem;
  margin: auto 0;
}

.chat-message {
  display: flex;
}

.chat-message--incoming {
  justify-content: flex-start;
}

.chat-message--outgoing {
  justify-content: flex-end;
}

.chat-message__bubble {
  max-width: 82%;
  padding: 12px 16px;
  border-radius: 18px;
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.95rem;
  line-height: 1.4;
}

.chat-message--incoming .chat-message__bubble {
  background: #f4f5ff;
  color: #1c1c28;
  border-bottom-left-radius: 6px;
}

.chat-message--outgoing .chat-message__bubble {
  background: linear-gradient(135deg, #5b37ff, #884dff);
  color: #ffffff;
  border-bottom-right-radius: 6px;
  align-items: flex-end;
}

.chat-message__bubble p {
  margin: 0;
  white-space: pre-wrap;
}

.chat-message__time {
  font-size: 0.7rem;
  opacity: 0.7;
  align-self: flex-end;
}

.chat-footer {
  padding: 18px 24px 26px;
  background: #ffffff;
}

.chat-error {
  margin: 0 0 12px;
  color: #f26d69;
  font-size: 0.78rem;
  text-align: center;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f3f4ff;
  border-radius: 999px;
  padding: 8px 12px;
  border: 1px solid #e0e3ff;
}

.chat-input input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: #1d2136;
  padding: 8px 6px;
  outline: none;
}

.chat-send {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #5b37ff, #884dff);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 12px 20px -12px rgba(91, 55, 255, 0.9);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.chat-send:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 24px -14px rgba(91, 55, 255, 0.9);
}

.chat-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .chat-shell {
    height: min(520px, calc(100vh - 48px));
    max-height: 520px;
  }

  .chat-card {
    border-radius: 22px;
    min-height: 460px;
  }

  .chat-top {
    padding: 20px 20px 20px;
  }

  .chat-body {
    padding: 20px 18px;
  }

  .chat-footer {
    padding: 16px 18px 22px;
  }
}
</style>
