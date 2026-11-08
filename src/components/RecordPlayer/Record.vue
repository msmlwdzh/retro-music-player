<script setup>
/**
 * ============================================================
 *  Record.vue —— 黑胶唱片本体（只画唱片，不含底座）
 * ------------------------------------------------------------
 *  动画职责：
 *    1. 基础角度由 progress 映射 —— 唱片转过的圈数与播放进度一致，
 *       seek 之后视觉不会和听感脱节。
 *    2. isPlaying = true  → GSAP 匀速持续旋转（ease: 'none'）。
 *    3. isPlaying = false → 不 kill 直接停，而是补一段长尾缓动做惯性减速。
 *  对外暴露 flyOut(dir) / flyIn(dir)：把进出场做成 paused timeline，
 *  交给 RecordPlayer 编排换唱片时序，本组件不关心顺序。
 *  坐标系与 ToneArm 共用 viewBox「0 0 380 310」，两者绝对定位叠放即可对齐。
 * ============================================================
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import {
  DUR,
  EASE,
  createSpinTween,
  createTimeline,
  slowDownTween,
} from '@/utils/anim'

const props = defineProps({
  /** 封面图地址（dataURL / URL 均可），自动裁成圆形贴在中心 */
  coverImg: { type: String, default: '' },
  /** 播放进度 0~1 */
  progress: { type: Number, default: 0 },
  /** 是否播放 */
  isPlaying: { type: Boolean, default: false },
  /** 总时长（秒，可选）：给定时把 progress 精确映射为「真实转过的圈数」 */
  duration: { type: Number, default: 0 },
})

/* ------------------------- 几何常量 ------------------------- */

const CX = 150 // 唱片圆心 x
const CY = 150 // 唱片圆心 y
const R = 135 // 唱片半径
const COVER_R = 48 // 中心封面镂空半径
const ORIGIN = `${CX} ${CY}` // GSAP svgOrigin
/** 未知时长时，按「一首歌转 8 圈」做视觉映射 */
const DEFAULT_TURNS = 8

const holderRef = ref(null) // 整张唱片：进出场位移作用于此
const discRef = ref(null) // 旋转部分：沟槽 + 封面

let spinTween = null
let slowTween = null
let ready = false

/* ------------------------- 角度映射 ------------------------- */

/** progress(0~1) → 唱片累计转过的角度（度） */
function angleFromProgress(p) {
  const turns = props.duration > 0 ? props.duration / DUR.turn : DEFAULT_TURNS
  return p * turns * 360
}

/* ------------------------- 旋转控制 ------------------------- */

function startSpin() {
  slowTween?.kill()
  slowTween = null
  if (spinTween) return // 已在转，保持连续不重置相位
  spinTween = createSpinTween(discRef.value, { rpm: 33 + 1 / 3, svgOrigin: ORIGIN })
}

/** 惯性减速停止：继续滑行一段再慢慢收住 */
function stopSpin() {
  spinTween?.kill()
  spinTween = null
  slowTween?.kill()
  slowTween = slowDownTween(discRef.value, { svgOrigin: ORIGIN, extraDeg: 170 })
}

watch(
  () => props.isPlaying,
  (on) => {
    if (!ready) return
    on ? startSpin() : stopSpin()
  }
)

// 进度跳变（seek / 换歌）时校正角度：正常播放时两者本就同步，
// 只在偏差明显时写入，避免频繁打断匀速 tween 造成抖动。
watch(
  () => props.progress,
  (p) => {
    if (!ready) return
    const target = angleFromProgress(p)
    const cur = Number(gsap.getProperty(discRef.value, 'rotation')) || 0
    if (Math.abs(target - cur) > 25) {
      gsap.set(discRef.value, { rotation: target })
      if (props.isPlaying) {
        // 重新起转，让 tween 从新相位继续
        spinTween?.kill()
        spinTween = null
        startSpin()
      }
    }
  }
)

onMounted(() => {
  ready = true
  gsap.set(discRef.value, { svgOrigin: ORIGIN, rotation: 0 })
  if (props.isPlaying) startSpin()
})

onBeforeUnmount(() => {
  spinTween?.kill()
  slowTween?.kill()
})

/* --------------------- 进出场（父级编排用） --------------------- */

/**
 * 旧唱片滑出转盘。
 * @param {'left'|'right'} dir 滑出方向
 */
function flyOut(dir = 'right') {
  const s = dir === 'left' ? -1 : 1
  const tl = createTimeline()
  tl.to(holderRef.value, {
    x: 320 * s,
    y: 46,
    rotation: 130 * s,
    scale: 0.82,
    opacity: 0,
    duration: DUR.slide,
    ease: EASE.dampOut,
  })
  return tl
}

/**
 * 新唱片滑入就位。
 * @param {'left'|'right'} dir 滑入的起始方向
 */
