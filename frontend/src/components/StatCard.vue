<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: "—" },
  hint: { type: String, default: "" },
  tone: { type: String, default: "neutral" }
});

const tones = {
  neutral: "text-ink-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-red-700"
};
</script>

<template>
  <!--
    Telefonda kutular ikişerli diziliyor, yani genişlik yarıya iniyor.
    Sayı orada text-2xl kalsaydı uzun tutarlar ("₺268.399,00") kutuyu
    esnetiyordu; bu yüzden telefonda bir ölçü küçük ve break-words açık.
  -->
  <article class="card min-w-0 p-3 sm:p-4">
    <p class="text-[11px] font-medium uppercase tracking-wide text-ink-500 sm:text-xs">{{ label }}</p>
    <p class="mt-1.5 break-words text-xl font-bold sm:mt-2 sm:text-2xl" :class="tones[tone] || tones.neutral">
      {{ value }}
    </p>
    <p v-if="hint" class="mt-1 text-xs text-ink-500">{{ hint }}</p>
  </article>
</template>
