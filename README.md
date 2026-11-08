# RETRO DECK · 黑胶唱片机 & 磁带录音机

一个用于作品集 / 个人主页展示的拟物（skeuomorphic）音乐播放器。
技术栈：**Vue 3 + Vite + Pinia + TailwindCSS + GSAP**。

> 核心理念：**换歌 = 更换黑胶唱片 / 更换磁带**，而不是点一下列表就切歌。
> 黑胶模式与磁带模式共用同一份音频状态，通过拨动开关整机切换，切换时音乐不断。

[**▶ 在线演示**](https://msmlwdzh.github.io/retro-music-player/) ·
[![Deploy to GitHub Pages](https://github.com/msmlwdzh/retro-music-player/actions/workflows/deploy.yml/badge.svg)](https://github.com/msmlwdzh/retro-music-player/actions/workflows/deploy.yml)

> 演示站是纯静态托管，AI 封面接口没有后端可调；点弹窗里的「本地生成」走程序化封面，
> 同样能完整走通「生成 → 裁圆 → 入架」链路。

## 视觉风格：手绘丝网印海报（Hand-drawn Screenprint）

> **品红作地，墨青作骨，奶油黄作星环**——整页像一张丝网印的复古科幻海报。

- **配色**：品红家族 `#F2719F / #E8449B / #F59EC4`（地 / 强调 / 机身外壳），
  墨青黑 `#132A33`（文字 / 描边 / 控件 / 黑胶 / 磁带），奶油黄 `#F5E6A8`
  （星环色，统包所有金属件：唱臂 / 旋钮 / VU 表圈），正红 `#D91F30` 与青蓝 `#5FD8E8`
  只出现在背景天幕，暖白 `#FFF6F9` 用于深色块内的文字，深玫红 `#8C1B57` 作辅助文字与细线。
- **背景主图**：`src/components/HandDrawnBg.vue` —— 青蓝天空 → 品红云带 → 正红地面的三段天幕，
  一颗带奶油黄星环的品红行星（右侧裁切构图）、四角星芒、干笔刷云团与星环毛边
  （`feTurbulence` + `feDisplacementMap`），全部内联 SVG，无外部图片。
- **手绘质感**：面板用四角不等值圆角模拟线条抖动，外加一圈内描线（`.ac-panel::before`）；
  全站叠一层平铺噪点（`.hd-grain`，`mix-blend-mode: multiply`）模拟油墨颗粒；
  阴影一律是**硬边印影**（向右下位移 2~3px 的墨色实影），不做模糊投影。
- **造型**：机器保持复古机械结构，外壳走品红，转轴 / 唱针 / 仓门边框 / 按键走墨青黑撞色。
- **圆角**：卡片与机器组件统一 **12px**。
- **交互**：hover 时品红提亮、墨青控件加深，按下把印影「按平」（盖章感），过渡统一 **0.25s ease**。
- **字体**：全局无衬线 **Inter**，标题 700/800，正文 400。
- **克制**：动效只有唱盘旋转、磁带滚动、按钮点击反馈；装饰只存在于背景层，不干扰操作区。

---

## 快速开始

```bash
npm install
npm run gen:audio   # 可选：重新合成内置演示 BGM（需要先装 Python 3）
npm run dev         # http://localhost:5173
npm run build
```

---

## 部署（GitHub Pages）

纯静态产物，推 `main` 由 `.github/workflows/deploy.yml` 自动构建发布
（`configure-pages` → `upload-pages-artifact` → `deploy-pages`）。

- Pages 的 Source 需为 **GitHub Actions**（本仓库已配置），也可在 Actions 页手动 `Run workflow`
- 访问地址：<https://msmlwdzh.github.io/retro-music-player/>
- 子路径零配置：`vite.config.js` 用 `base: './'`，音源由 `audioControl.js` 按
  `document.baseURI` 解析，所以部署在 `/<repo>/` 下不会资源 / 音频 404
- 静态站没有后端，AI 封面接口不可用；弹窗会提示并可用「本地生成」兜底
- 想换自定义域名：Settings → Pages → Custom domain，无需改构建配置

---

## 核心交互

### 1. 黑胶模式（RecordPlayer）

| 动作 | 表现 |
| --- | --- |
| 播放 | 唱盘通电起转（阻尼 λ=1.8，起步快），唱臂扫到外圈落针 |
| 暂停 | 唱臂抬起归位，唱片**断电后靠惯性滑行减速**（λ=0.3，长尾） |
| 换歌 | 暂停 → 等唱片惯性减速 → 唱臂抬起 → 旧唱片移出转盘 → 新唱片载入 → 唱臂落下 → 播放 |
| 循迹 | 唱臂随播放进度由外向内缓慢扫动（0° → 14.6°） |
| 33⅓ / 45 | 真实改变唱盘转速与放音速率 |

### 2. 磁带模式（TapeDeck）

| 动作 | 表现 |
| --- | --- |
| 播放 | 左右卷轴转动，磁带带体随卷径实时改变切线位置 |
| 卷轴物理 | 角速度 ω = K / r —— 供带轮越放越快、收带轮越卷越慢（带速恒定） |
| 换磁带 | 停止 → 等卷轴惯性停住 → 仓门打开 → 取出旧磁带 → 放入新磁带 → 仓门关闭 → 走带 |
| 倒带 / 快进 | 按住 ⟪ / ⟫ 以 5 倍带速走带，卷径与指针同步变化 |
| VU 表 | 双通道指针 + 过载指示灯，由阻尼器模拟机械惯性 |

### 3. 共用状态

全局只有一个 `HTMLAudioElement`（`utils/audioControl.js`），
两套载体共享播放进度 / 音量 / 播放态，切换载体时音乐不中断。

### 4. 快捷键

`空格` 播放 / 暂停 · `←` `→` 换歌（走完整换装时序）

---

## AI 封面生成

1. 点右上角 **＋ AI 封面**
2. 输入歌名 + 风格描述 → 生成
3. 自动 **裁切成圆形黑胶封面**（canvas 圆形裁切，四角透明）
4. 预览「装上唱片后的样子」→ 加入曲库（写入 `localStorage` 持久化）

### 后端：`server/`（极简中转，FastAPI）

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000     # 文档：http://127.0.0.1:8000/docs
```

配置在 `server/.env`（已在 `.gitignore` 中）：`AI_IMAGE_API_KEY` / `AI_IMAGE_BASE_URL` / `AI_IMAGE_MODEL_NAME`。

- 接口 `POST /generate-cover`
  - 入参 `{ "song_name": "夜行电车", "artist": "...", "style": "Lo-fi 低保真", "desc": "雨天车窗" }`
  - 成功 `{ "success": true, "image_base64": "<裸 base64>", "prompt": "<最终提示词>" }`
  - 失败 `{ "success": false, "error_msg": "调用文生图服务失败：502 Bad Gateway" }`
- 密钥只从 `.env` 读，代码零硬编码；超时 20s；CORS 只允许 `http://127.0.0.1:5173`
- Vite 开发期已把 `/api` 代理到 `127.0.0.1:8000`，后端另挂了 `/api/generate-cover` 别名，
  因此现有前端的 `{ title, prompt }` 也能直接跑通（字段别名兼容），无需改前端
- 换文生图模型时主要改 `main.py` 的 `build_payload()`（请求体）与 `fetch_image_bytes()`（取图）
- 无数据库、无登录、无限流，可直接免费部署到 Render / Railway（启动命令 `uvicorn main:app --host 0.0.0.0 --port $PORT`）

未启动后端、或接口异常时，会自动回退到内置的**程序化 SVG 封面生成器**
（确定性哈希 + 风格调色板，纯前端、零依赖、可离线演示），保证演示永不中断。

---

## 目录结构

```
src/
├── components/
│   ├── RecordPlayer/
│   │   ├── RecordPlayer.vue   # 转盘机身 + 换唱片时序编排（总指挥）
│   │   ├── Record.vue         # 黑胶唱片：惯性旋转 / 飞出 / 载入
│   │   └── ToneArm.vue        # 唱臂：抬起 / 落下 / 循迹
│   ├── TapePlayer/
│   │   ├── TapeDeck.vue       # 仓门 + VU 表 + 换磁带时序编排（总指挥）
│   │   └── Tape.vue           # 卡带：卷轴联动 / 带体路径
│   ├── svg/                   # 静态平面资产（无动画，可单独嵌入任意项目）
│   │   ├── TurntableFlat.vue  #   分组 #base / #platter / #record / #tonearm
│   │   └── TapeDeckFlat.vue   #   分组 #tapeBody / #tapeFilm / #spoolLeft / #spoolRight / #door
│   ├── HandDrawnBg.vue        # 手绘背景主图（天幕 / 行星 / 星环 / 星芒，纯内联 SVG）
│   ├── Ornament.vue           # 几何装饰构件：corner / rule / spray / rosette
│   ├── AudioKnob.vue          # 拟物旋钮（拖拽 / 键盘）
│   └── AiCoverGen.vue         # AI 封面生成弹窗
├── store/
│   ├── useAudioStore.js       # 播放状态（isPlaying/progress/mode/library）
│   └── useLibraryStore.js     # 曲库 + localStorage 持久化
├── utils/
│   ├── anim.js                # 阻尼 / 惯性 / 缓动 / GSAP 编排助手
│   ├── audioControl.js        # 单一 HTMLAudioElement 引擎
│   └── coverArt.js            # 本地封面生成 + 圆形裁切
├── assets/covers/             # 内置曲目封面
├── App.vue
├── main.js
└── style.css
scripts/make-demo-audio.py     # 内置演示 BGM 合成脚本（npm run gen:audio）
server/                        # AI 封面中转后端：main.py / .env / requirements.txt
```

> 封面请求由 `AiCoverGen.vue` 直接发到 `/api/generate-cover`，
> 需要换后端地址时设根目录 `.env` 的 `VITE_COVER_API`（默认同源）。

---

## 实现要点

### 状态与动画解耦（换载体的单向指令）

`useAudioStore` 只管状态与音频，**不碰任何组件 DOM**；动画全部由载体组件自己编排。
二者通过 `pendingTrack` 单向通信：

```
requestTrack(track) ──► pendingTrack = track（store 只下指令，不做动画）
                              │
                  载体组件 watch 到指令，跑完自己的时序：
                    黑胶：暂停 → 抬臂 → 旧唱片右滑出 → switchTrack → 新唱片左滑入 → 落臂 → 播放
                    磁带：停止 → 仓门翻开 → 旧带取出 → switchTrack → 新带放入 → 关门 → 播放
                              ▼
                        clearPending()
```

好处：换唱片、换磁带是两套完全不同的动画，但复用同一个状态入口；
切歌 / 上一首 / 下一首 / 自动连播 / 点列表，全部汇入 `requestTrack` 这一个入口。

**状态字段**：`isPlaying`、`currentTrack{id,title,artist,src,cover}`、`progress(0~1)`、
`duration`、`mode('record'|'tape')`、`library`。
**方法**：`play()` / `pause()` / `toggle()` / `seek(percent)` / `switchTrack(track)` /
`requestTrack()` / `next()` / `prev()` / `setMode()` / `setVolumeTo()` / `addTrack()` / `destroy()`。

### 父子动画组合

子组件把阶段动画封装成 **暂停态 timeline**（`createTimeline()`）暴露出去，
父组件用 `addChild()` 编排顺序 —— **不能用裸 `.add()`**，
那条线是曾经踩过的大坑（详见下）：

```js
import { createTimeline, addChild } from '@/utils/anim'

const tl = createTimeline()
addChild(tl, recordRef.value.flyOut())   // 旧唱片移出
tl.call(() => player.onEjected())        // 通知状态机
addChild(tl, recordRef.value.flyIn())    // 新唱片载入
tl.play()
```

> ⚠️ **为什么必须用 `addChild`**：`createTimeline()` 返回的是 paused 时间轴。
> 直接 `.add(childTL)` 时，父时间轴的播放头确实会扫过它，但子时间轴自身 `_ts = 0`
> 仍在暂停，播放头永远停在进度 0 —— 动画完全不执行，元素被 `fromTo` 的初始态
> 留在「画面外 + 透明」，表现就是一点切歌载体直接消失。`addChild()` 在挂载后会
> 显式 `paused(false)` 放行，顺序仍完全由父级编排。

### 惯性手感

所有持续运动走 `gsap.ticker` 统一心跳，用**帧率无关的指数阻尼**：

```js
v += (target - v) * (1 - Math.exp(-λ * dt))
```

起转 λ 大（电机扭矩足），停转 λ 小（惯性滑行），因此 60fps / 120fps 手感一致。

### 视觉资源

全部为**内联 SVG**，无任何外部图片 / 图标库 / 字体资源。
质感靠三件套实现：`.hd-grain` 噪点层（模拟油墨颗粒）、`.ac-panel::before` 内描线
（模拟同一块版上再描一道墨）、以及**硬边印影**（向右下位移的墨色实影）。

---

## 内置演示 BGM

`public/audio/*.wav` 由 `scripts/make-demo-audio.py` 用**纯算法合成**
（加法合成和弦铺底 + 琶音 + 贝斯 + 简易鼓组 + 单极点低通 + 底噪），
无采样、无第三方素材，**无任何版权风险**，可安全用于作品集展示。

| 曲目 | 风格 | 时长 |
| --- | --- | --- |
| Midnight Turntable | Lo-fi 低保真 · 76 BPM | 25.3s |
| Cassette Sunset | Chill 慵懒 · 92 BPM | 20.9s |
| Neon Arcade | Synthwave · 110 BPM | 17.5s |

换成自己的音乐：把任意 `mp3/wav` 放进 `public/audio/`，
改 `src/store/useLibraryStore.js` 里的 `BUILTIN` 即可。

---

## 移动端适配

- 载体仓用 `aspect-ratio` 锁定比例，宽度自适应，不写死像素
- 弹窗在小屏为底部抽屉、大屏为居中面板
- 旋钮支持触摸拖拽（`touch-action: none` + Pointer Events）
- 磁带走带键支持「按住」手势
- 快捷键不干扰输入框

## 依赖

仅 3 个运行时依赖：`vue` `pinia` `gsap`，无冗余依赖。
