<script setup>
/**
 * ============================================================
 *  TapeDeck.vue —— 磁带录音机（机身 + 可开合仓门 + Tape 子组件）
 * ------------------------------------------------------------
 *  与唱片机共用同一个 useAudioStore：
 *    · 音频实例只有一个，切换载体模式时音乐不断；
 *    · 两套载体互斥显示由 App 按 store.mode 决定（'record' | 'tape'）。
 *
 *  换磁带时序（一条 GSAP timeline 串起来）：
 *    1. 停止播放
 *    2. 仓门向上翻开（绕顶边 rotationX）
 *    3. 旧磁带取出（向上抽出）
 *    4. 新磁带放入（自上方落位，磁带在画面外时切换音源）
 *    5. 仓门关闭
 *    6. 开始播放
 *  触发源同样是 store.pendingTrack，与唱片机完全一致。
 * ============================================================
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import Tape from './Tape.vue'
import Ornament from '@/components/Ornament.vue'
import { useAudioStore } from '@/store/useAudioStore'
import { DUR, EASE, addChild, createTimeline } from '@/utils/anim'

const props = defineProps({
  track: { type: Object, default: null },
  isPlaying: { type: Boolean, default: undefined },
  showLibrary: { type: Boolean, default: true },
})

const store = useAudioStore()

const current = computed(() => props.track || store.currentTrack)
const playing = computed(() => (props.isPlaying === undefined ? store.isPlaying : props.isPlaying))
const cover = computed(() => current.value?.cover || '')

const doorRef = ref(null)
const tapeRef = ref(null)
const busy = ref(false)

let swapTl = null // 当前换带时间轴
let watchdog = 0 // 兜底定时器：时序被意外打断时把磁带拉回仓内

/** 清理兜底：无论时序怎么结束，都保证磁带可见、就位、仓门关闭 */
function finishSwap() {
  clearTimeout(watchdog)
  watchdog = 0
  swapTl = null
  busy.value = false
  tapeRef.value?.reset() // 幂等
  gsap.to(doorRef.value, { rotationX: 0, duration: 0.3 }) // 兜底关门
  store.clearPending()
}

/* --------------------- 仓门开合 --------------------- */

/** 仓门向上翻开 */
function openDoor() {
  const tl = createTimeline()
  tl.to(doorRef.value, { rotationX: -84, duration: DUR.door, ease: EASE.door })
  return tl
}

/** 仓门关闭 */
function closeDoor() {
  const tl = createTimeline()
  tl.to(doorRef.value, { rotationX: 0, duration: DUR.door, ease: EASE.door })
  return tl
}

/* --------------------- 换磁带时序 --------------------- */

function runSwap(track) {
  if (busy.value || !tapeRef.value || !doorRef.value) return
  busy.value = true

  const tl = gsap.timeline({ onComplete: finishSwap })
  swapTl = tl

  // ⚠️ openDoor/flyOut/flyIn/closeDoor 返回的都是 paused 时间轴，
  //    必须用 addChild 挂进来（内部会 paused(false)），
  //    直接 tl.add() 的话它们永远不播，磁带会永远停在仓外。
  addChild(tl, () => store.pause()) // 1 停止播放
  addChild(tl, openDoor()) // 2 仓门向上翻开
  addChild(tl, tapeRef.value.flyOut()) // 3 旧磁带取出
  addChild(tl, () => store.switchTrack(track)) //   （磁带在画面外时换音源）
  addChild(tl, tapeRef.value.flyIn()) // 4 新磁带放入
  addChild(tl, closeDoor()) // 5 仓门关闭
  tl.to({}, { duration: 0.18 }) // 6 短延时
  addChild(tl, () => store.play()) // 7 开始播放

  // 兜底：组装完才知道总时长，留 3s 余量，超时强制收尾
  clearTimeout(watchdog)
  watchdog = setTimeout(() => {
    if (busy.value) finishSwap()
  }, (tl.duration() + 3) * 1000)

  return tl
}

watch(
  () => store.pendingTrack,
  (t) => {
    if (t) runSwap(t)
  }
)

