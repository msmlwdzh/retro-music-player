<!--
  ============================================================
   TurntableFlat.vue —— 复古台式黑胶唱片机（2D 扁平拟物）
  ------------------------------------------------------------
   · 纯 SVG 静态图形：无动画、无外部资源、无 <filter>（阴影交给 Tailwind）
   · 配色遵循全站规范：外壳灰粉 #f59ec4，转盘 / 唱片 / 唱臂 / 按钮炭黑 #132a33，
     辅助线 #8c1b57，金属件走低反差哑光石墨。
   · 分组 id 约定（可直接用 GSAP 选择器驱动）：
       #base      底座（机身 / 旋钮 / 开关，整体不参与旋转）
       #platter   转盘（金属盘面 + 中心轴）
       #record    黑胶唱片（沟槽 + 中心封面镂空区）
       #tonearm   唱臂（内部再分 #tonearmBase 支座 / #tonearmArm 可旋转臂）
   · 唱片中心预留 r=58 的圆形封面区 #coverSlot：
       传 cover="xxx.png" 即渲染 <image>，不传则显示灰粉占位底
   · 驱动示例：
       gsap.to('#tonearmArm', { rotation: 0,  svgOrigin: '478 140' })  // 落臂
       gsap.to('#tonearmArm', { rotation: -22, svgOrigin: '478 140' }) // 抬臂
       gsap.to('#record',     { rotation: 360, svgOrigin: '225 225', repeat: -1, ease: 'none' })
  ============================================================
