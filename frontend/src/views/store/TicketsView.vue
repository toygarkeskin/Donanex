<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import { api, query } from "../../lib/api";
import { formatDate, TICKET_STATUS } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import FormField from "../../components/FormField.vue";

const route = useRoute();
const toast = useToastStore();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const filters = reactive({ status: "", page: 1 });
const selected = ref(null);
const reply = reactive({ body: "", status: "answered" });
const saving = ref(false);

const base = () => `/stores/${route.params.storeId}/tickets`;

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`${base()}${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

async function open(ticket) {
  selected.value = await api.get(`${base()}/${ticket.id}`);
  reply.body = "";
  reply.status = selected.value.status === "closed" ? "closed" : "answered";
}

async function send() {
  saving.value = true;
  try {
    const response = await api.put(`${base()}/${selected.value.id}`, { ...reply });
    toast.success(response.emailQueued ? "Yanıtınız kaydedildi ve müşteriye e-posta gönderiliyor." : response.message);
    await open(selected.value);
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Destek talepleri" description="Mağazanıza gelen müşteri talepleri." />

    <div class="mb-4 flex flex-wrap gap-3">
      <select v-model="filters.status" class="field w-auto" aria-label="Durum" @change="filters.page = 1; load()">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in TICKET_STATUS" :key="key" :value="key">{{ meta.label }}</option>
      </select>
    </div>

    <LoadingBlock v-if="loading" :rows="3" />
    <EmptyState v-else-if="!result.items.length" title="Destek talebi yok" icon="💬" />

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Konu</th>
                <th>Gönderen</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ticket in result.items"
                :key="ticket.id"
                class="cursor-pointer hover:bg-ink-50"
                :class="{ 'bg-brand-50': selected?.id === ticket.id }"
                @click="open(ticket)"
              >
                <td class="font-mono text-xs text-ink-500">{{ ticket.reference }}</td>
                <td class="font-medium text-ink-800">{{ ticket.subject }}</td>
                <td>
                  <p class="text-sm">{{ ticket.fullName }}</p>
                  <p class="text-xs text-ink-500">{{ formatDate(ticket.createdAt, false) }}</p>
                </td>
                <td><StatusBadge :map="TICKET_STATUS" :value="ticket.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar
          :page="result.page"
          :pages="result.pages"
          :total="result.total"
          unit="talep"
          @change="(next) => { filters.page = next; load(); }"
        />
      </div>

      <aside v-if="selected" class="card h-fit p-5">
        <h2 class="text-base font-semibold text-ink-900">{{ selected.subject }}</h2>
        <p class="mt-1 text-xs text-ink-500">
          {{ selected.reference }} · {{ selected.fullName }} · {{ selected.email }}
        </p>

        <p class="mt-4 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-700">
          {{ selected.message }}
        </p>

        <div v-if="selected.messages?.length" class="mt-4 space-y-3">
          <div
            v-for="message in selected.messages"
            :key="message.id"
            class="rounded-lg border border-ink-200 p-3 text-sm"
          >
            <p class="mb-1 text-xs font-medium text-ink-500">
              {{ message.isStaff ? "Mağaza" : "Müşteri" }} · {{ formatDate(message.createdAt) }}
            </p>
            <p class="whitespace-pre-line text-ink-700">{{ message.body }}</p>
          </div>
        </div>

        <form class="mt-5 space-y-3" @submit.prevent="send">
          <FormField id="reply" label="Yanıtınız" hint="Yanıt yazarsanız müşteriye e-posta gönderilir.">
            <textarea id="reply" v-model="reply.body" rows="4" class="field" maxlength="5000" />
          </FormField>
          <FormField id="status" label="Durum">
            <select id="status" v-model="reply.status" class="field">
              <option v-for="(meta, key) in TICKET_STATUS" :key="key" :value="key">{{ meta.label }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary w-full" :disabled="saving">
            {{ saving ? "Kaydediliyor…" : "Kaydet" }}
          </button>
        </form>
      </aside>
    </div>
  </div>
</template>
