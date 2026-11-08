/**
 * ============================================================
 *  anim.js —— GSAP 缓动与动画工厂的统一出口
 * ------------------------------------------------------------
 *  为什么要单独抽一层：
 *    · 所有质感相关的数值（缓动曲线 / 时长 / 转速）集中在这里，
 *      改一处就能全局调整手感，不用去每个组件里翻 magic number。
 *    · 组件只负责「编排顺序」，曲线与工厂由本文件提供。
 *  不依赖 Vue，可单独测试。
 * ============================================================
 */
import gsap from 'gsap'

export { gsap }

/* ============================================================
 *  一、缓动预设（EASE）
 * ============================================================ */

export const EASE = {
  /** 惯性减速：断电后靠惯性滑行至停止，尾巴长、收得软 */
  inertia: 'power3.out',
  /** 阻尼滑入：物体落位/插入时的阻尼感（快进慢出） */
  dampIn: 'power3.out',
  /** 阻尼滑出：抽出/移出时的阻尼感（慢起快走） */
  dampOut: 'power2.in',
  /** 匀速旋转：唱片、卷轴这类必须恒定角速度，绝不能加缓动 */
  spin: 'none',
  /** 唱臂起落：两端都有阻尼，中段利落 */
  arm: 'power2.inOut',
  /** 仓门开合：机械翻盖，略带回弹 */
  door: 'back.out(1.2)',
  /** 旋钮跟手：松手后极短的收敛动画 */
  knob: 'power4.out',
}

/* ============================================================
 *  二、时长预设（DUR，单位：秒）
 * ============================================================ */

export const DUR = {
  /** 33⅓ rpm 转满一圈的耗时：60 / 33.333 = 1.8s */
  turn: 1.8,
  /** 断电后惯性滑行的总时长 */
  slowDown: 2.6,
  /** 唱臂抬起 / 落下 */
  arm: 0.75,
  /** 唱片 / 磁带进出场 */
  slide: 0.62,
  /** 仓门开合 */
  door: 0.55,
  /** 旋钮回弹 */
  knob: 0.35,
}

/** 默认转速（转/分）：33⅓ —— 黑胶长播放标准转速 */
export const DEFAULT_RPM = 33 + 1 / 3

/* ============================================================
 *  三、数学 / 格式化工具
 * ============================================================ */

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v)

/** 秒 → mm:ss（NaN / Infinity 统一显示为 0:00） */
export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ============================================================
 *  四、时间轴 / 心跳
 * ============================================================ */

/**
 * 创建一条「暂停态」时间轴。
 * 子组件把自己的阶段动画封成 paused timeline 交出去，
 * 父组件用 .add(childTL) 自由编排先后顺序 —— 这是换装时序的基础。
 */
export function createTimeline(vars = {}) {
  return gsap.timeline({ paused: true, ...vars })
}

/**
 * 【关键】把一条「暂停态」子时间轴挂到父时间轴上，并解除它的暂停。
 * ------------------------------------------------------------------
 * ⚠️ 为什么不能直接用 parent.add(childTL)：
 *   createTimeline() 返回的都是 paused 时间轴。直接 add() 进父时间轴后，
 *   父时间轴的播放头确实会扫过它，但子时间轴自身 _ts = 0（仍在暂停），
 *   播放头永远停在进度 0 —— 于是「飞出」不执行、「飞入」也不执行，
 *   元素被 fromTo 的 immediateRender 留在「画面外 + 透明」的初始态上，
 *   表现就是：一点切歌，载体直接消失且再也回不来。
 *
 *   所以必须在 add() 之后显式 paused(false) 把子时间轴放行，
 *   之后由父时间轴的播放头统一驱动，顺序仍然完全由父级编排。
 *
 * @param {gsap.core.Timeline} parent   父时间轴
 * @param {gsap.core.Timeline|Function|*} child 子时间轴 / 回调 / 任意可被 add 的值
 * @param {number|string} [position]    插入位置，省略则追加到末尾
 * @returns {gsap.core.Timeline} 父时间轴（便于链式调用）
 */
export function addChild(parent, child, position) {
  if (!parent) return child
  // 回调 / 空值：原样交给 GSAP（duration 为 0，不占用时序）
  if (!child || typeof child.paused !== 'function') {
    return position === undefined ? parent.add(child) : parent.add(child, position)
  }
  if (position === undefined) parent.add(child)
  else parent.add(child, position)
  child.paused(false) // ← 放行，否则子时间轴永远不会播放
  return parent
}

/* ============================================================
 *  四、旋转动画工厂
 * ============================================================ */

/**
 * 匀速旋转：唱片 / 卷轴通电后的持续转动。
 * 用相对位移 `+=360` + repeat:-1，保证长时间播放不会累积浮点误差跳帧。
 *
 * @param {Element} target    SVG 元素
 * @param {object}   opts
 * @param {number}   opts.rpm        转速（转/分），负值反转
 * @param {string}   opts.svgOrigin  'x y'，SVG 空间中的旋转中心
 * @param {number}   opts.direction  1 正转 / -1 反转
 * @returns {gsap.core.Tween}
 */
export function createSpinTween(target, { rpm = DEFAULT_RPM, svgOrigin, direction = 1 } = {}) {
  const perTurn = 60 / Math.abs(rpm || DEFAULT_RPM) // 一圈耗时（秒）
  const vars = {
    rotation: `+=${360 * (direction >= 0 ? 1 : -1)}`,
    duration: perTurn,
    repeat: -1,
    ease: EASE.spin,
  }
  if (svgOrigin) vars.svgOrigin = svgOrigin
  return gsap.to(target, vars)
}

/**
 * 惯性减速停止：断电后不是立刻停，而是继续滑行一段再慢慢收住。
 * 实现方式是「再补一段相对旋转 + 长尾 ease」，比 kill() 自然得多。
 *
 * @param {Element} target
 * @param {object}   opts
 * @param {string}   opts.svgOrigin 旋转中心
 * @param {number}   opts.duration  滑行总时长
 * @param {number}   opts.extraDeg  额外滑过的角度（越大惯性越明显）
 * @returns {gsap.core.Tween}
 */
export function slowDownTween(
  target,
  { svgOrigin, duration = DUR.slowDown, ease = EASE.inertia, extraDeg = 170, onComplete } = {}
) {
  const vars = {
    rotation: `+=${extraDeg}`,
    duration,
    ease,
    overwrite: 'auto',
  }
  if (svgOrigin) vars.svgOrigin = svgOrigin
  if (onComplete) vars.onComplete = onComplete
  return gsap.to(target, vars)
}

/**
 * 尊重系统「减少动效」偏好：命中时把动画时长压到接近 0。
 * 组件里 duration: DUR.xxx * motionScale() 即可全局生效。
 */
export function motionScale() {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return reduced ? 0.01 : 1
}
