<script setup>
/**
 * ============================================================
 *  Tape.vue —— 磁带本体（卡带盒 + 左右卷轴 + 带体）
 * ------------------------------------------------------------
 *  视觉规则：
 *    · 左右卷轴角速度由「带速恒定」反推：ω = K / r。
 *      播放过程中供带轮（左）越放越小 → 转得越快；
 *      收带轮（右）越卷越大 → 转得越慢。这就是真实磁带的手感。
 *    · 带体（两卷之间的外公切线）随卷径实时重算，视觉跟随 progress。
 *    · 停止时同样走惯性减速缓动，不硬停。
 *  对外暴露 flyOut() / flyIn()：磁带「取出 / 放入」，交给 TapeDeck 编排换带时序。
 * ============================================================
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import {
  DUR,
  EASE,
  clamp,
  createSpinTween,
  createTimeline,
  slowDownTween,
} from '@/utils/anim'

const props = defineProps({
  /** 封面 / 标签图 */
  coverImg: { type: String, default: '' },
  /** 播放进度 0~1 */
  progress: { type: Number, default: 0 },
  /** 是否播放 */
  isPlaying: { type: Boolean, default: false },
  /** 总时长（秒，可选） */
  duration: { type: Number, default: 0 },
})

/* ------------------------- 几何常量 ------------------------- */

const R_MIN = 15 // 空卷半径
const R_MAX = 42 // 满卷半径
const LX = 95 // 左卷心 x
const RX = 205 // 右卷心 x
const SY = 118 // 卷心 y
const BASE_R = (R_MIN + R_MAX) / 2 // 转速归一化基准半径
const DEFAULT_TURNS = 6 // 未知时长时按「一首歌 6 圈」映射

const holderRef = ref(null)
const spoolLRef = ref(null)
const spoolRRef = ref(null)

let spinL = null
let spinR = null
let slowL = null
let slowR = null
let ready = false

/* ------------------------- 卷径与带体 ------------------------- */

const p = computed(() => clamp(props.progress))
/** 供带轮（左）：播放推进 → 越放越小 */
const rL = computed(() => R_MIN + (1 - p.value) * (R_MAX - R_MIN))
/** 收带轮（右）：播放推进 → 越卷越大 */
const rR = computed(() => R_MIN + p.value * (R_MAX - R_MIN))

/**
 * 两卷之间下方那条外公切线 —— 就是看得见的那段磁带。
 * 推导：两圆同高，外公切线与圆心连线的夹角 φ 满足 sinφ = (r1 - r2) / d。
 */
