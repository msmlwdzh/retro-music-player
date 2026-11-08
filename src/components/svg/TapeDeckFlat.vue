<!--
  ============================================================
   TapeDeckFlat.vue —— 复古卧式磁带录音机（拟物简约 2D）
  ------------------------------------------------------------
   · 纯 SVG 静态图形：无动画、无外部资源、无 <filter>（阴影交给 Tailwind）
   · 配色遵循全站规范：机身灰粉 #f59ec4，按键 / 仓门 / 磁带 / 计数器炭黑 #132a33，
     VU 表盘用浅色 #fff6f9，辅助线 #8c1b57。
   · 分组 id 约定（可直接用 GSAP 选择器驱动）：
       #tapeBody    机身外壳 / 按键 / 表头（整体不动）
       #tapeFilm    磁带本体（卡带盒 + 标签 + 双窗口 + 带体）
       #spoolLeft   左卷轴（圆形，svgOrigin '228 194'）
       #spoolRight  右卷轴（圆形，svgOrigin '372 194'）
       #door        仓门（单独 path，可独立旋转开合；内窗已用 evenodd 挖空）
   · 驱动示例：
       gsap.to('#door', { rotationX: -82, transformOrigin: '50% 100%', duration: .5 })
       gsap.to('#spoolLeft',  { rotation: '+=360', svgOrigin: '228 194', repeat: -1, ease: 'none' })
       gsap.to('#spoolRight', { rotation: '+=360', svgOrigin: '372 194', repeat: -1, ease: 'none' })
  ============================================================
