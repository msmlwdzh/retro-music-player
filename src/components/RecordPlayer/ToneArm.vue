<script setup>
/**
 * ============================================================
 *  ToneArm.vue —— 唱臂
 * ------------------------------------------------------------
 *  只有两个固定姿态：
 *    · 抬起（待机）REST_ANGLE = -24° —— 针尖完全离开唱片
 *    · 落下（播放）PLAY_ANGLE =  0° —— 针尖压在唱片外沿起播点
 *  切换用 GSAP timeline + 阻尼 ease（power2.inOut）：起落两端都软，
 *  中段利落，落位不会「砸」下去。
 *  角度一律经过 clamp，任何调用方都不可能把它转出机械限位。
 *
 *  对外暴露 lift() / drop()：返回 paused timeline，
 *  交给 RecordPlayer 编排「抬起 → 换片 → 落下」的时序。
 *  自身也监听 isPlaying 自动切换，且切换是幂等的（已在目标姿态则返回空时间轴），
 *  所以父级再显式调用一次也不会把动画做两遍。
 *
 *  坐标系与 Record 共用 viewBox「0 0 380 310」，支点固定在 (336, 62)。
 * ============================================================
 */
import { onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { DUR, EASE, createTimeline } from '@/utils/anim'

const props = defineProps({
  /** 播放中 = 落下；暂停 = 抬起 */
  isPlaying: { type: Boolean, default: false },
})

/* ------------------------- 几何 / 限位 ------------------------- */

const PIVOT_X = 336
const PIVOT_Y = 62
const PIVOT = `${PIVOT_X} ${PIVOT_Y}` // 支点：GSAP svgOrigin

const PLAY_ANGLE = 0 // 针尖落在唱片外沿
const REST_ANGLE = -24 // 抬起待机
const MIN_ANGLE = -32 // 机械下限位（再抬就顶到机身）
const MAX_ANGLE = 8 // 机械上限位（再落就划出唱片内圈）

const clampAngle = (a) => Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, a))

const armRef = ref(null)
let current = REST_ANGLE // 当前姿态角
let ready = false

/* ------------------------- 姿态切换 ------------------------- */

/**
 * 旋转到目标角度。
 * @param {number} angle 目标角度（会被 clamp）
 * @returns {gsap.core.Timeline} paused 时间轴；已到位时返回空时间轴（幂等）
 */
function moveTo(angle) {
  const target = clampAngle(angle)
  if (!ready || Math.abs(target - current) < 0.3) return createTimeline()
  const tl = createTimeline()
  tl.to(armRef.value, {
    rotation: target,
    duration: DUR.arm,
    ease: EASE.arm,
    svgOrigin: PIVOT,
  })
  current = target
  return tl
}

/** 抬起（暂停 / 换片前） */
function lift() {
  return moveTo(REST_ANGLE)
}

/** 落下（播放） */
function drop() {
  return moveTo(PLAY_ANGLE)
}

watch(
  () => props.isPlaying,
  (on) => {
    if (!ready) return
    // 自动切换：直接把时间轴 play 出去（父级编排时会拿到空时间轴，不冲突）
    ;(on ? drop() : lift()).play()
  }
)

onMounted(() => {
  gsap.set(armRef.value, { svgOrigin: PIVOT, rotation: REST_ANGLE })
  ready = true
  current = REST_ANGLE
  // 初始状态若已是播放态，补一次落下动画
  if (props.isPlaying) drop().play()
})

defineExpose({ lift, drop })
</script>

<template>
  <svg viewBox="0 0 380 310" class="h-full w-full overflow-visible" aria-hidden="true">
    <defs>
      <!-- 哑光石墨金属：低反差，不抢灰粉×炭黑的主色关系 -->
      <linearGradient id="arm-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="50%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#a98a3c" />
      </linearGradient>
      <!-- 支座：炭黑主体 + 顶面哑光金属 -->
      <radialGradient id="arm-base" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="60%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#132a33" />
      </radialGradient>
    </defs>

    <!-- ---------- 支座：固定在机身，不随臂旋转 ---------- -->
    <g>
      <circle :cx="PIVOT_X" :cy="PIVOT_Y" r="30" fill="#132a33" />
      <circle :cx="PIVOT_X" :cy="PIVOT_Y" r="24" fill="url(#arm-base)" />
      <!-- 支座外圈刻度环：辅助线色的细环，兼作机械分度 -->
      <circle
        :cx="PIVOT_X"
        :cy="PIVOT_Y"
        r="27"
        fill="none"
        stroke="#8c1b57"
        stroke-opacity=".55"
        stroke-width="1"
      />
      <circle :cx="PIVOT_X" :cy="PIVOT_Y" r="10" fill="#17323d" />
      <circle :cx="PIVOT_X" :cy="PIVOT_Y" r="3.6" fill="#f5e6a8" />
      <!-- 臂托（归位时托住唱臂） -->
      <rect :x="PIVOT_X - 34" :y="PIVOT_Y + 26" width="26" height="11" rx="5.5" fill="#10242d" />
    </g>

    <!-- ---------- 可旋转部分：svgOrigin = 支点 ---------- -->
    <g ref="armRef">
      <!-- 尾部配重 -->
      <g :transform="`rotate(117.7 348 33)`">
        <rect x="332" y="24" width="32" height="18" rx="9" fill="url(#arm-metal)" />
      </g>

      <!-- 臂杆（支点 → 针尖） -->
      <line
        :x1="PIVOT_X"
        :y1="PIVOT_Y"
        x2="267.7"
        y2="192.1"
        stroke="url(#arm-metal)"
        stroke-width="9"
        stroke-linecap="round"
      />
      <!-- 臂杆高光 -->
      <line
        :x1="PIVOT_X - 3"
        :y1="PIVOT_Y - 2"
        x2="272"
        y2="189"
        stroke="#fff6f9"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity=".5"
      />

      <!-- 唱头（headshell）：沿臂方向贴在针尖处 -->
      <g transform="translate(267.7 192.1) rotate(117.7)">
        <rect x="-24" y="-11" width="36" height="22" rx="4" fill="url(#arm-metal)" />
        <rect x="-20" y="-6" width="28" height="7" rx="3" fill="#17323d" />
        <!-- 唱针：旧铜，全机唯一的暖色点缀 -->
        <path d="M-14 11 L-14 19 L-8 19 Z" fill="#8c1b57" />
      </g>
    </g>
  </svg>
</template>
