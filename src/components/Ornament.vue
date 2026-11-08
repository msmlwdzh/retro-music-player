<script setup>
/**
 * ============================================================
 *  Ornament.vue —— 极简装饰构件（配合灰粉 × 炭黑的克制风格）
 * ------------------------------------------------------------
 *  只提供四种「几何级」的装饰：角线、分隔线、短枝、同心圆。
 *  没有卷草、花瓣、连珠纹样——装饰只用来做分区和收边，
 *  不参与视觉争夺。颜色一律取 currentColor，由外层 text-line /
 *  text-ink 控制浓淡。
 *
 *  用法：
 *    <Ornament kind="corner"  class="h-8 w-8 text-line" />
 *    <Ornament kind="rule"    class="h-3 w-full text-line" />
 *    <Ornament kind="spray"   class="h-3.5 w-14 text-line" />
 *    <Ornament kind="rosette" class="h-8 w-8 text-line" />
 * ============================================================
 */
defineProps({
  /** corner 角线 | rule 分隔线 | spray 短枝 | rosette 同心圆 */
  kind: { type: String, default: 'corner' },
})
</script>

<template>
  <!-- 角线：一条直角折线 + 端点小圆，四角可镜像复用 -->
  <svg v-if="kind === 'corner'" viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M6 42 V14 A8 8 0 0 1 14 6 H42" stroke-width="1.2" stroke-linecap="round" />
    <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="6" cy="42" r="2" fill="currentColor" stroke="none" />
  </svg>

  <!-- 分隔线：两侧细线 + 中央小菱形 -->
  <svg v-else-if="kind === 'rule'" viewBox="0 0 160 14" fill="none" aria-hidden="true">
    <path d="M2 7 H70" stroke="currentColor" stroke-width="1" opacity=".7" />
    <path d="M90 7 H158" stroke="currentColor" stroke-width="1" opacity=".7" />
    <path d="M80 3 L85 7 L80 11 L75 7 Z" fill="currentColor" />
  </svg>

  <!-- 短枝：一条细线 + 端点圆点，用于小标题旁 -->
  <svg v-else-if="kind === 'spray'" viewBox="0 0 72 20" fill="none" aria-hidden="true">
    <path d="M4 14 H62" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    <circle cx="66" cy="14" r="2.4" fill="currentColor" />
  </svg>

  <!-- 同心圆：轴心盖 / 徽记，两层细环 + 中心点 -->
  <svg v-else viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="1" opacity=".6" />
    <circle cx="20" cy="20" r="10" stroke="currentColor" stroke-width="1" opacity=".45" />
    <circle cx="20" cy="20" r="3" fill="currentColor" />
  </svg>
</template>
