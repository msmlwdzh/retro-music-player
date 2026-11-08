<script setup>
/**
 * ============================================================
 *  RecordPlayer.vue —— 黑胶唱片机（整合 Record + ToneArm）
 * ------------------------------------------------------------
 *  状态一律从 useAudioStore 取（也允许父级用 props 覆盖，便于独立复用）。
 *
 *  核心：换唱片的时序编排（全部走一条 GSAP timeline）：
 *    1. 暂停音频            → 唱片开始惯性减速
 *    2. 唱臂抬起
 *    3. 旧唱片向右滑出转盘
 *    4. 新唱片从左侧滑入就位（唱片在画面外时切换音源与封面）
 *    5. 短延时
 *    6. 唱臂落下 → 自动播放
 *  触发源统一为 store.pendingTrack：点列表 / 上下首 / 自动连播
 *  都汇到这一个入口，所以任何入口换歌都是完整时序。
 * ============================================================
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import gsap from 'gsap'
import Record from './Record.vue'
import ToneArm from './ToneArm.vue'
import Ornament from '@/components/Ornament.vue'
import { useAudioStore } from '@/store/useAudioStore'
import { addChild } from '@/utils/anim'

const props = defineProps({
  /** 当前曲目（不传则用 store 的） */
  track: { type: Object, default: null },
  /** 播放状态（不传则用 store 的） */
  isPlaying: { type: Boolean, default: undefined },
  /** 是否显示右侧唱片库 */
  showLibrary: { type: Boolean, default: true },
})

const store = useAudioStore()

const current = computed(() => props.track || store.currentTrack)
const playing = computed(() => (props.isPlaying === undefined ? store.isPlaying : props.isPlaying))
const cover = computed(() => current.value?.cover || '')

const recordRef = ref(null)
const armRef = ref(null)
const busy = ref(false) // 换片时序进行中：屏蔽重复触发

let swapTl = null // 当前换片时间轴（便于中断时清理）
let watchdog = 0 // 兜底定时器：时序被意外打断时把唱片拉回原位

/** 清理兜底：无论时序怎么结束，都保证唱片可见、就位 */
function finishSwap() {
  clearTimeout(watchdog)
  watchdog = 0
  swapTl = null
  busy.value = false
  recordRef.value?.reset() // 幂等，正常结束时也无害
  store.clearPending()
}

/* --------------------- 换唱片时序 --------------------- */

/**
 * @param {{id:string,title:string,artist:string,src:string,cover:string}} track
 */
function runSwap(track) {
  if (busy.value || !recordRef.value || !armRef.value) return
  busy.value = true

  const tl = gsap.timeline({ onComplete: finishSwap })
  swapTl = tl

  // ⚠️ 子组件的 lift/flyOut/flyIn 返回的都是 paused 时间轴，
  //    必须用 addChild（内部会 paused(false)）挂进来，
  //    直接 tl.add() 的话它们永远不会播放，唱片会永远停在画面外。
  addChild(tl, () => store.pause()) // 1 暂停音频（唱片随即惯性减速）
  addChild(tl, armRef.value.lift()) // 2 唱臂抬起
  addChild(tl, recordRef.value.flyOut('right')) // 3 旧唱片向右滑出
  addChild(tl, () => {
    // 唱片此刻在画面外 —— 换音源与封面不会被看见
    store.switchTrack(track)
  })
  addChild(tl, recordRef.value.flyIn('left')) // 4 新唱片从左侧滑入
  tl.to({}, { duration: 0.28 }) // 5 短延时（等唱片站稳）
  addChild(tl, armRef.value.drop()) // 6 唱臂落下
  addChild(tl, () => store.play()) // 7 自动续播

  // 兜底：时序全部组装完才知道总时长，留 3s 余量。
  // 超时说明某段动画没能跑完，强制收尾，避免「唱片卡在画面外」+ busy 永久锁死。
  clearTimeout(watchdog)
  watchdog = setTimeout(() => {
    if (busy.value) finishSwap()
  }, (tl.duration() + 3) * 1000)

  return tl
}

onBeforeUnmount(() => {
  clearTimeout(watchdog)
  swapTl?.kill()
  swapTl = null
})

