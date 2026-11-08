<script setup>
/**
 * ============================================================
 *  AudioKnob.vue —— 拟物拖拽旋钮
 * ------------------------------------------------------------
 *  · 角度范围 0~270°：起点 -135°（最小）、终点 +135°（最大），
 *    映射到 0~1 的值域（音量、音色等通用）。
 *  · 支持鼠标与触摸拖拽（Pointer Events 一套打通），
 *    拖拽时用 GSAP 短缓动收敛，手感跟手但不生硬。
 *  · 支持 v-model：值变化同时写回 audio 音量（调用方决定怎么接）。
 *  · 键盘可达：聚焦后用 ← → 微调，无障碍不被落下。
 * ============================================================
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { DUR, EASE, clamp } from '@/utils/anim'

const props = defineProps({
  /** @model 0~1 */
  modelValue: { type: Number, default: 0.5 },
  /** 旋钮直径（px） */
  size: { type: Number, default: 68 },
  /** 刻度文字 / 无障碍标签 */
  label: { type: String, default: '音量' },
})

const emit = defineEmits(['update:modelValue', 'change'])

/* ------------------------- 角度映射 ------------------------- */

const START = -135 // 最小值对应角度
const SWEEP = 270 // 总扫程

/**
 * 旋转中心：SVG 用户坐标下的圆心（viewBox 是 100×100，圆心在 50,50）。
 * 必须显式给 svgOrigin —— 只写 rotation 时 GSAP 会退化到图形包围盒的左上角转，
 * 旋钮本体就会被甩出画布、被 svg 的 overflow:hidden 裁掉一半。
 * 与 Record.vue / ToneArm.vue / Tape.vue 的处理方式保持一致。
 */
const ORIGIN = '50 50'

const value = computed(() => clamp(props.modelValue))
/** 0~1 → -135° ~ +135° */
const angle = computed(() => START + value.value * SWEEP)

/* ------------------------- 拖拽 ------------------------- */

const wrapRef = ref(null)
const knobRef = ref(null)
const dragging = ref(false)

/** 把角度写进 DOM：松手或外部值变化时走短缓动，拖拽中直接跟手 */
function renderAngle(a, animate = true) {
  if (!knobRef.value) return
  const vars = { rotation: a, svgOrigin: ORIGIN }
  if (animate) {
    gsap.to(knobRef.value, { ...vars, duration: DUR.knob, ease: EASE.knob, overwrite: 'auto' })
  } else {
    gsap.set(knobRef.value, vars)
  }
}

/** 由指针位置反算角度：以 12 点方向为 0°，顺时针为正 */
function angleFromPointer(e) {
  const rect = wrapRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = e.clientX - cx
  const dy = e.clientY - cy
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  // 底部死区（-180~-135 与 135~180）归并到就近端点，避免跨过 6 点方向时数值跳变
  if (deg < START) deg = deg < -157.5 ? START : START + SWEEP
  else if (deg > START + SWEEP) deg = START + SWEEP
  return Math.max(START, Math.min(START + SWEEP, deg))
}

function commitFromAngle(deg) {
  const v = (deg - START) / SWEEP
  const next = Math.round(clamp(v) * 100) / 100
  if (next === value.value) return
  emit('update:modelValue', next)
  emit('change', next)
}

function onPointerDown(e) {
  dragging.value = true
  wrapRef.value.setPointerCapture?.(e.pointerId)
  commitFromAngle(angleFromPointer(e))
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!dragging.value) return
  commitFromAngle(angleFromPointer(e))
}

