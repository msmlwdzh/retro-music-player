<script setup>
/**
 * ============================================================
 *  AiCoverGen.vue —— AI 封面生成弹窗
 * ------------------------------------------------------------
 *  流程：填歌名 + 风格提示词 → POST /api/generate-cover { title, prompt }
 *        → 拿到图片（base64 / url 均可）→ 预览 → 自动裁成圆形（适配黑胶）
 *        → 「加入唱片库」写入 localStorage 并 push 进曲库
 *
 *  安全与健壮：
 *    · 接口地址走环境变量 VITE_COVER_API，默认 '/api/generate-cover'，
 *      **不硬编码任何 API Key**（鉴权请放在你自己的后端代理里）。
 *    · 完整的加载态 / 错误提示；接口不可用时可一键回退到本地程序化生成，
 *      保证离线也能完整演示整条链路。
 * ============================================================
 */
import { computed, ref, watch } from 'vue'
import Ornament from '@/components/Ornament.vue'
import { useAudioStore } from '@/store/useAudioStore'
import { cropToCircle, hashString, localCover } from '@/utils/coverArt'

const props = defineProps({
  /** @model 是否打开 */
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'created'])

/** 接口地址：由环境变量注入，默认同源 /api/generate-cover */
const ENDPOINT = import.meta.env?.VITE_COVER_API || '/api/generate-cover'

const store = useAudioStore()

const title = ref('')
const prompt = ref('')
const loading = ref(false)
const error = ref('')
const rawSrc = ref('') // 接口返回的原始图片
const circleSrc = ref('') // 圆形裁切后的封面
const note = ref('') // 来源说明（AI / 本地兜底）

const canGenerate = computed(() => title.value.trim().length > 0 && !loading.value)
const hasImage = computed(() => Boolean(circleSrc.value || rawSrc.value))
const preview = computed(() => circleSrc.value || rawSrc.value)

/* ------------------------- 生成 ------------------------- */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}

/** 裸 base64（不带 data: 前缀）补成可用的 dataURL */
function normalizeImage(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (/^(data:|https?:|blob:|\/|\.)/i.test(s)) return s
  return `data:image/png;base64,${s}`
}

async function generate() {
  if (!canGenerate.value) return
  loading.value = true
  error.value = ''
  rawSrc.value = ''
  circleSrc.value = ''
  note.value = ''

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.value.trim(), prompt: prompt.value.trim() }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const type = res.headers.get('content-type') || ''
    let raw = ''
    if (type.includes('application/json')) {
      const data = await res.json()
      raw = normalizeImage(data.image || data.url || data.data || data.base64 || '')
    } else {
      raw = await blobToDataUrl(await res.blob())
    }
    if (!raw) throw new Error('响应中没有图片数据')

    rawSrc.value = raw
    // 自动裁成圆形 —— 黑胶唱片中心标签就是圆的
    circleSrc.value = await cropToCircle(raw, 512)
    note.value = 'AI 生成 · 已圆形裁切'
  } catch (err) {
    error.value = `生成失败：${err?.message || err}（可改用「本地生成」兜底）`
  } finally {
    loading.value = false
  }
}

/** 接口不可用时的兜底：本地程序化生成（确定性，同一标题永远同一张） */
async function generateLocal() {
  if (!title.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const svgUrl = localCover({
      title: title.value.trim(),
      style: prompt.value.trim(),
      seed: hashString(title.value + '|' + prompt.value),
    })
    rawSrc.value = svgUrl
    circleSrc.value = await cropToCircle(svgUrl, 512)
    note.value = '本地程序化生成 · 已圆形裁切'
  } finally {
    loading.value = false
  }
}

/* ------------------------- 入库 ------------------------- */

async function addToLibrary() {
  const img = circleSrc.value || rawSrc.value
  if (!img) return

  // AI 只生成封面，音源沿用当前曲目（或曲库第一首）—— 避免造出无法播放的空条目
  const src = store.currentTrack?.src || store.library[0]?.src || ''
  const track = store.addTrack({
    title: title.value.trim() || 'UNTITLED',
    style: prompt.value.trim(),
    cover: img,
    src,
  })

  emit('created', track)
  close()
}

/* ------------------------- 弹窗控制 ------------------------- */

