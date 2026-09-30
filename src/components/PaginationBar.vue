<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import AppSelect from "./AppSelect.vue";
import { t } from "../lib/store";
const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    total?: number;
    hasNext?: boolean;
    busy?: boolean;
    compact?: boolean;
  }>(),
  { total: -1, hasNext: false, busy: false },
);
const emit = defineEmits<{
  "update:page": [number];
  "update:pageSize": [number];
}>();
const pages = computed(() =>
  Math.max(props.page, 1, Math.ceil(props.total / props.pageSize)),
);
</script>
<template>
  <nav
    class="pagination-bar"
    :class="{ 'is-compact': compact }"
    :aria-label="t('分页导航', 'Pagination')"
  >
    <span class="pagination-summary muted" aria-live="polite">
      {{
        total >= 0
          ? t("共 " + total + " 条", total + " items")
          : t("逐页加载", "Paged results")
      }}
    </span>
    <div class="pagination-actions">
      <AppSelect
        compact
        :model-value="String(pageSize)"
        :aria-label="t('每页数量', 'Page size')"
        :disabled="busy"
        :options="
          [25, 50, 100, 200].map((n) => ({
            value: String(n),
            label: n + t(' 条/页', ' / page'),
          }))
        "
        @update:model-value="emit('update:pageSize', Number($event))"
      />
      <div class="pagination-navigation">
        <button
          class="pagination-step"
          type="button"
          :disabled="busy || page <= 1"
          :aria-label="t('上一页', 'Previous page')"
          :title="t('上一页', 'Previous page')"
          @click="emit('update:page', page - 1)"
        >
          <ChevronLeft :size="16" />
        </button>
        <span
          class="pagination-current"
          aria-live="polite"
          aria-atomic="true"
          :title="
            total >= 0
              ? t('共 ' + total + ' 条', total + ' items')
              : t('逐页加载', 'Paged results')
          "
        >
          {{ page }}<template v-if="total >= 0"> / {{ pages }}</template>
        </span>
        <button
          class="pagination-step"
          type="button"
          :disabled="busy || (total >= 0 ? page >= pages : !hasNext)"
          :aria-label="t('下一页', 'Next page')"
          :title="t('下一页', 'Next page')"
          @click="emit('update:page', page + 1)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
  </nav>
</template>
