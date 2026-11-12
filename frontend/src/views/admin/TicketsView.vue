<script setup>
import { nextTick, onMounted, reactive, ref, watch } from "vue";
import { api, query } from "../../lib/api";
import { formatDate, TICKET_STATUS, TICKET_PRIORITY } from "../../lib/format";
import { useToastStore } from "../../stores/toast";
import PageHeader from "../../components/PageHeader.vue";
import StatusBadge from "../../components/StatusBadge.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import EmptyState from "../../components/EmptyState.vue";
import PaginationBar from "../../components/PaginationBar.vue";
import FormField from "../../components/FormField.vue";
import TalepEkleri from "../../components/TalepEkleri.vue";
import AppIcon from "../../components/AppIcon.vue";

const toast = useToastStore();

const result = ref({ items: [], total: 0, page: 1, pages: 1 });
const loading = ref(true);
const filters = reactive({ q: "", status: "", priority: "", page: 1 });
const selected = ref(null);
const reply = reactive({ body: "", status: "answered", priority: "normal" });
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    result.value = await api.get(`/admin/tickets${query(filters)}`);
  } finally {
    loading.value = false;
  }
}

/*
 * Talep paneli dar ekranda listenin ALTINDA açılıyor; oraya kaydırmazsak
 * satıra tıklayan kullanıcı hiçbir şey olmamış sanıyor.
 */
const panel = ref(null);

