<script setup>
/**
 * ============================================================
 *  HandDrawnBg.vue —— 手绘丝网印背景（页面主图）
 * ------------------------------------------------------------
 *  风格取自参考图：青蓝天空 → 品红云带 → 正红地面的三段天幕，
 *  配一颗带奶油黄星环的品红行星，外加四角星芒与纸面颗粒。
 *
 *  实现要点（全部内联 SVG，零外部资源）：
 *   1. 三段天幕用一条竖向 linearGradient，避免多层半透明叠加造成的灰浊；
 *   2. 云团用手绘感的曲线路径 + feDisplacementMap 抖动边缘，
 *      让描边像干笔刷擦出来的毛边，而不是矢量弧线；
 *   3. 行星的暗面用 clipPath 裁在圆内，色取墨青黑，与全站文字同色；
 *   4. 颗粒用 .hd-grain 的平铺噪点（见 style.css），不额外跑滤镜。
 *
 *  纯装饰层：pointer-events-none + aria-hidden，不参与任何交互。
 * ============================================================
 */
</script>

<template>
  <div class="hd-grain pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
    <svg
      class="h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- 三段天幕：青蓝 → 品红 → 正红 -->
        <linearGradient id="hd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#A6EDF6" />
          <stop offset="15%" stop-color="#74DFEE" />
          <stop offset="30%" stop-color="#5FD8E8" />
          <stop offset="44%" stop-color="#8FD8DE" />
          <stop offset="55%" stop-color="#F087B0" />
          <stop offset="66%" stop-color="#EE5C93" />
          <stop offset="77%" stop-color="#E8449B" />
          <stop offset="88%" stop-color="#D9202F" />
          <stop offset="100%" stop-color="#A81422" />
        </linearGradient>

        <!-- 行星本体：左上受光，右下转入品红暗调 -->
        <radialGradient id="hd-planet" cx="32%" cy="26%" r="82%">
          <stop offset="0%" stop-color="#FFA9D6" />
          <stop offset="34%" stop-color="#F45CA6" />
          <stop offset="72%" stop-color="#D62C8A" />
          <stop offset="100%" stop-color="#9C1A62" />
        </radialGradient>

        <!-- 星环：奶油黄，末端略深，像被行星挡住的那段 -->
        <linearGradient id="hd-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#FBF0C4" stop-opacity="0" />
          <stop offset="18%" stop-color="#FBF0C4" />
          <stop offset="62%" stop-color="#F5E6A8" />
          <stop offset="100%" stop-color="#D9BE72" />
        </linearGradient>

        <!-- 手绘毛边：低频湍流做位移，边缘像干笔刷 -->
        <filter id="hd-rough" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.028" numOctaves="3" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <!-- 小尺度毛边：星芒、细线用 -->
        <filter id="hd-rough-sm" x="-14%" y="-14%" width="128%" height="128%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <!-- 四角星芒：唱片海报里的高光点 -->
        <symbol id="hd-spark" viewBox="-14 -14 28 28">
          <path
            d="M0 -14 C1.9 -4.2 4.2 -1.9 14 0 C4.2 1.9 1.9 4.2 0 14 C-1.9 4.2 -4.2 1.9 -14 0 C-4.2 -1.9 -1.9 -4.2 0 -14 Z"
            fill="currentColor"
          />
        </symbol>

        <!-- 行星裁剪区（暗面、陨石坑、环的正面都裁在圆内） -->
        <clipPath id="hd-planet-clip">
          <circle cx="1310" cy="105" r="232" />
        </clipPath>
      </defs>

      <!-- ---------- 天幕 ---------- -->
      <rect width="1440" height="900" fill="url(#hd-sky)" />

      <!-- ---------- 天空干刷痕：斜向长笔触，只做肌理不抢主体 ---------- -->
      <g stroke-linecap="round" fill="none" opacity=".2">
        <path d="M-40 300 C 260 250, 520 320, 760 268 C 900 238, 980 250, 1060 276" stroke="#FFFFFF" stroke-width="14" />
        <path d="M120 372 C 340 336, 520 384, 700 350" stroke="#BFF2F8" stroke-width="10" />
        <path d="M-20 214 C 180 186, 320 226, 470 202" stroke="#FFFFFF" stroke-width="7" />
        <path d="M860 356 C 980 340, 1080 356, 1200 338" stroke="#FFFFFF" stroke-width="8" />
      </g>

      <!-- ---------- 云带（干笔刷毛边） ---------- -->
      <g filter="url(#hd-rough)">
        <!-- 中段大面积粉云：横贯画面，压住青蓝与正红的交界 -->
        <path
          d="M-60 470 C 90 424, 180 466, 300 448 C 420 430, 470 392, 590 404 C 710 416, 760 456, 880 448
             C 1000 440, 1060 400, 1180 410 C 1300 420, 1380 458, 1500 440 L 1500 700 L -60 700 Z"
          fill="#FAC4DA"
          opacity=".42"
        />
        <!-- 粉云受光面：更亮的一段，制造笔触层次 -->
        <path
          d="M-40 512 C 130 476, 240 512, 380 496 C 520 480, 560 452, 700 460 C 840 468, 900 500, 1040 488
             C 1180 476, 1240 448, 1480 468"
          fill="none"
          stroke="#FFD9EA"
          stroke-width="26"
          stroke-linecap="round"
          opacity=".45"
        />
        <!-- 深红云团：左下角压住画面，给红色地面一个起点 -->
        <path
          d="M-60 640 C 60 596, 150 628, 240 606 C 330 584, 360 556, 460 566 C 560 576, 600 620, 700 636
             L 700 760 L -60 760 Z"
          fill="#EE2A3C"
          opacity=".55"
        />
        <!-- 高光云丝：几笔横向干刷，模拟笔触拖尾 -->
        <g stroke="#FFE7F0" stroke-linecap="round" fill="none" opacity=".5">
          <path d="M120 560 C 220 546, 300 566, 400 552" stroke-width="9" />
          <path d="M760 588 C 860 572, 940 594, 1050 578" stroke-width="7" />
          <path d="M980 528 C 1070 514, 1140 534, 1230 520" stroke-width="11" />
        </g>
      </g>

      <!-- ---------- 行星 + 星环 ---------- -->
      <!-- 环的背段：整圈画一遍，中间部分随后被行星本体盖住。
           整组套毛边滤镜，边缘才会像干笔刷擦出来，而不是矢量圆弧。 -->
      <g transform="rotate(-19 1310 105)" filter="url(#hd-rough)">
        <ellipse cx="1310" cy="105" rx="392" ry="96" fill="none" stroke="url(#hd-ring)" stroke-width="40" opacity=".95" />
        <ellipse cx="1310" cy="105" rx="330" ry="70" fill="none" stroke="#FBF0C4" stroke-width="9" opacity=".45" />
        <ellipse cx="1310" cy="105" rx="270" ry="50" fill="none" stroke="#A98A3C" stroke-width="5" opacity=".3" />
      </g>

      <!-- 行星本体 -->
      <circle cx="1310" cy="105" r="232" fill="url(#hd-planet)" />

      <g clip-path="url(#hd-planet-clip)">
        <!-- 暗面：只做右侧一弯月牙，受光面留给左半边，避免整颗球糊成灰色 -->
        <path
          d="M1284 -110 C 1206 40, 1226 190, 1326 300 L 1600 300 L 1600 -110 Z"
          fill="#123A46"
          opacity=".82"
        />
        <!-- 明暗交界处一抹青蓝，像油墨叠印错位 -->
        <path
          d="M1286 -40 C 1216 90, 1232 200, 1320 290"
          fill="none"
          stroke="#2FB4CC"
          stroke-width="9"
          opacity=".3"
        />

        <!-- 陨石坑：受光面一侧，深坑 + 品红受光边缘 -->
        <g>
          <g fill="#0A1A20" opacity=".5">
            <ellipse cx="1150" cy="80" rx="36" ry="24" transform="rotate(-20 1150 80)" />
            <ellipse cx="1216" cy="24" rx="20" ry="14" transform="rotate(-12 1216 24)" />
            <ellipse cx="1116" cy="176" rx="25" ry="18" transform="rotate(14 1116 176)" />
            <ellipse cx="1206" cy="206" rx="14" ry="10" transform="rotate(-8 1206 206)" />
            <ellipse cx="1152" cy="248" rx="9" ry="7" />
          </g>
          <g fill="none" stroke="#FFA9D6" stroke-width="4" opacity=".5">
            <path d="M1124 68 C 1138 58, 1160 56, 1178 64" />
            <path d="M1100 168 C 1110 162, 1124 162, 1134 167" />
          </g>
        </g>

        <!-- 环的前段：同一条椭圆，只留球面内的部分，于是自然变成一道弧 -->
        <g transform="rotate(-19 1310 105)">
          <ellipse cx="1310" cy="105" rx="392" ry="96" fill="none" stroke="url(#hd-ring)" stroke-width="40" opacity=".95" />
        </g>
        <!-- 弧顶压一道深线，把环和球面分开 -->
        <g transform="rotate(-19 1310 105)">
          <ellipse cx="1310" cy="105" rx="392" ry="116" fill="none" stroke="#A98A3C" stroke-width="4" opacity=".35" />
        </g>
      </g>

      <!-- ---------- 星芒 ---------- -->
      <g filter="url(#hd-rough-sm)">
        <use href="#hd-spark" x="126" y="86" width="26" height="26" style="color: #fff6f9" opacity=".95" />
        <use href="#hd-spark" x="286" y="192" width="18" height="18" style="color: #fbf0c4" opacity=".9" />
        <use href="#hd-spark" x="454" y="62" width="14" height="14" style="color: #fff6f9" opacity=".8" />
        <use href="#hd-spark" x="728" y="146" width="20" height="20" style="color: #fff6f9" opacity=".85" />
        <use href="#hd-spark" x="62" y="330" width="16" height="16" style="color: #fff6f9" opacity=".7" />
        <use href="#hd-spark" x="906" y="330" width="22" height="22" style="color: #fff6f9" opacity=".8" />
        <use href="#hd-spark" x="1338" y="392" width="18" height="18" style="color: #fff6f9" opacity=".75" />
        <use href="#hd-spark" x="196" y="712" width="20" height="20" style="color: #fff6f9" opacity=".55" />
        <use href="#hd-spark" x="820" y="806" width="24" height="24" style="color: #fff6f9" opacity=".6" />
      </g>

      <!-- ---------- 底部干刷：几笔横向擦痕，收住红地的边 ---------- -->
      <g stroke="#EE2A3C" stroke-linecap="round" fill="none" opacity=".5">
        <path d="M-20 792 C 160 768, 320 800, 520 776" stroke-width="16" />
        <path d="M700 826 C 880 802, 1040 830, 1240 808" stroke-width="12" />
        <path d="M300 866 C 480 846, 640 870, 820 850" stroke-width="20" />
      </g>
    </svg>
  </div>
</template>
