<script setup>
/**
 * ============================================================
 *  App.vue —— 复古音响控制台（总装）
 * ------------------------------------------------------------
 *  职责：
 *   1. 载体互斥显示：按 store.mode 在「唱片机 ⇄ 磁带机」之间整机换装，
 *      两套载体共用同一个音频实例，切换时音乐不断。
 *   2. 统一控制条：走带键 / 进度条 / 音量旋钮 / 模式拨动开关。
 *   3. AI 封面弹窗入口。
 *  本文件不持有任何播放状态：全部读 useAudioStore。
 * ============================================================
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import RecordPlayer from '@/components/RecordPlayer/RecordPlayer.vue'
import TapeDeck from '@/components/TapePlayer/TapeDeck.vue'
import AudioKnob from '@/components/AudioKnob.vue'
import AiCoverGen from '@/components/AiCoverGen.vue'
import Ornament from '@/components/Ornament.vue'
import HandDrawnBg from '@/components/HandDrawnBg.vue'
import TurntableFlat from '@/components/svg/TurntableFlat.vue'
import TapeDeckFlat from '@/components/svg/TapeDeckFlat.vue'
import citypopCover from '@/assets/covers/citypop-cover.jpg'
import { useAudioStore } from '@/store/useAudioStore'
import { formatTime } from '@/utils/anim'

const player = useAudioStore()

/* ------------------------- 弹窗 ------------------------- */

const aiOpen = ref(false)

/** AI 生成入库后，直接走一次完整换装流程把新封面换上 */
function onCreated(track) {
  player.requestTrack(track)
}

/* ------------------------- 音量（旋钮双向绑定） ------------------------- */

const volume = computed({
  get: () => player.volume,
  set: (v) => player.setVolumeTo(v),
})

/* ------------------------- 进度条 ------------------------- */

const seeking = ref(false)
const seekValue = ref(0)

function onSeekInput(e) {
  seeking.value = true
  seekValue.value = Number(e.target.value)
}

function onSeekCommit(e) {
  player.seek(Number(e.target.value) / 1000)
  seeking.value = false
}

const shownProgress = computed(() =>
  seeking.value ? seekValue.value / 1000 : player.progress
)

/* ------------------------- 模式拨动开关 ------------------------- */

const leverRef = ref(null)

watch(
  () => player.mode,
  (m) => {
    if (!leverRef.value) return
    gsap.to(leverRef.value, {
      x: m === 'record' ? 0 : 36,
      duration: 0.5,
      ease: 'back.out(1.6)',
    })
  },
  { immediate: true }
)

/* ------------------- 载体换装（整机淡入淡出） ------------------- */

function onLeave(el, done) {
  gsap.to(el, {
    opacity: 0,
    y: 30,
    scale: 0.96,
    rotation: -1.5,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: done,
  })
}

function onEnter(el, done) {
  gsap.fromTo(
    el,
    { opacity: 0, y: -30, scale: 0.96, rotation: 1.5 },
    { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 0.55, ease: 'power3.out', onComplete: done }
  )
}

/* ------------------------- 快捷键 ------------------------- */

function isTyping(target) {
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
}

function onKeydown(e) {
  if (isTyping(e.target)) return
  if (e.code === 'Space') {
    e.preventDefault()
    player.toggle()
  } else if (e.code === 'ArrowRight') {
    player.next()
  } else if (e.code === 'ArrowLeft') {
    player.prev()
  }
}

onMounted(() => {
  player.init()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  player.destroy()
})

/* ------------------------- 派生显示 ------------------------- */

const currentTitle = computed(() => player.currentTrack?.title || '—')
const currentArtist = computed(() => player.currentTrack?.artist || '')
const carrierName = computed(() => (player.mode === 'record' ? '黑胶唱片' : '磁带'))
</script>

