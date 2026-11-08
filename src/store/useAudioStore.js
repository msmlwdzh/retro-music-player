/**
 * ============================================================
 *  useAudioStore —— 全局音频状态（Pinia setup store）
 * ------------------------------------------------------------
 *  职责边界：**只管状态与音频控制，不碰任何组件 DOM**。
 *  视觉动画层（Record / ToneArm / TapeDeck）通过读取这些响应式字段
 *  （isPlaying / progress / mode …）来驱动自己的 GSAP 动画，
 *  store 不知道动画的存在，动画也不知道 audio 元素的存在。
 *
 *  状态字段：
 *    isPlaying     boolean  是否正在播放
 *    currentTrack  object   { id, title, artist, src, cover }
 *    progress      number   0~1 播放进度（timeupdate 驱动，供视觉层同步）
 *    duration      number   总时长（秒）
 *    mode          string   'record' | 'tape' 载体模式（互斥显示）
 *    library       array    曲目数组
 *
 *  对外方法：
 *    play() / pause() / toggle() / seek(percent) / switchTrack(track)
 *    next() / prev() / requestTrack() / setMode() / setVolume() / destroy()
 * ============================================================
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createAudioInstance,
  destroyAudio,
  loadAudio,
  pauseAudio,
  playAudio,
  seekAudio,
  setVolume,
} from '@/utils/audioControl'
import { clamp } from '@/utils/anim'
import { useLibraryStore } from '@/store/useLibraryStore'

export const useAudioStore = defineStore('audio', () => {
  /* ------------------------- 状态 ------------------------- */

  const isPlaying = ref(false)
  /** @type {import('vue').Ref<{id:string,title:string,artist:string,src:string,cover:string}|null>} */
  const currentTrack = ref(null)
  const progress = ref(0)
  const duration = ref(0)
  const currentTime = ref(0) // 仅用于界面显示 mm:ss
  /** @type {import('vue').Ref<'record'|'tape'>} */
  const mode = ref('record')
  const volume = ref(0.8)
  const error = ref('') // 音频加载失败提示

  /**
   * 待装载曲目 —— 换装时序的单向指令通道。
   * 组件（RecordPlayer / TapeDeck）watch 到非空值就执行完整的
   * 「取出旧载体 → 放入新载体」动画，播完再调 switchTrack() 真正切换。
   * store 不关心动画怎么演，只负责下指令。
   */
  const pendingTrack = ref(null)

  /** 曲库来自 libraryStore（内置演示曲目 + localStorage 持久化的 AI 曲目） */
  const libraryStore = useLibraryStore()
  const library = computed(() => libraryStore.tracks)

  /* ------------------------- 音频实例 ------------------------- */

  /** 全局唯一一个 HTMLAudioElement，两套载体共用 */
  const ctrl = createAudioInstance({
    onTime: ({ currentTime: t, duration: d, progress: p }) => {
      currentTime.value = t
      if (d > 0) duration.value = d
      progress.value = p
    },
    onLoaded: ({ duration: d }) => {
      duration.value = d
    },
    onEnded: () => {
      isPlaying.value = false
      progress.value = 1
      // 自动连播：也走换装时序，保持体验一致
      const nextTrack = libraryStore.siblingId(currentTrack.value?.id ?? '', 1)
      const t = libraryStore.getById(nextTrack)
      if (t) pendingTrack.value = t
    },
    onPlay: () => {
      isPlaying.value = true
    },
    onPause: () => {
      isPlaying.value = false
    },
    onError: (e) => {
      error.value = e ? `音频加载失败（code ${e.code}）` : '音频加载失败'
      isPlaying.value = false
    },
  })

  /* ------------------------- 控制方法 ------------------------- */

  /** 首次调用时把第一首曲目装填进机器（不自动播放，等用户交互） */
  function init() {
    if (!currentTrack.value && library.value.length) {
      currentTrack.value = library.value[0]
      loadAudio(ctrl, currentTrack.value.src)
    }
    setVolume(ctrl, volume.value)
  }

  /** 播放：没有当前曲目时自动取曲库第一首 */
  async function play() {
    error.value = ''
    if (!currentTrack.value && library.value.length) {
      currentTrack.value = library.value[0]
    }
    if (!currentTrack.value) return
    loadAudio(ctrl, currentTrack.value.src)
    const ok = await playAudio(ctrl)
    isPlaying.value = ok
    if (!ok) error.value = '浏览器拦截了自动播放，请再点一次播放键'
  }

  /** 暂停 */
  function pause() {
    pauseAudio(ctrl)
    isPlaying.value = false
  }

  /** 播放 / 暂停切换 */
  function toggle() {
    isPlaying.value ? pause() : play()
  }

  /**
   * 跳转到指定进度（0~1）。
   * 同时立即更新 progress，让视觉层（唱片角度 / 卷轴）跟手而不是等下一次 timeupdate。
   */
  function seek(percent) {
    const p = clamp(Number(percent) || 0)
    seekAudio(ctrl, p)
    progress.value = p
    currentTime.value = duration.value * p
  }

  /**
   * 切换曲目（真正换音源）。
   * 注意：本方法**不含**动画，换唱片 / 换磁带的时序动画由载体组件编排，
   * 组件在「旧载体移出、新载体就位」的时机调用本方法。
   *
   * @param {{id:string,title:string,artist:string,src:string,cover:string}} track
   * @param {{autoplay?:boolean}} opts
   */
  function switchTrack(track, { autoplay = false } = {}) {
    if (!track) return
    currentTrack.value = track
    progress.value = 0
    currentTime.value = 0
    duration.value = 0
    error.value = ''
    loadAudio(ctrl, track.src)
    if (autoplay) play()
  }

  /**
   * 请求换曲目 —— 对外统一的换歌入口（点列表、上下首、自动连播都走这里）。
   * 只下指令不做动画：置 pendingTrack，等载体组件演完时序后自行 switchTrack。
   */
  function requestTrack(track) {
    if (!track || track.id === currentTrack.value?.id) {
      // 点的是当前曲目：不换载体，只切换播放态
      toggle()
      return
    }
    pendingTrack.value = track
  }

  /** 下一首（循环） */
  function next() {
    const t = libraryStore.getById(libraryStore.siblingId(currentTrack.value?.id ?? '', 1))
    if (t) requestTrack(t)
  }

  /** 上一首（循环） */
  function prev() {
    const t = libraryStore.getById(libraryStore.siblingId(currentTrack.value?.id ?? '', -1))
    if (t) requestTrack(t)
  }

  /**
   * 切换载体模式：'record' | 'tape'。
   * 只换视觉载体，音频实例不变 —— 所以切换时音乐不会断。
   */
  function setMode(m) {
    mode.value = m === 'tape' ? 'tape' : 'record'
  }

  /** 音量 0~1 */
  function setVolumeTo(v) {
    volume.value = clamp(Number(v) || 0)
    setVolume(ctrl, volume.value)
  }

  /** AI 封面生成后入库：转发给 libraryStore（内部负责 localStorage 持久化） */
  function addTrack(payload) {
    const track = libraryStore.addTrack(payload)
    return track
  }

  /** 组件演完换装动画后调用，清空指令 */
  function clearPending() {
    pendingTrack.value = null
  }

  /** 页面卸载时释放音频资源 */
  function destroy() {
    destroyAudio(ctrl)
  }

  /* ------------------------- 派生 ------------------------- */

  return {
    // state
    isPlaying,
    currentTrack,
    progress,
    duration,
    currentTime,
    mode,
    volume,
    error,
    pendingTrack,
    library,
    // actions
    init,
    play,
    pause,
    toggle,
    seek,
    switchTrack,
    requestTrack,
    next,
    prev,
    setMode,
    setVolumeTo,
    addTrack,
    clearPending,
    destroy,
  }
})