// 统一的换歌指令入口
watch(
  () => store.pendingTrack,
  (t) => {
    if (t) runSwap(t)
  }
)
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_186px]">
    <!-- ============ 机身：底座 → 唱片 → 唱臂，三层共用 viewBox 0 0 380 310 ============ -->
    <div class="ac-panel hd-grain relative aspect-[380/310] w-full overflow-hidden">
      <!-- ---------- 底座（最底层）：品红外壳 + 墨青黑轮廓 + 手绘笔触 ---------- -->
      <svg viewBox="0 0 380 310" class="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <!-- 丝网印外壳：上亮下深的一段，模拟油墨滚过纸面 -->
          <linearGradient id="rp-plinth" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stop-color="#fac4da" />
            <stop offset="62%" stop-color="#f59ec4" />
            <stop offset="100%" stop-color="#e8449b" />
          </linearGradient>
          <!-- 外壳上的干笔刷毛边 -->
          <filter id="rp-brush" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="2" seed="6" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <!-- 机身外壳：品红底，层次只靠这一条墨青黑外框 -->
        <rect x="3" y="3" width="374" height="304" rx="12" fill="url(#rp-plinth)" />

        <!-- 外壳上的斜向干刷笔触：奶油黄 + 亮粉各一道，压低透明度只做肌理 -->
        <g filter="url(#rp-brush)" stroke-linecap="round" fill="none">
          <path d="M28 258 C 120 236, 210 262, 352 232" stroke="#fbf0c4" stroke-width="9" opacity=".22" />
          <path d="M40 272 C 150 252, 240 276, 340 254" stroke="#e8449b" stroke-width="7" opacity=".28" />
          <path d="M36 46 C 110 34, 170 52, 244 38" stroke="#fbf0c4" stroke-width="5" opacity=".18" />
        </g>

        <!-- 外框：墨青黑，比内线粗一档，像丝印的实边 -->
        <rect x="3" y="3" width="374" height="304" rx="12" fill="none" stroke="#132a33" stroke-width="3" />
        <!-- 内框辅助线：深玫红，只做分区不做装饰 -->
        <rect
          x="13"
          y="13"
          width="354"
          height="284"
          rx="8"
          fill="none"
          stroke="#8c1b57"
          stroke-opacity=".55"
          stroke-width="1.2"
        />
        <!-- 底部一道辅助线：分隔机身与底部丝印区 -->
        <line x1="24" y1="292" x2="356" y2="292" stroke="#8c1b57" stroke-opacity=".5" stroke-width="1.2" />
      </svg>

      <!-- ---------- 唱片（随换片时序滑出 / 滑入） ---------- -->
      <div class="absolute inset-0">
        <Record
          ref="recordRef"
          :cover-img="cover"
          :progress="store.progress"
          :is-playing="playing"
          :duration="store.duration"
        />
      </div>
      <!-- ---------- 唱臂 ---------- -->
      <div class="absolute inset-0">
        <ToneArm ref="armRef" :is-playing="playing" />
      </div>
    </div>

    <!-- ============ 唱片库缩略列表 ============ -->
    <aside v-if="showLibrary" class="ac-panel p-3">
      <div class="mb-3 flex items-center gap-2 px-0.5">
        <Ornament kind="spray" class="h-3.5 w-14 shrink-0 text-line" />
        <span class="ac-label">Shelf</span>
      </div>
      <ul class="max-h-[248px] space-y-2 overflow-y-auto pr-0.5">
        <li v-for="t in store.library" :key="t.id">
          <button
            type="button"
            class="group flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left"
            :class="
              t.id === current?.id
                ? 'border-ink bg-ink text-paper'
                : 'border-line/70 text-ink-soft hover:border-ink hover:bg-rose-100'
            "
            :disabled="busy"
            :title="`换上《${t.title}`"
            @click="store.requestTrack(t)"
          >
            <!-- 圆形封面缩略 -->
            <span class="relative shrink-0">
              <img
                v-if="t.cover"
                :src="t.cover"
                :alt="t.title"
                class="h-8 w-8 rounded-full border border-ink object-cover"
              />
              <span
                v-else
                class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-rose-100 text-[9px] text-ink-soft"
              >
                N/A
              </span>
              <!-- 正在播放的小圆点：贴在缩略图右下角 -->
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
