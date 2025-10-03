<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3000";
const socket = io(backendUrl, { autoConnect: true });

const messages = ref([]);
const input = ref("");
const joinInput = ref("");
const messagesContainer = ref(null);
const latestError = ref("");
const sending = ref(false);
const isHistoryLoading = ref(false);
const roomCode = ref("");
const roomReady = ref(false);
const isJoining = ref(false);
const isCreating = ref(false);

const STORAGE_KEY_USER = "chat-poc-user-id";
const STORAGE_KEY_ROOM = "chat-poc-room-code";
const localUserId = ref("");

if (typeof window !== "undefined") {
  const existing = window.sessionStorage.getItem(STORAGE_KEY_USER);
  if (existing) {
    localUserId.value = existing;
  } else {
    localUserId.value = `user-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(STORAGE_KEY_USER, localUserId.value);
  }
}

const agent = {
  name: "Beata",
  statusOnline: "We are online!",
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

async function scrollToBottom({ smooth = false } = {}) {
  await nextTick();
  const el = messagesContainer.value;
  if (!el) return;
  requestAnimationFrame(() => {
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    } catch (error) {
      el.scrollTop = el.scrollHeight;
    }
  });
}

function normalizeMessage(message) {
  return {
    ...message,
    createdAt: message.createdAt ?? new Date().toISOString(),
  };
}

async function upsertMessage(message) {
  const normalized = normalizeMessage(message);
  const index = messages.value.findIndex((m) => m.id === normalized.id);
  if (index >= 0) {
    messages.value.splice(index, 1, normalized);
  } else {
    messages.value.push(normalized);
  }
  messages.value.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  await scrollToBottom({ smooth: true });
}

function waitForConnection() {
  if (socket.connected) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    socket.once("connect", resolve);
    socket.connect();
  });
}

function createRoomOnServer() {
  return new Promise((resolve, reject) => {
    socket.emit("room:create", (ack) => {
      if (ack?.ok && ack.room?.code) {
        resolve(ack.room.code);
      } else {
        reject(new Error(ack?.error ?? "Unable to create room"));
      }
    });
  });
}

function joinRoomOnServer(code) {
  return new Promise((resolve, reject) => {
    socket.emit(
      "room:join",
      { code, nickname: localUserId.value },
      (ack) => {
        if (ack?.ok) {
          resolve(code);
        } else {
          reject(new Error(ack?.error ?? "Unable to join room"));
        }
      }
    );
  });
}

async function loadHistory(code, { silent = false } = {}) {
  if (!silent) {
    isHistoryLoading.value = true;
  }
  try {
    const response = await fetch(
      `${backendUrl}/api/messages?limit=50&roomCode=${encodeURIComponent(code)}`
    );
    if (!response.ok) {
      throw new Error("Failed to load conversation");
    }
    const data = await response.json();
    const ordered = data
      .map(normalizeMessage)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    messages.value = ordered;
    await scrollToBottom();
    return true;
  } catch (err) {
    latestError.value =
      err instanceof Error ? err.message : "Unable to load chat history";
    return false;
  } finally {
    if (!silent) {
      isHistoryLoading.value = false;
    }
  }
}

async function setActiveRoom(code, { persist = true } = {}) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) {
    latestError.value = "Room code is required";
    return false;
  }

  roomCode.value = normalized;
  roomReady.value = true;
  messages.value = [];
  latestError.value = "";

  const loaded = await loadHistory(normalized);
  if (!loaded) {
    roomReady.value = false;
    roomCode.value = "";
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY_ROOM);
    }
    return false;
  }

  if (persist && typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY_ROOM, normalized);
  }
  return true;
}

async function createNewRoom() {
  isCreating.value = true;
  latestError.value = "";
  try {
    await waitForConnection();
    const code = await createRoomOnServer();
    await setActiveRoom(code);
    joinInput.value = "";
  } catch (err) {
    latestError.value = err instanceof Error ? err.message : "Room error";
  } finally {
    isCreating.value = false;
  }
}

async function joinExistingRoom() {
  const normalized = joinInput.value.trim().toLowerCase();
  if (!normalized) {
    latestError.value = "Enter a room code to join";
    return;
  }

  isJoining.value = true;
  latestError.value = "";
  try {
    await waitForConnection();
    await joinRoomOnServer(normalized);
    const ok = await setActiveRoom(normalized);
    if (ok) {
      joinInput.value = "";
    }
  } catch (err) {
    latestError.value = err instanceof Error ? err.message : "Unable to join room";
  } finally {
    isJoining.value = false;
  }
}

async function resumeStoredRoom() {
  if (typeof window === "undefined") {
    return;
  }
  const stored = window.sessionStorage.getItem(STORAGE_KEY_ROOM);
  if (!stored) {
    return;
  }
  try {
    await waitForConnection();
    await joinRoomOnServer(stored);
    await setActiveRoom(stored, { persist: false });
  } catch (err) {
    window.sessionStorage.removeItem(STORAGE_KEY_ROOM);
    latestError.value = err instanceof Error ? err.message : "Room not available";
    roomReady.value = false;
    roomCode.value = "";
  }
}

async function sendMessage() {
  if (!roomReady.value) {
    return;
  }

  const messageText = input.value.trim();
  if (!messageText || sending.value) {
    return;
  }

  const payload = {
    roomCode: roomCode.value,
    sender: localUserId.value,
    content: messageText,
  };

  input.value = "";
  sending.value = true;

  socket.emit("chat:send", payload, async (ack) => {
    sending.value = false;
    if (!ack?.ok) {
      latestError.value = ack?.error ?? "Unable to deliver message";
    } else {
      latestError.value = "";
      await scrollToBottom({ smooth: true });
    }
  });
}

let messageHandler = null;
let participantJoinedHandler = null;

onMounted(async () => {
  await resumeStoredRoom();
  messageHandler = async (message) => {
    if (message?.roomCode && message.roomCode !== roomCode.value) {
      return;
    }
    latestError.value = "";
    await upsertMessage(message);
  };
  participantJoinedHandler = async ({ roomCode: joinedCode } = {}) => {
    if (!roomReady.value || !joinedCode || joinedCode !== roomCode.value) {
      return;
    }
    const previousLength = messages.value.length;
    const success = await loadHistory(roomCode.value, { silent: true });
    if (success && messages.value.length > previousLength) {
      await scrollToBottom({ smooth: true });
    }
  };
  socket.on("chat:message", messageHandler);
  socket.on("room:participant-joined", participantJoinedHandler);
});

onBeforeUnmount(() => {
  if (messageHandler) {
    socket.off("chat:message", messageHandler);
  }
  if (participantJoinedHandler) {
    socket.off("room:participant-joined", participantJoinedHandler);
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
            <p>{{ agent.statusOnline }}</p>
            <p class="chat-room" v-if="roomReady">
              Room code: <strong>{{ roomCode }}</strong>
            </p>
            <p class="chat-room" v-else>Join an existing room or create a new one.</p>
          </div>
          <button
            class="chat-header__action"
            type="button"
            aria-label="Conversation options"
          >
            ?
          </button>
        </header>

        <div class="chat-room-controls">
          <div v-if="roomReady" class="chat-room-controls__code">
            <span class="chat-room-controls__badge">{{ roomCode }}</span>
            <span>Share this code so others can join.</span>
          </div>
          <div class="chat-room-controls__form">
            <input
              v-model="joinInput"
              class="chat-room-controls__input"
              type="text"
              placeholder="Enter a room code"
              :disabled="isJoining || isCreating"
              @keyup.enter.prevent="joinExistingRoom"
            />
            <button
              class="chat-room-controls__join"
              type="button"
              :disabled="isJoining || isCreating || !joinInput.trim()"
              @click="joinExistingRoom"
            >
              {{ isJoining ? "Joining…" : "Join" }}
            </button>
          </div>
          <button
            class="chat-room-controls__create"
            type="button"
            :disabled="isCreating"
            @click="createNewRoom"
          >
            {{ isCreating ? "Creating…" : "Create new room" }}
          </button>
        </div>
      </div>

      <main class="chat-body" ref="messagesContainer">
        <template v-if="!roomReady">
          <div class="chat-placeholder">
            Enter a room code above or create a new room to start chatting.
          </div>
        </template>
        <template v-else-if="isHistoryLoading">
          <div class="chat-placeholder">Loading conversation…</div>
        </template>
        <template v-else-if="!messages.length">
          <div class="chat-placeholder">No messages yet. Say hi ??</div>
        </template>
        <template v-else>
          <article
            v-for="message in messages"
            :key="message.id ?? `${message.sender}-${message.createdAt}`"
            :class="[
              'chat-message',
              message.sender === localUserId
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
        </template>
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
            :disabled="sending || !roomReady"
            @keyup.enter="sendMessage"
          />
          <button
            class="chat-send"
            type="button"
            :disabled="sending || !roomReady || !input.trim()"
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
  width: min(500px, 100%);
  height: min(780px, calc(100vh - 64px));
  max-height: 780px;
}

.chat-card {
  background: #ffffff;
  border-radius: 28px;
  box-shadow: 0 40px 70px -35px rgba(77, 56, 199, 0.38);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-height: 620px;
}

chat-top {
  background: linear-gradient(135deg, #5b37ff, #9b4dff);
  padding: 28px 28px 30px;
  color: #ffffff;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 18px;
}

.chat-header__avatar {
  width: 64px;
  height: 64px;
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
  font-size: 0.82rem;
  opacity: 0.8;
}

.chat-header__meta h1 {
  margin: 4px 0 2px;
  font-size: 1.55rem;
  font-weight: 600;
}

.chat-header__meta p {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.85;
}

.chat-room {
  font-size: 0.88rem;
  opacity: 0.9;
}

.chat-header__action {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 1.6rem;
  cursor: pointer;
  padding: 4px 6px;
}

.chat-room-controls {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-room-controls__code {
  display: flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.18);
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 0.88rem;
}

.chat-room-controls__badge {
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.32);
  padding: 7px 14px;
  border-radius: 999px;
}

.chat-room-controls__form {
  display: flex;
  gap: 12px;
}

.chat-room-controls__input {
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  color: #ffffff;
  padding: 11px 18px;
  font-size: 0.9rem;
  outline: none;
}

.chat-room-controls__input::placeholder {
  color: rgba(255, 255, 255, 0.72);
}

.chat-room-controls__join,
.chat-room-controls__create {
  border: none;
  border-radius: 999px;
  padding: 11px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.chat-room-controls__join {
  background: #ffffff;
  color: #5b37ff;
  box-shadow: 0 16px 30px -20px rgba(0, 0, 0, 0.8);
}

.chat-room-controls__create {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.24);
  color: #ffffff;
}

.chat-room-controls__join:disabled,
.chat-room-controls__create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.chat-room-controls__join:not(:disabled):hover,
.chat-room-controls__create:not(:disabled):hover {
[... truncated ...]
