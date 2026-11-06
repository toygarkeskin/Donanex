<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, query } from "../../lib/api";
import { formatDate, TICKET_STATUS } from "../../lib/format";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const page = ref(1);
const open = ref(null);
const detail = ref(null);

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/me/tickets${query({ page: page.value })}`);
  } finally {
    loading.value = false;
  }
}

async function show(ticket) {
  if (open.value === ticket.id) {
    open.value = null;
    return;
  }
  open.value = ticket.id;
  detail.value = await api.get(`/me/tickets/${ticket.id}`);
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Destek taleplerim">
      <template #actions>
        <RouterLink :to="{ name: 'support' }" class="btn-primary">+ Yeni talep</RouterLink>
      </template>
    </PageHeader>

    <LoadingBlock v-if="loading" :rows="3" />

    <EmptyState
      v-else-if="!result.items.length"
      title="Henüz destek talebiniz yok"
      description="Bir sorun yaşarsanız destek ekibimize yazabilirsiniz."
      icon="💬"
    >
      <RouterLink :to="{ name: 'support' }" class="btn-primary">Talep oluştur</RouterLink>
    </EmptyState>

    <div v-else class="space-y-3">
      <article v-for="ticket in result.items" :key="ticket.id" class="card overflow-hidden">
        <button
          type="button"
          class="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-ink-50"
          @click="show(ticket)"
        >
          <span class="font-mono text-xs text-ink-500">{{ ticket.reference }}</span>
          <span class="min-w-40 flex-1 font-medium text-ink-800">{{ ticket.subject }}</span>
          <StatusBadge :map="TICKET_STATUS" :value="ticket.status" />
          <span class="text-sm text-ink-500">{{ formatDate(ticket.createdAt, false) }}</span>
        </button>

        <div v-if="open === ticket.id && detail" class="border-t border-ink-100 bg-ink-50 p-4">
          <p class="whitespace-pre-line text-sm text-ink-700">{{ detail.message }}</p>

          <div v-if="detail.messages?.length" class="mt-4 space-y-3">
            <div
              v-for="message in detail.messages"
              :key="message.id"
              class="rounded-lg border p-3 text-sm"
              :class="message.isStaff ? 'border-brand-200 bg-surface' : 'border-ink-200 bg-surface'"
            >
              <p class="mb-1 text-xs font-medium text-ink-500">
                {{ message.isStaff ? "Destek ekibi" : "Siz" }} · {{ formatDate(message.createdAt) }}
              </p>
              <p class="whitespace-pre-line text-ink-700">{{ message.body }}</p>
            </div>
          </div>
          <p v-else class="mt-3 text-sm text-ink-500">Henüz yanıt verilmedi.</p>
        </div>
      </article>

      <PaginationBar
        :page="result.page"
        :pages="result.pages"
        :total="result.total"
        unit="talep"
        @change="(next) => { page = next; load(); }"
      />
    </div>
  </div>
</template>
