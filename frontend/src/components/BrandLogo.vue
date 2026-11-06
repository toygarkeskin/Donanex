<script setup>
/*
 * Donanex marka işareti.
 *
 * Tasarım fikri: bir işlemci (çip) gövdesi ve kenarlarındaki pinler —
 * donanım satan bir pazar yerini tek bakışta anlatır. Gövdenin içindeki
 * boşluk "D" harfini oluşturur, yani harf çizilmez, çipten oyulur.
 *
 * Satır içi SVG olmasının sebebi: renkleri tema belirteçlerinden alır,
 * her ölçekte keskin kalır ve ayrı bir ağ isteği gerektirmez.
 */
defineProps({
  // Yalnızca işaret mi, yazıyla birlikte mi.
  withText: { type: Boolean, default: true },
  size: { type: Number, default: 32 }
});
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Donanex"
      class="shrink-0"
    >
      <!-- Çip pinleri: üstte, altta ve yanlarda üçer tane -->
      <g class="text-brand-600" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M11 2.5v3M16 2.5v3M21 2.5v3" />
        <path d="M11 26.5v3M16 26.5v3M21 26.5v3" />
        <path d="M2.5 11h3M2.5 16h3M2.5 21h3" />
        <path d="M26.5 11h3M26.5 16h3M26.5 21h3" />
      </g>

      <!-- Çip gövdesi -->
      <rect x="5" y="5" width="22" height="22" rx="5.5" class="text-brand-600" fill="currentColor" />

      <!--
        "D" harfi gövdeden OYULUYOR: evenodd kuralıyla ikinci yol delik açar.
        Böylece harf, zeminin rengini alır ve iki temada da doğru görünür.
      -->
      <path
        class="text-surface"
        fill="currentColor"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M11 10.5h4.6c3.3 0 5.4 2.2 5.4 5.5s-2.1 5.5-5.4 5.5H11V10.5Zm2.7 2.5v6h1.9c1.7 0 2.7-1.1 2.7-3s-1-3-2.7-3h-1.9Z"
      />
    </svg>

    <span v-if="withText" class="text-lg font-bold tracking-tight text-ink-900">Donanex</span>
  </span>
</template>