const filmPath = computed(() => {
  const d = RX - LX
  const sin = Math.max(-1, Math.min(1, (rL.value - rR.value) / d))
  const cos = Math.sqrt(1 - sin * sin)
  const x1 = LX + rL.value * sin
  const y1 = SY + rL.value * cos
  const x2 = RX + rR.value * sin
  const y2 = SY + rR.value * cos
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`
})

/** progress → 卷轴累计转过的角度 */
function angleFromProgress(v) {
  const turns = props.duration > 0 ? props.duration / DUR.turn : DEFAULT_TURNS
  return v * turns * 360
}

/* ------------------------- 旋转控制 ------------------------- */

function syncSpeed() {
  // ω = K / r：半径越小转得越快（用 timeScale 表达，无需重建 tween）
  if (spinL) spinL.timeScale(BASE_R / rL.value)
  if (spinR) spinR.timeScale(BASE_R / rR.value)
}

function startSpin() {
  slowL?.kill()
  slowR?.kill()
  slowL = slowR = null
  if (!spinL) {
    spinL = createSpinTween(spoolLRef.value, { rpm: 33 + 1 / 3, svgOrigin: `${LX} ${SY}` })
    spinR = createSpinTween(spoolRRef.value, { rpm: 33 + 1 / 3, svgOrigin: `${RX} ${SY}` })
  }
  syncSpeed()
}

function stopSpin() {
  spinL?.kill()
  spinR?.kill()
  spinL = spinR = null
  slowL?.kill()
  slowR?.kill()
  slowL = slowDownTween(spoolLRef.value, { svgOrigin: `${LX} ${SY}`, extraDeg: 120 })
  slowR = slowDownTween(spoolRRef.value, { svgOrigin: `${RX} ${SY}`, extraDeg: 90 })
}

watch(
  () => props.isPlaying,
  (on) => {
    if (!ready) return
    on ? startSpin() : stopSpin()
  }
)

// 卷径变化 → 实时修正转速
watch([rL, rR], () => {
  if (props.isPlaying) syncSpeed()
})

// 进度跳变（seek / 换带）时对齐角度
watch(p, (v) => {
  if (!ready) return
  const target = angleFromProgress(v)
  const cur = Number(gsap.getProperty(spoolLRef.value, 'rotation')) || 0
  if (Math.abs(target - cur) > 25) {
    gsap.set(spoolLRef.value, { rotation: target })
    gsap.set(spoolRRef.value, { rotation: target })
    if (props.isPlaying) {
      spinL?.kill()
      spinR?.kill()
      spinL = spinR = null
      startSpin()
    }
  }
})

onMounted(() => {
  ready = true
  gsap.set(spoolLRef.value, { svgOrigin: `${LX} ${SY}`, rotation: 0 })
  gsap.set(spoolRRef.value, { svgOrigin: `${RX} ${SY}`, rotation: 0 })
  if (props.isPlaying) startSpin()
})

onBeforeUnmount(() => {
  spinL?.kill()
  spinR?.kill()
  slowL?.kill()
  slowR?.kill()
})

/* --------------------- 取出 / 放入（父级编排用） --------------------- */

/** 旧磁带取出：向上抽出仓外 */
function flyOut() {
  const tl = createTimeline()
  tl.to(holderRef.value, {
    y: -230,
    rotation: -6,
    scale: 0.9,
    opacity: 0,
    duration: DUR.slide,
    ease: EASE.dampOut,
  })
  return tl
}

/** 新磁带放入：自上方落入仓内 */
function flyIn() {
  const tl = createTimeline()
  // immediateRender: false —— 否则时间轴一创建磁带就被瞬移到「画面外 + 透明」，
  // 取出动画还没演，磁带先凭空消失。
  tl.fromTo(
    holderRef.value,
    { y: -230, rotation: 6, scale: 0.9, opacity: 0 },
    {
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      duration: DUR.slide,
      ease: EASE.dampIn,
      immediateRender: false,
    }
  )
  return tl
}

function reset() {
  gsap.set(holderRef.value, { y: 0, rotation: 0, scale: 1, opacity: 1 })
}

defineExpose({ flyOut, flyIn, reset })
</script>

<template>
  <svg viewBox="0 0 300 190" class="h-full w-full overflow-visible" aria-hidden="true">
    <defs>
      <!-- 卡带壳：墨黑 -->
      <linearGradient id="tape-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f3d49" />
        <stop offset="100%" stop-color="#17323d" />
      </linearGradient>
      <!-- 轮毂：偏粉调白铜 -->
      <linearGradient id="tape-hub" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fbf0c4" />
        <stop offset="100%" stop-color="#d9be72" />
      </linearGradient>
      <!-- 视窗玻璃：极弱的浅色反光，不做镜面 -->
      <linearGradient id="tape-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff6f9" stop-opacity=".07" />
        <stop offset="100%" stop-color="#fff6f9" stop-opacity=".01" />
      </linearGradient>
      <clipPath id="tape-label-clip">
        <rect x="22" y="18" width="256" height="52" rx="4" />
      </clipPath>
    </defs>

    <g ref="holderRef">
      <!-- 卡带外壳：炭黑本体 -->
      <rect x="6" y="6" width="288" height="178" rx="8" fill="url(#tape-shell)" />
      <rect x="6" y="6" width="288" height="178" rx="8" fill="none" stroke="#f5e6a8" stroke-opacity=".5" stroke-width="2" />
      <!-- 壳内一圈辅助细线：只作压边 -->
      <rect
        x="13"
        y="13"
        width="274"
        height="164"
        rx="5"
        fill="none"
        stroke="#e8449b"
        stroke-opacity=".5"
      />

      <!-- 上部纸标签（封面贴在这里）：灰粉底 -->
      <rect x="22" y="18" width="256" height="52" rx="4" fill="#fde1ec" />
      <image
        v-if="coverImg"
        :href="coverImg"
        x="22"
        y="18"
        width="256"
        height="52"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#tape-label-clip)"
      />
      <rect x="22" y="18" width="256" height="52" rx="4" fill="none" stroke="#0a1a20" stroke-opacity=".35" stroke-width="1" />

      <!-- 双视窗（露出卷轴与带体） -->
      <rect x="60" y="82" width="70" height="70" rx="9" fill="#0a1a20" />
      <rect x="170" y="82" width="70" height="70" rx="9" fill="#0a1a20" />
      <rect x="60" y="82" width="70" height="70" rx="9" fill="none" stroke="#e8449b" stroke-opacity=".5" />
      <rect x="170" y="82" width="70" height="70" rx="9" fill="none" stroke="#e8449b" stroke-opacity=".5" />

      <!-- 带体：随卷径实时变化的公切线（比窗口略亮，才能在炭黑底上看得见） -->
      <path
        :d="filmPath"
        stroke="#e8449b"
        stroke-width="5"
        stroke-linecap="round"
        fill="none"
      />

      <!-- 左卷轴（供带轮） -->
      <g ref="spoolLRef">
        <circle :cx="LX" :cy="SY" :r="rL" fill="#10242d" />
        <circle :cx="LX" :cy="SY" :r="rL" fill="none" stroke="#e8449b" stroke-opacity=".38" stroke-width="1.5" />
        <g stroke="url(#tape-hub)" stroke-width="4" stroke-linecap="round">
          <line :x1="LX" :y1="SY - 10" :x2="LX" :y2="SY - 4" />
          <line :x1="LX + 9" :y1="SY - 5" :x2="LX + 4" :y2="SY - 2" />
          <line :x1="LX + 9" :y1="SY + 5" :x2="LX + 4" :y2="SY + 2" />
          <line :x1="LX" :y1="SY + 10" :x2="LX" :y2="SY + 4" />
          <line :x1="LX - 9" :y1="SY + 5" :x2="LX - 4" :y2="SY + 2" />
          <line :x1="LX - 9" :y1="SY - 5" :x2="LX - 4" :y2="SY - 2" />
        </g>
        <circle :cx="LX" :cy="SY" r="7" fill="url(#tape-hub)" />
      </g>

      <!-- 右卷轴（收带轮） -->
      <g ref="spoolRRef">
        <circle :cx="RX" :cy="SY" :r="rR" fill="#10242d" />
        <circle :cx="RX" :cy="SY" :r="rR" fill="none" stroke="#e8449b" stroke-opacity=".38" stroke-width="1.5" />
        <g stroke="url(#tape-hub)" stroke-width="4" stroke-linecap="round">
          <line :x1="RX" :y1="SY - 10" :x2="RX" :y2="SY - 4" />
          <line :x1="RX + 9" :y1="SY - 5" :x2="RX + 4" :y2="SY - 2" />
          <line :x1="RX + 9" :y1="SY + 5" :x2="RX + 4" :y2="SY + 2" />
          <line :x1="RX" :y1="SY + 10" :x2="RX" :y2="SY + 4" />
          <line :x1="RX - 9" :y1="SY + 5" :x2="RX - 4" :y2="SY + 2" />
          <line :x1="RX - 9" :y1="SY - 5" :x2="RX - 4" :y2="SY - 2" />
        </g>
        <circle :cx="RX" :cy="SY" r="7" fill="url(#tape-hub)" />
      </g>

      <!-- 视窗玻璃反光 -->
      <rect x="60" y="82" width="70" height="70" rx="9" fill="url(#tape-glass)" />
      <rect x="170" y="82" width="70" height="70" rx="9" fill="url(#tape-glass)" />

      <!-- 下部标签 + 定位孔（灰粉纸条 + 墨黑孔） -->
      <rect x="22" y="158" width="256" height="18" rx="3" fill="#f59ec4" />
      <rect x="22" y="158" width="256" height="18" rx="3" fill="none" stroke="#0a1a20" stroke-opacity=".3" />
      <circle cx="40" cy="167" r="3.5" fill="#0a1a20" />
      <circle cx="150" cy="167" r="3.5" fill="#0a1a20" />
      <circle cx="260" cy="167" r="3.5" fill="#0a1a20" />
    </g>
  </svg>
</template>
