/**
 * ============================================================
 *  useLibraryStore —— 曲库（唱片架 / 磁带架）
 * ------------------------------------------------------------
 *  · 内置 3 首自制无版权演示 BGM（见 scripts/make-demo-audio.py，
 *    运行时由纯算法合成，无任何版权风险）。
 *  · AI 生成的曲目连同封面一起持久化到 localStorage，
 *    刷新页面后仍在架子上。
 * ============================================================
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashString, localCover } from '@/utils/coverArt'
// 内置展示封面：日系 city pop 方形插画（裁圆后贴在唱片中心）
import citypopCover from '@/assets/covers/citypop-cover.jpg'

const LS_KEY = 'retro-deck:tracks:v1'

/** 内置演示曲目：封面用确定性种子生成，保证每次刷新一致 */
const BUILTIN = [
  {
    id: 'bgm-midnight',
    title: 'Midnight Turntable',
    artist: 'Deck A · 午夜转盘',
    style: 'Lo-fi 低保真 · 深夜 · 唱片底噪',
    bpm: 76,
    src: 'audio/midnight-turntable.wav',
    seed: 1071,
  },
  {
    id: 'bgm-sunset',
    title: 'Cassette Sunset',
    artist: 'Deck B · 磁带落日',
    style: 'Chill 慵懒 · 日落 · 磁带走带',
    bpm: 92,
    src: 'audio/cassette-sunset.wav',
    seed: 2863,
  },
  {
    id: 'bgm-arcade',
    title: 'Neon Arcade',
    artist: 'Deck C · 霓虹街机',
    style: 'Synthwave 合成器 · 霓虹 · 街机',
    bpm: 110,
    src: 'audio/neon-arcade.wav',
    seed: 4519,
  },
].map((t) => ({
  ...t,
  // 「磁带落日」用实拍级 city pop 插画封面，其余用确定性程序化封面
  cover:
    t.id === 'bgm-sunset'
      ? citypopCover
      : localCover({ title: t.title, style: t.style, seed: t.seed }),
  source: 'builtin',
  createdAt: 0,
}))

/* ------------------------- 持久化 ------------------------- */

function loadCustom() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((t) => t && t.id && t.src) : []
  } catch {
    return []
  }
}

function persistCustom(list) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch (err) {
    // 容量超限（大量 AI 封面）时给出提示但不阻断交互
    console.warn('[library] 本地存储写入失败：', err)
  }
}

export const useLibraryStore = defineStore('library', () => {
  /** AI / 用户新增的曲目（持久化部分） */
  const custom = ref(loadCustom())

  /** 完整曲库：内置在前，用户曲目在后 */
  const tracks = computed(() => [...BUILTIN, ...custom.value])

  const ids = computed(() => tracks.value.map((t) => t.id))

  function getById(id) {
    return tracks.value.find((t) => t.id === id) || null
  }

  /** 取相邻曲目 id（dir = 1 下一首 / -1 上一首，首尾循环） */
  function siblingId(id, dir = 1) {
    const list = ids.value
    if (!list.length) return null
    const i = list.indexOf(id)
    if (i === -1) return list[0]
    return list[(i + dir + list.length) % list.length]
  }

  /**
   * 新增曲目（AI 封面弹窗走这里）。
   * @param {{title:string, style?:string, cover:string, src:string, bpm?:number}} payload
   */
  function addTrack({ title, style = '', cover = '', src, bpm = 90 }) {
    const cleanTitle = (title || 'UNTITLED').trim().slice(0, 40) || 'UNTITLED'
    const seed = hashString(cleanTitle + '|' + style)
    const track = {
      id: `ai-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
      title: cleanTitle,
      artist: 'AI Cover · 自制封面',
      style: style || 'AI 生成封面',
      bpm,
      src,
      cover,
      seed,
      source: 'ai',
      createdAt: Date.now(),
    }
    custom.value = [...custom.value, track]
    persistCustom(custom.value)
    return track
  }

  return {
    tracks,
    custom,
    getById,
    siblingId,
    addTrack,
  }
})