onMounted(() => {
  gsap.set(doorRef.value, { rotationX: 0, transformOrigin: '50% 0%' })
})

onBeforeUnmount(() => {
  clearTimeout(watchdog)
  swapTl?.kill()
  swapTl = null
})
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_186px]">
    <!-- ================= 机身 ================= -->
    <div class="ac-panel hd-grain relative aspect-[380/300] w-full overflow-hidden">
      <!-- 机身（SVG） -->
      <svg viewBox="0 0 380 300" class="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <!-- 丝网印外壳：品红纸面，上亮下深 -->
          <linearGradient id="td-body" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stop-color="#fac4da" />
            <stop offset="60%" stop-color="#f59ec4" />
            <stop offset="100%" stop-color="#e8449b" />
          </linearGradient>
          <!-- 奶油黄金属：压条 / VU 表圈，取自参考图的星环色 -->
          <linearGradient id="td-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbf0c4" />
            <stop offset="55%" stop-color="#f5e6a8" />
            <stop offset="100%" stop-color="#c9a955" />
          </linearGradient>
          <!-- 按键：墨青黑实心 -->
          <linearGradient id="td-key" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1f3d49" />
            <stop offset="100%" stop-color="#132a33" />
          </linearGradient>
          <!-- 外壳干笔刷毛边 -->
          <filter id="td-brush" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="12" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <!-- 外壳 + 内嵌面板：品红底，层次交给墨青黑外框 -->
        <rect x="6" y="8" width="368" height="284" rx="12" fill="url(#td-body)" />

        <!-- 外壳上的斜向干刷笔触 -->
        <g filter="url(#td-brush)" stroke-linecap="round" fill="none">
          <path d="M22 262 C 120 240, 220 266, 358 236" stroke="#fbf0c4" stroke-width="9" opacity=".2" />
          <path d="M34 276 C 150 256, 250 280, 348 258" stroke="#e8449b" stroke-width="7" opacity=".26" />
        </g>

        <rect x="6" y="8" width="368" height="284" rx="12" fill="none" stroke="#132a33" stroke-width="3" />
        <rect x="14" y="16" width="352" height="268" rx="10" fill="#f7b0cf" />
        <!-- 内框辅助线：只做分区，不做装饰 -->
        <rect
          x="14"
          y="16"
          width="352"
          height="268"
          rx="10"
          fill="none"
          stroke="#8c1b57"
          stroke-opacity=".55"
          stroke-width="1.2"
        />
        <!-- 上 / 下金属压条：结构分界 -->
        <rect x="14" y="16" width="352" height="4" rx="2" fill="url(#td-metal)" opacity=".75" />
        <rect x="14" y="280" width="352" height="4" rx="2" fill="url(#td-metal)" opacity=".45" />

        <!-- 铭牌条：墨青黑实底 + 奶油刻字意象 -->
        <rect x="26" y="24" width="88" height="7" rx="3.5" fill="#132a33" />
        <rect x="30" y="27" width="60" height="1.4" rx="0.7" fill="#f5e6a8" fill-opacity=".9" />
        <rect x="26" y="36" width="54" height="5" rx="2.5" fill="#1f3d49" />

        <!-- 磁带仓凹槽：墨青黑，磁带本体落在里面 -->
        <rect x="40" y="52" width="300" height="174" rx="12" fill="#132a33" />
        <rect x="40" y="52" width="300" height="174" rx="12" fill="none" stroke="#0a1a20" stroke-width="2" />
        <rect
          x="46"
          y="58"
          width="288"
          height="162"
          rx="8"
          fill="none"
          stroke="#e8449b"
          stroke-opacity=".4"
          stroke-width="1.2"
        />

        <!-- 底部：双 VU 表（奶油黄表圈 + 暖白纸面 + 墨青黑指针） -->
        <circle cx="62" cy="260" r="22" fill="url(#td-metal)" />
        <circle cx="62" cy="260" r="17" fill="#fff6f9" />
        <path d="M51 251 A 13 13 0 0 1 73 251" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".5" />
        <line x1="62" y1="272" x2="52" y2="252" stroke="#132a33" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="112" cy="260" r="22" fill="url(#td-metal)" />
        <circle cx="112" cy="260" r="17" fill="#fff6f9" />
        <path d="M101 251 A 13 13 0 0 1 123 251" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".5" />
        <line x1="112" y1="272" x2="122" y2="252" stroke="#132a33" stroke-width="2.4" stroke-linecap="round" />

        <!-- 底部：走带按键排（墨青黑键体 + 奶油黄标记） -->
        <g>
          <rect v-for="i in 6" :key="i" :x="146 + (i - 1) * 35" y="246" width="30" height="30" rx="8" fill="url(#td-key)" />
          <rect v-for="i in 6" :key="`k${i}`" :x="146 + (i - 1) * 35" y="246" width="30" height="30" rx="8" fill="none" stroke="#0a1a20" stroke-opacity=".8" />
          <circle cx="161" cy="261" r="3.5" fill="#f5e6a8" />
        </g>
      </svg>

      <!-- 磁带本体（绝对定位落在仓凹槽内，坐标与上方 SVG 的凹槽 x40..340 / y52..226 对齐） -->
      <div class="absolute" style="left: 11.58%; top: 18.67%; width: 76.84%; height: 55.33%">
        <Tape
          ref="tapeRef"
          :cover-img="cover"
          :progress="store.progress"
          :is-playing="playing"
          :duration="store.duration"
        />
      </div>

      <!-- 仓门：HTML 层做 3D 翻盖（绕顶边向上翻开），中间留透明视窗 -->
      <div
        class="absolute"
        style="left: 9.5%; top: 15%; width: 81%; height: 62%; perspective: 900px; z-index: 20"
      >
        <div
          ref="doorRef"
          class="relative h-full w-full rounded-xl border-[9px] border-ink bg-transparent"
          style="transform-origin: 50% 0%; transform-style: preserve-3d"
        >
          <!-- 门框内缘：辅助线细线，强化「仓门是独立零件」 -->
          <div class="absolute inset-0 rounded-lg outline outline-1 -outline-offset-4 outline-line/60" />
          <!-- 视窗玻璃：只做极轻压暗，磁带仍然清晰可见 -->
          <div class="absolute inset-0 rounded-lg bg-ink/10" />
          <!-- 下沿开启扣手 -->
          <div class="absolute bottom-0 left-1/2 h-1.5 w-14 -translate-x-1/2 rounded-full bg-rose-300" />
        </div>
      </div>
    </div>

    <!-- ================= 磁带架 ================= -->
    <aside v-if="showLibrary" class="ac-panel p-3">
      <div class="mb-3 flex items-center gap-2 px-0.5">
        <Ornament kind="spray" class="h-3.5 w-14 shrink-0 text-line" />
        <span class="ac-label">Shelf</span>
      </div>
      <ul class="max-h-[248px] space-y-2 overflow-y-auto pr-0.5">
        <li v-for="t in store.library" :key="t.id">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left"
            :class="
              t.id === current?.id
                ? 'border-ink bg-ink text-paper'
                : 'border-line/70 text-ink-soft hover:border-ink hover:bg-rose-100'
            "
            :disabled="busy"
            :title="`换上《${t.title}`"
            @click="store.requestTrack(t)"
          >
            <span class="relative shrink-0">
              <img
                v-if="t.cover"
                :src="t.cover"
                :alt="t.title"
                class="h-8 w-8 rounded-lg border border-ink object-cover"
              />
              <span
                v-else
                class="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-rose-100 text-[9px] text-ink-soft"
              >
                N/A
              </span>
              <!-- 正在播放的小圆点 -->
              <span
                v-if="t.id === current?.id && playing"
                class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-ink bg-ink ring-2 ring-rose-300"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[12px] font-medium leading-tight">{{ t.title }}</span>
              <span class="block truncate text-[10px] leading-tight opacity-60">{{ t.artist }}</span>
            </span>
          </button>
        </li>
      </ul>
    </aside>
  </div>
</template>