function onPointerUp(e) {
  dragging.value = false
  wrapRef.value?.releasePointerCapture?.(e.pointerId)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

/** 键盘微调（步长 0.05） */
function onKeydown(e) {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0
  if (!step) return
  e.preventDefault()
  const next = Math.round(clamp(value.value + step) * 100) / 100
  emit('update:modelValue', next)
  emit('change', next)
}

/* ------------------------- 同步 ------------------------- */

// 外部（如 store 音量）变化时同步旋钮角度
watch(angle, (a) => {
  if (!dragging.value) renderAngle(a, true)
})

// 初始角度：watch 不带 immediate，这里补一次，避免首帧停在 0°
onMounted(() => renderAngle(angle.value, false))

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

/* ------------------------- 刻度 ------------------------- */

const TICKS = Array.from({ length: 10 }, (_, i) => {
  const a = START + (i / 9) * SWEEP
  const rad = ((a - 90) * Math.PI) / 180
  const r1 = 44
  const r2 = 38
  return {
    x1: 50 + r1 * Math.cos(rad),
    y1: 50 + r1 * Math.sin(rad),
    x2: 50 + r2 * Math.cos(rad),
    y2: 50 + r2 * Math.sin(rad),
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-1 select-none">
    <div
      ref="wrapRef"
      class="relative cursor-grab rounded-full active:cursor-grabbing"
      :style="{ width: size + 'px', height: size + 'px', touchAction: 'none' }"
      role="slider"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(value * 100)"
      tabindex="0"
      @pointerdown="onPointerDown"
      @keydown="onKeydown"
    >
      <svg viewBox="0 0 100 100" class="h-full w-full">
        <defs>
          <!-- 哑光石墨金属外圈：低反差，不做镜面 -->
          <linearGradient id="knob-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f5e6a8" />
            <stop offset="55%" stop-color="#d9be72" />
            <stop offset="100%" stop-color="#a98a3c" />
          </linearGradient>
          <!-- 旋钮顶面：炭黑，与机身撞色一致 -->
          <radialGradient id="knob-top" cx="38%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#10242d" />
            <stop offset="100%" stop-color="#0a1a20" />
          </radialGradient>
        </defs>

        <!-- 刻度：辅助线色 -->
        <g stroke="#8c1b57" stroke-width="1.6" stroke-linecap="round" opacity=".7">
          <line v-for="(t, i) in TICKS" :key="i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
        </g>
        <!-- 刻度内圈细线 -->
        <circle cx="50" cy="50" r="34" fill="none" stroke="#8c1b57" stroke-opacity=".45" stroke-width="1" />

        <!-- 旋钮本体 -->
        <g ref="knobRef">
          <circle cx="50" cy="50" r="31" fill="url(#knob-metal)" />
          <circle cx="50" cy="50" r="25" fill="url(#knob-top)" />
          <!-- 顶面一圈辅助细线 -->
          <circle cx="50" cy="50" r="22" fill="none" stroke="#8c1b57" stroke-opacity=".4" stroke-width=".8" />
          <!-- 中心轴点：极简，只留一个灰粉圆点 -->
          <circle cx="50" cy="50" r="2.2" fill="#f59ec4" />
          <!-- 指示线：灰粉，指向刻度 -->
          <line x1="50" y1="26" x2="50" y2="36" stroke="#f59ec4" stroke-width="3" stroke-linecap="round" />
          <!-- 滚花：极弱，只提供磨砂手感暗示 -->
          <g stroke="#f5e6a8" stroke-opacity=".14" stroke-width="1.4">
            <line v-for="i in 12" :key="i"
              :x1="50 + 27 * Math.cos(((i * 30 - 90) * Math.PI) / 180)"
              :y1="50 + 27 * Math.sin(((i * 30 - 90) * Math.PI) / 180)"
              :x2="50 + 31 * Math.cos(((i * 30 - 90) * Math.PI) / 180)"
              :y2="50 + 31 * Math.sin(((i * 30 - 90) * Math.PI) / 180)" />
          </g>
        </g>
        <circle cx="50" cy="50" r="31" fill="none" stroke="#0a1a20" stroke-opacity=".6" stroke-width="1" />
      </svg>
    </div>

    <span class="text-[10px] tracking-[0.08em] text-line tabular-nums">
      {{ label }} {{ Math.round(value * 100) }}
    </span>
  </div>
</template>