-->
<template>
  <svg
    viewBox="0 0 600 450"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full"
    role="img"
    aria-label="复古台式黑胶唱片机"
  >
    <defs>
      <!-- 哑光石墨金属：竖向三段，反差压得很低 -->
      <linearGradient id="tt-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="50%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#a98a3c" />
      </linearGradient>

      <!-- 哑光塑料：机身外壳（灰粉，几乎看不出渐变） -->
      <linearGradient id="tt-plastic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fac4da" />
        <stop offset="100%" stop-color="#f59ec4" />
      </linearGradient>

      <!-- 唱臂 / 唱头：哑光石墨管 -->
      <linearGradient id="tt-arm" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="55%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#132a33" />
      </linearGradient>

      <!-- 黑胶盘面：极弱径向明暗（不用滤镜、不做镜面高光） -->
      <radialGradient id="tt-disc" cx="0.38" cy="0.32" r="0.78">
        <stop offset="0%" stop-color="#10242d" />
        <stop offset="0.7%" stop-color="#132a33" />
        <stop offset="1%" stop-color="#0a1a20" />
      </radialGradient>

      <!-- 封面占位底：灰粉 -->
      <radialGradient id="tt-slot" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0%" stop-color="#fff6f9" />
        <stop offset="1%" stop-color="#f59ec4" />
      </radialGradient>

      <!-- 唱片中心封面镂空：黑色盘面在此处被挖空 -->
      <mask id="tt-record-hole">
        <rect x="0" y="0" width="600" height="450" fill="#fff" />
        <circle cx="225" cy="225" r="58" fill="#000" />
      </mask>

      <!-- 封面裁切圆（给 <image> 用） -->
      <clipPath id="tt-cover-clip">
        <circle cx="225" cy="225" r="58" />
      </clipPath>
    </defs>

    <!-- ============================ 底座 ============================ -->
    <g id="base">
      <!-- 机身主体：灰粉外壳 + 炭黑外框 -->
      <rect x="18" y="36" width="564" height="378" rx="24" fill="url(#tt-plastic)" />
      <rect x="18" y="36" width="564" height="378" rx="24" fill="none" stroke="#132a33" stroke-width="2" />
      <!-- 内嵌面板（哑光顶面） -->
      <rect x="30" y="48" width="540" height="354" rx="18" fill="#f7b0cf" />
      <!-- 内框辅助线：只做分区 -->
      <rect x="42" y="60" width="516" height="330" rx="12" fill="none" stroke="#8c1b57" stroke-opacity=".7" />
      <!-- 上 / 下金属压条 -->
      <rect x="30" y="48" width="540" height="6" rx="3" fill="url(#tt-metal)" opacity=".55" />
      <rect x="30" y="396" width="540" height="6" rx="3" fill="url(#tt-metal)" opacity=".35" />

      <!-- 四只防滑脚（炭黑） -->
      <rect x="52" y="404" width="46" height="16" rx="7" fill="#132a33" />
      <rect x="502" y="404" width="46" height="16" rx="7" fill="#132a33" />

      <!-- 右侧控制区：转速开关（灰粉槽 + 炭黑滑块） -->
      <rect x="430" y="322" width="72" height="34" rx="10" fill="#f7b0cf" />
      <rect x="436" y="328" width="30" height="22" rx="7" fill="#132a33" />
      <circle cx="437" cy="362" r="3" fill="#8c1b57" />
      <circle cx="495" cy="362" r="3" fill="#8c1b57" />

      <!-- 右侧控制区：电源 / 音量旋钮（炭黑主体 + 灰粉指示） -->
      <circle cx="452" cy="96" r="26" fill="url(#tt-metal)" />
      <circle cx="452" cy="96" r="18" fill="#132a33" />
      <rect x="450" y="76" width="4" height="12" rx="2" fill="#f7b0cf" />
      <circle cx="530" cy="96" r="18" fill="url(#tt-metal)" />
      <circle cx="530" cy="96" r="11" fill="#132a33" />
      <rect x="528.5" y="82" width="3" height="9" rx="1.5" fill="#f7b0cf" />

      <!-- 电源指示灯：熄灭为凹槽，点亮为浅色点（不做辉光） -->
      <circle cx="530" cy="150" r="7" fill="#132a33" />
      <circle cx="530" cy="150" r="4" fill="#fff6f9" />

      <!-- 左侧丝印条：次级信息条 -->
      <rect x="52" y="86" width="64" height="6" rx="3" fill="#8c1b57" />
      <rect x="52" y="100" width="40" height="6" rx="3" fill="#8c1b57" />
    </g>

    <!-- ============================ 转盘 ============================ -->
    <g id="platter">
      <!-- 盘体外圈：石墨金属 -->
      <circle cx="225" cy="225" r="160" fill="url(#tt-metal)" />
      <!-- 盘面：炭黑凹陷 -->
      <circle cx="225" cy="225" r="150" fill="#132a33" />
      <!-- 防滑垫 -->
      <circle cx="225" cy="225" r="146" fill="#0a1a20" />
      <!-- 垫面同心刻度环（辅助线色） -->
      <circle cx="225" cy="225" r="126" fill="none" stroke="#8c1b57" stroke-width="1.5" opacity=".8" />
      <circle cx="225" cy="225" r="104" fill="none" stroke="#8c1b57" stroke-width="1.5" opacity=".8" />
      <!-- 中心轴 -->
      <circle cx="225" cy="225" r="7" fill="url(#tt-metal)" />
      <circle cx="225" cy="225" r="2.6" fill="#132a33" />
    </g>

    <!-- ============================ 黑胶唱片 ============================ -->
    <g id="record">
      <!-- 盘体（中心被 mask 挖空，露出封面区） -->
      <g mask="url(#tt-record-hole)">
        <circle cx="225" cy="225" r="142" fill="url(#tt-disc)" />
        <!-- 外沿亮边：一条极细的辅助线 -->
        <circle cx="225" cy="225" r="142" fill="none" stroke="#8c1b57" stroke-width="1.2" opacity=".55" />
        <!-- 沟槽：等距同心细环，透明度由外向内递减 -->
        <circle cx="225" cy="225" r="134" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".30" />
        <circle cx="225" cy="225" r="126" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".26" />
        <circle cx="225" cy="225" r="118" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".24" />
        <circle cx="225" cy="225" r="110" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".22" />
        <circle cx="225" cy="225" r="102" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".20" />
        <circle cx="225" cy="225" r="94" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".18" />
        <circle cx="225" cy="225" r="86" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".16" />
        <circle cx="225" cy="225" r="78" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".14" />
        <circle cx="225" cy="225" r="70" fill="none" stroke="#8c1b57" stroke-width="1" opacity=".12" />
        <!-- 曲目分隔环（略宽的一道） -->
        <circle cx="225" cy="225" r="98" fill="none" stroke="#8c1b57" stroke-width="2.4" opacity=".6" />
      </g>

      <!-- 中心封面区：留空给封面图 -->
      <circle id="coverSlot" cx="225" cy="225" r="58" fill="url(#tt-slot)" />
      <image
        v-if="cover"
        :href="cover"
        x="167"
        y="167"
        width="116"
        height="116"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#tt-cover-clip)"
      />
      <!-- 封面外圈标签环 + 中心轴孔 -->
      <circle cx="225" cy="225" r="58" fill="none" stroke="#8c1b57" stroke-width="1.4" opacity=".7" />
      <circle cx="225" cy="225" r="4" fill="#0a1a20" />
    </g>

    <!-- ============================ 唱臂 ============================ -->
    <g id="tonearm">
      <!-- 支座：固定在机身上，不随臂旋转 -->
      <g id="tonearmBase">
        <circle cx="478" cy="140" r="30" fill="#f7b0cf" />
        <circle cx="478" cy="140" r="24" fill="url(#tt-metal)" />
        <circle cx="478" cy="140" r="11" fill="#132a33" />
        <circle cx="478" cy="140" r="4" fill="#f5e6a8" />
        <!-- 臂托架 -->
        <rect x="452" y="168" width="52" height="12" rx="6" fill="#f7b0cf" />
      </g>

      <!--
        可旋转部分：svgOrigin = '478 140'
        初始 -28° 为「归位 / 抬起」姿态，0° 时针尖正好落在唱片外沿起播点
      -->
      <g id="tonearmArm" transform="rotate(-28 478 140)">
        <!-- 尾部配重 -->
        <rect x="482" y="128" width="38" height="24" rx="11" fill="url(#tt-arm)" />
        <rect x="514" y="132" width="10" height="16" rx="5" fill="#132a33" />
        <!-- 臂杆 -->
        <line
          x1="478"
          y1="140"
          x2="356"
          y2="140"
          stroke="url(#tt-arm)"
          stroke-width="9"
          stroke-linecap="round"
        />
        <!-- 臂杆高光：一条极细的哑光反光 -->
        <line
          x1="474"
          y1="137.5"
          x2="360"
          y2="137.5"
          stroke="#f5e6a8"
          stroke-width="1.4"
          stroke-linecap="round"
          opacity=".4"
        />
        <!-- 唱头（headshell） -->
        <rect x="322" y="128" width="38" height="24" rx="5" fill="url(#tt-arm)" />
        <rect x="326" y="132" width="30" height="8" rx="3" fill="#132a33" />
        <!-- 唱针：极小面积的点缀色 -->
        <path d="M330 152 L330 160 L336 160 Z" fill="#8c1b57" />
      </g>
    </g>
  </svg>
</template>

<script setup>
/**
 * @prop {string} cover - 可选：唱片中心封面图地址（会自动裁成 r=58 的圆形）
 */
defineProps({
  cover: { type: String, default: '' },
})
</script>