<template>
  <!-- 页面地：手绘丝网印背景（青蓝天空 → 品红云带 → 正红地面），内容浮在其上 -->
  <div class="relative min-h-screen text-ink">
    <HandDrawnBg />

    <div class="relative z-10">
      <!-- ================= 顶栏 ================= -->
      <!-- 顶栏：半透暖白纸带，压住背景最上方的青蓝天空，保证标题可读 -->
      <header class="sticky top-0 z-30 border-b-2 border-ink/15 bg-rose-50/70 backdrop-blur-md">
        <div class="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-5">
          <div class="flex items-center gap-3">
            <!-- 徽记：墨青黑方章 + 奶油黄唱片抽象 -->
            <svg viewBox="0 0 32 32" class="h-9 w-9 shrink-0" aria-hidden="true">
              <rect x="0" y="0" width="32" height="32" rx="9" fill="#132a33" />
              <circle cx="16" cy="16" r="10" fill="none" stroke="#f5e6a8" stroke-width="1.8" />
              <circle cx="16" cy="16" r="5.5" fill="none" stroke="#e8449b" stroke-width="1.4" />
              <circle cx="16" cy="16" r="2" fill="#fbf0c4" />
            </svg>
            <div class="leading-tight">
              <h1 class="text-lg font-extrabold tracking-[-0.01em] text-ink sm:text-xl">
                <span class="hd-marker">RETRO DECK</span>
              </h1>
              <p class="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-line">
                黑胶唱片机 · 磁带录音机
              </p>
            </div>
          </div>

          <button type="button" class="mech-btn px-4 py-2.5 text-[11px]" @click="aiOpen = true">
            ＋ AI 封面
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-[960px] px-6 pb-16 pt-8">
        <div class="space-y-6">
          <!-- ================= 载体仓（互斥显示） ================= -->
          <div class="mx-auto w-full max-w-[600px]">
            <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave">
              <component :is="player.mode === 'record' ? RecordPlayer : TapeDeck" :key="player.mode" />
            </Transition>
          </div>

          <!-- ================= 控制条 ================= -->
          <section class="ac-panel hd-grain mx-auto w-full max-w-[600px] p-5 sm:p-6">
            <!-- 正在播放 -->
            <div class="mb-3 flex items-end justify-between gap-3">
              <div class="min-w-0">
                <p class="ac-label mb-1.5">Now Playing</p>
                <p class="truncate text-xl font-extrabold leading-tight tracking-[-0.01em] text-ink sm:text-2xl">
                  {{ currentTitle }}
                </p>
                <p class="truncate text-[11px] font-medium tracking-[0.08em] text-line">
                  {{ currentArtist }}
                </p>
              </div>
              <span class="shrink-0 text-[11px] font-medium tabular-nums text-line">
                {{ formatTime(player.currentTime) }} / {{ formatTime(player.duration) }}
              </span>
            </div>

            <Ornament kind="rule" class="mb-3 h-3 w-full text-ink/25" />

            <!-- 进度条 -->
            <input
              class="range-slider mb-4 w-full"
              type="range"
              min="0"
              max="1000"
              step="1"
              aria-label="播放进度"
              :style="{ '--p': (shownProgress * 100).toFixed(1) + '%' }"
              :value="Math.round(shownProgress * 1000)"
              :disabled="!player.duration"
              @input="onSeekInput"
              @change="onSeekCommit"
            />

            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-5">
              <!-- 走带键 -->
              <div class="flex items-center gap-2">
                <button type="button" class="mech-btn h-10 w-10" aria-label="上一首" @click="player.prev()">
                  <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                    <path d="M18 6 L18 18 L8 12 Z M7 6 L7 18" fill="currentColor" />
                  </svg>
                </button>

                <button
                  type="button"
                  class="mech-btn h-12 w-12"
                  :class="player.isPlaying ? 'is-active' : ''"
                  :aria-label="player.isPlaying ? '暂停' : '播放'"
                  @click="player.toggle()"
                >
                  <svg v-if="player.isPlaying" viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                    <rect x="7" y="6" width="3.6" height="12" rx="1" fill="currentColor" />
                    <rect x="13.4" y="6" width="3.6" height="12" rx="1" fill="currentColor" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true">
                    <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
                  </svg>
                </button>

                <button type="button" class="mech-btn h-10 w-10" aria-label="下一首" @click="player.next()">
                  <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                    <path d="M6 6 L6 18 L16 12 Z M17 6 L17 18" fill="currentColor" />
                  </svg>
                </button>
              </div>

              <!-- 模式拨动开关：墨青黑凹槽 + 奶油黄滑块 -->
              <div class="flex items-center gap-2.5">
                <span class="ac-label">Mode</span>
                <button
                  type="button"
                  class="relative h-9 w-[84px] rounded-xl border-2 border-ink bg-ink px-1"
                  :aria-label="`切换载体，当前${carrierName}`"
                  @click="player.setMode(player.mode === 'record' ? 'tape' : 'record')"
                >
                  <!-- 滑块：奶油黄，在墨青黑凹槽里滑动（取自星环色） -->
                  <span
                    ref="leverRef"
                    class="absolute left-1 top-1 h-7 w-[36px] rounded-lg bg-cream shadow-knob"
                  />
                  <!-- 两端刻字：当前模式为墨青黑，另一端为暖白 -->
                  <span class="absolute inset-0 flex items-center justify-between px-2.5 text-[9px] font-bold tracking-[0.1em]">
                    <span :class="player.mode === 'record' ? 'text-ink' : 'text-paper/55'">LP</span>
                    <span :class="player.mode === 'tape' ? 'text-ink' : 'text-paper/55'">TAPE</span>
                  </span>
                </button>
              </div>

              <!-- 音量旋钮 -->
              <AudioKnob v-model="volume" :size="64" label="VOL" />
            </div>

            <p
              v-if="player.error"
              class="mt-4 rounded-xl border-2 border-ink bg-rose-50 px-3 py-2.5 text-[11px] text-ink"
            >
              {{ player.error }}
            </p>

            <div class="mt-5 border-t border-ink/20 pt-4 text-[10px] leading-relaxed text-line">
              点选右侧曲库 = 更换{{ carrierName }}，会自动播放完整的换装时序。空格播放 / 暂停，← → 换歌。
            </div>
          </section>
        </div>
      </main>

      <!-- ================= 扁平 SVG 图形资产（可独立嵌入任意 Vue 项目） ================= -->
      <section class="mx-auto max-w-[960px] px-6 pb-16">
        <div class="ac-panel hd-grain p-6 sm:p-8">
          <h2 class="text-[13px] font-extrabold tracking-[0.06em] text-ink">
            FLAT SVG ASSETS · 静态图形资产
          </h2>
          <Ornament kind="rule" class="my-3 h-3 w-48 text-ink/25" />
          <p class="text-[11px] leading-relaxed text-line">
            纯原生 SVG · 无动画 · 无外部资源。唱片机分组
            <span class="text-ink-soft">#base / #platter / #record / #tonearm</span>；磁带机分组
            <span class="text-ink-soft">#tapeBody / #tapeFilm / #spoolLeft / #spoolRight / #door</span>，
            可直接交给 GSAP 驱动。唱片中心 r=58 的圆形区留给封面图。
          </p>

          <div class="mt-6 grid gap-5 lg:grid-cols-2">
            <figure class="rounded-xl border-2 border-ink bg-rose-50 p-4">
              <div class="aspect-[4/3] w-full">
                <!-- 硬边印影：海报里的图形是"印"在纸上的，不用柔光投影 -->
                <TurntableFlat :cover="citypopCover" class="drop-shadow-[6px_6px_0_rgba(19,42,51,0.35)]" />
              </div>
              <figcaption class="mt-3 text-[10px] font-semibold tracking-[0.08em] text-line">
                TURNTABLE · 600×450 · 唱片中心为封面镂空区
              </figcaption>
            </figure>

            <figure class="rounded-xl border-2 border-ink bg-rose-50 p-4">
              <div class="aspect-[3/2] w-full">
                <TapeDeckFlat class="drop-shadow-[6px_6px_0_rgba(19,42,51,0.35)]" />
              </div>
              <figcaption class="mt-3 text-[10px] font-semibold tracking-[0.08em] text-line">
                TAPE DECK · 600×400 · 仓门为独立 path，可绕边开合
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </div>

    <!-- AI 封面生成弹窗 -->
    <AiCoverGen v-model="aiOpen" @created="onCreated" />
  </div>
</template>