-->
<template>
  <svg
    viewBox="0 0 600 400"
    xmlns="http://www.w3.org/2000/svg"
    class="h-full w-full"
    role="img"
    aria-label="复古卧式磁带录音机"
  >
    <defs>
      <!-- 机身哑光塑料：灰粉 -->
      <linearGradient id="td-plastic" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fac4da" />
        <stop offset="100%" stop-color="#f59ec4" />
      </linearGradient>

      <!-- 哑光石墨金属：面板压条 / 旋钮 / 表圈 -->
      <linearGradient id="td-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="55%" stop-color="#d9be72" />
        <stop offset="100%" stop-color="#a98a3c" />
      </linearGradient>

      <!-- 按键：炭黑实心 -->
      <linearGradient id="td-key" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#17323d" />
        <stop offset="1%" stop-color="#132a33" />
      </linearGradient>

      <!-- 卡带外壳：炭黑哑光塑料 -->
      <linearGradient id="td-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10242d" />
        <stop offset="1%" stop-color="#132a33" />
      </linearGradient>

      <!-- VU 表盘纸面：浅色，黑块内的读数字面 -->
      <linearGradient id="td-dial" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff6f9" />
        <stop offset="1%" stop-color="#fac4da" />
      </linearGradient>

      <!-- 卷轴金属毂：哑光石墨 -->
      <linearGradient id="td-hub" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e6a8" />
        <stop offset="1%" stop-color="#d9be72" />
      </linearGradient>
    </defs>

    <!-- ============================ 机身 ============================ -->
    <g id="tapeBody">
      <!-- 外壳：灰粉 + 炭黑外框 -->
      <rect x="24" y="64" width="552" height="286" rx="20" fill="url(#td-plastic)" />
      <rect x="24" y="64" width="552" height="286" rx="20" fill="none" stroke="#132a33" stroke-width="2" />
      <!-- 内嵌面板 -->
      <rect x="36" y="76" width="528" height="262" rx="16" fill="#f7b0cf" />
      <!-- 内框辅助线：只做分区 -->
      <rect x="46" y="86" width="508" height="242" rx="12" fill="none" stroke="#8c1b57" stroke-opacity=".7" />
      <!-- 上 / 下金属压条 -->
      <rect x="36" y="76" width="528" height="6" rx="3" fill="url(#td-metal)" opacity=".5" />
      <rect x="36" y="332" width="528" height="6" rx="3" fill="url(#td-metal)" opacity=".3" />
      <!-- 两只底脚 -->
      <rect x="78" y="350" width="58" height="15" rx="7" fill="#132a33" />
      <rect x="464" y="350" width="58" height="15" rx="7" fill="#132a33" />

      <!-- 左侧：丝印装饰条 -->
      <rect x="56" y="104" width="74" height="6" rx="3" fill="#8c1b57" />
      <rect x="56" y="118" width="46" height="6" rx="3" fill="#8c1b57" />

      <!-- 左侧：三位机械计数器（炭黑窗口 + 浅色数字块） -->
      <rect x="56" y="164" width="74" height="38" rx="6" fill="#132a33" />
      <rect x="62" y="170" width="18" height="26" rx="4" fill="#fff6f9" opacity=".85" />
      <rect x="83" y="170" width="18" height="26" rx="4" fill="#fff6f9" opacity=".85" />
      <rect x="104" y="170" width="20" height="26" rx="4" fill="#fff6f9" opacity=".85" />
      <rect x="56" y="164" width="74" height="38" rx="6" fill="none" stroke="#8c1b57" stroke-width="1.5" />

      <!-- 左侧：电源指示灯（浅色点，不发光） -->
      <circle cx="93" cy="140" r="7" fill="#132a33" />
      <circle cx="93" cy="140" r="4" fill="#fff6f9" />

      <!-- 左侧：音量旋钮（炭黑主体 + 灰粉指示） -->
      <circle cx="93" cy="240" r="26" fill="url(#td-metal)" />
      <circle cx="93" cy="240" r="18" fill="#132a33" />
      <rect x="91" y="220" width="4" height="12" rx="2" fill="#f7b0cf" />

      <!-- 右侧：双 VU 表头（炭黑表圈 + 浅色盘面 + 炭黑指针） -->
      <g>
        <circle cx="505" cy="132" r="31" fill="#132a33" />
        <circle cx="505" cy="132" r="25" fill="url(#td-dial)" />
        <path d="M486 126 A 22 22 0 0 1 524 126" fill="none" stroke="#8c1b57" stroke-width="1.6" />
        <line x1="505" y1="146" x2="497" y2="118" stroke="#132a33" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="505" cy="146" r="3" fill="#132a33" />

        <circle cx="505" cy="214" r="31" fill="#132a33" />
        <circle cx="505" cy="214" r="25" fill="url(#td-dial)" />
        <path d="M486 208 A 22 22 0 0 1 524 208" fill="none" stroke="#8c1b57" stroke-width="1.6" />
        <line x1="505" y1="228" x2="513" y2="200" stroke="#132a33" stroke-width="2.2" stroke-linecap="round" />
        <circle cx="505" cy="228" r="3" fill="#132a33" />
      </g>

      <!-- 底部：走带按键排（炭黑键体 + 灰粉标记点） -->
      <g>
        <rect x="60" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect x="122" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect x="184" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect x="246" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect x="308" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect x="370" y="284" width="52" height="30" rx="8" fill="url(#td-key)" />
        <rect
          v-for="i in 6"
          :key="`kb${i}`"
          :x="60 + (i - 1) * 62"
          y="284"
          width="52"
          height="30"
          rx="8"
          fill="none"
          stroke="#8c1b57"
          stroke-opacity=".45"
        />
        <!-- 录音键标记点 -->
        <circle cx="86" cy="299" r="4" fill="#f7b0cf" />
      </g>
    </g>

    <!-- ============================ 磁带本体 ============================ -->
    <g id="tapeFilm">
      <!-- 卡带外壳：炭黑 -->
      <rect x="150" y="104" width="300" height="152" rx="10" fill="url(#td-shell)" />
      <rect x="150" y="104" width="300" height="152" rx="10" fill="none" stroke="#8c1b57" stroke-width="1.5" />

      <!-- 上部纸标签：灰粉 -->
      <rect x="166" y="112" width="268" height="40" rx="5" fill="#f7b0cf" />
      <rect x="176" y="122" width="150" height="5" rx="2.5" fill="#8c1b57" />
      <rect x="176" y="133" width="96" height="5" rx="2.5" fill="#fff6f9" />
      <circle cx="418" cy="132" r="9" fill="#8c1b57" opacity=".7" />

      <!-- 双视窗（露出卷轴与带体） -->
      <rect x="196" y="162" width="64" height="64" rx="10" fill="#0a1a20" />
      <rect x="340" y="162" width="64" height="64" rx="10" fill="#0a1a20" />
      <rect x="196" y="162" width="64" height="64" rx="10" fill="none" stroke="#8c1b57" stroke-opacity=".5" />
      <rect x="340" y="162" width="64" height="64" rx="10" fill="none" stroke="#8c1b57" stroke-opacity=".5" />

      <!-- 带体：绕经两卷下方（比窗口略亮才看得见） -->
      <path d="M228 220 L372 220" stroke="#8c1b57" stroke-width="6" stroke-linecap="round" fill="none" />

      <!-- 下部标签：灰粉纸条 -->
      <rect x="166" y="232" width="268" height="18" rx="4" fill="#f7b0cf" />
      <rect x="176" y="238" width="120" height="5" rx="2.5" fill="#8c1b57" />

      <!-- 卡带底部定位孔 -->
      <circle cx="186" cy="248" r="3.5" fill="#0a1a20" />
      <circle cx="300" cy="248" r="3.5" fill="#0a1a20" />
      <circle cx="414" cy="248" r="3.5" fill="#0a1a20" />
    </g>

    <!-- ============================ 左卷轴 ============================ -->
    <g id="spoolLeft">
      <circle cx="228" cy="194" r="26" fill="#132a33" />
      <!-- 六个轮齿：GSAP 绕 228 194 旋转整组即可 -->
      <g stroke="url(#td-hub)" stroke-width="5" stroke-linecap="round">
        <line x1="228" y1="172" x2="228" y2="185" />
        <line x1="247" y1="183" x2="238" y2="190" />
        <line x1="247" y1="205" x2="238" y2="198" />
        <line x1="228" y1="216" x2="228" y2="203" />
        <line x1="209" y1="205" x2="218" y2="198" />
        <line x1="209" y1="183" x2="218" y2="190" />
      </g>
      <circle cx="228" cy="194" r="11" fill="url(#td-hub)" />
      <circle cx="228" cy="194" r="4" fill="#132a33" />
    </g>

    <!-- ============================ 右卷轴 ============================ -->
    <g id="spoolRight">
      <circle cx="372" cy="194" r="26" fill="#132a33" />
      <g stroke="url(#td-hub)" stroke-width="5" stroke-linecap="round">
        <line x1="372" y1="172" x2="372" y2="185" />
        <line x1="391" y1="183" x2="382" y2="190" />
        <line x1="391" y1="205" x2="382" y2="198" />
        <line x1="372" y1="216" x2="372" y2="203" />
        <line x1="353" y1="205" x2="362" y2="198" />
        <line x1="353" y1="183" x2="362" y2="190" />
      </g>
      <circle cx="372" cy="194" r="11" fill="url(#td-hub)" />
      <circle cx="372" cy="194" r="4" fill="#132a33" />
    </g>

    <!-- ============================ 仓门 ============================ -->
    <!-- 单独 path：外框 + evenodd 内窗洞；绕底边旋转即可开合 -->
    <g id="door">
      <path
        d="
          M 150 96
          H 450
          A 10 10 0 0 1 460 106
          V 254
          A 10 10 0 0 1 450 264
          H 150
          A 10 10 0 0 1 140 254
          V 106
          A 10 10 0 0 1 150 96
          Z
          M 174 140
          H 426
          A 8 8 0 0 1 434 148
          V 236
          A 8 8 0 0 1 426 244
          H 174
          A 8 8 0 0 1 166 236
          V 148
          A 8 8 0 0 1 174 140
          Z
        "
        fill="#132a33"
        fill-rule="evenodd"
        stroke="#8c1b57"
        stroke-width="1.6"
      />
      <!-- 视窗玻璃：极弱浅色反光 -->
      <rect x="166" y="140" width="268" height="104" rx="8" fill="#fff6f9" opacity=".08" />
      <!-- 门下沿开启扣手 -->
      <rect x="266" y="248" width="68" height="8" rx="4" fill="#f7b0cf" />
    </g>
  </svg>
</template>

<script setup>
// 纯静态图形组件：不接收 props，全部交互交给外部 GSAP 通过分组 id 驱动
</script>