async function open(ticket) {
  selected.value = await api.get(`/admin/tickets/${ticket.id}`);
  reply.body = "";
  reply.status = selected.value.status === "closed" ? "closed" : "answered";
  // Öncelik, talebin MEVCUT değeriyle açılıyor: form gönderildiğinde
  // dokunulmamış bir alan sessizce "normal"e düşmesin.
  reply.priority = selected.value.priority ?? "normal";
  await nextTick();
  if (window.innerWidth < 1280) panel.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function send() {
  saving.value = true;
  try {
    const response = await api.put(`/admin/tickets/${selected.value.id}`, { ...reply });
    toast.success(response.emailQueued ? "Yanıt kaydedildi, müşteriye e-posta gönderiliyor." : response.message);
    await open(selected.value);
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

/*
 * Arama HER TUŞTA değil, yazma durunca çalışıyor.
 *
 * Tam metin sorgusu indeksli ama yine de bir sorgu; "kargom gecikti"
 * yazarken on dört istek göndermenin karşılığı yok. 350 ms, yazmayı
 * bölmeden bekleyen bir aralık.
 */
let aramaZamanlayici;
watch(
  () => filters.q,
  () => {
    clearTimeout(aramaZamanlayici);
    aramaZamanlayici = setTimeout(() => {
      filters.page = 1;
      load();
    }, 350);
  }
);

onMounted(load);
</script>

<template>
  <div>
    <PageHeader title="Destek talepleri" description="Tüm mağazalara ve sisteme gelen talepler." />

    <div class="mb-4 flex flex-wrap gap-3">
      <!--
        Arama konu ve mesaj metninde çalışıyor (PostgreSQL tam metin, Türkçe
        kök bulucuyla): "kargom gecikti" yazınca "kargolar gecikiyor" diyen
        talep de çıkıyor. Talep numarası yazılırsa (DT-000123) doğrudan o
        talebe gidiliyor.
      -->
      <input
        v-model="filters.q"
        type="search"
        class="field max-w-xs"
        placeholder="Konu, mesaj veya talep no…"
        aria-label="Taleplerde ara"
      />
      <select v-model="filters.status" class="field w-auto" aria-label="Durum" @change="filters.page = 1; load()">
        <option value="">Tüm durumlar</option>
        <option v-for="(meta, key) in TICKET_STATUS" :key="key" :value="key">{{ meta.label }}</option>
      </select>
      <select v-model="filters.priority" class="field w-auto" aria-label="Öncelik" @change="filters.page = 1; load()">
        <option value="">Tüm öncelikler</option>
        <option v-for="(meta, key) in TICKET_PRIORITY" :key="key" :value="key">{{ meta.label }}</option>
      </select>
      <button
        v-if="filters.q || filters.status || filters.priority"
        type="button"
        class="btn-secondary"
        @click="filters.q = ''; filters.status = ''; filters.priority = ''; filters.page = 1; load()"
      >
        Temizle
      </button>
    </div>

    <LoadingBlock v-if="loading" :rows="3" />
    <EmptyState v-else-if="!result.items.length" title="Destek talebi yok" icon="destek" />

    <!--
      Yan panel xl'de (1280px) yana geçiyor, lg'de (1024px) değil.
      Ölçüm: 1024px ekranda kenar menü (256) ve boşluklar düşünce liste
      sütununa 290px kalıyordu; beş sütunlu tablo oraya sığmayıp kendi
      içinde yatay kayıyordu. Altında tam genişlikte durması daha iyi.
    -->
    <div v-else class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>No</th>
                <th>Konu</th>
                <th>Mağaza</th>
                <th>Öncelik</th>
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
                <td>
                  <p class="font-medium text-ink-800">{{ ticket.subject }}</p>
                  <p class="text-xs text-ink-500">{{ ticket.fullName }} · {{ formatDate(ticket.createdAt, false) }}</p>
                </td>
                <td class="text-sm text-ink-600">{{ ticket.storeName || "—" }}</td>
                <td>
                  <!-- "Normal" çizilmiyor: varsayılan değerin işarete ihtiyacı
                       yok ve her satırda gri bir etiket listeyi gürültüye
                       çevirirdi. Göz doğrudan sapan taleplere gidiyor. -->
                  <StatusBadge
                    v-if="ticket.priority && ticket.priority !== 'normal'"
                    :map="TICKET_PRIORITY"
                    :value="ticket.priority"
                  />
                  <span v-else class="text-xs text-ink-400">—</span>
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

      <aside v-if="selected" ref="panel" class="card h-fit p-5 scroll-mt-20">
        <h2 class="text-base font-semibold text-ink-900">{{ selected.subject }}</h2>
        <p class="mt-1 text-xs text-ink-500">{{ selected.reference }} · {{ selected.email }}</p>

        <p class="mt-4 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{{ selected.message }}</p>

        <div v-if="selected.messages?.length" class="mt-4 space-y-3">
          <div v-for="message in selected.messages" :key="message.id" class="rounded-lg border border-ink-200 p-3 text-sm">
            <p class="mb-1 text-xs font-medium text-ink-500">
              {{ message.isStaff ? "Ekip" : "Müşteri" }} · {{ formatDate(message.createdAt) }}
            </p>
            <p class="whitespace-pre-line text-ink-700">{{ message.body }}</p>
          </div>
        </div>

        <!-- Ekler: ekran görüntüsü, fatura, belge. İndirme yetkisi talebi
             görme yetkisiyle aynı ve her indirmede sunucuda soruluyor. -->
        <div class="mt-4">
          <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <AppIcon name="ek" :size="14" /> Ekler
          </p>
          <TalepEkleri
            :ekler="selected.attachments || []"
            :yukleme-yolu="`/admin/tickets/${selected.id}/ekler`"
            :indirme-yolu="(ekId) => `/admin/tickets/${selected.id}/ekler/${ekId}`"
            bakan="ekip"
            @eklendi="(ek) => selected.attachments = [...(selected.attachments || []), ek]"
          />
        </div>

        <form class="mt-5 space-y-3" @submit.prevent="send">
          <FormField id="reply" label="Yanıt" hint="Yanıt yazarsanız müşteriye e-posta gönderilir.">
            <textarea id="reply" v-model="reply.body" rows="4" class="field" maxlength="5000" />
          </FormField>
          <div class="grid grid-cols-2 gap-3">
            <FormField id="status" label="Durum">
              <select id="status" v-model="reply.status" class="field">
                <option v-for="(meta, key) in TICKET_STATUS" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </FormField>
            <FormField id="priority" label="Öncelik">
              <select id="priority" v-model="reply.priority" class="field">
                <option v-for="(meta, key) in TICKET_PRIORITY" :key="key" :value="key">{{ meta.label }}</option>
              </select>
            </FormField>
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="saving">
            {{ saving ? "Kaydediliyor…" : "Kaydet" }}
          </button>
        </form>
      </aside>
    </div>
  </div>
</template>
