/**
 * ============================================================
 *  audioControl.js —— HTMLAudioElement 薄封装（纯函数，零 Vue 依赖）
 * ------------------------------------------------------------
 *  设计边界：
 *    · 只做「音频能力」：创建 / 加载 / 播放 / 暂停 / seek / 音量 / 销毁。
 *    · 不碰任何组件 DOM，不持有业务状态（进度、曲目由 store 管）。
 *    · 对外只通过 handlers 回调抛事件，便于测试与替换实现。
 *  全局约定只创建 **一个** audio 实例：两套载体（唱片 / 磁带）共用，
 *  切换模式时音乐不会断。
 * ============================================================
 */

/**
 * 创建音频控制器。
 *
 * @param {object} handlers 事件回调（全部可选）
 * @param {(p:{currentTime:number,duration:number,progress:number})=>void} handlers.onTime
 *        timeupdate：每 200~250ms 触发一次，抛进度给视觉层
 * @param {(p:{duration:number})=>void} handlers.onLoaded  loadedmetadata：拿到总时长
 * @param {()=>void} handlers.onEnded   播放结束
 * @param {()=>void} handlers.onPlay    真正开始播放
 * @param {()=>void} handlers.onPause   真正暂停
 * @param {(err:any)=>void} handlers.onError  加载 / 解码失败
 * @returns {{el: HTMLAudioElement}}
 */
export function createAudioInstance(handlers = {}) {
  const el = new Audio()
  el.preload = 'metadata'
  el.volume = 0.8
  el.crossOrigin = null

  const emitTime = () => {
    const duration = Number.isFinite(el.duration) ? el.duration : 0
    handlers.onTime?.({
      currentTime: el.currentTime,
      duration,
      progress: duration > 0 ? el.currentTime / duration : 0,
    })
  }

  const onLoaded = () => handlers.onLoaded?.({ duration: Number.isFinite(el.duration) ? el.duration : 0 })
  const onEnded = () => handlers.onEnded?.()
  const onPlay = () => handlers.onPlay?.()
  const onPause = () => handlers.onPause?.()
  const onError = () => handlers.onError?.(el.error)

  el.addEventListener('timeupdate', emitTime)
  el.addEventListener('loadedmetadata', onLoaded)
  el.addEventListener('durationchange', onLoaded)
  el.addEventListener('ended', onEnded)
  el.addEventListener('play', onPlay)
  el.addEventListener('pause', onPause)
  el.addEventListener('error', onError)

  // 记录解绑函数，保证 destroyAudio 不泄漏监听
  const ctrl = {
    el,
    _off() {
      el.removeEventListener('timeupdate', emitTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('durationchange', onLoaded)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('error', onError)
    },
  }
  return ctrl
}

/**
 * 载入音源。src 为相对路径时按 document.baseURI 解析，
 * 这样部署到子路径（base: './'）也不会 404。
 * @returns {boolean} 是否真的发生了切换（相同地址会跳过重载）
 */
export function loadAudio(ctrl, src) {
  if (!ctrl?.el || !src) return false
  const url = /^(https?:|blob:|data:)/i.test(src) ? src : new URL(src, document.baseURI).href
  if (ctrl.el.src === url) return false
  ctrl.el.src = url
  ctrl.el.load()
  return true
}

/**
 * 播放。浏览器自动播放策略可能拒绝（未产生用户交互时），
 * 这里吞掉异常并返回是否成功，由调用方决定是否回退 UI 状态。
 * @returns {Promise<boolean>}
 */
export async function playAudio(ctrl) {
  if (!ctrl?.el) return false
  try {
    await ctrl.el.play()
    return true
  } catch {
    return false
  }
}

/** 暂停 */
export function pauseAudio(ctrl) {
  if (!ctrl?.el) return
  ctrl.el.pause()
}

/**
 * 跳转到指定进度。
 * @param {number} percent 0~1（不是 0~100）
 */
export function seekAudio(ctrl, percent) {
  if (!ctrl?.el) return
  const p = Math.min(1, Math.max(0, Number(percent) || 0))
  const duration = Number.isFinite(ctrl.el.duration) ? ctrl.el.duration : 0
  if (duration > 0) ctrl.el.currentTime = p * duration
}

/**
 * 设置音量。
 * @param {number} v 0~1
 */
export function setVolume(ctrl, v) {
  if (!ctrl?.el) return
  ctrl.el.volume = Math.min(1, Math.max(0, Number(v) || 0))
}

/** 销毁：暂停 + 解绑 + 释放音源 */
export function destroyAudio(ctrl) {
  if (!ctrl?.el) return
  try {
    ctrl.el.pause()
  } catch {
    /* 忽略：元素可能已处于不可用状态 */
  }
  ctrl._off?.()
  ctrl.el.removeAttribute('src')
  ctrl.el.load()
}