function flyIn(dir = 'left') {
  const s = dir === 'left' ? -1 : 1
  const tl = createTimeline()
  // immediateRender: false —— 否则这条时间轴一创建就把唱片瞬移到
  // 「画面外 + 透明」的起始态，飞出动画还没演，唱片先凭空消失了。
  tl.fromTo(
    holderRef.value,
    { x: 320 * s, y: 46, rotation: -130 * s, scale: 0.82, opacity: 0 },
    {
      x: 0,
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

/** 强制复位（换歌被中断时兜底） */
function reset() {
  gsap.set(holderRef.value, { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 })
}

defineExpose({ flyOut, flyIn, reset })
</script>

<template>
  <svg viewBox="0 0 380 310" class="h-full w-full overflow-visible" aria-hidden="true">
    <defs>
      <!-- 黑胶盘面：炭黑，只留极弱的哑光明暗，不做镜面高光 -->
      <radialGradient id="rec-vinyl" cx="40%" cy="36%" r="72%">
        <stop offset="0%" stop-color="#10242d" />
        <stop offset="55%" stop-color="#132a33" />
        <stop offset="100%" stop-color="#0a1a20" />
      </radialGradient>
      <!-- 标签底：无封面时露出基底灰粉 -->
      <radialGradient id="rec-label" cx="38%" cy="34%" r="70%">
        <stop offset="0%" stop-color="#fff6f9" />
        <stop offset="100%" stop-color="#f59ec4" />
      </radialGradient>
      <!-- 静态哑光反光：顶灯在盘面上的极弱反射，不随唱片旋转 -->
      <linearGradient id="rec-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fbf0c4" stop-opacity=".12" />
        <stop offset="60%" stop-color="#fbf0c4" stop-opacity=".03" />
        <stop offset="100%" stop-color="#fbf0c4" stop-opacity="0" />
      </linearGradient>
      <!-- 主轴：哑光石墨金属 -->
      <radialGradient id="rec-spindle" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="60%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#a98a3c" />
      </radialGradient>
      <!-- 封面圆形裁切 -->
      <clipPath id="rec-cover-clip">
        <circle :cx="CX" :cy="CY" :r="COVER_R" />
      </clipPath>
    </defs>

    <g ref="holderRef">
      <!-- ---------- 随盘旋转 ---------- -->
      <g ref="discRef">
        <circle :cx="CX" :cy="CY" :r="R" fill="url(#rec-vinyl)" />

        <!-- 密纹沟槽（灰粉刻线，墨黑底上呈细密的木刻质感） -->
        <circle
          v-for="(r, i) in 22"
          :key="i"
          :cx="CX"
          :cy="CY"
          :r="COVER_R + 8 + i * 3.6"
          fill="none"
          stroke="#e8449b"
          stroke-opacity=".07"
          stroke-width="1.1"
        />

        <!-- 三道分曲亮纹 -->
        <circle :cx="CX" :cy="CY" :r="R - 12" fill="none" stroke="#e8449b" stroke-opacity=".16" stroke-width="2.4" />
        <circle :cx="CX" :cy="CY" :r="R - 46" fill="none" stroke="#e8449b" stroke-opacity=".12" stroke-width="2" />
        <circle :cx="CX" :cy="CY" :r="R - 80" fill="none" stroke="#e8449b" stroke-opacity=".1" stroke-width="1.8" />

        <!-- 外沿倒角：极细一圈炭黑，避免盘边发灰 -->
        <circle :cx="CX" :cy="CY" :r="R - 1" fill="none" stroke="#0a1a20" stroke-opacity=".55" stroke-width="3" />

        <!-- 封面外圈一道辅助线细环：既是压边，也当作刻度基准 -->
        <circle
          :cx="CX"
          :cy="CY"
          :r="COVER_R + 4.5"
          fill="none"
          stroke="#e8449b"
          stroke-opacity=".5"
          stroke-width="1"
        />

        <!-- 中心标签 + 封面（居中圆形裁切，覆盖在镂空位） -->
        <circle :cx="CX" :cy="CY" :r="COVER_R" fill="url(#rec-label)" />
        <image
          v-if="coverImg"
          :href="coverImg"
          :x="CX - COVER_R"
          :y="CY - COVER_R"
          :width="COVER_R * 2"
          :height="COVER_R * 2"
          clip-path="url(#rec-cover-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
        <circle :cx="CX" :cy="CY" :r="COVER_R" fill="none" stroke="#0a1a20" stroke-opacity=".6" stroke-width="1.5" />
        <circle :cx="CX" :cy="CY" r="4.5" fill="#0a1a20" />
      </g>

      <!-- ---------- 不随盘旋转 ---------- -->
      <ellipse
        :cx="CX - 44"
        :cy="CY - 50"
        rx="82"
        ry="28"
        :transform="`rotate(-38 ${CX - 44} ${CY - 50})`"
        fill="url(#rec-sheen)"
      />
      <circle :cx="CX" :cy="CY" r="7" fill="url(#rec-spindle)" />
      <circle :cx="CX" :cy="CY" r="7" fill="none" stroke="#0a1a20" stroke-opacity=".6" stroke-width="1" />
    </g>
  </svg>
</template>