function close() {
  emit('update:modelValue', false)
}

function reset() {
  title.value = ''
  prompt.value = ''
  rawSrc.value = ''
  circleSrc.value = ''
  error.value = ''
  note.value = ''
}

// 关闭后清空，下次打开是干净表单
watch(
  () => props.modelValue,
  (open) => {
    if (!open) reset()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center"
        @click.self="close"
      >
        <!-- 灰粉卡片容器：黑边框 + 极淡阴影，内部留白充足 -->
        <div
          class="ac-panel hd-grain w-full max-w-md p-6"
          role="dialog"
          aria-modal="true"
          aria-label="AI 封面生成"
        >
          <!-- 标题：黑色、中等字重 -->
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 class="text-sm font-extrabold tracking-[0.02em] text-ink">AI COVER STUDIO</h3>
              <p class="mt-1 text-[11px] leading-relaxed text-line">
                生成方形插画 → 自动裁成黑胶圆形封面 → 入架
              </p>
            </div>
            <button
              type="button"
              class="p-1 text-line transition hover:text-ink"
              aria-label="关闭"
              @click="close"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <Ornament kind="rule" class="mb-4 h-3 w-full text-line" />

          <!-- 表单：黑色输入框边框 + #17323d 深色底 + 浅色文字 -->
          <label class="block">
            <span class="ac-label">歌名</span>
            <input
              v-model="title"
              type="text"
              maxlength="40"
              placeholder="例如：Midnight Drive"
              class="mt-1.5 w-full rounded-xl border-2 border-ink bg-ink-panel px-3 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-ink-deep"
            />
          </label>

          <label class="mt-4 block">
            <span class="ac-label">风格提示词</span>
            <textarea
              v-model="prompt"
              rows="2"
              maxlength="160"
              placeholder="例如：日系 city pop，落日海岸公路，低饱和胶片颗粒，无文字"
              class="mt-1.5 w-full resize-none rounded-xl border-2 border-ink bg-ink-panel px-3 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-ink-deep"
            />
          </label>

          <!-- 操作 -->
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="mech-btn px-4 py-2.5 text-[11px]"
              :disabled="!canGenerate"
              @click="generate"
            >
              {{ loading ? '生成中…' : '生成封面' }}
            </button>
            <button
              type="button"
              class="rounded-xl border-2 border-ink px-4 py-2.5 text-[11px] text-ink transition hover:bg-rose-100 disabled:opacity-35"
              :disabled="loading || !title.trim()"
              @click="generateLocal"
            >
              本地生成
            </button>
            <span v-if="note" class="text-[11px] text-ink">{{ note }}</span>
          </div>

          <!-- 错误提示：辅助线细边框，不抢视觉 -->
          <p
            v-if="error"
            class="mt-4 rounded-xl border border-line px-3 py-2.5 text-[11px] leading-relaxed text-ink-soft"
          >
            {{ error }}
          </p>

          <!-- 预览 -->
          <div
            v-if="hasImage"
            class="mt-5 rounded-xl border border-line bg-rose-100 p-4"
          >
            <div class="flex items-center gap-4">
              <!-- 方形原图 -->
              <div class="shrink-0">
                <img
                  :src="rawSrc || preview"
                  alt="方形原图"
                  class="h-20 w-20 rounded-xl border border-ink object-cover"
                />
                <p class="mt-1.5 text-center text-[10px] text-line">方形</p>
              </div>
              <!-- 圆形裁切 -->
              <div class="shrink-0">
                <img
                  :src="preview"
                  alt="圆形封面"
                  class="h-20 w-20 rounded-full border border-ink object-cover"
                />
                <p class="mt-1.5 text-center text-[10px] text-line">圆形</p>
              </div>
              <p class="min-w-0 flex-1 text-[11px] leading-relaxed text-line">
                右侧圆形版本会贴到黑胶唱片中心标签位。
              </p>
            </div>

            <button type="button" class="mech-btn mt-4 w-full px-3 py-2.5 text-[11px]" @click="addToLibrary">
              加入唱片库
            </button>
          </div>

          <p class="mt-5 text-[10px] leading-relaxed text-line">
            接口：{{ ENDPOINT }}（可用 VITE_COVER_API 覆盖）。密钥请放在你自己的后端，前端不持有。
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
