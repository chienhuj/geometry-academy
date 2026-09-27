// --- 真題圖片 Base64 與路徑解析器 ---
window.PADLET_IMAGE_MAP = window.PADLET_IMAGE_MAP || {};
window.getPadletImageSrc = function(path) {
  if (window.PADLET_IMAGE_MAP && window.PADLET_IMAGE_MAP[path]) {
    return window.PADLET_IMAGE_MAP[path];
  }
  return path;
};

// --- 幾何圖形面積學院 核心邏輯 (app.js) ---

// --- 狀態管理 ---
const AppState = {
  activeTab: 'learn', // 'learn', 'heightMeasure', 'photoSelfCheck', 'compositeArea', 'challenge'
  activeShape: 'rectangle', // 'rectangle', 'parallelogram', 'triangle', 'trapezoid'
  
  // 選單 1：公式探索狀態
  learnStep: 0,
  
  // 選單 2：為圖形「量身高」狀態
  heightMeasure: {
    mode: 'demo', // 'demo' (平行四邊形三部曲動畫), 'practice' (虛擬尺規畫高練習)
    demoStep: 0, // 0: 標註底, 1: 直尺放腳底, 2: 三角板推出來, 3: 畫垂直高
    demoPlaying: false
  },
  
  // 虛擬尺規練習狀態
  drawShape: 'slanted_para', // 'acute_triangle', 'slanted_para', 'obtuse_triangle', 'right_trapezoid', 'slanted_trapezoid'
  drawingState: {
    rulerPlaced: false,
    setsquarePlaced: false,
    setsquareX: 130,
    heightDrawn: false,
    heightX: null,
    extensionDrawn: false,
    feedbackText: '',
    feedbackType: '', // 'success', 'error', 'info'
    checked: false
  },
  
  // 選單 3：拍照上傳自檢狀態
  uploadState: {
    fileUploaded: false,
    imageSrc: null,
    points: [], // [0]: 起點, [1]: 垂足(直角處), [2]: 頂點
    checked: false,
    measuredAngle: null,
    angleDiff: null,
    isPerpendicular: null
  },

  // 選單 4：複合圖形的面積狀態
  compositeArea: {
    activeMethod: 'split', // 'split' (分割再加總), 'subtract' (補完再刪去), 'translate' (平移再合併)
    problemIndex: 0, // 當前心法下的範例索引 (0: 範例一, 1: 範例二)
    step: 0, // 0: 原複合圖形, 1: 變形/輔助線展開
    practiceAnswer: null,
    practiceFeedback: null
  },

  // 選單 5：選擇題挑戰狀態 (三級分級)
  quiz: {
    currentLevel: 'basic',
    currentQ: 0,
    score: 0,
    correctCount: 0,
    selectedAnswer: null,
    isCorrect: null,
    hasAnswered: false,
    showFeedback: false,
    isFinished: false,
    wrongAttempts: [],
    currentQuestions: [],
    decompositionState: {
      activeParts: [],
      partInputs: {},
      showHint: false
    }
  }
};

// --- 共用 SVG 資源與定義 ---
const SVG_GRID_DEFS = `
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.8" />
    </pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7E909A" />
    </marker>
  </defs>
`;

const getRulerSvg = (id, className, style, width = 200) => `
  <g id="${id}" class="${className}" style="${style}">
    <rect x="0" y="0" width="${width}" height="15" fill="#e2ebf0" stroke="#7E909A" stroke-width="1.5" rx="2" />
    ${[...Array(Math.floor(width / 10))].map((_, i) => `<line x1="${i * 10 + 5}" y1="0" x2="${i * 10 + 5}" y2="${i % 5 === 0 ? '8' : '4'}" stroke="#7E909A" stroke-width="1" />`).join('')}
    <text x="${width / 2}" y="11" font-size="9" fill="#4B5F69" text-anchor="middle" font-weight="bold" font-family="system-ui">直尺放腳"底"</text>
  </g>
`;

const getSetSquareSvg = (id, className, style) => `
  <g id="${id}" class="${className}" style="${style}">
    <polygon points="0,0 0,110 60,110" fill="rgba(255, 255, 255, 0.85)" stroke="#D3A297" stroke-width="2" />
    <rect x="0" y="100" width="10" height="10" fill="none" stroke="#D3A297" stroke-width="1.5" />
    ${[...Array(10)].map((_, i) => `<line x1="0" y1="${(i+1)*10}" x2="5" y2="${(i+1)*10}" stroke="#D3A297" stroke-width="1" />`).join('')}
    <text x="14" y="90" font-size="11" fill="#B87D70" transform="rotate(-90 14,90)" font-weight="bold" font-family="system-ui">三角板量身“高”</text>
  </g>
`;

// --- 公式探索資料庫 ---
const shapeConfig = {
  rectangle: {
    name: '長方形',
    steps: [
      { title: "長方形面積是多少？", content: "長6公分、寬4公分的長方形，面積是多少平方公分？" },
      { title: "在長邊舖排正方形", content: "長6公分，也就是6個1公分，我們可以在上面排6個邊長1公分的正方形。" },
      { title: "舖排直向的排數", content: "寬4公分，也就是4個1公分，我們可以排4排。" },
      { title: "計算格子總數", content: "每一排6個，有4排，「每排個數 × 排數 ＝ 總面積」，所以長方形的面積 ＝ 6 × 4 = 24 平方公分。" },
      { title: "公式推導", content: '公式推導：6×4跟原本的長方形有什麼關係？6是長邊的公分數、4是寬邊的公分數，簡化寫成「長 × 寬 = 長方形面積」，因此，長方形面積＝長 × 寬<br><br><div class="formula-box bg-slate-100 p-4 rounded-xl border-2 border-slate-300 text-center"><span class="text-2xl font-black text-slate-700">長方形面積 ＝ 長 × 寬</span></div>' }
    ],
    svg: () => {
      const step = AppState.learnStep;
      const fillVal = (step === 0 || step === 4) ? '#ffffff' : 'rgba(126, 144, 154, 0.1)';
      const row1Opacity = (step >= 1 && step <= 3) ? '1' : '0';
      const rows24Opacity = (step >= 2 && step <= 3) ? '1' : '0';
      const numbersOpacity = (step === 3) ? '1' : '0';
      
      const squaresRow1 = [...Array(6)].map((_, i) => 
        `<rect x="${i*20}" y="0" width="20" height="20" fill="rgba(126, 144, 154, 0.4)" stroke="var(--color-primary-dark)" stroke-width="1" />`
      ).join('');
      
      const squaresRows24 = [...Array(3)].map((_, r) => 
        [...Array(6)].map((_, c) => 
          `<rect x="${c*20}" y="${(r+1)*20}" width="20" height="20" fill="rgba(126, 144, 154, 0.4)" stroke="var(--color-primary-dark)" stroke-width="1" />`
        ).join('')
      ).join('');

      const numbersHtml = [...Array(4)].map((_, r) => 
        [...Array(6)].map((_, c) => 
          `<text x="${c*20+10}" y="${r*20+14}" font-size="9" text-anchor="middle" fill="#fff" font-weight="bold">${r*6+c+1}</text>`
        ).join('')
      ).join('');

      return `
        <svg viewBox="0 0 240 120" class="w-full h-full max-h-64 overflow-visible">
          ${SVG_GRID_DEFS}
          <rect x="0" y="0" width="240" height="120" fill="url(#grid)" />
          <g transform="translate(40, 20)">
            <rect id="rect-main-shape" x="0" y="0" width="120" height="80" fill="${fillVal}" stroke="var(--color-primary-dark)" stroke-width="2.5" class="svg-transition" />
            
            <!-- squares row 1 -->
            <g id="rect-squares-row1" class="opacity-transition" style="opacity: ${row1Opacity};">
              ${squaresRow1}
            </g>
            
            <!-- squares rows 2-4 -->
            <g id="rect-squares-rows24" class="opacity-transition" style="opacity: ${rows24Opacity};">
              ${squaresRows24}
            </g>
            
            <!-- numbers -->
            <g id="rect-numbers" class="opacity-transition" style="opacity: ${numbersOpacity};">
              ${numbersHtml}
            </g>
            
            <!-- length label -->
            <g id="rect-length-label" style="opacity: 1;" class="opacity-transition">
              <line x1="0" y1="-8" x2="120" y2="-8" stroke="var(--color-primary-dark)" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)" />
              <text x="60" y="-14" font-size="12" text-anchor="middle" font-weight="bold" fill="var(--color-primary-dark)">長 6 公分</text>
            </g>
            <!-- width label -->
            <g id="rect-width-label" style="opacity: 1;" class="opacity-transition">
              <line x1="-8" y1="0" x2="-8" y2="80" stroke="var(--color-primary-dark)" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)" />
              <text x="-14" y="45" font-size="12" text-anchor="end" font-weight="bold" fill="var(--color-primary-dark)" transform="rotate(-90 -14,45)">寬 4 公分</text>
            </g>
          </g>
        </svg>
      `;
    },
    updateSvg: (step) => {
      // Direct render handles step changes via AppState.learnStep
    }
  },
  parallelogram: {
    name: '平行四邊形',
    steps: [
      { title: "觀察這個平行四邊形", content: "這是一個平行四邊形，歪歪的沒有直角，該怎麼計算它的面積呢？" },
      { title: "進行切割重組", content: "我們從一邊垂直往下剪開，切出一個三角形，將它移到平行四邊形的另一邊..." },
      { title: "拼成長方形", content: "神奇的事情發生了！它拼接成了一個我們非常熟悉的「長方形」！" },
      { title: "放置直尺 (量底)", content: "把直尺平放於圖形底部，測量原圖形的「底」（對應長方形的「長」）。" },
      { title: "放置三角板 (量高)", content: "利用直角三角板對齊底邊直尺，沿著直尺推到頂端，量出垂直高度「高」（對應長方形的「寬」）。" },
      { title: "推導面積公式", content: "拼出的長方形面積 ＝ 長 × 寬。對照原本圖形，長等於「底」，寬等於「高」，所以平行四邊形面積 ＝ 底 × 高。" },
      { title: "記憶公式", content: '<div class="formula-box bg-slate-100 p-4 rounded-xl border-2 border-slate-300 text-center"><span class="text-2xl font-black text-slate-700">平行四邊形面積 ＝ 底 × 高</span></div>' }
    ],
    svg: () => {
      const step = AppState.learnStep;
      const bgOpacity = (step === 0) ? '1' : '0';
      const mainFill = (step === 0) ? '#ffffff' : 'rgba(148, 168, 154, 0.3)';
      const mainOpacity = (step > 0) ? '1' : '0';
      const movingFill = (step === 0) ? '#ffffff' : 'rgba(211, 162, 151, 0.4)';
      const movingOpacity = (step > 0) ? '1' : '0';
      const cutlineOpacity = (step >= 1) ? '1' : '0';
      const movingTransform = (step >= 2) ? 'translateX(100px)' : 'translateX(0px)';
      const rulerOpacity = (step >= 3) ? '1' : '0';
      const setsquareOpacity = (step >= 4) ? '1' : '0';
      const baseLabelOpacity = (step >= 3) ? '1' : '0';
      const heightLabelOpacity = (step >= 4) ? '1' : '0';

      return `
        <svg viewBox="0 0 260 140" class="w-full h-full max-h-64 overflow-visible">
          ${SVG_GRID_DEFS}
          <rect x="0" y="0" width="260" height="140" fill="url(#grid)" />
          <g transform="translate(40, 20)">
            <!-- single background shape visible only at step 0 -->
            <polygon id="para-bg-shape" points="40,80 140,80 180,20 80,20" fill="#ffffff" stroke="var(--color-secondary-dark)" stroke-width="2" class="opacity-transition" style="opacity: ${bgOpacity};" />
            
            <!-- static right polygon part -->
            <polygon id="para-right-shape" points="80,80 140,80 180,20 80,20" fill="${mainFill}" stroke="var(--color-secondary-dark)" stroke-width="2" class="svg-transition" style="opacity: ${mainOpacity};" />
            
            <!-- height cut line -->
            <g id="para-cut-elements" class="opacity-transition" style="opacity: ${cutlineOpacity};">
              <line id="para-cutline" x1="80" y1="20" x2="80" y2="80" stroke="var(--color-accent-dark)" stroke-width="2" stroke-dasharray="4" />
              <rect x="80" y="72" width="8" height="8" fill="none" stroke="var(--color-accent-dark)" stroke-width="1" />
            </g>
            
            <!-- moving triangle part -->
            <polygon id="para-moving-shape" points="40,80 80,80 80,20" fill="${movingFill}" stroke="var(--color-accent-dark)" stroke-width="2" class="svg-transition" 
              style="transform-box: view-box; -webkit-transform-box: view-box; transform: ${movingTransform}; opacity: ${movingOpacity};" />
              
            <!-- rulers and tools -->
            ${getRulerSvg('para-ruler-tool', 'opacity-transition', `opacity: ${rulerOpacity}; transform: translate(20px, 80px);`)}
            ${getSetSquareSvg('para-setsquare-tool', 'opacity-transition', `opacity: ${setsquareOpacity}; transform: translate(80px, -30px);`)}
            
            <!-- labels -->
            <text id="para-base-label" x="90" y="112" font-size="12" font-weight="bold" fill="var(--color-secondary-dark)" class="opacity-transition" style="opacity: ${baseLabelOpacity}" text-anchor="middle">底 5 公分</text>
            <text id="para-height-label" x="60" y="55" font-size="12" font-weight="bold" fill="var(--color-accent-dark)" class="opacity-transition" style="opacity: ${heightLabelOpacity}" text-anchor="middle">高 3 公分</text>
          </g>
        </svg>
      `;
    }
  },
  triangle: {
    name: '三角形',
    steps: [
      { title: "觀察這個三角形", content: "這是一個普通的三角形。我們可以用什麼魔法把它變成已經學過的圖形呢？" },
      { title: "複製一個三角形", content: "複製一個完全一模一樣的三角形，疊在原本的三角形上面。" },
      { title: "旋轉與拼合", content: "將複製的三角形旋轉 180 度，慢慢移動拼在原本三角形的旁邊。" },
      { title: "拼成平行四邊形", content: "看！兩個完全一樣的三角形，拼成了一個「平行四邊形」！" },
      { title: "量底", content: "直尺放底邊。大平行四邊形的「底」，剛好等於原本三角形的「底」。" },
      { title: "量高 (三角板測量)", content: "三角板沿直尺推到頂端，量出高度。平行四邊形的「高」，剛好等於三角形的「高」。" },
      { title: "推導三角形公式", content: "平行四邊形面積 ＝ 底 × 高。因為我們是用「兩個」全等三角形拼成的，所以算一個三角形要除以 2。" },
      { title: "記憶公式", content: '<div class="formula-box bg-slate-100 p-4 rounded-xl border-2 border-slate-300 text-center"><span class="text-2xl font-black text-slate-700">三角形面積 ＝ 底 × 高 ÷ 2</span></div>' }
    ],
    svg: () => {
      const step = AppState.learnStep;
      const originalFill = (step === 0) ? '#ffffff' : 'rgba(141, 155, 123, 0.3)';
      const copyOpacity = (step >= 1) ? '1' : '0';
      const copyRotation = (step >= 2) ? 'rotate(180deg)' : 'rotate(0deg)';
      const heightOpacity = (step >= 5) ? '1' : '0';
      const rulerOpacity = (step >= 4) ? '1' : '0';
      const setsquareOpacity = (step >= 5) ? '1' : '0';
      const baseLabelOpacity = (step >= 4) ? '1' : '0';
      const heightLabelOpacity = (step >= 5) ? '1' : '0';

      return `
        <svg viewBox="0 0 260 140" class="w-full h-full max-h-64 overflow-visible">
          ${SVG_GRID_DEFS}
          <rect x="0" y="0" width="260" height="140" fill="url(#grid)" />
          <g transform="translate(40, 20)">
            <!-- original triangle -->
            <polygon id="tri-original-shape" points="40,80 120,80 80,20" fill="${originalFill}" stroke="var(--color-success)" stroke-width="2.5" class="svg-transition" />
            
            <!-- moving copy triangle -->
            <polygon id="tri-moving-shape" points="40,80 120,80 80,20" fill="rgba(211, 162, 151, 0.3)" stroke="var(--color-accent-dark)" stroke-width="2" class="svg-transition"
              style="transform-origin: 100px 50px; transform-box: view-box; -webkit-transform-box: view-box; transform: ${copyRotation}; opacity: ${copyOpacity};" />
              
            <!-- height line indicator -->
            <g id="tri-height-elements" class="opacity-transition" style="opacity: ${heightOpacity};">
              <line x1="80" y1="20" x2="80" y2="80" stroke="var(--color-accent-dark)" stroke-width="2" stroke-dasharray="4" />
              <rect x="80" y="72" width="8" height="8" fill="none" stroke="var(--color-accent-dark)" stroke-width="1" />
            </g>
            
            <!-- tools -->
            ${getRulerSvg('tri-ruler-tool', 'opacity-transition', `opacity: ${rulerOpacity}; transform: translate(0px, 80px);`)}
            ${getSetSquareSvg('tri-setsquare-tool', 'opacity-transition', `opacity: ${setsquareOpacity}; transform: translate(80px, -30px);`)}
            
            <!-- labels -->
            <text id="tri-base-label" x="80" y="112" font-size="12" font-weight="bold" fill="var(--color-secondary-dark)" class="opacity-transition" style="opacity: ${baseLabelOpacity}" text-anchor="middle">底 4 公分</text>
            <text id="tri-height-label" x="60" y="55" font-size="12" font-weight="bold" fill="var(--color-accent-dark)" class="opacity-transition" style="opacity: ${heightLabelOpacity}" text-anchor="middle">高 3 公分</text>
          </g>
        </svg>
      `;
    }
  },
  trapezoid: {
    name: '梯形',
    steps: [
      { title: "觀察這個梯形", content: "梯形有兩條互相平行的邊，我們叫它們「上底」和「下底」。" },
      { title: "複製一個梯形", content: "複製一個完全一模一樣的梯形，疊在原本的梯形上面。" },
      { title: "旋轉與拼合", content: "將複製的梯形旋轉 180 度，慢慢移動拼在原本梯形的旁邊。" },
      { title: "拼成一個大平行四邊形", content: "它們拼成了一個巨大的平行四邊形！" },
      { title: "量底 (上底 ＋ 下底)", content: "測量這個大平行四邊形的底邊長度，它剛好等於梯形的「上底 ＋ 下底」。" },
      { title: "量高 (三角板測量)", content: "用三角板測量垂直高度，這也就是原本梯形的「高」。" },
      { title: "推導梯形公式", content: "大平行四邊形面積 ＝ 底 × 高 ＝ (上底＋下底) × 高。因為用了兩個梯形，所以單個梯形面積要再除以 2。" },
      { title: "記憶公式", content: '<div class="formula-box bg-slate-100 p-4 rounded-xl border-2 border-slate-300 text-center"><span class="text-2xl font-black text-slate-700">梯形面積 ＝ (上底 ＋ 下底) × 高 ÷ 2</span></div>' }
    ],
    svg: () => {
      const step = AppState.learnStep;
      const originalFill = (step === 0) ? '#ffffff' : 'rgba(126, 144, 154, 0.3)';
      const copyOpacity = (step >= 1) ? '1' : '0';
      const copyRotation = (step >= 2) ? 'rotate(180deg)' : 'rotate(0deg)';
      const heightOpacity = (step >= 5) ? '1' : '0';
      const rulerOpacity = (step >= 4) ? '1' : '0';
      const setsquareOpacity = (step >= 5) ? '1' : '0';
      const baseLabelOpacity = (step >= 4) ? '1' : '0';
      const heightLabelOpacity = (step >= 5) ? '1' : '0';

      return `
        <svg viewBox="0 0 300 140" class="w-full h-full max-h-64 overflow-visible">
          ${SVG_GRID_DEFS}
          <rect x="0" y="0" width="300" height="140" fill="url(#grid)" />
          <g transform="translate(20, 20)">
            <!-- original trapezoid -->
            <polygon id="trap-original-shape" points="60,20 120,20 160,80 20,80" fill="${originalFill}" stroke="var(--color-primary-dark)" stroke-width="2.5" class="svg-transition" />
            
            <!-- moving copy trapezoid -->
            <polygon id="trap-moving-shape" points="60,20 120,20 160,80 20,80" fill="rgba(211, 162, 151, 0.3)" stroke="var(--color-accent-dark)" stroke-width="2" class="svg-transition"
              style="transform-origin: 140px 50px; transform-box: view-box; -webkit-transform-box: view-box; transform: ${copyRotation}; opacity: ${copyOpacity};" />
              
            <!-- height line -->
            <g id="trap-height-elements" class="opacity-transition" style="opacity: ${heightOpacity};">
              <line x1="60" y1="20" x2="60" y2="80" stroke="var(--color-accent-dark)" stroke-width="2" stroke-dasharray="4" />
              <rect x="60" y="72" width="8" height="8" fill="none" stroke="var(--color-accent-dark)" stroke-width="1" />
            </g>
            
            <!-- tools -->
            ${getRulerSvg('trap-ruler-tool', 'opacity-transition', `opacity: ${rulerOpacity}; transform: translate(0px, 80px);`, 240)}
            ${getSetSquareSvg('trap-setsquare-tool', 'opacity-transition', `opacity: ${setsquareOpacity}; transform: translate(60px, -30px);`)}
            
            <!-- labels -->
            <text id="trap-base-label" x="90" y="112" font-size="12" font-weight="bold" fill="var(--color-secondary-dark)" class="opacity-transition" style="opacity: ${baseLabelOpacity}" text-anchor="middle">上底3 + 下底7 = 10公分</text>
            <text id="trap-height-label" x="40" y="55" font-size="12" font-weight="bold" fill="var(--color-accent-dark)" class="opacity-transition" style="opacity: ${heightLabelOpacity}" text-anchor="middle">高 3 公分</text>
          </g>
        </svg>
      `;
    }
  }
};

// --- 畫高挑戰圖形設定 ---
const drawShapeConfig = {
  acute_triangle: {
    name: '銳角三角形',
    desc: '請畫出以藍色線段為「底」的「高」。高應是從對面頂點到底邊的垂直距離。',
    rulerY: 120,
    rulerMinX: 70,
    rulerMaxX: 210,
    targetX: 150,
    targetY: 120,
    topVertex: { x: 150, y: 40 },
    needExtension: false,
    svg: (state) => `
      <g transform="translate(30, 10)">
        <!-- grid -->
        ${SVG_GRID_DEFS}
        <rect x="-30" y="-10" width="300" height="160" fill="url(#grid)" />
        
        <!-- Shape -->
        <polygon points="70,120 210,120 150,40" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <!-- Highlight Base -->
        <line x1="70" y1="120" x2="210" y2="120" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
        <text x="140" y="138" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">指定的「底」</text>
        <circle cx="150" cy="40" r="4.5" fill="var(--color-accent-dark)" />
        <text x="150" y="30" font-size="10" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">對面的頂點</text>
        
        <!-- User Drawn Height -->
        ${state.heightDrawn ? `
          <line x1="${state.heightX}" y1="40" x2="${state.heightX}" y2="120" stroke="var(--color-error)" stroke-width="5" />
          <text x="${state.heightX + 8}" y="80" font-size="11" fill="var(--color-error)" font-weight="bold">高</text>
          <rect x="${state.heightX - 4}" y="112" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
        ` : ''}
        
        <!-- Perpendicular Guideline Preview -->
        ${state.setsquarePlaced && !state.heightDrawn ? `
          <line x1="${state.setsquareX}" y1="40" x2="${state.setsquareX}" y2="120" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2" opacity="0.6" />
          <text x="${state.setsquareX + 4}" y="65" font-size="8" fill="#f43f5e" font-weight="bold">預覽高</text>
        ` : ''}
        <!-- Tools overlay -->
        ${state.rulerPlaced ? getRulerSvg('draw-ruler', '', 'transform: translate(40px, 120px);') : ''}
        ${state.setsquarePlaced ? getSetSquareSvg('draw-setsquare', '', `transform: translate(${state.setsquareX}px, 10px);`) : ''}
      </g>
    `
  },
  obtuse_triangle: {
    name: '鈍角三角形 (高在外部)',
    desc: '注意：此三角形的頂點在底邊的右外側，高會落在底邊的延長線上。請思考如何用直尺與虛線延長底邊來量身高。',
    rulerY: 120,
    rulerMinX: 130,
    rulerMaxX: 230,
    targetX: 70,
    targetY: 120,
    topVertex: { x: 70, y: 40 },
    needExtension: true,
    svg: (state) => `
      <g transform="translate(30, 10)">
        <!-- grid -->
        ${SVG_GRID_DEFS}
        <rect x="-30" y="-10" width="300" height="160" fill="url(#grid)" />
        
        <!-- Base extension guide line dotted -->
        ${state.extensionDrawn ? `
          <line x1="130" y1="120" x2="60" y2="120" stroke="var(--color-primary)" stroke-width="5" stroke-dasharray="3" />
          <text x="95" y="135" font-size="10" fill="var(--color-primary)" font-weight="bold" text-anchor="middle">底邊的延長線</text>
        ` : ''}
        
        <!-- Shape -->
        <polygon points="130,120 230,120 70,40" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <!-- Highlight Base -->
        <line x1="130" y1="120" x2="230" y2="120" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
        <text x="180" y="138" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">指定的「底」</text>
        <circle cx="70" cy="40" r="4.5" fill="var(--color-accent-dark)" />
        <text x="70" y="30" font-size="10" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">對面的頂點</text>
        
        <!-- User Drawn Height -->
        ${state.heightDrawn ? `
          <line x1="${state.heightX}" y1="40" x2="${state.heightX}" y2="120" stroke="var(--color-error)" stroke-width="5" />
          <text x="${state.heightX - 16}" y="80" font-size="11" fill="var(--color-error)" font-weight="bold">高</text>
          <rect x="${state.heightX - 4}" y="112" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
        ` : ''}
        
        <!-- Perpendicular Guideline Preview -->
        ${state.setsquarePlaced && !state.heightDrawn ? `
          <line x1="${state.setsquareX}" y1="40" x2="${state.setsquareX}" y2="120" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2" opacity="0.6" />
          <text x="${state.setsquareX + 4}" y="65" font-size="8" fill="#f43f5e" font-weight="bold">預覽高</text>
        ` : ''}
        <!-- Tools overlay -->
        ${state.rulerPlaced ? getRulerSvg('draw-ruler', '', 'transform: translate(0px, 120px);') : ''}
        ${state.setsquarePlaced ? getSetSquareSvg('draw-setsquare', '', `transform: translate(${state.setsquareX}px, 10px);`) : ''}
      </g>
    `
  },
  slanted_para: {
    name: '斜平行四邊形',
    desc: '平行四邊形的高有無限多條（只要垂直連接兩對邊即可，不需要一定通過頂點）。你可以直接在底邊內畫垂直高，也可以平放直尺並利用虛線延長底邊，在圖形外部畫垂直高。',
    rulerY: 120,
    rulerMinX: 130,
    rulerMaxX: 210,
    targetX: 70,
    targetY: 120,
    topVertex: { x: 70, y: 40 },
    needExtension: true,
    svg: (state) => `
      <g transform="translate(30, 10)">
        <!-- grid -->
        ${SVG_GRID_DEFS}
        <rect x="-30" y="-10" width="300" height="160" fill="url(#grid)" />
        
        <!-- Base extension guide line dotted -->
        ${state.extensionDrawn ? `
          <line x1="130" y1="120" x2="60" y2="120" stroke="var(--color-primary)" stroke-width="5" stroke-dasharray="3" />
          <text x="95" y="135" font-size="10" fill="var(--color-primary)" font-weight="bold" text-anchor="middle">底邊的延長線</text>
        ` : ''}
        
        <!-- Shape -->
        <polygon points="130,120 210,120 150,40 70,40" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <!-- Highlight Base -->
        <line x1="130" y1="120" x2="210" y2="120" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
        <text x="170" y="138" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">指定的「底」</text>
        <circle cx="70" cy="40" r="4.5" fill="var(--color-accent-dark)" />
        <text x="70" y="30" font-size="10" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">頂點</text>
        
        <!-- User Drawn Height -->
        ${state.heightDrawn ? `
          <line x1="${state.heightX}" y1="40" x2="${state.heightX}" y2="120" stroke="var(--color-error)" stroke-width="5" />
          <text x="${state.heightX - 16}" y="80" font-size="11" fill="var(--color-error)" font-weight="bold">高</text>
          <rect x="${state.heightX - 4}" y="112" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
        ` : ''}
        
        <!-- Perpendicular Guideline Preview -->
        ${state.setsquarePlaced && !state.heightDrawn ? `
          <line x1="${state.setsquareX}" y1="40" x2="${state.setsquareX}" y2="120" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2" opacity="0.6" />
          <text x="${state.setsquareX + 4}" y="65" font-size="8" fill="#f43f5e" font-weight="bold">預覽高</text>
        ` : ''}
        <!-- Tools overlay -->
        ${state.rulerPlaced ? getRulerSvg('draw-ruler', '', 'transform: translate(0px, 120px);') : ''}
        ${state.setsquarePlaced ? getSetSquareSvg('draw-setsquare', '', `transform: translate(${state.setsquareX}px, 10px);`) : ''}
      </g>
    `
  },
  right_trapezoid: {
    name: '直角梯形',
    desc: '直角梯形是指其中一邊（腰）垂直於上底與下底的梯形。這條垂直邊的長度剛好就等於梯形的高。請畫出這個直角梯形的高（有無限多條，也可以直接畫在垂直邊上，即 X = 110 處）。',
    rulerY: 120,
    rulerMinX: 110,
    rulerMaxX: 230,
    targetX: 110,
    targetY: 120,
    topVertex: { x: 110, y: 40 },
    needExtension: false,
    svg: (state) => `
      <g transform="translate(30, 10)">
        <!-- grid -->
        ${SVG_GRID_DEFS}
        <rect x="-30" y="-10" width="300" height="160" fill="url(#grid)" />
        
        <!-- Shape -->
        <polygon points="110,120 230,120 190,40 110,40" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <!-- Highlight Base -->
        <line x1="110" y1="120" x2="230" y2="120" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
        <text x="170" y="138" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">指定的「下底」</text>
        <circle cx="110" cy="40" r="4.5" fill="var(--color-accent-dark)" />
        <text x="110" y="30" font-size="10" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">直角頂點</text>
        
        <!-- Right angle markers -->
        <path d="M 110 110 L 120 110 L 120 120" fill="none" stroke="#6D8274" stroke-width="1.5" />
        <path d="M 110 50 L 120 50 L 120 40" fill="none" stroke="#6D8274" stroke-width="1.5" />

        <!-- User Drawn Height -->
        ${state.heightDrawn ? `
          <line x1="${state.heightX}" y1="40" x2="${state.heightX}" y2="120" stroke="var(--color-error)" stroke-width="5" />
          <text x="${state.heightX + 8}" y="80" font-size="11" fill="var(--color-error)" font-weight="bold">高</text>
          <rect x="${state.heightX - 4}" y="112" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
        ` : ''}
        
        <!-- Perpendicular Guideline Preview -->
        ${state.setsquarePlaced && !state.heightDrawn ? `
          <line x1="${state.setsquareX}" y1="40" x2="${state.setsquareX}" y2="120" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2" opacity="0.6" />
          <text x="${state.setsquareX + 4}" y="65" font-size="8" fill="#f43f5e" font-weight="bold">預覽高</text>
        ` : ''}
        <!-- Tools overlay -->
        ${state.rulerPlaced ? getRulerSvg('draw-ruler', '', 'transform: translate(60px, 120px);') : ''}
        ${state.setsquarePlaced ? getSetSquareSvg('draw-setsquare', '', `transform: translate(${state.setsquareX}px, 10px);`) : ''}
      </g>
    `
  },
  slanted_trapezoid: {
    name: '斜梯形',
    desc: '一般斜梯形中，高是平行上底與下底間的垂直距離。請將直尺放於下底，並用三角板垂直連接平行上底與下底來畫高。斜梯形的高有無限多條，只要垂直於兩底即可，不需要一定要通過頂點喔！',
    rulerY: 120,
    rulerMinX: 90,
    rulerMaxX: 230,
    targetX: 70, // target upper-left vertex x
    targetY: 120,
    topVertex: { x: 70, y: 40 },
    needExtension: false,
    svg: (state) => `
      <g transform="translate(30, 10)">
        <!-- grid -->
        ${SVG_GRID_DEFS}
        <rect x="-30" y="-10" width="300" height="160" fill="url(#grid)" />
        
        <!-- Shape -->
        <polygon points="90,120 230,120 170,40 70,40" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <!-- Highlight Base -->
        <line x1="90" y1="120" x2="230" y2="120" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
        <text x="160" y="138" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">指定的「下底」</text>
        <circle cx="70" cy="40" r="4.5" fill="var(--color-accent-dark)" />
        <text x="70" y="30" font-size="10" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">上底頂點</text>
        
        <!-- User Drawn Height -->
        ${state.heightDrawn ? `
          <line x1="${state.heightX}" y1="40" x2="${state.heightX}" y2="120" stroke="var(--color-error)" stroke-width="5" />
          <text x="${state.heightX + 8}" y="80" font-size="11" fill="var(--color-error)" font-weight="bold">高</text>
          <rect x="${state.heightX - 4}" y="112" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
        ` : ''}
        
        <!-- Perpendicular Guideline Preview -->
        ${state.setsquarePlaced && !state.heightDrawn ? `
          <line x1="${state.setsquareX}" y1="40" x2="${state.setsquareX}" y2="120" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2" opacity="0.6" />
          <text x="${state.setsquareX + 4}" y="65" font-size="8" fill="#f43f5e" font-weight="bold">預覽高</text>
        ` : ''}
        <!-- Tools overlay -->
        ${state.rulerPlaced ? getRulerSvg('draw-ruler', '', 'transform: translate(40px, 120px);') : ''}
        ${state.setsquarePlaced ? getSetSquareSvg('draw-setsquare', '', `transform: translate(${state.setsquareX}px, 10px);`) : ''}
      </g>
    `
  }
};

// --- 選單 2：為圖形「量身高」平行四邊形三部曲動畫示範資料 ---
const heightMeasureDemoConfig = {
  steps: [
    {
      title: "步驟 0：認識平行四邊形的「底」與「高」",
      desc: "平行四邊形沒有直角，該怎麼量它的身高呢？首先，我們要選定一條邊作為「底」，從腳「底」到對面的頭「頂」，垂直的距離就是「高」。",
      subDesc: "觀察下方圖形，藍色邊是選定的底邊，對面的紅色頂點就是它的頭頂。"
    },
    {
      title: "步驟 1：直尺放腳「底」",
      desc: "【教學口訣：直尺放腳底】將直尺水平貼平在選定的底邊上，作為測量的基礎軌道。",
      subDesc: "直尺緊緊貼齊底邊，就像站在水平地面上一樣，提供垂直量尺推移的滑軌。"
    },
    {
      title: "步驟 2：機器(三角板)推出來",
      desc: "【教學口訣：機器(三角板)推出來】將直角三角板的一條直角邊緊靠著底邊直尺，像小機器車一樣沿著直尺推移到頂點。",
      subDesc: "三角板在直尺上滑行，保證量出的線條一定與底邊保持「90度完全垂直」！"
    },
    {
      title: "步驟 3：從腳「底」到頭「頂」，畫出垂直高",
      desc: "【教學口訣：從腳底到頭頂畫垂直高】鉛筆靠著三角板垂直邊，從頭頂畫一條垂直線到底邊直尺，並標記直角記號！",
      subDesc: "這條垂直線段就是平行四邊形的身高（高）！平行四邊形的高有無限多條，只要垂直兩平行線即可。"
    }
  ],
  svg: (step) => {
    const rulerOpacity = step >= 1 ? '1' : '0';
    const setsquareOpacity = step >= 2 ? '1' : '0';
    const setsquarePos = (step >= 2) ? 'translate(80px, -30px)' : 'translate(20px, -30px)';
    const heightLineOpacity = step >= 3 ? '1' : '0';
    const rightAngleOpacity = step >= 3 ? '1' : '0';

    return `
      <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
        ${SVG_GRID_DEFS}
        <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
        <g transform="translate(35, 20)">
          <!-- Parallelogram -->
          <polygon points="40,80 150,80 190,20 80,20" fill="rgba(148, 168, 154, 0.2)" stroke="#6D8274" stroke-width="2.5" />
          
          <!-- Highlight Base -->
          <line x1="40" y1="80" x2="150" y2="80" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" />
          <text x="95" y="98" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">腳「底」（底邊 11 cm）</text>
          
          <!-- Vertex -->
          <circle cx="80" cy="20" r="4.5" fill="#B87D70" />
          <text x="80" y="12" font-size="10" fill="#B87D70" font-weight="bold" text-anchor="middle">頭「頂」（頂點）</text>
          
          <!-- Height Line and Right Angle -->
          <g id="demo-height-group" style="opacity: ${heightLineOpacity}; transition: opacity 0.4s ease;">
            <line x1="80" y1="20" x2="80" y2="80" stroke="#C87A7A" stroke-width="3" stroke-dasharray="3" />
            <text x="70" y="55" font-size="11" fill="#C87A7A" font-weight="bold" text-anchor="end">垂直高 6 cm</text>
            <rect id="demo-right-angle" x="80" y="72" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1.5" style="opacity: ${rightAngleOpacity};" />
          </g>
          
          <!-- Ruler -->
          ${getRulerSvg('demo-ruler', 'opacity-transition', `opacity: ${rulerOpacity}; transform: translate(15px, 80px); transition: opacity 0.4s ease;`, 200)}
          
          <!-- SetSquare: vertical leg at x=0, horizontal leg at y=100. translate(80px, -20px) puts horizontal leg at y=80 (on ruler) and vertical leg at x=80 (touching vertex) -->
          ${getSetSquareSvg('demo-setsquare', 'opacity-transition', `opacity: ${setsquareOpacity}; transform: ${setsquarePos}; transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);`)}
        </g>
      </svg>
    `;
  }
};

// --- 選單 4：複合圖形的面積 三大心法設定 (底邊對齊 y=120 格線，各心法 2 個範例) ---
const compositeAreaConfig = {
  split: {
    name: "心法一：分割再加總",
    subtitle: "化繁為簡・各個擊破",
    desc: "將不規則的多邊形或組合圖形，用水平或鉛直的「輔助線」切割成數個我們熟悉的簡單長方形、正方形或三角形，分別算出各塊面積後再相加。",
    problems: [
      {
        title: "範例一：L 形多邊形 (鉛直分割)",
        idea1: "鉛直分割：切成「長方形 A (左)」與「長方形 B (右下)」，分別計算後相加。",
        idea2: "水平分割：亦可沿橫向切成「上方長方形」與「下方寬長方形」，結果相同！",
        toggleBtnText0: "✨ 展開鉛直分割線",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「展開鉛直分割線」</strong>，觀察將 L 形切成兩個簡單長方形（長方形 A 與 B）的各個擊破思維！",
        guidingQuestions: [
          "這個 L 形不規則圖形，點選右上角展開分割線後，切成了哪兩個熟悉的長方形？",
          "左邊長方形 A 的長和寬各是多少？面積該如何計算？",
          "右邊長方形 B 的長和寬又是多少？面積又是多少？",
          "分別算出兩塊長方形的面積後，要怎麼求出整個圖形的總面積？"
        ],
        strategyTip: "總面積 ＝ 長方形 A 面積 ＋ 長方形 B 面積（兩塊簡單面積相加即可求得）。",
        question: "請觀察左圖標示的尺寸，算算看這個 L 形多邊形的總面積是多少平方公分？",
        unit: "平方公分",
        expectedAnswer: 96,
        svg: (step) => `
          <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
            <g>
              ${step === 0 ? `
                <polygon points="40,120 160,120 160,80 120,80 120,20 40,20" fill="rgba(148, 168, 154, 0.35)" stroke="#4B5F69" stroke-width="2.5" />
                <text x="80" y="70" font-size="14" fill="#4B5F69" font-weight="bold" text-anchor="middle">L 形圖形</text>
              ` : `
                <rect x="40" y="20" width="80" height="100" fill="rgba(148, 168, 154, 0.45)" stroke="#4B5F69" stroke-width="2" />
                <rect x="120" y="80" width="40" height="40" fill="rgba(211, 162, 151, 0.45)" stroke="#B87D70" stroke-width="2" />
                <line x1="120" y1="20" x2="120" y2="120" stroke="#C87A7A" stroke-width="2.5" stroke-dasharray="4" />
                <text x="80" y="70" font-size="12" fill="#4B5F69" font-weight="bold" text-anchor="middle">長方形 A</text>
                <text x="80" y="86" font-size="10" fill="#4B5F69" font-weight="bold" text-anchor="middle">(8 × 10)</text>
                <text x="140" y="104" font-size="11" fill="#B87D70" font-weight="bold" text-anchor="middle">B (4×4)</text>
              `}
              <text x="32" y="74" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="end">寬 10 cm</text>
              <text x="80" y="14" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">8 cm</text>
              <text x="168" y="104" font-size="11" fill="#4B5F69" font-weight="bold">4 cm</text>
              <line x1="40" y1="132" x2="160" y2="132" stroke="#4B5F69" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)" />
              <text x="100" y="145" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">底長 12 cm</text>
            </g>
          </svg>
        `
      },
      {
        title: "範例二：房屋型組合圖形 (水平分割)",
        idea1: "水平分割：沿屋簷作水平輔助線，拆解成「上部屋頂三角形」與「下部長方形」。",
        idea2: "對稱垂直分割：從屋頂頂點垂直切開，拆成左右兩個全等的梯形分別計算！",
        toggleBtnText0: "✨ 展開水平分割線",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「展開水平分割線」</strong>，觀察房屋造型拆解過程：由總高 10 cm 減去下部長方形高 6 cm，確認屋頂三角形的高為 4 cm！",
        guidingQuestions: [
          "點選右上角「展開水平分割線」，觀察房屋造型可以拆解成哪兩種熟悉的幾何圖形？",
          "下部長方形的長與高是多少？上部屋頂三角形的底邊長是多少？",
          "圖形給了「總高 10 cm」與「長方形高 6 cm」，你如何推算出上部屋頂三角形的高？",
          "分別算出下部長方形面積與屋頂三角形面積後，總面積是多少？"
        ],
        strategyTip: "總面積 ＝ 下部長方形面積 ＋ 屋頂三角形面積（注意：三角形面積要除以 2 喔！）。",
        question: "請觀察左圖標示的尺寸，算算看這個房屋形複合圖形的總面積是多少平方公分？",
        unit: "平方公分",
        expectedAnswer: 112,
        svg: (step) => `
          <svg viewBox="0 0 290 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="290" height="150" fill="url(#grid)" />
            <g>
              ${step === 0 ? `
                <polygon points="40,120 180,120 180,60 110,20 40,60" fill="rgba(148, 168, 154, 0.35)" stroke="#4B5F69" stroke-width="2.5" />
                <text x="110" y="95" font-size="13" fill="#4B5F69" font-weight="bold" text-anchor="middle">複合房屋形</text>
              ` : `
                <rect x="40" y="60" width="140" height="60" fill="rgba(126, 144, 154, 0.4)" stroke="#4B5F69" stroke-width="2" />
                <polygon points="40,60 110,20 180,60" fill="rgba(211, 162, 151, 0.45)" stroke="#B87D70" stroke-width="2" />
                <line x1="40" y1="60" x2="180" y2="60" stroke="#C87A7A" stroke-width="2.5" stroke-dasharray="4" />
                <line x1="110" y1="20" x2="110" y2="60" stroke="#C87A7A" stroke-width="1.5" stroke-dasharray="3" />
                <rect x="110" y="52" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1" />
                <text x="110" y="95" font-size="13" fill="#4B5F69" font-weight="bold" text-anchor="middle">下部長方形 (14 × 6)</text>
                <text x="118" y="44" font-size="10" fill="#B87D70" font-weight="bold">高 4 cm (10－6)</text>
              `}
              <text x="32" y="94" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="end">高 6 cm</text>
              <text x="188" y="94" font-size="11" fill="#4B5F69" font-weight="bold">6 cm</text>
              <!-- 底部長度標示 -->
              <line x1="40" y1="132" x2="180" y2="132" stroke="#4B5F69" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)" />
              <text x="110" y="145" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">底長 14 cm</text>
              <!-- 右側總高標示 (確認屋頂三角形的高為 10 - 6 = 4) -->
              <line x1="110" y1="20" x2="225" y2="20" stroke="#7E909A" stroke-width="1" stroke-dasharray="2" />
              <line x1="180" y1="120" x2="225" y2="120" stroke="#7E909A" stroke-width="1" stroke-dasharray="2" />
              <line x1="215" y1="20" x2="215" y2="120" stroke="#4B5F69" stroke-width="1.5" />
              <line x1="208" y1="20" x2="222" y2="20" stroke="#4B5F69" stroke-width="1.5" />
              <line x1="208" y1="120" x2="222" y2="120" stroke="#4B5F69" stroke-width="1.5" />
              <text x="228" y="74" font-size="11" fill="#4B5F69" font-weight="bold">總高 10 cm</text>
            </g>
          </svg>
        `
      }
    ]
  },
  subtract: {
    name: "心法二：補完再刪去",
    subtitle: "借力使力・反向思維",
    desc: "遇到缺角或凹進去的多邊形，想像把它補成一個完整的大長方形或正方形，算出完整面積後，再扣掉虛擬補上的空白區域面積。",
    problems: [
      {
        title: "範例一：缺角大長方形 (扣除缺角)",
        idea1: "補全扣除法：先補成完整大長方形，再扣掉虛擬補上的右上角空白缺角面積。",
        idea2: "分割加總法：若不補全，也可以將圖形切成兩個長方形分別計算相加。",
        toggleBtnText0: "✨ 展開補全輔助線",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「展開補全輔助線」</strong>，觀察先虛擬補全大長方形、再扣除右上缺角的逆向思維！",
        guidingQuestions: [
          "點選右上角「展開補全輔助線」，若將缺角補滿，會變成一個長與寬各是多少的完整大長方形？",
          "虛擬補上的右上角空白缺口，它的長和寬分別是多少公分？空白面積是多少？",
          "算完完整大長方形面積後，該如何利用右上角空白面積求出實際圖形的面積？"
        ],
        strategyTip: "實際面積 ＝ 完整大長方形面積 － 缺口空白面積（反向思考，大塊扣除虛擬小塊）。",
        question: "請觀察左圖標示的尺寸，算算看這個缺角多邊形的實際面積是多少平方公分？",
        unit: "平方公分",
        expectedAnswer: 96,
        svg: (step) => `
          <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
            <g>
              <polygon points="40,20 120,20 120,80 160,80 160,120 40,120" fill="rgba(148, 168, 154, 0.35)" stroke="#4B5F69" stroke-width="2.5" />
              <text x="80" y="70" font-size="13" fill="#4B5F69" font-weight="bold" text-anchor="middle">實際圖形</text>
              
              ${step === 1 ? `
                <rect x="120" y="20" width="40" height="60" fill="rgba(200, 122, 122, 0.25)" stroke="#C87A7A" stroke-width="2" stroke-dasharray="4" />
                <text x="140" y="48" font-size="10" fill="#C87A7A" font-weight="bold" text-anchor="middle">虛擬補上</text>
                <text x="140" y="62" font-size="9" fill="#C87A7A" font-weight="bold" text-anchor="middle">缺角 (4×6)</text>
                <rect x="40" y="20" width="120" height="100" fill="none" stroke="#2C3539" stroke-width="1.5" stroke-dasharray="2" />
              ` : ''}
              
              <text x="32" y="74" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="end">完整寬 10 cm</text>
              <text x="100" y="14" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">完整長 12 cm</text>
              <text x="168" y="104" font-size="11" fill="#4B5F69" font-weight="bold">4 cm</text>
              <text x="140" y="94" font-size="10" fill="#7E909A" text-anchor="middle">4 cm</text>
            </g>
          </svg>
        `
      },
      {
        title: "範例二：切角多邊形 (扣除三角形角)",
        idea1: "大長方形減小直角三角形：補齊後扣除角落三角形（先求完整，再扣除空白）。",
        idea2: "梯形與長方形分割加總：亦可作水平分割，拆解成「上方直角梯形」與「下方長方形」。",
        toggleBtnText0: "✨ 展開補全輔助線",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「展開補全輔助線」</strong>，觀察將多邊形補成完整長方形、再扣除角落三角形的逆向思維！",
        guidingQuestions: [
          "點選右上角「展開補全輔助線」，如果把缺角補齊，完整大長方形的長和寬是多少？",
          "右上角被切除的空白角是一個什麼形狀？它的底和高各是多少公分？",
          "算出完整大長方形面積後，該如何扣除切除的三角形面積得到實際多邊形面積？"
        ],
        strategyTip: "剩餘面積 ＝ 完整大長方形面積 － 右上角直角三角形面積（先求完整，再扣空白）。",
        question: "請觀察左圖標示的尺寸，算算看右上角切除直角三角形後，剩餘圖形的面積是多少平方公分？",
        unit: "平方公分",
        expectedAnswer: 122,
        svg: (step) => `
          <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
            <g>
              <polygon points="40,20 120,20 180,80 180,120 40,120" fill="rgba(148, 168, 154, 0.35)" stroke="#4B5F69" stroke-width="2.5" />
              <text x="100" y="75" font-size="13" fill="#4B5F69" font-weight="bold" text-anchor="middle">剩餘圖形</text>
              
              ${step === 1 ? `
                <polygon points="120,20 180,20 180,80" fill="rgba(200, 122, 122, 0.25)" stroke="#C87A7A" stroke-width="2" stroke-dasharray="4" />
                <rect x="172" y="20" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1" />
                <text x="155" y="45" font-size="10" fill="#C87A7A" font-weight="bold" text-anchor="middle">空白直角三角</text>
                <text x="155" y="58" font-size="9" fill="#C87A7A" font-weight="bold" text-anchor="middle">(6×6÷2)</text>
                <rect x="40" y="20" width="140" height="100" fill="none" stroke="#2C3539" stroke-width="1.5" stroke-dasharray="2" />
              ` : ''}
              
              <text x="32" y="74" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="end">寬 10 cm</text>
              <text x="110" y="14" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">長 14 cm</text>
              <text x="188" y="104" font-size="11" fill="#4B5F69" font-weight="bold">4 cm</text>
              <text x="80" y="14" font-size="10" fill="#7E909A" text-anchor="middle">8 cm</text>
              <text x="150" y="14" font-size="10" fill="#C87A7A" font-weight="bold" text-anchor="middle">切除 6 cm</text>
            </g>
          </svg>
        `
      }
    ]
  },
  translate: {
    name: "心法三：平移再合併",
    subtitle: "巧妙滑移・無縫拼合",
    desc: "在草地或土地中貫穿等寬的斜路或道路時，計算剩餘土地面積的最佳方法是將被分開的圖形「向內平移合併」，消除路徑寬度！",
    problems: [
      {
        title: "範例一：平行四邊形土地夾斜道",
        idea1: "向內平移合併：消除小路寬度，拼成新底長（原底長扣除路寬）的單一平行四邊形！",
        idea2: "總面積扣除小路：用大平行四邊形面積 (15×8) 扣除平行四邊形小路面積 (3×8)。",
        toggleBtnText0: "✨ 執行平移並合併",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「執行平移並合併」</strong>，觀察草地乙向左平移消除小路、無縫拼合成完整平行四邊形的動態過程！",
        guidingQuestions: [
          "草地被一條底寬 3 公尺的斜向小路切開，若把小路抽走、將右邊草地往左推平移靠攏，會拼成什麼形狀？",
          "向左平移消除小路後，合併後的草地底邊長度變成了多少公尺？高度有沒有改變？",
          "直接用「合併後的底邊」乘上「垂直高」，是否能比一塊一塊算再相加更快速？"
        ],
        strategyTip: "合併後底邊 ＝ 原總底長 － 小路寬度；草地總面積 ＝ 合併後底長 × 垂直高。",
        question: "請觀察左圖標示的尺寸，花園中間有一條底寬 3 公尺的斜道，扣除道路後，草地的總面積是多少平方公尺？",
        unit: "平方公尺",
        expectedAnswer: 96,
        svg: (step) => `
          <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
            <g>
              <!-- 草地甲 (固定左側，底長 5m = 50px) -->
              <polygon points="30,120 80,120 110,40 60,40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="2" />
              <text x="65" y="85" font-size="12" fill="#4E6151" font-weight="bold" text-anchor="middle">草地甲</text>
              
              <!-- 中間小路 (路寬 3m = 30px)，平移合併時淡出消失 -->
              ${step === 0 ? `
                <polygon points="80,120 110,120 140,40 110,40" fill="rgba(200, 122, 122, 0.25)" stroke="#C87A7A" stroke-width="1.5" stroke-dasharray="3" />
                <text x="110" y="85" font-size="10" fill="#C87A7A" font-weight="bold" text-anchor="middle">小路 3m</text>
              ` : ''}
              
              <!-- 草地乙 (右側，step 1 時平移 dx = -30px 靠齊草地甲) -->
              ${step === 0 ? `
                <polygon points="110,120 180,120 210,40 140,40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="2" />
                <text x="160" y="85" font-size="12" fill="#4E6151" font-weight="bold" text-anchor="middle">草地乙</text>
              ` : `
                <polygon points="80,120 150,120 180,40 110,40" fill="rgba(109, 130, 116, 0.55)" stroke="#2D4133" stroke-width="2.5" class="transition-all duration-500" />
                <text x="130" y="85" font-size="12" fill="#2D4133" font-weight="bold" text-anchor="middle">草地乙 (已靠攏)</text>
              `}
              
              <!-- 高度標示 (h = 8m = 80px) -->
              <line x1="225" y1="40" x2="225" y2="120" stroke="#C87A7A" stroke-width="1.5" stroke-dasharray="3" />
              <line x1="218" y1="40" x2="232" y2="40" stroke="#C87A7A" stroke-width="1" />
              <line x1="218" y1="120" x2="232" y2="120" stroke="#C87A7A" stroke-width="1" />
              <text x="238" y="84" font-size="11" fill="#C87A7A" font-weight="bold">高 8 m</text>
              
              <!-- 底部標示 -->
              ${step === 0 ? `
                <line x1="30" y1="132" x2="180" y2="132" stroke="#4B5F69" stroke-width="1.5" marker-start="url(#arrow)" marker-end="url(#arrow)" />
                <text x="105" y="145" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">原總底長 15 m</text>
              ` : `
                <line x1="30" y1="132" x2="150" y2="132" stroke="#2D4133" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
                <text x="90" y="145" font-size="11" fill="#2D4133" font-weight="bold" text-anchor="middle">合併底長 12 m (15－3)</text>
              `}
            </g>
          </svg>
        `
      },
      {
        title: "範例二：長方形草地十字步道平移",
        idea1: "四向平移合併：四塊草地同時向內靠攏，消除十字路寬，直接重組成一個完整長方形！",
        idea2: "面積扣除思考：若用大面積扣除兩條道路，路心重疊處會多扣一次需加回，極易算錯！",
        toggleBtnText0: "✨ 執行四向平移合併",
        toggleBtnText1: "🔄 復原原本圖形",
        helperTip: "💡 點選右上角<strong>「執行四向平移合併」</strong>，觀察四塊綠地同時向內緊靠，無縫化為一個完整長方形的震撼過程！",
        guidingQuestions: [
          "點選右上角「執行四向平移合併」，觀察四塊草坪同時向內推擠靠攏，會重新組合成什麼圖形？",
          "縱向與橫向步道寬度都是 2 公尺，合併後的長方形「新長度」與「新寬度」分別是多少公尺？",
          "將合併後的新長度與新寬度相乘，是否就能輕鬆算出所有草地的總面積？"
        ],
        strategyTip: "合併後淨長 ＝ 總長 － 縱向路寬；合併後淨寬 ＝ 總寬 － 橫向路寬；草地總面積 ＝ 淨長 × 淨寬。",
        question: "請觀察左圖標示的尺寸，花園中間有互相垂直、寬度皆為 2 公尺的十字步道，扣除步道後，四塊草地的總面積是多少平方公尺？",
        unit: "平方公尺",
        expectedAnswer: 352,
        svg: (step) => `
          <svg viewBox="0 0 280 150" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
            ${SVG_GRID_DEFS}
            <rect x="0" y="0" width="280" height="150" fill="url(#grid)" />
            <g>
              ${step === 0 ? `
                <!-- 四塊分散草坪 -->
                <rect x="30" y="30" width="70" height="40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="1.5" />
                <rect x="120" y="30" width="70" height="40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="1.5" />
                <rect x="30" y="80" width="70" height="40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="1.5" />
                <rect x="120" y="80" width="70" height="40" fill="rgba(109, 130, 116, 0.4)" stroke="#4E6151" stroke-width="1.5" />
                <!-- 十字道路虛線區 -->
                <rect x="100" y="30" width="20" height="90" fill="rgba(200, 122, 122, 0.2)" stroke="#C87A7A" stroke-dasharray="2" />
                <rect x="30" y="70" width="160" height="10" fill="rgba(200, 122, 122, 0.2)" stroke="#C87A7A" stroke-dasharray="2" />
                <text x="110" y="24" font-size="9" fill="#C87A7A" font-weight="bold" text-anchor="middle">路寬 2m</text>
                <text x="22" y="78" font-size="9" fill="#C87A7A" font-weight="bold" text-anchor="end">寬 2m</text>
              ` : `
                <!-- 平移合併後的單一大長方形 (寬 140px = 22m, 高 80px = 16m) -->
                <rect x="40" y="35" width="140" height="80" fill="rgba(109, 130, 116, 0.55)" stroke="#2D4133" stroke-width="2.5" class="transition-all duration-500" />
                <text x="110" y="75" font-size="13" fill="#2D4133" font-weight="bold" text-anchor="middle">平移合併大草坪</text>
                <text x="110" y="93" font-size="11" fill="#2D4133" font-weight="bold" text-anchor="middle">(22 m × 16 m)</text>
              `}
              
              <!-- 尺寸標示 -->
              ${step === 0 ? `
                <text x="110" y="14" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">長 24 m</text>
                <text x="200" y="78" font-size="11" fill="#4B5F69" font-weight="bold">寬 18 m</text>
              ` : `
                <text x="110" y="24" font-size="11" fill="#2D4133" font-weight="bold" text-anchor="middle">淨長 22 m (24－2)</text>
                <text x="190" y="78" font-size="11" fill="#2D4133" font-weight="bold">淨寬 16 m (18－2)</text>
              `}
            </g>
          </svg>
        `
      }
    ]
  }
};

// --- 選單 5：小試身手 分級題庫 (含動態隨機生成、會考/篩選測驗真題與高階拆解應用題) ---

// 隨機題目輔助函式：產生隨機干擾選項並打亂
function createRandomizedOptions(correctAns, distractorCandidates, unit = ' 平方公分') {
  const distractors = [];
  for (const d of distractorCandidates) {
    if (d > 0 && d !== correctAns && !distractors.includes(d)) {
      distractors.push(d);
    }
  }
  // 若不足 3 個干擾項，自動補足合理的干擾數值
  let offset = 2;
  while (distractors.length < 3) {
    const candPlus = correctAns + offset;
    const candMinus = correctAns - offset;
    if (candPlus > 0 && !distractors.includes(candPlus) && candPlus !== correctAns) {
      distractors.push(candPlus);
    }
    if (distractors.length < 3 && candMinus > 0 && !distractors.includes(candMinus) && candMinus !== correctAns) {
      distractors.push(candMinus);
    }
    offset += 3;
  }
  const chosenDistractors = distractors.slice(0, 3);
  const allOptions = [correctAns, ...chosenDistractors];
  
  // 洗牌 (Fisher-Yates)
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }
  const answerIndex = allOptions.indexOf(correctAns);
  return {
    options: allOptions.map(v => Number.isInteger(v) ? `${v}${unit}` : `${v.toFixed(1)}${unit}`),
    answerIndex: answerIndex
  };
}

// 基礎題 1：長方形隨機生成
function generateRandomRectQuestion() {
  const l = Math.floor(Math.random() * 7) + 6; // 6 ~ 12
  const w = Math.floor(Math.random() * 5) + 3; // 3 ~ 7
  const correctAns = l * w;
  const distractorCandidates = [
    (l + w) * 2,    // 誤用周長
    l + w,          // 誤用半周長
    correctAns * 2  // 誤乘以 2
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "長方形面積概念 (基礎動態題)",
    question: `有一個長方形的長是 ${l} 公分、寬是 ${w} 公分，請問它的面積是多少平方公分？`,
    diagram: `
      <svg viewBox="0 0 200 110" class="w-full max-w-xs mx-auto h-28 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <rect x="30" y="20" width="140" height="70" fill="rgba(126, 144, 154, 0.2)" stroke="#4B5F69" stroke-width="2" />
        <text x="100" y="14" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="middle">長 ${l} 公分</text>
        <text x="20" y="60" font-size="11" fill="#4B5F69" font-weight="bold" text-anchor="end">寬 ${w}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "長方形的面積公式是：長 × 寬。將長度與寬度相乘即可！",
    explanation: `長方形面積 ＝ 長 × 寬 ＝ ${l} × ${w} ＝ ${correctAns} 平方公分。周長才是 (長＋寬)×2 喔！`
  };
}

// 基礎題 2：平行四邊形隨機生成
function generateRandomParaQuestion() {
  const b = (Math.floor(Math.random() * 5) + 4) * 2; // 8, 10, 12, 14, 16
  const h = Math.floor(Math.random() * 5) + 4; // 4 ~ 8
  const correctAns = b * h;
  const distractorCandidates = [
    correctAns / 2, // 誤除以 2 (誤認成三角形)
    (b + h) * 2,    // 誤用周長
    b + h           // 兩數相加
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "平行四邊形求積 (基礎動態題)",
    question: `有一個平行四邊形，底邊長 ${b} 公分，對應的高是 ${h} 公分，請問它的面積是多少平方公分？`,
    diagram: `
      <svg viewBox="0 0 200 110" class="w-full max-w-xs mx-auto h-28 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <polygon points="50,85 170,85 140,25 20,25" fill="rgba(109, 130, 116, 0.2)" stroke="#4E6151" stroke-width="2" />
        <line x1="140" y1="25" x2="140" y2="85" stroke="#C87A7A" stroke-dasharray="4" stroke-width="2" />
        <rect x="132" y="77" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1.5" />
        <text x="110" y="102" font-size="11" fill="#4E6151" font-weight="bold" text-anchor="middle">底 ${b} 公分</text>
        <text x="155" y="58" font-size="11" fill="#C87A7A" font-weight="bold">高 ${h}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "平行四邊形的面積公式是：底 × 高。請注意平行四邊形不需要除以 2！",
    explanation: `平行四邊形面積 ＝ 底 × 高 ＝ ${b} × ${h} ＝ ${correctAns} 平方公分。只有三角形和梯形需要除以 2。`
  };
}

// 基礎題 3：三角形隨機生成
function generateRandomTriQuestion() {
  const b = (Math.floor(Math.random() * 4) + 3) * 2; // 6, 8, 10, 12
  const h = (Math.floor(Math.random() * 4) + 2) * 2; // 4, 6, 8, 10
  const correctAns = (b * h) / 2;
  const distractorCandidates = [
    b * h,          // 忘記除以 2
    (b + h) * 2,    // 誤用周長公式
    (b * (h + 2)) / 2 // 高度看錯
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "三角形求積 (基礎動態題)",
    question: `有一個三角形，底是 ${b} 公分，高是 ${h} 公分，請問它的面積是多少平方公分？`,
    diagram: `
      <svg viewBox="0 0 200 110" class="w-full max-w-xs mx-auto h-28 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <polygon points="30,85 170,85 90,25" fill="rgba(211, 162, 151, 0.25)" stroke="#A26B60" stroke-width="2" />
        <line x1="90" y1="25" x2="90" y2="85" stroke="#4E6151" stroke-dasharray="4" stroke-width="2" />
        <rect x="90" y="77" width="8" height="8" fill="none" stroke="#4E6151" stroke-width="1.5" />
        <text x="100" y="102" font-size="11" fill="#A26B60" font-weight="bold" text-anchor="middle">底 ${b} 公分</text>
        <text x="82" y="58" font-size="11" fill="#4E6151" font-weight="bold" text-anchor="end">高 ${h}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "三角形的面積公式是：底 × 高 ÷ 2。算完底乘高後記得除以 2 喔！",
    explanation: `三角形面積 ＝ 底 × 高 ÷ 2 ＝ ${b} × ${h} ÷ 2 ＝ ${correctAns} 平方公分。兩個全等三角形才能拼成一個平行四邊形，所以一定要除以 2。`
  };
}

// 基礎題 4：梯形隨機生成
function generateRandomTrapQuestion() {
  const top = Math.floor(Math.random() * 5) + 4; // 4 ~ 8
  const btm = top + (Math.floor(Math.random() * 3) + 2) * 2; // 比 top 大 4, 6, 8
  const h = (Math.floor(Math.random() * 4) + 2) * 2; // 4, 6, 8, 10
  const correctAns = ((top + btm) * h) / 2;
  const distractorCandidates = [
    (top + btm) * h, // 忘記除以 2
    top * h,         // 只乘上底
    btm * h          // 只乘下底
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "梯形求積 (基礎動態題)",
    question: `有一個梯形，上底是 ${top} 公分，下底是 ${btm} 公分，高是 ${h} 公分，請問它的面積是多少平方公分？`,
    diagram: `
      <svg viewBox="0 0 200 110" class="w-full max-w-xs mx-auto h-28 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <polygon points="30,85 170,85 130,25 70,25" fill="rgba(141, 126, 154, 0.2)" stroke="#685577" stroke-width="2" />
        <line x1="70" y1="25" x2="70" y2="85" stroke="#C87A7A" stroke-dasharray="4" stroke-width="2" />
        <rect x="70" y="77" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1.5" />
        <text x="100" y="18" font-size="11" fill="#685577" font-weight="bold" text-anchor="middle">上底 ${top}</text>
        <text x="100" y="102" font-size="11" fill="#685577" font-weight="bold" text-anchor="middle">下底 ${btm} 公分</text>
        <text x="62" y="58" font-size="11" fill="#C87A7A" font-weight="bold" text-anchor="end">高 ${h}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "梯形的面積公式是：(上底 ＋ 下底) × 高 ÷ 2。先將上底與下底相加，乘上高之後再除以 2！",
    explanation: `梯形面積 ＝ (上底 ＋ 下底) × 高 ÷ 2 ＝ (${top} ＋ ${btm}) × ${h} ÷ 2 ＝ ${correctAns} 平方公分。`
  };
}

// 進階題 1：斜邊混淆陷阱題 (底 10、高 4、斜邊 7 與 6 之隨機倍率變換)
function generateRandomSlantTrapQuestion() {
  const k = Math.floor(Math.random() * 3) + 1; // 1, 2, 3 倍率
  const b = 10 * k;
  const h = 4 * k;
  const s1 = 7 * k;
  const s2 = 6 * k;
  const correctAns = (b * h) / 2; // k=1 時為 20
  const distractorCandidates = [
    (s1 * s2) / 2, // k=1 時為 21 (誤用兩斜邊計算面積)
    b * h,        // k=1 時為 40 (忘記除以 2)
    s1 * s2       // k=1 時為 42 (兩斜邊相乘)
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "斜邊混淆陷阱 (進階動態題)",
    question: `下圖三角形的底邊是 ${b} 公分，對應高是 ${h} 公分，兩條斜邊分別為 ${s1} 公分與 ${s2} 公分，請問它的面積是多少？`,
    diagram: `
      <svg viewBox="0 0 200 120" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <polygon points="40,90 160,90 90,30" fill="rgba(148, 168, 154, 0.15)" stroke="#6D8274" stroke-width="2" />
        <line x1="90" y1="30" x2="90" y2="90" stroke="#C87A7A" stroke-dasharray="4" stroke-width="2" />
        <rect x="90" y="82" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1.5" />
        <text x="100" y="106" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">${b}</text>
        <text x="82" y="60" font-size="11" fill="#C87A7A" font-weight="bold" text-anchor="end">${h}</text>
        <text x="55" y="55" font-size="10" fill="#7E909A">${s1}</text>
        <text x="135" y="55" font-size="10" fill="#7E909A">${s2}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "面積公式只需要互相垂直的「底」和「高」，旁邊兩條斜邊是混淆數據，千萬不要被騙囉！",
    explanation: `底是 ${b} 公分，對應高是 ${h} 公分。三角形面積 ＝ 底 × 高 ÷ 2 ＝ ${b} × ${h} ÷ 2 ＝ ${correctAns} 平方公分。斜邊 ${s1} 與 ${s2} 不與底邊垂直，不能用來算面積！`
  };
}

// 進階題 2：鈍角三角形外部高動態題 (底 6、高 5、延長線 3 之隨機倍率變換)
function generateRandomObtuseExternalQuestion() {
  const k = Math.floor(Math.random() * 3) + 1; // 1, 2, 3 倍率
  const b = 6 * k;
  const h = 5 * k;
  const ext = 3 * k;
  const correctAns = (b * h) / 2; // k=1 時為 15
  const distractorCandidates = [
    ((b + ext) * h) / 2, // k=1 時為 22.5 (誤將延長線加進底邊)
    b * h,               // k=1 時為 30 (忘記除以 2)
    (b + ext) * h        // k=1 時為 45 (兩者皆錯)
  ];
  const { options, answerIndex } = createRandomizedOptions(correctAns, distractorCandidates);

  return {
    title: "三角形高在底邊延長線 (進階動態題)",
    question: `如圖，鈍角三角形的底邊是 ${b} 公分，高畫在底邊延長線上是 ${h} 公分，延長線虛線段長 ${ext} 公分。請問這個鈍角三角形的面積是多少？`,
    diagram: `
      <svg viewBox="0 0 220 120" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-3">
        <polygon points="90,85 170,85 40,25" fill="rgba(211, 162, 151, 0.25)" stroke="#B87D70" stroke-width="2" />
        <line x1="40" y1="85" x2="90" y2="85" stroke="#7E909A" stroke-dasharray="3" stroke-width="1.5" />
        <line x1="40" y1="25" x2="40" y2="85" stroke="#C87A7A" stroke-dasharray="3" stroke-width="2" />
        <rect x="40" y="77" width="8" height="8" fill="none" stroke="#C87A7A" stroke-width="1.5" />
        <text x="130" y="102" font-size="11" fill="#1d4ed8" font-weight="bold" text-anchor="middle">底 ${b}</text>
        <text x="65" y="102" font-size="10" fill="#7E909A" text-anchor="middle">${ext}</text>
        <text x="32" y="55" font-size="11" fill="#C87A7A" font-weight="bold" text-anchor="end">高 ${h}</text>
      </svg>
    `,
    options: options,
    answerIndex: answerIndex,
    hint: "算面積時，底邊只能算三角形本身實線的底邊長度，延長線只是為了量出垂直高度，絕對不能加進底邊裡！",
    explanation: `鈍角三角形的底邊是 ${b} 公分，對應的高是 ${h} 公分。面積 ＝ 底 × 高 ÷ 2 ＝ ${b} × ${h} ÷ 2 ＝ ${correctAns} 平方公分。延長線長度 ${ext} 公分不屬於三角形底邊。`
  };
}

// 根據難度取得測驗題目
window.getQuizQuestionsForLevel = function(lvl) {
  if (lvl === 'basic') {
    return [
      generateRandomRectQuestion(),
      generateRandomParaQuestion(),
      generateRandomTriQuestion(),
      generateRandomTrapQuestion(),
      {
        title: "塗色三角形面積 (113年篩選測驗第15題)",
        question: "如圖，塗色三角形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/screening_q1.png",
        options: ["(1) 6", "(2) 9", "(3) 12", "(4) 18"],
        answerIndex: 0,
        hint: "這是鈍角三角形，請仔細找出圖形真正的底邊長度，以及從頂點作到延長線上的垂直高！",
        explanation: "這是鈍角三角形，底邊為 6 公分，真正的高是延長底邊後與之垂直的 2 公分線段。塗色三角形面積 ＝ 底 × 高 ÷ 2 ＝ 6 × 2 ÷ 2 ＝ 6 平方公分，故選 (1)。"
      },
      {
        title: "三角形面積 (114年篩選測驗第25題)",
        question: "如圖，三角形的面積為多少平方公分？",
        image: "padlet_s52_images/clean/screening_q2.png",
        options: ["(1) 24", "(2) 25", "(3) 48", "(4) 50"],
        answerIndex: 0,
        hint: "直角三角形中，哪兩條邊互相垂直？找出能代表「底」和「高」的直角邊再來計算！",
        explanation: "圖形頂角標有直角符號，兩直角邊長分別為 8 公分與 6 公分，兩股互相垂直可直接作為底和高。三角形面積 ＝ 底 × 高 ÷ 2 ＝ 8 × 6 ÷ 2 ＝ 24 平方公分，故選 (1)。"
      },
      {
        title: "灰色圖形面積 (113年篩選測驗第2題)",
        question: "如圖，每個小方格的面積都是 1 平方公分，請問灰色圖形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/screening_q3.png",
        options: ["(1) 12", "(2) 24", "(3) 30", "(4) 35"],
        answerIndex: 1,
        hint: "數數看灰色平行四邊形在方格網中的底邊佔了幾格，垂直高度跨越了幾格！",
        explanation: "每個方格邊長 1 公分。平行四邊形底邊佔 4 格（4 公分），垂直高佔 6 格（6 公分）。面積 ＝ 底 × 高 ＝ 4 × 6 ＝ 24 平方公分，故選 (2)。"
      },
      {
        title: "梯形面積算式 (114年篩選測驗第2題)",
        question: "如圖，白色梯形與塗色梯形是全等圖形。下列哪個算式可以算出白色梯形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/screening_q4.png",
        options: [
          "(1) 9 × 4 × 5",
          "(2) (5 ＋ 9) × 4",
          "(3) (5 ＋ 9) × 4 ÷ 2",
          "(4) (5 ＋ 9) × 4 ÷ 2 ÷ 2"
        ],
        answerIndex: 2,
        hint: "回想梯形面積公式：(上底 ＋ 下底) × 高 ÷ 2。觀察圖中標示找出對應的算式！",
        explanation: "白色梯形上底 5 公分、下底 9 公分、垂直高 4 公分。依據梯形面積公式 ＝ (上底 ＋ 下底) × 高 ÷ 2，正確算式為 (5 ＋ 9) × 4 ÷ 2，故選 (3)。"
      }
    ];
  } else if (lvl === 'intermediate') {
    return [
      generateRandomSlantTrapQuestion(),
      generateRandomObtuseExternalQuestion(),
      {
        title: "長方形內塗色三角形 (115學測第2題)",
        question: "下圖是一個長方形。左側被分成 a 與 b 兩段，上邊長為 c。請問下列哪個算式可以算出塗色三角形的面積？",
        image: "padlet_s52_images/clean/115-02.png",
        options: ["a × c", "a × c ÷ 2", "(a ＋ b) × c", "b × c ÷ 2"],
        answerIndex: 1,
        hint: "以長度 a 為三角形的底邊時，頂點在長方形右下角，從頂點向底邊所在直線作的垂直高剛好等於長方形的寬 c！",
        explanation: "塗色三角形以 a 為底邊，對應的垂直高剛好是長方形的寬度 c。依據三角形面積公式，算式為 a × c ÷ 2。"
      },
      {
        title: "直角三角與平行四邊形算法評價 (113學測第16題)",
        question: "下面是小明計算三角形面積和平行四邊形面積的算法和答案。請問哪個圖形的算法和答案都正確？",
        image: "padlet_s52_images/clean/09_113-16.png",
        options: [
          "① 只有三角形面積正確",
          "② 只有平行四邊形面積正確",
          "③ 三角形面積和平行四邊形面積都正確",
          "④ 三角形面積和平行四邊形面積都錯誤"
        ],
        answerIndex: 2,
        hint: "直角三角形兩直角邊互相垂直；平行四邊形中，注意直角符號標在哪條邊上！",
        explanation: "直角三角形兩直角邊 6 與 8 互相垂直，算式 6 × 8 ÷ 2 ＝ 24 正確。平行四邊形中小明以側邊 5 公分當底，並找出垂直側邊的 8 公分為對應垂直高，算式 5 × 8 ＝ 40 也完全正確。因此三角形面積和平行四邊形面積都正確。故選 ③。"
      },
      {
        title: "梯形對角線兩大三角形面積評價 (113學測第14題)",
        question: "下圖中的四邊形 ABCD 是一個梯形。大毛沿對角線 AC 將梯形分割成甲和乙兩三角形，其中甲面積比乙大。小毛沿對角線 BD 將梯形分割成丙和丁兩三角形，其中丙面積比丁大。下面關於四個三角形面積大小的敘述，何者正確？",
        image: "padlet_s52_images/clean/10_113-14.png",
        options: [
          "三角形甲的面積比三角形丙大，三角形乙的面積比三角形丁小",
          "三角形甲的面積比三角形丙小，三角形乙的面積比三角形丁大",
          "三角形甲的面積和三角形丙一樣大，三角形乙的面積比三角形丁小",
          "三角形甲的面積和三角形丙一樣大，三角形乙的面積和三角形丁一樣大"
        ],
        answerIndex: 3,
        hint: "梯形 ABCD 中，AB 與 CD 平行。沿對角線切開的甲與丙都是以較長邊或等底與同高構成的大三角形，梯形面積固定，扣除後兩小三角形乙與丁也會完全相等！",
        explanation: "三角形甲以 AB 為底，高為梯形的高；三角形丙以 AB 為底，高也是梯形的高，所以甲與丙面積一樣大！總面積固定，因此剩下的乙和丁面積也必然一樣大。正確答案為 ④。"
      },
      {
        title: "長方形與平行四邊形高與鄰邊陷阱 (112學測第13題)",
        question: "平行四邊形乙和平行四邊形丙都不是長方形。長方形甲長 18 公分、寬 12 公分；平行四邊形乙底邊 18 公分、高 12 公分；平行四邊形丙底邊 18 公分、鄰邊 12 公分。下列關於甲、乙、丙三個圖形面積大小順序的描述，何者正確？",
        image: "padlet_s52_images/clean/11_112.png",
        options: [
          "甲 ＝ 乙，乙 ＞ 丙",
          "甲 ＝ 乙，乙 ＜ 丙",
          "甲 ＞ 乙，乙 ＞ 丙",
          "甲 ＞ 乙，乙 ＝ 丙"
        ],
        answerIndex: 0,
        hint: "長方形甲面積＝18×12＝216。平行四邊形乙面積＝底×高＝18×12＝216。平行四邊形丙的「鄰邊」是 12，斜邊必大於垂直高，所以丙的高小於 12，面積小於 216！",
        explanation: "長方形甲面積 ＝ 18 × 12 ＝ 216。平行四邊形乙面積 ＝ 18 × 12 ＝ 216，因此甲 ＝ 乙。平行四邊形丙的斜鄰邊是 12，其垂直高必小於 12，因此丙的面積小於 216。大小關係為：甲 ＝ 乙，乙 ＞ 丙。"
      },
      {
        title: "直角三角形斜邊上的高 (111學測第13題)",
        question: "如圖，三角形 ABC 是直角三角形，AD 是 BC 邊上的高，請問 AD 長多少公分？",
        image: "padlet_s52_images/clean/15_111.png",
        options: [
          "48/10",
          "24/10",
          "60/8",
          "80/6"
        ],
        answerIndex: 0,
        hint: "利用「等面積法」：直角三角形面積可以用兩直角邊算 (8 × 6 ÷ 2 ＝ 24)，也可以用斜邊當底乘高 (10 × AD ÷ 2 ＝ 24)！",
        explanation: "三角形 ABC 面積 ＝ 8 × 6 ÷ 2 ＝ 24 平方公分。以斜邊 BC（10 公分）為底時：10 × AD ÷ 2 ＝ 24 ➔ 10 × AD ＝ 48 ➔ AD ＝ 48/10 公分。"
      },
      {
        title: "梯形剪成三角形與平行四邊形 (108學測第18題)",
        question: "有一張梯形色紙（如下圖），把它剪成一個三角形(甲)和一個平行四邊形(乙)，甲和乙的面積，哪一個比較大？",
        image: "padlet_s52_images/clean/19_108.png",
        options: [
          "三角形的面積比較大",
          "平行四邊形的面積比較大",
          "三角形和平行四邊形的面積一樣大",
          "條件不足，無法判斷大小"
        ],
        answerIndex: 2,
        hint: "設梯形高為 h。平行四邊形乙的底等於上底 3，面積＝3 × h。三角形甲的底等於下底扣掉上底 9 － 3 ＝ 6，面積＝6 × h ÷ 2 ＝ 3 × h！",
        explanation: "設梯形的高為 h 公分。平行四邊形乙的底等於梯形上底 3 公分，面積 ＝ 3 × h 平方公分。三角形甲的底為 9 － 3 ＝ 6 公分，高也是 h，面積 ＝ 6 × h ÷ 2 ＝ 3 × h 平方公分。兩者面積完全一樣大！"
      },
      {
        title: "鈍角三角形外部高算式 (114學測第11題)",
        question: "如圖，下列哪個算式可以算出塗色部分三角形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/06_114-11.png",
        options: ["a × c", "a × c ÷ 2", "a × d ÷ 2", "(a ＋ b) × c ÷ 2"],
        answerIndex: 1,
        hint: "鈍角三角形的底為實線邊長 a，頂點向底邊延長線作的垂直高為 c，算式要除以 2！",
        explanation: "塗色三角形底邊為 a，對應的垂直高為外部的虛線線段 c。三角形面積 ＝ 底 × 高 ÷ 2，所以算式是 a × c ÷ 2。"
      },
      {
        title: "已知平行四邊形面積求高 (113學測第21題)",
        question: "下列哪個算式可以算出平行四邊形甲乙丙丁的面積是多少平方公分？",
        image: "padlet_s52_images/clean/08_113-21.png",
        options: ["a × b", "a × d", "b × c", "a × d ÷ 2"],
        answerIndex: 1,
        hint: "注意圖中的垂直直角符號！直角符號標在虛線 d 與對邊 a 之間，表示 d 是底邊 a 的垂直高。",
        explanation: "平行四邊形面積 ＝ 底 × 高。圖中虛線 d 垂直於底邊 a，所以面積算式為 a × d。"
      },
      {
        title: "共高三角形面積和乘法分配律 (111學測第11題)",
        question: "下圖是由兩個底邊相同、高不相同的三角形組合成的圖形。已知底邊為 78 公分，高分別是 39 公分和 65 公分。下列哪個算式可以算出這兩個三角形的面積和是多少平方公分？",
        image: "padlet_s52_images/clean/13_111.png",
        options: [
          "39 ＋ 65 × 78 ÷ 2",
          "78 × 39 ＋ 78 × 65 ÷ 2",
          "78 × (39 ＋ 65)",
          "(39 ＋ 65) × 78 ÷ 2"
        ],
        answerIndex: 3,
        hint: "上方三角形為 78 × 39 ÷ 2，下方為 78 × 65 ÷ 2。運用乘法對加法的分配律提出共同的 78 與 ÷ 2！",
        explanation: "兩三角形共底 78。面積和 ＝ 78 × 39 ÷ 2 ＋ 78 × 65 ÷ 2 ＝ (39 ＋ 65) × 78 ÷ 2。"
      },
      {
        title: "同底等高比例求三角形面積 (111學測第12題)",
        question: "如圖，已知 BD、DE 和 EC 的長度相等，且三角形 ABC 的面積為 45 平方公分，請問三角形 ADC 的面積為多少平方公分？",
        image: "padlet_s52_images/clean/14_111.png",
        options: ["45 平方公分", "30 平方公分", "20 平方公分", "15 平方公分"],
        answerIndex: 1,
        hint: "底邊 BC 被三等分，三角形 ADC 的底邊 DC 佔了其中 2 份，高與大三角形相同！",
        explanation: "底邊 DC ＝ DE ＋ EC 佔大底邊 BC 的 2/3。因為頂點 A 相同、高相同，面積 ＝ 45 × (2/3) ＝ 30 平方公分。"
      },
      {
        title: "梯形面積公式拆解本質 (109學測第21題)",
        question: "小明拿到一塊梯形木板，他想使用已經學過的長方形、三角形和平行四邊形的面積公式，求算梯形木板的面積。下列哪一個選項的敘述不完整？",
        image: "padlet_s52_images/clean/17_109.png",
        options: [
          "① 拆成兩個三角形，梯形面積是「上底×高÷2＋下底×高÷2」。",
          "② 拆成平行四邊形和三角形，梯形面積是「上底×高+(下底－上底)×高÷2」。",
          "③ 拆成兩個梯形，梯形面積是「(上底+下底)×高÷2」。",
          "④ 拆成長方形和兩個三角形，梯形面積是「上底×高+(下底－上底)×高÷2」。"
        ],
        answerIndex: 2,
        hint: "題目要求利用「已經學過」的長方形、三角形和平行四邊形公式來推導，請對照圖中四種拆法的標示算式！",
        explanation: "題目要求利用已學過的長方形、三角形和平行四邊形面積公式來求算梯形木板面積。選項 ③ 拆成兩個梯形後算式仍直接套用梯形公式「(上底＋下底)×高÷2」，既沒有依據已學公式展開，高也沒有分割，敘述不完整。故選 ③。"
      },
      {
        title: "同底等高平行四邊形面積不變性 (108學測第10題)",
        question: "下圖長方形 ABCD 的長為 27 公分，寬被分成 27 公分與 13 公分兩段。下列哪一個算式無法正確算出長方形 ABCD 的面積？",
        image: "padlet_s52_images/clean/18_108.png",
        options: [
          "13 × (13 ＋ 27)",
          "27 × (13 ＋ 27)",
          "27 × 27 ＋ 13 × 27",
          "27 × 13 ＋ 27 × 27"
        ],
        answerIndex: 0,
        hint: "長方形 ABCD 的長是 27，寬是 (13 ＋ 27)。面積可以是 27 × (13 ＋ 27) 或分割為兩小塊 27×27 ＋ 27×13！",
        explanation: "長方形 ABCD 面積 ＝ 長 × 寬 ＝ 27 × (27 ＋ 13)。依分配律可展開為 27 × 27 ＋ 27 × 13。只有選項 ① 是以寬 13 為係數，無法算出完整長方形面積。"
      }
    ];
  } else if (lvl === 'advanced') {
    return [
      {
        title: "直角梯形內嵌灰色三角形求積 (115學測第24題)",
        question: "下圖中的四邊形 ABCD 是直角梯形，上底 AD = 3，高 AB = 9（分段為 4 與 5），下底 BC = 12。請問中間灰色三角形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/115-24.png",
        isDecomposition: true,
        targetUnit: "平方公分",
        correctAnswer: 31.5,
        allowedDelta: 0.1,
        combineTemplate: "灰色三角形 ＝ 梯形 ABCD {trap} － 上方直角三角形 {tri1} － 下方直角三角形 {tri2}",
        parts: [
          {
            id: "trap",
            name: "梯形 ABCD (整體)",
            formula: "(上底 ＋ 下底) × 高 ÷ 2",
            inputs: [
              { label: "上底", key: "upper", expected: 3 },
              { label: "下底", key: "lower", expected: 12 },
              { label: "高", key: "height", expected: 9 }
            ],
            expectedArea: 67.5
          },
          {
            id: "tri1",
            name: "上方空白直角三角形",
            formula: "底 × 高 ÷ 2",
            inputs: [
              { label: "底", key: "base", expected: 3 },
              { label: "高", key: "height", expected: 4 }
            ],
            expectedArea: 6
          },
          {
            id: "tri2",
            name: "下方空白直角三角形",
            formula: "底 × 高 ÷ 2",
            inputs: [
              { label: "底", key: "base", expected: 12 },
              { label: "高", key: "height", expected: 5 }
            ],
            expectedArea: 30
          }
        ],
        hint: "使用扣除法：先算出梯形 ABCD 總面積，再扣除上下兩個空白直角三角形的面積，就能得到灰色三角形！",
        explanation: "1. 梯形 ABCD 面積 ＝ (3 ＋ 12) × 9 ÷ 2 ＝ 67.5。\n2. 上方空白直角三角形 ＝ 3 × 4 ÷ 2 ＝ 6。\n3. 下方空白直角三角形 ＝ 12 × 5 ÷ 2 ＝ 30。\n4. 灰色三角形 ＝ 67.5 － 6 － 30 ＝ 31.5 平方公分。"
      },
      {
        title: "長方形分割平行四邊形求積 (115學測第7題)",
        question: "如圖，將長方形切成平行四邊形甲、三角形乙及三角形丙。已知平行四邊形甲的底為 10 公分，面積是 120 平方公分。請問長方形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/115-07.png",
        isDecomposition: true,
        targetUnit: "平方公分",
        correctAnswer: 300,
        allowedDelta: 0.5,
        combineTemplate: "長方形面積 ＝ 長方形的長 {length} × 長方形的寬 {height}",
        parts: [
          {
            id: "height",
            name: "平行四邊形甲的高（也是長方形的寬）",
            formula: "高 ＝ 面積 ÷ 底",
            inputs: [
              { label: "面積", key: "area", expected: 120 },
              { label: "底", key: "base", expected: 10 }
            ],
            expectedArea: 12
          },
          {
            id: "length",
            name: "長方形的長",
            formula: "長 ＝ 底段一 ＋ 底段二",
            inputs: [
              { label: "底段一", key: "seg1", expected: 10 },
              { label: "底段二", key: "seg2", expected: 15 }
            ],
            expectedArea: 25
          }
        ],
        hint: "平行四邊形甲的底是 10，高＝120÷10＝12，這個高剛好等於長方形的寬！長方形的長＝10＋15＝25。",
        explanation: "1. 長方形的寬（平行四邊形的高）＝ 120 ÷ 10 ＝ 12 公分。\n2. 長方形的長 ＝ 10 ＋ 15 ＝ 25 公分。\n3. 長方形面積 ＝ 25 × 12 ＝ 300 平方公分。"
      },
      {
        title: "平行四邊形面積已知求周長 (115學測第9題)",
        question: "下圖中的四邊形 ABCD 是一個平行四邊形，面積是 180 平方公分，對應的高是 12 公分，CD 邊長為 18 公分。請問四邊形 ABCD 的周長是多少公分？",
        image: "padlet_s52_images/clean/115-09.png",
        isDecomposition: true,
        targetUnit: "公分",
        correctAnswer: 66,
        allowedDelta: 0.5,
        combineTemplate: "平行四邊形周長 ＝ (底邊 AD {base} ＋ 鄰邊 CD {cd}) × 2",
        parts: [
          {
            id: "base",
            name: "底邊 AD 的長度",
            formula: "底 ＝ 面積 ÷ 高",
            inputs: [
              { label: "面積", key: "area", expected: 180 },
              { label: "高", key: "height", expected: 12 }
            ],
            expectedArea: 15
          },
          {
            id: "cd",
            name: "鄰邊 CD 的長度",
            formula: "題目給定",
            inputs: [
              { label: "邊長", key: "len", expected: 18 }
            ],
            expectedArea: 18
          }
        ],
        hint: "平行四邊形面積＝底×高，底邊 AD＝180÷12＝15。平行四邊形兩組對邊等長，周長＝(15＋18)×2！",
        explanation: "1. 底邊 AD ＝ 面積 ÷ 高 ＝ 180 ÷ 12 ＝ 15 公分。\n2. 平行四邊形四邊長為 15、18、15、18。\n3. 周長 ＝ (15 ＋ 18) × 2 ＝ 66 公分。"
      },
      {
        title: "64格網等底異高平行四邊形 (114學測第17題)",
        question: "下圖是由 64 個全等的小平行四邊形拼成的圖形。已知平行四邊形甲的面積是 21 平方公分，請問平行四邊形乙的面積是多少平方公分？",
        image: "padlet_s52_images/clean/05_114-17.png",
        isDecomposition: true,
        targetUnit: "平方公分",
        correctAnswer: 42,
        allowedDelta: 0.1,
        combineTemplate: "平行四邊形乙面積 ＝ 平行四邊形甲面積 {p1} × 乙高是甲高的倍數 {ratio}",
        parts: [
          {
            id: "p1",
            name: "平行四邊形甲佔網格尺寸（底 1 格、高 2 格）",
            formula: "題目給定甲面積",
            inputs: [
              { label: "甲面積", key: "area", expected: 21 }
            ],
            expectedArea: 21
          },
          {
            id: "ratio",
            name: "乙的高為甲的幾倍（等底異高）",
            formula: "乙高 4 格 ÷ 甲高 2 格",
            inputs: [
              { label: "乙的高 (格數)", key: "h2", expected: 4 },
              { label: "甲的高 (格數)", key: "h1", expected: 2 }
            ],
            expectedArea: 2
          }
        ],
        hint: "仔細數網格：平行四邊形甲的底佔 1 格、高佔 2 格（面積 21 平方公分）；平行四邊形乙的底也是 1 格、高佔 4 格！乙的高剛好是甲的 2 倍（4÷2＝2），因為等底，所以乙的面積是甲的 2 倍！",
        explanation: "1. 平行四邊形甲：底 1 格、高 2 格，面積 ＝ 21 平方公分。\n2. 平行四邊形乙：底 1 格、高 4 格，高是甲的 4 ÷ 2 ＝ 2 倍。\n3. 在底相同的情況下，高變為 2 倍，面積也變為 2 倍：21 × 2 ＝ 42 平方公分。"
      },
      {
        title: "長方形面積單位換算與進位 (114學測第8題)",
        question: "長方形甲的長是 230 公分（2.3 公尺），寬是 1025 公分（10.25 公尺）。請問長方形甲的面積是多少平方公尺？",
        image: "padlet_s52_images/clean/07_114-08.png",
        isDecomposition: true,
        targetUnit: "平方公尺",
        correctAnswer: 23.575,
        allowedDelta: 0.001,
        combineTemplate: "長方形面積 ＝ 長 (公尺) {m_len} × 寬 (公尺) {m_wid}",
        parts: [
          {
            id: "m_len",
            name: "長度轉換為公尺",
            formula: "230 公分 ÷ 100",
            inputs: [
              { label: "公分", key: "cm", expected: 230 }
            ],
            expectedArea: 2.3
          },
          {
            id: "m_wid",
            name: "寬度轉換為公尺",
            formula: "1025 公分 ÷ 100",
            inputs: [
              { label: "公分", key: "cm", expected: 1025 }
            ],
            expectedArea: 10.25
          }
        ],
        hint: "長 230 公分＝2.3 公尺，寬 1025 公分＝10.25 公尺。面積＝長×寬＝2.3×10.25！",
        explanation: "長方形面積 ＝ 長 × 寬 ＝ 2.3 × 10.25 ＝ 23.575 平方公尺。"
      },
      {
        title: "正三角、正方形與長方形拼貼 (112學測第14題)",
        question: "妹妹拿一個正三角形、一個正方形及一個長方形色紙貼成如圖。已知正三角形周長是 36 公分，長方形長邊是 26 公分，請問長方形的面積是多少平方公分？",
        image: "padlet_s52_images/clean/12_112.png",
        isDecomposition: true,
        targetUnit: "平方公分",
        correctAnswer: 312,
        allowedDelta: 0.5,
        combineTemplate: "長方形面積 ＝ 長方形的長 {rect_len} × 長方形的寬 {tri_side}",
        parts: [
          {
            id: "tri_side",
            name: "正三角形邊長（也是長方形的寬）",
            formula: "邊長 ＝ 周長 ÷ 3",
            inputs: [
              { label: "正三角形周長", key: "p", expected: 36 }
            ],
            expectedArea: 12
          },
          {
            id: "rect_len",
            name: "長方形的長",
            formula: "題目給定",
            inputs: [
              { label: "長邊", key: "l", expected: 26 }
            ],
            expectedArea: 26
          }
        ],
        hint: "正三角形三邊等長，邊長＝36÷3＝12。圖中正三角形緊貼正方形，正方形又緊貼長方形，因此長方形的寬就是 12！",
        explanation: "1. 正三角形邊長 ＝ 36 ÷ 3 ＝ 12 公分。\n2. 圖形緊密相連，正方形邊長與長方形的寬皆為 12 公分。\n3. 長方形面積 ＝ 長 × 寬 ＝ 26 × 12 ＝ 312 平方公分。"
      },
      {
        title: "兩全等直角三角形重疊平移求梯形積 (107學測第25題)",
        question: "將兩個一樣的直角三角形部分重疊如下圖，灰色部分面積是多少平方公分？",
        image: "padlet_s52_images/clean/20_107.png",
        isDecomposition: true,
        targetUnit: "平方公分",
        correctAnswer: 18,
        allowedDelta: 0.1,
        combineTemplate: "灰色梯形面積 ＝ ({trap_upper} ＋ {trap_lower}) × {trap_height} ÷ 2",
        parts: [
          {
            id: "trap_upper",
            name: "灰色梯形上底",
            formula: "題目圖形標示",
            inputs: [
              { label: "上底", key: "top", expected: 3 }
            ],
            expectedArea: 3
          },
          {
            id: "trap_lower",
            name: "灰色梯形下底",
            formula: "直角三角形底邊",
            inputs: [
              { label: "下底", key: "bottom", expected: 6 }
            ],
            expectedArea: 6
          },
          {
            id: "trap_height",
            name: "灰色梯形的高（平移距離）",
            formula: "平移距離",
            inputs: [
              { label: "平移距離 (高)", key: "h", expected: 4 }
            ],
            expectedArea: 4
          }
        ],
        hint: "兩個全等直角三角形重疊扣除共同部分後，灰色部分剛好等於右邊露出的直角梯形！上底 3 公分、下底 6 公分、垂直高為平移距離 4 公分。帶入梯形公式即可！",
        explanation: "1. 兩個直角三角形全等，重疊扣除共同部分後，灰色面積等於平移露出的梯形面積。\n2. 灰色直角梯形上底 3 公分、下底 6 公分、垂直高為平移距離 4 公分。\n3. 面積 ＝ (3 ＋ 6) × 4 ÷ 2 ＝ 18 平方公分。"
      }
    ];
  }
  return [];
};

// --- 選擇題題庫 (各形狀由易到難各 5 題) ---
const quizDatabase = {
  rectangle: [
    {
      level: "簡易",
      question: "有一個長方形，長是 8 公分，寬是 5 公分，請問它的面積是多少平方公分？",
      options: ["13", "26", "40", "85"],
      answerIndex: 2,
      hint: "長方形的面積公式是：長 × 寬。直接把這兩個長度乘起來就是答案囉！",
      explanation: "長方形面積 ＝ 長 × 寬，8 × 5 = 40 平方公分。"
    },
    {
      level: "簡易",
      question: "長方形的長是 8 公尺、寬是 4 公尺，請問長方形的面積是多少？",
      options: ["24公尺", "24平方公尺", "32公尺", "32平方公尺"],
      answerIndex: 3,
      hint: "注意！面積的單位必須是「平方公尺」，長度相乘 8 × 4 是多少呢？",
      explanation: "長方形面積 ＝ 8 × 4 = 32。因為長度單位是公尺，因此面積單位是「平方公尺」。（32公尺代表長度，24公尺是其周長，單位不可選錯喔）"
    },
    {
      level: "中等",
      question: "一張長方形卡片面積是 24 平方公分，如果長是 6 公分，那寬是多少公分？",
      options: ["3", "4", "18", "144"],
      answerIndex: 1,
      hint: "面積 ＝ 長 × 寬，已知 24 ＝ 6 × 寬，多少乘以 6 會是 24 呢？可以用除法倒回去算算看！",
      explanation: "已知面積 24 平方公分且長為 6 公分，由公式可得 24 = 6 × 寬，因此寬 = 24 ÷ 6 = 4 公分。"
    },
    {
      level: "中等",
      question: "周長 40 公分的正方形，其面積是多少平方公分？",
      options: ["10", "40", "100", "1600"],
      answerIndex: 2,
      hint: "正方形有 4 個一樣長的邊，先用周長算出正方形 the 「邊長」，再計算邊長相乘的面積！",
      explanation: "正方形周長 40 公分，邊長 = 40 ÷ 4 = 10 公分。面積 ＝ 邊長 × 邊長 = 10 × 10 = 100 平方公分。"
    },
    {
      level: "困難",
      question: "觀察下圖，有一塊大長方形的右上角被割掉了一部分，請問原長方形（未割前）的總面積是多少平方公分？",
      diagram: `
        <svg viewBox="0 0 220 130" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <rect x="50" y="20" width="130" height="70" fill="rgba(126, 144, 154, 0.3)" stroke="var(--color-primary-dark)" stroke-width="2" />
          <polygon points="140,20 180,60 180,20" fill="#F5F2EB" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4" />
          
          <line x1="35" y1="20" x2="35" y2="90" stroke="var(--color-text)" stroke-width="1" />
          <line x1="30" y1="20" x2="40" y2="20" stroke="var(--color-text)" stroke-width="1" />
          <line x1="30" y1="90" x2="40" y2="90" stroke="var(--color-text)" stroke-width="1" />
          <text x="25" y="60" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">寬 8</text>
          
          <line x1="50" y1="105" x2="180" y2="105" stroke="var(--color-text)" stroke-width="1" />
          <line x1="50" y1="100" x2="50" y2="110" stroke="var(--color-text)" stroke-width="1" />
          <line x1="180" y1="100" x2="180" y2="110" stroke="var(--color-text)" stroke-width="1" />
          <text x="115" y="122" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">長 12 公分</text>
        </svg>`,
      options: ["20", "40", "96", "100"],
      answerIndex: 2,
      hint: "算式中使用的「長」和「寬」在割去角落前後有改變嗎？原本長方形的長與寬各自是多少？",
      explanation: "不管圖形角落如何被割去或遮蓋，原長方形的長 12 公分、寬 8 公分不變，因此原總面積 ＝ 12 × 8 = 96 平方公分。"
    }
  ],
  parallelogram: [
    {
      level: "簡易",
      question: "如圖，每個方格的面積都是 1 平方公分，請問這個平行四邊形的面積是多少平方公分？",
      diagram: `
        <svg viewBox="0 0 200 130" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          ${SVG_GRID_DEFS}
          <rect x="0" y="0" width="200" height="130" fill="url(#grid)" />
          <polygon points="60,20 160,20 120,100 20,100" fill="rgba(148, 168, 154, 0.4)" stroke="var(--color-secondary-dark)" stroke-width="2" />
          <rect x="0" y="0" width="200" height="130" fill="url(#grid)" pointer-events="none" />
        </svg>`,
      options: ["10", "20", "30", "40"],
      answerIndex: 1,
      hint: "數數看：平行四邊形的「底」佔了幾格？「高」（垂直高度）佔了幾格？相乘就是答案喔！",
      explanation: "平行四邊形的底有 5 格 (5公分)，高有 4 格 (4公分)，面積 ＝ 底 × 高 ＝ 5 × 4 = 20 平方公分。"
    },
    {
      level: "簡易",
      question: "一個平行四邊形的底是 12 公分，高是 5 公分，面積是多少平方公分？",
      options: ["17", "30", "60", "120"],
      answerIndex: 2,
      hint: "公式：底 × 高。直接把底 12 公分與高 5 公分相乘即可。",
      explanation: "平行四邊形面積 ＝ 底 × 高 ＝ 12 × 5 = 60 平方公分。"
    },
    {
      level: "中等",
      question: "下圖是小堂 and 千千計算這個平行四邊形面積的算式：<br>小堂的算式：5 × 8<br>千千的算式：8 × 9<br>請問誰的算法正確？",
      diagram: `
        <svg viewBox="0 0 220 120" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <polygon points="60,90 180,90 140,30 20,30" fill="rgba(211, 162, 151, 0.2)" stroke="var(--color-accent-dark)" stroke-width="2" />
          <line x1="20" y1="30" x2="20" y2="90" stroke="var(--color-error)" stroke-dasharray="4" stroke-width="2" />
          <rect x="20" y="82" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
          <line x1="20" y1="90" x2="60" y2="90" stroke="var(--color-accent-dark)" stroke-dasharray="2" stroke-width="1" />
          <text x="120" y="106" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">底 8</text>
          <text x="145" y="55" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">斜邊 9</text>
          <text x="12" y="60" font-size="12" fill="var(--color-error)" font-weight="bold" text-anchor="middle">高 5</text>
        </svg>`,
      options: ["小堂", "千千", "兩個人都正確", "兩個人都錯誤"],
      answerIndex: 0,
      hint: "平行四邊形的「高」必須與「底」互相垂直。圖中跟底邊 (8) 垂直的高度是 5 還是斜邊的 9 呢？",
      explanation: "平行四邊形面積 ＝ 底 × 高。底是 8，垂直的高度(高)是 5，因此小堂的算式 (8 × 5) 是正確的。千千用底乘上斜邊 (8 × 9) 是常犯的錯誤，斜邊不是垂直的高度！"
    },
    {
      level: "中等",
      question: "下列哪個算式可以算出平行四邊形 甲乙丙丁 的面積？",
      diagram: `
        <svg viewBox="0 0 240 140" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg shadow-sm border border-gray-200 mt-2 mb-4">
          <polygon points="100,20 220,70 140,120 20,70" fill="rgba(148, 168, 154, 0.15)" stroke="var(--color-secondary-dark)" stroke-width="2" />
          <line x1="100" y1="20" x2="140" y2="120" stroke="var(--color-secondary-dark)" stroke-width="1.5" />
          <line x1="100" y1="20" x2="65" y2="95" stroke="var(--color-error)" stroke-dasharray="4" stroke-width="2" />
          <polyline points="72,85 82,90 77,100" fill="none" stroke="var(--color-error)" stroke-width="2" />
          <text x="95" y="15" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">甲</text>
          <text x="230" y="75" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">乙</text>
          <text x="145" y="135" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">丙</text>
          <text x="5" y="75" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">丁</text>
          <text x="160" y="40" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">a</text>
          <text x="185" y="105" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">b</text>
          <text x="120" y="75" font-size="12" fill="var(--color-text)" font-weight="bold" text-anchor="middle">c</text>
          <text x="90" y="65" font-size="12" fill="var(--color-error)" font-weight="bold" text-anchor="middle">d</text>
        </svg>`,
      options: ["a × b", "a × d", "b × c", "a × d ÷ 2"],
      answerIndex: 1,
      hint: "尋找垂直記號！哪一個邊是「底」，哪一條垂直於底邊的線段是「高」？另外，平行四邊形的面積公式要除以 2 嗎？",
      explanation: "垂直記號標示在邊「丁丙」（長度等同對邊 a）與虛線 d 之間。所以底是 a，高是 d，面積公式 ＝ 底 × 高，即 a × d。不需要除以 2 喔！"
    },
    {
      level: "困難",
      question: "平行四邊形 ABCD 的一邊 CD 長為 18 公分，以 BC 為底邊時的高為 12 公分，已知其面積為 180 平方公分，請問此平行四邊形 ABCD 的周長是多少公分？",
      diagram: `
        <svg viewBox="0 0 220 130" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <polygon points="105,90 180,90 113,30 38,30" fill="rgba(211, 162, 151, 0.2)" stroke="var(--color-accent-dark)" stroke-width="2" />
          <line x1="113" y1="30" x2="113" y2="90" stroke="var(--color-error)" stroke-dasharray="4" stroke-width="2" />
          <rect x="113" y="82" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
          <text x="153" y="65" font-size="11" fill="var(--color-text)" font-weight="bold">18</text>
          <text x="121" y="60" font-size="11" fill="var(--color-error)" font-weight="bold">12</text>
          <text x="75" y="65" font-size="13" fill="var(--color-text)" font-weight="bold" text-anchor="middle">面積 = 180</text>
          <text x="33" y="25" font-size="11" fill="var(--color-text)" font-weight="bold">A</text>
          <text x="108" y="25" font-size="11" fill="var(--color-text)" font-weight="bold">D</text>
          <text x="100" y="105" font-size="11" fill="var(--color-text)" font-weight="bold">B</text>
          <text x="185" y="105" font-size="11" fill="var(--color-text)" font-weight="bold">C</text>
        </svg>`,
      options: ["33", "60", "66", "180"],
      answerIndex: 2,
      hint: "平行四邊形面積 ＝ 底 × 高。由面積 180 與對應高 12，先求出底邊 BC 的長度，再用周長公式 2 × (CD + BC) 計算。",
      explanation: "因為 面積 = 底 × 高，所以：BC × 12 = 180，得 BC = 15 公分。平行四邊形對邊相等，周長 = 2 × (CD + BC) = 2 × (18 + 15) = 66 公分。"
    }
  ],
  triangle: [
    {
      level: "簡易",
      question: "三角形的面積公式是什麼？",
      options: ["底 × 高", "底 × 高 ÷ 2", "(上底 ＋ 下底) × 高 ÷ 2", "邊長 × 邊長"],
      answerIndex: 1,
      hint: "想想看，兩個完全一樣的三角形可以拼成什麼形狀？三角形的面積是它的幾分之幾？",
      explanation: "兩個全等三角形可以拼成一個平行四邊形，因此三角形的面積是平行四邊形 (底 × 高) 的一半，即底 × 高 ÷ 2。"
    },
    {
      level: "簡易",
      question: "如圖，三角形的底是 10 公分，高是 5 公分，其它兩邊分別為 8 公分與 6 公分，請問它的面積是多少平方公分？",
      diagram: `
        <svg viewBox="0 0 200 120" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg shadow-sm border border-gray-200 mt-2 mb-4">
          <polygon points="40,90 160,90 100,30" fill="rgba(148, 168, 154, 0.15)" stroke="var(--color-success)" stroke-width="2" />
          <line x1="100" y1="30" x2="100" y2="90" stroke="var(--color-error)" stroke-dasharray="4" stroke-width="2" />
          <rect x="100" y="82" width="8" height="8" fill="none" stroke="var(--color-error)" stroke-width="1.5" />
          <text x="100" y="106" font-size="11" fill="var(--color-success)" font-weight="bold" text-anchor="middle">10</text>
          <text x="108" y="65" font-size="11" fill="var(--color-error)" font-weight="bold">5</text>
          <text x="65" y="55" font-size="11" fill="var(--color-text-muted)" text-anchor="middle">8</text>
          <text x="135" y="55" font-size="11" fill="var(--color-text-muted)" text-anchor="middle">6</text>
        </svg>`,
      options: ["24", "25", "48", "50"],
      answerIndex: 1,
      hint: "套用公式：底 × 高 ÷ 2。千萬不要忘記「除以 2」，並且注意 8 和 6 是用來混淆的斜邊長度！",
      explanation: "三角形面積 ＝ 底 × 高 ÷ 2 ＝ 10 × 5 ÷ 2 = 25 平方公分。8 和 6 僅為其它的邊長資訊，在此不需要用到。"
    },
    {
      level: "挑戰",
      question: "如圖，直角梯形 ABCD 中，AD = 3，BC = 12，AB = 9。P 是 AB 上的一點，且 AP = 4，BP = 5。請問灰色三角形 DPC 的面積是多少？",
      diagram: `
        <svg viewBox="0 0 200 130" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <polygon points="40,30 70,30 160,110 40,110" fill="#F3F4F6" stroke="#4B5563" stroke-width="1.5" />
          <polygon points="70,30 40,70 160,110" fill="rgba(219, 39, 119, 0.2)" stroke="#db2777" stroke-width="2" />
          <path d="M 40 28 L 48 28 L 48 20" fill="none" stroke="#4B5563" stroke-width="1" />
          <path d="M 40 102 L 48 102 L 48 110" fill="none" stroke="#4B5563" stroke-width="1" />
          <circle cx="40" cy="60" r="3" fill="#db2777" />
          <text x="55" y="15" font-size="10" fill="#4B5563" font-weight="bold" text-anchor="middle">3</text>
          <text x="100" y="123" font-size="10" fill="#4B5563" font-weight="bold" text-anchor="middle">12</text>
          <text x="28" y="45" font-size="10" fill="#4B5563" font-weight="bold" text-anchor="middle">4</text>
          <text x="28" y="90" font-size="10" fill="#4B5563" font-weight="bold" text-anchor="middle">5</text>
          <text x="28" y="24" font-size="10" fill="#4B5563" font-weight="bold">A</text>
          <text x="75" y="24" font-size="10" fill="#4B5563" font-weight="bold">D</text>
          <text x="28" y="64" font-size="10" fill="#db2777" font-weight="bold">P</text>
          <text x="28" y="118" font-size="10" fill="#4B5563" font-weight="bold">B</text>
          <text x="165" y="118" font-size="10" fill="#4B5563" font-weight="bold">C</text>
        </svg>`,
      options: ["67.5", "36", "31.5", "30"],
      answerIndex: 2,
      hint: "灰色三角形 DPC 的面積 ＝ 整個梯形 ABCD 面積 － 直角三角形 APD 面積 － 直角三角形 BCP 面積。先算出這三個圖形的面積吧！",
      explanation: "直角梯形 ABCD 總面積 = (3 + 12) × 9 ÷ 2 = 67.5。直角三角形 APD 面積 = 3 × 4 ÷ 2 = 6。直角三角形 BCP 面積 = 12 × 5 ÷ 2 = 30。灰色三角形 DPC 面積 = 67.5 - 6 - 30 = 31.5 平方公分。"
    }
  ],
  trapezoid: [
    {
      level: "簡易",
      question: "一個梯形的上底是 4 公分，下底是 6 公分，高是 5 公分，請問它的面積是多少平方公分？",
      options: ["20", "25", "50", "100"],
      answerIndex: 1,
      hint: "梯形的面積公式是：（上底 ＋ 下底）× 高 ÷ 2。先將上底和下底相加，再乘上高，最後別忘了除以 2 喔！",
      explanation: "梯形面積 ＝ (上底 ＋ 下底) × 高 ÷ 2 ＝ (4 ＋ 6) × 5 ÷ 2 ＝ 10 × 5 ÷ 2 ＝ 25 平方公分。"
    },
    {
      level: "中等",
      question: "兩個完全一模一樣的梯形，把它們拼成一個平行四邊形後，這個平行四邊形的「底」會是原梯形的什麼呢？",
      options: ["高", "只有下底", "上底 ＋ 下底", "斜邊"],
      answerIndex: 2,
      hint: "想想公式推導動畫：將其中一個梯形上下顛倒拼上去後，底部那條長長的新底邊，是由原本梯形的哪兩個邊拼接起來的？",
      explanation: "將兩個完全相同的梯形上下顛倒拼合後，平行的兩邊（上底與下底）會首尾相接拼成平行四邊形的底。因此，拼成後的平行四邊形底邊長度 ＝ 梯形的「上底 ＋ 下底」。"
    },
    {
      level: "中等",
      question: "兩個完全相同的梯形拼成一個面積為 40 平方公分的平行四邊形。請問原本「一個梯形」的面積是多少平方公分？",
      options: ["10", "20", "40", "80"],
      answerIndex: 1,
      hint: "既然平行四邊形是由兩個「完全相同」的梯形拼出來的，那一個梯形的面積當然就是平行四邊形面積的幾分之幾呢？",
      explanation: "因為兩個相同的梯形能拼出一個平行四邊形，所以單個梯形的面積就是拼成後的平行四邊形面積的一半，即 40 ÷ 2 = 20 平方公分。"
    },
    {
      level: "中等",
      question: "觀察下圖，有一個梯形上底是 3 公分，下底是 9 公分。沿著虛線切開，將其分成三角形 甲 與平行四邊形 乙，請問區域 甲 與區域 乙 的面積關係為何？",
      diagram: `
        <svg viewBox="0 0 240 130" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <polygon points="70,30 130,30 90,90 30,90" fill="rgba(211, 162, 151, 0.2)" stroke="var(--color-accent-dark)" stroke-width="2" />
          <polygon points="130,30 210,90 90,90" fill="rgba(148, 168, 154, 0.2)" stroke="var(--color-secondary-dark)" stroke-width="2" />
          <line x1="130" y1="30" x2="90" y2="90" stroke="var(--color-error)" stroke-width="2" stroke-dasharray="4" />
          
          <text x="80" y="65" font-size="14" fill="var(--color-accent-dark)" font-weight="bold" text-anchor="middle">乙</text>
          <text x="145" y="65" font-size="14" fill="var(--color-secondary-dark)" font-weight="bold" text-anchor="middle">甲</text>
          
          <text x="100" y="20" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">上底 3 公分</text>
          <text x="120" y="106" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">下底 9 公分</text>
        </svg>`,
      options: ["甲的面積大於乙", "乙的面積大於甲", "甲和乙的面積一樣大", "無法比較"],
      answerIndex: 2,
      hint: "平行四邊形 乙 的底是 3。三角形 甲 的底是下底減去平行四邊形底：9 - 3 = 6。平行四邊形面積 ＝ 底 × 高，三角形面積 ＝ 底 × 高 ÷ 2，代入公式算算看！",
      explanation: "平行四邊形 乙 的底邊是 3，高度為 h，其面積為 3 × h。三角形 甲 的底邊是 9 - 3 = 6，高度也是 h，其面積為 6 × h ÷ 2 = 3 × h。因此，三角形 甲 與平行四邊形 乙 的面積一樣大！"
    },
    {
      level: "困難",
      question: "如圖，白色梯形與塗色梯形是完全一模一樣的全等圖形。下列哪一個算式可以正確算出「白色梯形」的面積？",
      diagram: `
        <svg viewBox="0 0 240 120" class="w-full max-w-xs mx-auto h-32 bg-white rounded-lg border border-slate-200 mt-2 mb-4">
          <polygon points="80,90 180,90 140,30 100,30" fill="rgba(211, 162, 151, 0.25)" stroke="var(--color-accent-dark)" stroke-width="2" />
          <polygon points="40,90 80,90 100,30 0,30" fill="white" stroke="var(--color-accent-dark)" stroke-width="2" />
          <line x1="100" y1="30" x2="100" y2="90" stroke="var(--color-error)" stroke-dasharray="4" stroke-width="2" />
          <polyline points="100,80 110,80 110,90" fill="none" stroke="var(--color-error)" stroke-width="2" />
          <text x="50" y="20" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">9</text>
          <text x="60" y="105" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">5</text>
          <text x="120" y="20" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">5</text>
          <text x="130" y="105" font-size="11" fill="var(--color-text)" font-weight="bold" text-anchor="middle">9</text>
          <text x="115" y="65" font-size="11" fill="var(--color-error)" font-weight="bold" text-anchor="middle">高 4</text>
        </svg>`,
      options: ["9 × 4 × 5", "(5 ＋ 9) × 4", "(5 ＋ 9) × 4 ÷ 2", "(5 ＋ 9) × 4 ÷ 2 ÷ 2"],
      answerIndex: 2,
      hint: "題目問的是單個「白色梯形」的面積。觀察圖形，白色梯形的上底是 9，下底是 5，垂直高是 4，請將這些數值帶入梯形面積公式！",
      explanation: "白色梯形上底是 9，下底是 5，高是 4。套用公式 (上底 ＋ 下底) × 高 ÷ 2，得到算式 (5 ＋ 9) × 4 ÷ 2。"
    }
  ]
};

// --- 線上抽題邏輯 (直接按難度由易到難順序出完所有 5 題) ---
function generateChallengeQuestions(shape) {
  return quizDatabase[shape] || quizDatabase.rectangle;
}

// --- 路由切換 ---
window.switchTab = function(tabName) {
  AppState.activeTab = tabName;
  
  // 初始化狀態
  if (tabName === 'learn') {
    AppState.learnStep = 0;
  } else if (tabName === 'heightMeasure') {
    if (AppState.heightMeasure.mode === 'practice') {
      window.resetDrawingState();
    }
  } else if (tabName === 'photoSelfCheck') {
    // 保留或更新
  } else if (tabName === 'compositeArea') {
    AppState.compositeArea.step = 0;
    AppState.compositeArea.practiceAnswer = null;
    AppState.compositeArea.practiceFeedback = null;
  } else if (tabName === 'challenge') {
    AppState.quiz.currentQuestions = window.getQuizQuestionsForLevel(AppState.quiz.currentLevel);
    window.resetChallengeState();
  }
  
  renderMain();
};

window.switchShape = function(shapeName) {
  AppState.activeShape = shapeName;
  AppState.learnStep = 0;
  renderMain();
};

// --- 選單 2：為圖形「量身高」專屬邏輯 ---
window.switchHeightMeasureMode = function(mode) {
  AppState.heightMeasure.mode = mode;
  if (mode === 'practice') {
    window.resetDrawingState();
  }
  renderContentAreaOnly();
};

window.updateDemoDOM = function() {
  const demoStep = AppState.heightMeasure.demoStep;
  const totalDemoSteps = heightMeasureDemoConfig.steps.length;
  const stepInfo = heightMeasureDemoConfig.steps[demoStep];

  // 1. 更新計數器與文字
  const indicator = document.getElementById('demo-step-indicator');
  if (indicator) indicator.textContent = `${demoStep + 1} / ${totalDemoSteps} 步驟`;

  const title = document.getElementById('demo-step-title');
  if (title) title.textContent = stepInfo.title;

  const desc = document.getElementById('demo-step-desc');
  if (desc) desc.textContent = stepInfo.desc;

  const subDesc = document.getElementById('demo-step-subdesc');
  if (subDesc) subDesc.textContent = `💡 ${stepInfo.subDesc}`;

  // 2. 更新按鈕狀態
  const prevBtn = document.getElementById('demo-prev-btn');
  if (prevBtn) prevBtn.disabled = (demoStep === 0);

  const nextBtn = document.getElementById('demo-next-btn');
  if (nextBtn) nextBtn.disabled = (demoStep === totalDemoSteps - 1);

  const playBtn = document.getElementById('demo-play-btn');
  if (playBtn) playBtn.textContent = AppState.heightMeasure.demoPlaying ? '⏸️ 暫停' : '▶️ 自動播放';

  // 3. 更新進度圓點
  const dots = document.querySelectorAll('#demo-dots-container button');
  dots.forEach((btn, idx) => {
    const isPast = idx <= demoStep;
    const isCurrent = idx === demoStep;
    btn.className = "w-8 h-8 rounded-full border-2 font-bold transition-all flex items-center justify-center text-xs md:text-sm";
    if (isCurrent) {
      btn.className += " bg-amber-400 text-slate-800 border-amber-400 scale-110";
    } else if (isPast) {
      btn.className += " bg-slate-300 text-slate-800 border-slate-300";
    } else {
      btn.className += " bg-transparent text-slate-400 border-slate-300";
    }
  });

  // 4. 更新口訣卡片的選中狀態
  const chantItems = document.querySelectorAll('#demo-chant-list > div');
  chantItems.forEach((item, idx) => {
    const itemStep = idx + 1; // 1, 2, 3
    if (itemStep === demoStep) {
      item.className = "p-2.5 rounded-lg border bg-amber-50 border-amber-300 font-bold text-amber-900 transition-all";
    } else {
      item.className = "p-2.5 rounded-lg border bg-white border-slate-200 text-slate-600 transition-all";
    }
  });

  // 5. 動態平滑更新 SVG 元素
  const ruler = document.getElementById('demo-ruler');
  if (ruler) ruler.style.opacity = demoStep >= 1 ? '1' : '0';

  const setsquare = document.getElementById('demo-setsquare');
  if (setsquare) {
    setsquare.style.opacity = demoStep >= 2 ? '1' : '0';
    setsquare.style.transform = (demoStep >= 2) ? 'translate(80px, -30px)' : 'translate(20px, -30px)';
  }

  const heightGroup = document.getElementById('demo-height-group');
  if (heightGroup) heightGroup.style.opacity = demoStep >= 3 ? '1' : '0';
};

window.nextDemoStep = function() {
  if (AppState.heightMeasure.demoStep < heightMeasureDemoConfig.steps.length - 1) {
    AppState.heightMeasure.demoStep++;
    window.updateDemoDOM();
  }
};

window.prevDemoStep = function() {
  if (AppState.heightMeasure.demoStep > 0) {
    AppState.heightMeasure.demoStep--;
    window.updateDemoDOM();
  }
};

window.jumpDemoStep = function(stepIdx) {
  AppState.heightMeasure.demoStep = stepIdx;
  window.updateDemoDOM();
};

let demoTimer = null;
window.toggleDemoAutoPlay = function() {
  AppState.heightMeasure.demoPlaying = !AppState.heightMeasure.demoPlaying;
  if (AppState.heightMeasure.demoPlaying) {
    if (AppState.heightMeasure.demoStep >= heightMeasureDemoConfig.steps.length - 1) {
      AppState.heightMeasure.demoStep = 0;
    }
    window.updateDemoDOM();
    demoTimer = setInterval(() => {
      if (AppState.heightMeasure.demoStep < heightMeasureDemoConfig.steps.length - 1) {
        AppState.heightMeasure.demoStep++;
        window.updateDemoDOM();
      } else {
        clearInterval(demoTimer);
        AppState.heightMeasure.demoPlaying = false;
        window.updateDemoDOM();
      }
    }, 2500);
  } else {
    clearInterval(demoTimer);
    window.updateDemoDOM();
  }
};

// --- 選單 4：複合圖形的面積 專屬邏輯 ---
window.switchCompositeMethod = function(method) {
  AppState.compositeArea.activeMethod = method;
  AppState.compositeArea.problemIndex = 0;
  AppState.compositeArea.step = 0;
  AppState.compositeArea.practiceAnswer = null;
  AppState.compositeArea.practiceFeedback = null;
  renderContentAreaOnly();
};

window.switchCompositeProblem = function(idx) {
  AppState.compositeArea.problemIndex = idx;
  AppState.compositeArea.step = 0;
  AppState.compositeArea.practiceAnswer = null;
  AppState.compositeArea.practiceFeedback = null;
  renderContentAreaOnly();
};

window.toggleCompositeStep = function() {
  AppState.compositeArea.step = AppState.compositeArea.step === 0 ? 1 : 0;
  renderContentAreaOnly();
};

window.checkCompositeAnswer = function() {
  const inputEl = document.getElementById('composite-answer-input');
  if (!inputEl) return;
  const val = parseFloat(inputEl.value);
  const methodCfg = compositeAreaConfig[AppState.compositeArea.activeMethod];
  const problemIdx = AppState.compositeArea.problemIndex || 0;
  const prob = methodCfg.problems[problemIdx] || methodCfg.problems[0];
  const unit = prob.unit || '平方公分';
  if (val === prob.expectedAnswer) {
    AppState.compositeArea.practiceFeedback = {
      type: 'success',
      text: `🎉 太棒了！回答完全正確，總面積正是 ${prob.expectedAnswer} ${unit}。幾何拆解與推導非常出色！`
    };
  } else {
    AppState.compositeArea.practiceFeedback = {
      type: 'error',
      text: `💡 再檢查看看計算喔！回想左側的思考引導，仔細檢查各部分的底、高或長、寬是否正確！`
    };
  }
  renderContentAreaOnly();
};

// --- 選單 5：小試身手 分級切換邏輯 ---
window.switchQuizLevel = function(lvl) {
  AppState.quiz.currentLevel = lvl;
  AppState.quiz.currentQuestions = window.getQuizQuestionsForLevel(lvl);
  window.resetChallengeState();
  renderContentAreaOnly();
};


// --- 公式探索按鈕 與 DOM 漸進更新 ---
window.updateLearnDOM = function() {
  const config = shapeConfig[AppState.activeShape];
  const step = AppState.learnStep;
  const totalSteps = config.steps.length;
  const stepData = config.steps[step];
  
  // 1. 更新步驟指示與文字
  const indicator = document.getElementById('learn-step-indicator');
  if (indicator) indicator.textContent = `${step + 1} / ${totalSteps} 步驟`;
  
  const title = document.getElementById('learn-step-title');
  if (title) title.textContent = stepData.title;
  
  const content = document.getElementById('learn-step-content');
  if (content) content.innerHTML = stepData.content;
  
  // 2. 更新按鈕啟用狀態
  const prevBtn = document.getElementById('learn-prev-btn');
  if (prevBtn) prevBtn.disabled = (step === 0);
  
  const nextBtn = document.getElementById('learn-next-btn');
  if (nextBtn) nextBtn.disabled = (step === totalSteps - 1);
  
  // 3. 更新進度指示圓點的樣式
  const dotButtons = document.querySelectorAll('#learn-dots-container button');
  dotButtons.forEach((btn, idx) => {
    const isPast = idx <= step;
    const isCurrent = idx === step;
    
    btn.className = "w-8 h-8 rounded-full border-2 font-bold transition-all flex items-center justify-center text-xs md:text-sm";
    if (isCurrent) {
      btn.className += " bg-amber-400 text-slate-800 border-amber-400 scale-110";
    } else if (isPast) {
      btn.className += " bg-slate-300 text-slate-800 border-slate-300";
    } else {
      btn.className += " bg-transparent text-slate-400 border-slate-300";
    }
  });
  
  // 4. 動態且平滑更新 SVG 內部的元素屬性與樣式，以觸發 CSS Transition
  if (AppState.activeShape === 'rectangle') {
    const mainShape = document.getElementById('rect-main-shape');
    if (mainShape) {
      const fillVal = (step === 0 || step === 4) ? '#ffffff' : 'rgba(126, 144, 154, 0.1)';
      mainShape.setAttribute('fill', fillVal);
    }
    const row1 = document.getElementById('rect-squares-row1');
    if (row1) row1.style.opacity = (step >= 1 && step <= 3) ? '1' : '0';
    
    const rows24 = document.getElementById('rect-squares-rows24');
    if (rows24) rows24.style.opacity = (step >= 2 && step <= 3) ? '1' : '0';
    
    const numbers = document.getElementById('rect-numbers');
    if (numbers) numbers.style.opacity = (step === 3) ? '1' : '0';
  } 
  else if (AppState.activeShape === 'parallelogram') {
    const bgShape = document.getElementById('para-bg-shape');
    if (bgShape) bgShape.style.opacity = (step === 0) ? '1' : '0';
    
    const rightShape = document.getElementById('para-right-shape');
    if (rightShape) {
      rightShape.style.opacity = (step > 0) ? '1' : '0';
      const mainFill = (step === 0) ? '#ffffff' : 'rgba(148, 168, 154, 0.3)';
      rightShape.setAttribute('fill', mainFill);
    }
    
    const movingShape = document.getElementById('para-moving-shape');
    if (movingShape) {
      movingShape.style.opacity = (step > 0) ? '1' : '0';
      const movingFill = (step === 0) ? '#ffffff' : 'rgba(211, 162, 151, 0.4)';
      movingShape.setAttribute('fill', movingFill);
      movingShape.style.transform = (step >= 2) ? 'translateX(100px)' : 'translateX(0px)';
    }
    
    const cutElements = document.getElementById('para-cut-elements');
    if (cutElements) cutElements.style.opacity = (step >= 1) ? '1' : '0';
    
    const ruler = document.getElementById('para-ruler-tool');
    if (ruler) ruler.style.opacity = (step >= 3) ? '1' : '0';
    
    const setsquare = document.getElementById('para-setsquare-tool');
    if (setsquare) setsquare.style.opacity = (step >= 4) ? '1' : '0';
    
    const baseLabel = document.getElementById('para-base-label');
    if (baseLabel) baseLabel.style.opacity = (step >= 3) ? '1' : '0';
    
    const heightLabel = document.getElementById('para-height-label');
    if (heightLabel) heightLabel.style.opacity = (step >= 4) ? '1' : '0';
  } 
  else if (AppState.activeShape === 'triangle') {
    const originalShape = document.getElementById('tri-original-shape');
    if (originalShape) {
      const originalFill = (step === 0) ? '#ffffff' : 'rgba(141, 155, 123, 0.3)';
      originalShape.setAttribute('fill', originalFill);
    }
    
    const movingShape = document.getElementById('tri-moving-shape');
    if (movingShape) {
      movingShape.style.opacity = (step >= 1) ? '1' : '0';
      movingShape.style.transform = (step >= 2) ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    
    const height = document.getElementById('tri-height-elements');
    if (height) height.style.opacity = (step >= 5) ? '1' : '0';
    
    const ruler = document.getElementById('tri-ruler-tool');
    if (ruler) ruler.style.opacity = (step >= 4) ? '1' : '0';
    
    const setsquare = document.getElementById('tri-setsquare-tool');
    if (setsquare) setsquare.style.opacity = (step >= 5) ? '1' : '0';
    
    const baseLabel = document.getElementById('tri-base-label');
    if (baseLabel) baseLabel.style.opacity = (step >= 4) ? '1' : '0';
    
    const heightLabel = document.getElementById('tri-height-label');
    if (heightLabel) heightLabel.style.opacity = (step >= 5) ? '1' : '0';
  } 
  else if (AppState.activeShape === 'trapezoid') {
    const originalShape = document.getElementById('trap-original-shape');
    if (originalShape) {
      const originalFill = (step === 0) ? '#ffffff' : 'rgba(126, 144, 154, 0.3)';
      originalShape.setAttribute('fill', originalFill);
    }
    
    const movingShape = document.getElementById('trap-moving-shape');
    if (movingShape) {
      movingShape.style.opacity = (step >= 1) ? '1' : '0';
      movingShape.style.transform = (step >= 2) ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    
    const height = document.getElementById('trap-height-elements');
    if (height) height.style.opacity = (step >= 5) ? '1' : '0';
    
    const ruler = document.getElementById('trap-ruler-tool');
    if (ruler) ruler.style.opacity = (step >= 4) ? '1' : '0';
    
    const setsquare = document.getElementById('trap-setsquare-tool');
    if (setsquare) setsquare.style.opacity = (step >= 5) ? '1' : '0';
    
    const baseLabel = document.getElementById('trap-base-label');
    if (baseLabel) baseLabel.style.opacity = (step >= 4) ? '1' : '0';
    
    const heightLabel = document.getElementById('trap-height-label');
    if (heightLabel) heightLabel.style.opacity = (step >= 5) ? '1' : '0';
  }
};

window.nextLearnStep = function() {
  const steps = shapeConfig[AppState.activeShape].steps;
  if (AppState.learnStep < steps.length - 1) {
    AppState.learnStep++;
    window.updateLearnDOM();
  }
};

window.prevLearnStep = function() {
  if (AppState.learnStep > 0) {
    AppState.learnStep--;
    window.updateLearnDOM();
  }
};

window.jumpToStep = function(stepIdx) {
  AppState.learnStep = stepIdx;
  window.updateLearnDOM();
};

// --- 線上畫高邏輯 ---
window.switchDrawShape = function(shapeKey) {
  AppState.drawShape = shapeKey;
  window.resetDrawingState();
  // 重設上傳自檢的狀態，避免舊形狀的標註與診斷殘留
  AppState.uploadState.points = [];
  AppState.uploadState.answers = { q1: null, q2: null, q3: null };
  AppState.uploadState.diagnosticReport = null;
  AppState.uploadState.showQuiz = false;
  AppState.uploadState.scanFinished = false;
  renderContentAreaOnly();
};

window.switchDrawMode = function(mode) {
  AppState.drawHeightMode = mode;
  renderContentAreaOnly();
};

window.resetDrawingState = function() {
  AppState.drawingState = {
    rulerPlaced: false,
    setsquarePlaced: false,
    setsquareX: 130,
    heightDrawn: false,
    heightX: null,
    extensionDrawn: false,
    feedbackText: '',
    feedbackType: '',
    checked: false
  };
};

window.placeRuler = function() {
  const config = drawShapeConfig[AppState.drawShape];
  AppState.drawingState.rulerPlaced = true;
  if (config.needExtension && !AppState.drawingState.extensionDrawn) {
    AppState.drawingState.feedbackText = '直尺已放於腳底。步驟 2：因為是高在外部的圖形，請先點擊「畫底邊延長線」！';
  } else {
    AppState.drawingState.feedbackText = '直尺已放於腳底。步驟 2：請點擊「機器(三角板)推出來」按鈕！';
  }
  AppState.drawingState.feedbackType = 'info';
  renderContentAreaOnly();
};

window.placeSetsquare = function() {
  AppState.drawingState.setsquarePlaced = true;
  AppState.drawingState.feedbackText = '機器(三角板)已推出來。接下來請滑動下方拉桿對齊頂點（或底對面平行邊），並沿著三角板畫高。';
  AppState.drawingState.feedbackType = 'info';
  renderContentAreaOnly();
};

window.handleSetsquareSlider = function(val) {
  AppState.drawingState.setsquareX = parseInt(val);
  
  // 即時重新繪製 SVG
  const svgContainer = document.getElementById('drawing-svg-container');
  if (svgContainer) {
    svgContainer.innerHTML = drawShapeConfig[AppState.drawShape].svg(AppState.drawingState);
  }
};

window.adjustSetsquare = function(direction) {
  const slider = document.getElementById('setsquare-slider');
  if (slider) {
    let newVal = parseInt(slider.value) + direction * 2;
    newVal = Math.max(30, Math.min(230, newVal));
    slider.value = newVal;
    window.handleSetsquareSlider(newVal);
  }
};

window.drawExtension = function() {
  AppState.drawingState.extensionDrawn = true;
  AppState.drawingState.feedbackText = '底邊的虛線延長線已畫好。接下來請點擊「機器(三角板)推出來」按鈕！';
  AppState.drawingState.feedbackType = 'info';
  renderContentAreaOnly();
};

window.drawHeight = function() {
  if (!AppState.drawingState.setsquarePlaced) {
    AppState.drawingState.feedbackText = '請先點擊讓「機器(三角板)推出來」！否則無法沿著三角板畫出垂直的高喔！';
    AppState.drawingState.feedbackType = 'error';
    renderContentAreaOnly();
    return;
  }
  
  AppState.drawingState.heightDrawn = true;
  AppState.drawingState.heightX = AppState.drawingState.setsquareX;
  AppState.drawingState.feedbackText = '高已畫好！請點擊下方「送出檢查」進行幾何檢驗。';
  AppState.drawingState.feedbackType = 'info';
  renderContentAreaOnly();
};

window.checkDrawing = function() {
  const config = drawShapeConfig[AppState.drawShape];
  const state = AppState.drawingState;
  
  state.checked = true;
  
  if (!state.heightDrawn) {
    state.feedbackText = '您還沒有畫高喔！請依照步驟放置直尺、推出三角板並畫高。';
    state.feedbackType = 'error';
    renderContentAreaOnly();
    return;
  }
  
  // 根據形狀類型進行不同的幾何檢驗
  if (AppState.drawShape === 'acute_triangle' || AppState.drawShape === 'obtuse_triangle') {
    // 三角形：高必須通過對面頂點
    const diff = Math.abs(state.heightX - config.targetX);
    if (diff > 6) {
      state.feedbackText = `❌ 檢核未通過！您畫的「高」位置不對喔。三角形的高必須準確通過「對面的頂點」（紅色點）。請滑動三角板對齊紅色點試試看！`;
      state.feedbackType = 'error';
    } else if (config.needExtension && !state.extensionDrawn) {
      state.feedbackText = `⚠️ 部分正確！您的高度位置對了，但因為高落在底邊外側，您必須先點擊「畫底邊延長線」來把底邊補上虛線，才是一個完整的畫法喔！`;
      state.feedbackType = 'warning';
    } else {
      state.feedbackText = `🎉 太棒了！檢核完全正確！您已成功畫出三角形的高，它垂直於底邊且精準通過對面的頂點！`;
      state.feedbackType = 'success';
    }
  } else if (AppState.drawShape === 'slanted_para') {
    // 平行四邊形：高有無限多條，只要連接兩對邊且垂直即可。不需要通過頂點！
    // 斜平行四邊形底部範圍 130~210，頂部範圍 70~150。
    if (state.heightX < 70 || state.heightX > 210) {
      state.feedbackText = `❌ 檢核未通過！高位置偏離了圖形範圍。請將三角板置於平行四邊形底邊或其延長線範圍內。`;
      state.feedbackType = 'error';
    } else if (state.heightX < 130) {
      // 落在底邊外側 (70~129)，需要延長線
      if (!state.extensionDrawn) {
        state.feedbackText = `⚠️ 部分正確！平行四邊形的高可以畫在外面（有無限多條），但因為此位置在底邊外側，您必須先點擊「畫底邊延長線」（虛線），高才有立足點喔！`;
        state.feedbackType = 'warning';
      } else {
        state.feedbackText = `🎉 完全正確！您在底邊的延長線上畫出了垂直高。平行四邊形的高有無限多條，您成功畫出了其中一條！`;
        state.feedbackType = 'success';
      }
    } else {
      // 落在底邊內側 (130~210)，不需要延長線
      state.feedbackText = `🎉 完全正確！您在底邊內畫出了垂直高。平行四邊形的高有無限多條，只要垂直於兩對邊即可，不需要一定要通過頂點喔！`;
      state.feedbackType = 'success';
    }
  } else if (AppState.drawShape === 'right_trapezoid') {
    // 直角梯形：高有無限多條，上底為 110~190。
    if (state.heightX < 110 || state.heightX > 190) {
      state.feedbackText = `❌ 檢核未通過！垂直高沒有連接到上底。直角梯形的高必須連接平行上底與下底，請將三角板滑動至上底範圍內（110 ~ 190 之間）。`;
      state.feedbackType = 'error';
    } else {
      state.feedbackText = `🎉 完全正確！您畫出了直角梯形的高。在直角梯形中，垂直於底邊的那條腰也是 it 的一條高（此時 X = 110），高有無限多條，您成功畫出其中一條！`;
      state.feedbackType = 'success';
    }
  } else if (AppState.drawShape === 'slanted_trapezoid') {
    // 斜梯形：高有無限多條，上底為 70~170，下底為 90~230，重疊區域為 90~170。
    if (state.heightX < 90 || state.heightX > 170) {
      state.feedbackText = `❌ 檢核未通過！垂直高沒有同時連接上底與下底。請將三角板滑動至上底與下底的重疊範圍內（90 ~ 170 之間）。`;
      state.feedbackType = 'error';
    } else {
      state.feedbackText = `🎉 完全正確！您畫出了斜梯形的高。梯形的高有無限多條，只要垂直連接平行上底與下底即可，不需要一定要通過頂點喔！`;
      state.feedbackType = 'success';
    }
  }
  
  renderContentAreaOnly();
};

// --- 拍照上傳自學診斷邏輯 ---
window.triggerFileInput = function() {
  const fileInput = document.getElementById('photo-file-input');
  if (fileInput) fileInput.click();
};

window.handlePhotoUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    AppState.uploadState.fileUploaded = true;
    AppState.uploadState.imageSrc = e.target.result;
    AppState.uploadState.points = [];
    AppState.uploadState.checked = false;
    AppState.uploadState.measuredAngle = null;
    AppState.uploadState.angleDiff = null;
    AppState.uploadState.isPerpendicular = null;
    renderContentAreaOnly();
  };
  reader.readAsDataURL(file);
};

window.useSamplePhoto = function() {
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 350" width="500" height="350">
    <rect width="500" height="350" fill="#fcfbf7"/>
    <pattern id="spgrid" width="25" height="25" patternUnits="userSpaceOnUse">
      <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#e8e5dc" stroke-width="1"/>
    </pattern>
    <rect width="500" height="350" fill="url(#spgrid)"/>
    <polygon points="80,260 380,260 220,90" fill="#f0ede3" stroke="#4a5568" stroke-width="3" stroke-linejoin="round"/>
    <line x1="220" y1="90" x2="220" y2="260" stroke="#718096" stroke-width="2.5" stroke-dasharray="5"/>
    <rect x="220" y="246" width="14" height="14" fill="none" stroke="#718096" stroke-width="1.5"/>
    <text x="230" y="285" font-family="sans-serif" font-size="14" fill="#4a5568" font-weight="bold">底邊 (30 cm)</text>
    <text x="235" y="180" font-family="sans-serif" font-size="14" fill="#4a5568" font-weight="bold">高 (17 cm)</text>
    <text x="220" y="75" font-family="sans-serif" font-size="12" fill="#e53e3e" text-anchor="middle" font-weight="bold">頂點 A</text>
  </svg>`;
  AppState.uploadState.imageSrc = 'data:image/svg+xml;utf8,' + encodeURIComponent(sampleSvg);
  AppState.uploadState.fileUploaded = true;
  AppState.uploadState.points = [];
  AppState.uploadState.checked = false;
  AppState.uploadState.measuredAngle = null;
  AppState.uploadState.angleDiff = null;
  AppState.uploadState.isPerpendicular = null;
  renderContentAreaOnly();
};

window.handleWorkspaceClick = function(event) {
  if (!AppState.uploadState.fileUploaded) return;
  if (!AppState.uploadState.points) {
    AppState.uploadState.points = [];
  }
  if (AppState.uploadState.points.length >= 3) return;
  
  const container = document.getElementById('photo-canvas-container') || event.currentTarget;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  
  let clientX = event.clientX;
  let clientY = event.clientY;
  if (clientX === undefined && event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if (clientX === undefined && event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  }
  
  if (rect.width === 0 || rect.height === 0) return;

  // 緊貼相片實體像素計算百分比，徹底防止外框伸縮造成的點位飄移
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
  
  AppState.uploadState.points.push({ x, y });
  AppState.uploadState.checked = false;
  renderContentAreaOnly();
};

window.clearPoints = function() {
  AppState.uploadState.points = [];
  AppState.uploadState.checked = false;
  AppState.uploadState.measuredAngle = null;
  AppState.uploadState.angleDiff = null;
  AppState.uploadState.isPerpendicular = null;
  renderContentAreaOnly();
};

window.undoPoint = function() {
  if (AppState.uploadState.points && AppState.uploadState.points.length > 0) {
    AppState.uploadState.points.pop();
    AppState.uploadState.checked = false;
    AppState.uploadState.measuredAngle = null;
    AppState.uploadState.angleDiff = null;
    AppState.uploadState.isPerpendicular = null;
    renderContentAreaOnly();
  }
};

window.deletePointFrom = function(idx) {
  if (AppState.uploadState.points) {
    AppState.uploadState.points = AppState.uploadState.points.slice(0, idx);
    AppState.uploadState.checked = false;
    AppState.uploadState.measuredAngle = null;
    AppState.uploadState.angleDiff = null;
    AppState.uploadState.isPerpendicular = null;
    renderContentAreaOnly();
  }
};

window.calculateAngle = function() {
  const points = AppState.uploadState.points;
  if (!points || points.length < 3) return 0;
  
  const p1 = points[2]; // 頂點 (Point 3)
  const p2 = points[1]; // 垂足 (Point 2)
  const p3 = points[0]; // 底邊起點 (Point 1)
  
  const container = document.getElementById('photo-canvas-container') || document.querySelector('.photo-workspace');
  const w = container ? container.getBoundingClientRect().width : 400;
  const h = container ? container.getBoundingClientRect().height : 300;
  
  // 依據相片實際渲染尺寸進行各向量長度與夾角計算
  const p1Px = { x: (p1.x * w) / 100, y: (p1.y * h) / 100 };
  const p2Px = { x: (p2.x * w) / 100, y: (p2.y * h) / 100 };
  const p3Px = { x: (p3.x * w) / 100, y: (p3.y * h) / 100 };
  
  // 垂足出發的兩向量
  const vHeight = { x: p1Px.x - p2Px.x, y: p1Px.y - p2Px.y };
  const vBase = { x: p3Px.x - p2Px.x, y: p3Px.y - p2Px.y };
  
  const dotProduct = vHeight.x * vBase.x + vHeight.y * vBase.y;
  const mHeight = Math.sqrt(vHeight.x * vHeight.x + vHeight.y * vHeight.y);
  const mBase = Math.sqrt(vBase.x * vBase.x + vBase.y * vBase.y);
  
  if (mHeight === 0 || mBase === 0) return 0;
  
  const cosTheta = dotProduct / (mHeight * mBase);
  const clampedCos = Math.max(-1, Math.min(1, cosTheta));
  const angleRad = Math.acos(clampedCos);
  const angleDeg = angleRad * (180 / Math.PI);
  
  return angleDeg;
};

window.verifyDrawingPerpendicular = function() {
  const points = AppState.uploadState.points || [];
  if (points.length < 3) {
    alert("請先在相片中依序點選 3 個定位點（1. 底邊起點 ➔ 2. 垂足 ➔ 3. 頂點）！");
    return;
  }
  
  const measuredAngle = window.calculateAngle();
  const angleDiff = Math.abs(measuredAngle - 90);
  const isPerpendicular = angleDiff <= 2.5; // 允許 2.5 度以內之正常操作容許誤差 (87.5° ~ 92.5°)
  
  AppState.uploadState.checked = true;
  AppState.uploadState.measuredAngle = measuredAngle;
  AppState.uploadState.angleDiff = angleDiff;
  AppState.uploadState.isPerpendicular = isPerpendicular;
  
  renderContentAreaOnly();
};

// --- 選擇題作答與測驗邏輯 (動態題數百分比配分) ---
window.resetChallengeState = function() {
  AppState.quiz.currentQ = 0;
  AppState.quiz.score = 0;
  AppState.quiz.correctCount = 0;
  AppState.quiz.selectedAnswer = null;
  AppState.quiz.isCorrect = null;
  AppState.quiz.hasAnswered = false;
  AppState.quiz.showFeedback = false;
  AppState.quiz.isFinished = false;
  AppState.quiz.wrongAttempts = [];
  AppState.quiz.decompositionState = {
    activeParts: [],
    partInputs: {},
    showHint: false
  };
};

window.resetChallenge = function() {
  AppState.quiz.currentQuestions = window.getQuizQuestionsForLevel(AppState.quiz.currentLevel);
  window.resetChallengeState();
  renderContentAreaOnly();
};

window.handleQuizAnswer = function(idx) {
  const currentQData = AppState.quiz.currentQuestions[AppState.quiz.currentQ];
  AppState.quiz.selectedAnswer = idx;
  AppState.quiz.hasAnswered = true;
  
  const total = AppState.quiz.currentQuestions.length;
  if (idx === currentQData.answerIndex) {
    AppState.quiz.isCorrect = true;
    AppState.quiz.showFeedback = true;
    AppState.quiz.correctCount = (AppState.quiz.correctCount || 0) + 1;
    AppState.quiz.score = Math.round((AppState.quiz.correctCount / total) * 100);
  } else {
    AppState.quiz.isCorrect = false;
    AppState.quiz.showFeedback = true;
    if (!AppState.quiz.wrongAttempts.includes(idx)) {
      AppState.quiz.wrongAttempts.push(idx);
    }
  }
  renderContentAreaOnly();
};

window.nextQuizQuestion = function() {
  if (AppState.quiz.currentQ < AppState.quiz.currentQuestions.length - 1) {
    AppState.quiz.currentQ++;
    AppState.quiz.selectedAnswer = null;
    AppState.quiz.isCorrect = null;
    AppState.quiz.hasAnswered = false;
    AppState.quiz.showFeedback = false;
    AppState.quiz.wrongAttempts = [];
    AppState.quiz.decompositionState = {
      activeParts: [],
      partInputs: {},
      showHint: false
    };
  } else {
    AppState.quiz.isFinished = true;
  }
  renderContentAreaOnly();
};

// --- UI 渲染邏輯 ---
function renderHeader() {
  return `
    <header class="nav-header">
      <div class="nav-container">
        <a href="#" class="nav-logo" onclick="window.switchTab('learn')">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16m-7 6h7"></path>
          </svg>
          幾何圖形面積學院
        </a>
        <div class="nav-links">
          <button class="nav-btn ${AppState.activeTab === 'learn' ? 'active' : ''}" onclick="window.switchTab('learn')">公式探索</button>
          <button class="nav-btn ${AppState.activeTab === 'heightMeasure' ? 'active' : ''}" onclick="window.switchTab('heightMeasure')">為圖形量身高</button>
          <button class="nav-btn ${AppState.activeTab === 'photoSelfCheck' ? 'active' : ''}" onclick="window.switchTab('photoSelfCheck')">拍照上傳自檢</button>
          <button class="nav-btn ${AppState.activeTab === 'compositeArea' ? 'active' : ''}" onclick="window.switchTab('compositeArea')">複合圖形面積</button>
          <button class="nav-btn ${AppState.activeTab === 'challenge' ? 'active' : ''}" onclick="window.switchTab('challenge')">小試身手</button>
        </div>
      </div>
    </header>
  `;
}

function renderSubMenu() {
  const shapes = ['rectangle', 'parallelogram', 'triangle', 'trapezoid'];
  const buttonsHtml = shapes.map(key => {
    const isActive = AppState.activeShape === key;
    return `<button class="shape-btn ${isActive ? 'active' : ''}" onclick="window.switchShape('${key}')">${shapeConfig[key].name}</button>`;
  }).join('');
  
  return `
    <div class="shape-select-panel mt-6">
      ${buttonsHtml}
    </div>
  `;
}

// 分頁 1：公式探索 (移除「動畫教學提示」)
function renderLearn() {
  const config = shapeConfig[AppState.activeShape];
  const step = config.steps[AppState.learnStep];
  const totalSteps = config.steps.length;
  
  // 底部進度圓點
  const dotsHtml = config.steps.map((_, idx) => {
    const isPast = idx <= AppState.learnStep;
    const isCurrent = idx === AppState.learnStep;
    return `
      <button onclick="window.jumpToStep(${idx})" class="w-8 h-8 rounded-full border-2 font-bold transition-all flex items-center justify-center text-xs md:text-sm
        ${isCurrent ? 'bg-amber-400 text-slate-800 border-amber-400 scale-110' : isPast ? 'bg-slate-300 text-slate-800 border-slate-300' : 'bg-transparent text-slate-400 border-slate-300'}"
      >
        ${idx + 1}
      </button>
    `;
  }).join('<div class="w-4 h-0.5 bg-slate-200"></div>');

  return `
    <div class="main-grid fade-in">
      <div class="glass-panel flex flex-col justify-between" style="min-height: 400px;">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold flex items-center gap-2">
            <span class="w-2.5 h-6 bg-emerald-600 rounded-full inline-block"></span>
            ${config.name}：面積公式推導
          </h2>
          <span id="learn-step-indicator" class="text-slate-500 font-semibold">${AppState.learnStep + 1} / ${totalSteps} 步驟</span>
        </div>
        
        <div class="svg-workspace p-6 border rounded-2xl flex-grow mb-6">
          ${config.svg()}
        </div>
        
        <div class="flex items-center justify-between gap-4 mt-auto">
          <button id="learn-prev-btn" class="btn btn-outline" onclick="window.prevLearnStep()" ${AppState.learnStep === 0 ? 'disabled' : ''}>上一步</button>
          <div id="learn-dots-container" class="flex items-center gap-1 hidden md:flex">${dotsHtml}</div>
          <button id="learn-next-btn" class="btn btn-primary" onclick="window.nextLearnStep()" ${AppState.learnStep === totalSteps - 1 ? 'disabled' : ''}>下一步</button>
        </div>
      </div>
      
      <div class="flex flex-col gap-6">
        <div class="glass-panel flex-grow">
          <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">步驟導引說明</h3>
          <h2 id="learn-step-title" class="text-xl font-bold text-slate-800 mb-3">${step.title}</h2>
          <p id="learn-step-content" class="text-slate-600 text-lg leading-relaxed">${step.content}</p>
        </div>
      </div>
    </div>
  `;
}

// 分頁 2：為圖形「量身高」
function renderHeightMeasure() {
  const mode = AppState.heightMeasure.mode;
  
  const modeTabsHtml = `
    <div class="flex justify-center gap-6 mb-8 bg-slate-100 p-2.5 rounded-full max-w-md mx-auto">
      <button class="flex-1 py-2 px-4 rounded-full font-bold text-sm transition-all
        ${mode === 'demo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
        onclick="window.switchHeightMeasureMode('demo')">
        🎬 平行四邊形量身高示範
      </button>
      <button class="flex-1 py-2 px-4 rounded-full font-bold text-sm transition-all
        ${mode === 'practice' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
        onclick="window.switchHeightMeasureMode('practice')">
        📏 虛擬尺規畫高練習
      </button>
    </div>
  `;

  if (mode === 'demo') {
    const demoStep = AppState.heightMeasure.demoStep;
    const totalDemoSteps = heightMeasureDemoConfig.steps.length;
    const stepInfo = heightMeasureDemoConfig.steps[demoStep];

    const demoDots = heightMeasureDemoConfig.steps.map((_, idx) => {
      const isPast = idx <= demoStep;
      const isCurrent = idx === demoStep;
      return `
        <button onclick="window.jumpDemoStep(${idx})" class="w-8 h-8 rounded-full border-2 font-bold transition-all flex items-center justify-center text-xs md:text-sm
          ${isCurrent ? 'bg-amber-400 text-slate-800 border-amber-400 scale-110' : isPast ? 'bg-slate-300 text-slate-800 border-slate-300' : 'bg-transparent text-slate-400 border-slate-300'}"
        >
          ${idx}
        </button>
      `;
    }).join('<div class="w-4 h-0.5 bg-slate-200"></div>');

    return `
      <div class="flex flex-col max-w-5xl mx-auto px-4 fade-in">
        ${modeTabsHtml}
        
        <div class="main-grid">
          <div class="glass-panel flex flex-col justify-between" style="min-height: 440px;">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span class="w-2.5 h-6 bg-amber-500 rounded-full inline-block"></span>
                量身高三部曲（許扶堂老師教學法）
              </h2>
              <span id="demo-step-indicator" class="text-slate-500 font-semibold text-sm">${demoStep + 1} / ${totalDemoSteps} 步驟</span>
            </div>
            
            <div id="demo-svg-workspace" class="svg-workspace p-6 border rounded-2xl flex-grow mb-6 relative overflow-visible">
              ${heightMeasureDemoConfig.svg(demoStep)}
            </div>
            
            <div class="flex items-center justify-between gap-4 mt-auto">
              <button id="demo-prev-btn" class="btn btn-outline" onclick="window.prevDemoStep()" ${demoStep === 0 ? 'disabled' : ''}>上一步</button>
              <div id="demo-dots-container" class="flex items-center gap-1 hidden md:flex">${demoDots}</div>
              <div class="flex gap-2">
                <button id="demo-play-btn" class="btn btn-secondary text-sm" onclick="window.toggleDemoAutoPlay()">
                  ${AppState.heightMeasure.demoPlaying ? '⏸️ 暫停' : '▶️ 自動播放'}
                </button>
                <button id="demo-next-btn" class="btn btn-primary" onclick="window.nextDemoStep()" ${demoStep === totalDemoSteps - 1 ? 'disabled' : ''}>下一步</button>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col gap-6">
            <div class="glass-panel">
              <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">步驟核心解說</h3>
              <h2 id="demo-step-title" class="text-xl font-bold text-slate-800 mb-3">${stepInfo.title}</h2>
              <p id="demo-step-desc" class="text-slate-700 text-base leading-relaxed mb-4">${stepInfo.desc}</p>
              <div id="demo-step-subdesc" class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-600 font-medium">
                💡 ${stepInfo.subDesc}
              </div>
            </div>
            
            <div class="glass-panel">
              <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">許扶堂老師 教學口訣</h3>
              <div id="demo-chant-list" class="space-y-2.5 text-sm">
                <div class="p-2.5 rounded-lg border ${demoStep === 1 ? 'bg-amber-50 border-amber-300 font-bold text-amber-900' : 'bg-white border-slate-200 text-slate-600'}">
                  1️⃣ <strong>直尺放腳「底」</strong>：直尺平放底邊，確立基準線
                </div>
                <div class="p-2.5 rounded-lg border ${demoStep === 2 ? 'bg-amber-50 border-amber-300 font-bold text-amber-900' : 'bg-white border-slate-200 text-slate-600'}">
                  2️⃣ <strong>機器(三角板)推出來</strong>：直角邊貼直尺滑行，保證垂直
                </div>
                <div class="p-2.5 rounded-lg border ${demoStep === 3 ? 'bg-amber-50 border-amber-300 font-bold text-amber-900' : 'bg-white border-slate-200 text-slate-600'}">
                  3️⃣ <strong>從腳「底」到頭「頂」</strong>：沿三角板畫垂直高並標註直角
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    const currentDraw = drawShapeConfig[AppState.drawShape] || drawShapeConfig.slanted_para;
    const state = AppState.drawingState;
    
    const shapeToggleHtml = Object.keys(drawShapeConfig).map(key => {
      const isActive = AppState.drawShape === key;
      return `
        <button class="px-4 py-2 rounded-full font-semibold transition-all border text-sm
          ${isActive ? 'bg-slate-700 text-white border-slate-700 shadow-md' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}"
          onclick="window.switchDrawShape('${key}')"
        >
          ${drawShapeConfig[key].name}
        </button>
      `;
    }).join('');

    let helperGuideText = '';
    if (!state.rulerPlaced) {
      helperGuideText = '💡 <strong>作圖提示：</strong>請先點擊右側按鈕的『1. 直尺放腳「底」』，將直尺靠在底邊上。';
    } else if (currentDraw.needExtension && !state.extensionDrawn) {
      helperGuideText = '💡 <strong>作圖提示：</strong>圖形的頂點在底邊的外側，高會落在外面，請點擊右側『2. 畫底邊延長線』。';
    } else if (!state.heightDrawn) {
      helperGuideText = '💡 <strong>作圖提示：</strong>請拖移下方滑桿或微調按鈕，使<strong>紅色預覽線</strong>剛好對齊頂點，再點擊右側的『沿著三角板畫垂直高』。';
    } else {
      helperGuideText = '💡 <strong>作圖提示：</strong>垂直高已畫出！請點擊右側的『送出檢查 🔍』來驗證結果是否正確。';
    }

    return `
      <div class="flex flex-col max-w-5xl mx-auto px-4 fade-in">
        ${modeTabsHtml}
        
        <div class="flex justify-center gap-3 mb-6 flex-wrap">
          ${shapeToggleHtml}
        </div>
        
        <div class="main-grid">
          <div class="glass-panel flex flex-col justify-between" style="min-height: 450px;">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span class="w-2.5 h-6 bg-slate-600 rounded-full inline-block"></span>
                虛擬尺規畫高練習
              </h2>
              <button class="text-sm font-semibold text-slate-500 flex items-center gap-1 hover:text-slate-700" onclick="window.resetDrawingState(); renderContentAreaOnly();">
                🔄 重設畫布
              </button>
            </div>
            
            <div class="mb-4 p-3 rounded-xl border bg-slate-50 border-slate-200 text-xs md:text-sm text-slate-700">
              ${helperGuideText}
            </div>
            
            <div class="svg-workspace p-6 border rounded-2xl flex-grow mb-6 relative overflow-visible">
              <svg id="drawing-svg-container" viewBox="0 0 300 160" class="w-full h-full max-h-64 overflow-visible" xmlns="http://www.w3.org/2000/svg">
                ${currentDraw.svg(state)}
              </svg>
            </div>
            
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200" ${state.setsquarePlaced ? '' : 'style="opacity: 0.5; pointer-events: none;"'}>
              <div class="flex justify-between text-sm font-bold text-slate-600 mb-2">
                <span>📏 滑動與微調三角板：</span>
                <span>位置：X = ${state.setsquareX}</span>
              </div>
              <div class="flex items-center gap-4 mt-2">
                <button class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 rounded-lg font-bold text-xs transition-all" onclick="window.adjustSetsquare(-1)">◀ 往左移</button>
                <input type="range" id="setsquare-slider" min="30" max="230" value="${state.setsquareX}" class="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
                  oninput="window.handleSetsquareSlider(this.value)" />
                <button class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 rounded-lg font-bold text-xs transition-all" onclick="window.adjustSetsquare(1)">往右移 ▶</button>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col gap-6">
            <div class="glass-panel">
              <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">題目要求</h3>
              <h2 class="text-lg font-bold text-slate-800 mb-2">${currentDraw.name}</h2>
              <p class="text-slate-600 text-sm mb-4">${currentDraw.desc}</p>
              
              <div class="space-y-3 mt-4">
                <button class="w-full btn ${state.rulerPlaced ? 'btn-outline' : 'btn-primary'}" onclick="window.placeRuler()" ${state.rulerPlaced ? 'disabled' : ''}>
                  1. 直尺放腳「底」
                </button>
                
                ${currentDraw.needExtension ? `
                  <button class="w-full btn ${state.rulerPlaced && !state.extensionDrawn ? 'btn-primary' : 'btn-outline'}" 
                    onclick="window.drawExtension()" ${state.rulerPlaced && !state.extensionDrawn ? '' : 'disabled'}>
                    2. 畫底邊延長線 (需為虛線)
                  </button>
                  <button class="w-full btn ${state.rulerPlaced && state.extensionDrawn && !state.setsquarePlaced ? 'btn-primary' : 'btn-outline'}" 
                    onclick="window.placeSetsquare()" ${state.rulerPlaced && state.extensionDrawn && !state.setsquarePlaced ? '' : 'disabled'}>
                    3. 機器(三角板)推出來
                  </button>
                  <button class="w-full btn ${state.setsquarePlaced && !state.heightDrawn ? 'btn-primary' : 'btn-outline'}" 
                    onclick="window.drawHeight()" ${state.setsquarePlaced && !state.heightDrawn ? '' : 'disabled'}>
                    4. 沿著三角板畫垂直高
                  </button>
                ` : `
                  <button class="w-full btn ${state.rulerPlaced && !state.setsquarePlaced ? 'btn-primary' : 'btn-outline'}" 
                    onclick="window.placeSetsquare()" ${state.rulerPlaced && !state.setsquarePlaced ? '' : 'disabled'}>
                    2. 機器(三角板)推出來
                  </button>
                  <button class="w-full btn ${state.setsquarePlaced && !state.heightDrawn ? 'btn-primary' : 'btn-outline'}" 
                    onclick="window.drawHeight()" ${state.setsquarePlaced && !state.heightDrawn ? '' : 'disabled'}>
                    3. 沿著三角板畫垂直高
                  </button>
                `}
              </div>
              
              <button class="w-full mt-6 btn btn-accent py-3 shadow-md" onclick="window.checkDrawing()" ${state.heightDrawn ? '' : 'disabled'}>
                送出檢查 🔍
              </button>
            </div>
            
            ${state.feedbackText ? `
              <div class="glass-panel fade-in
                ${state.feedbackType === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 
                  state.feedbackType === 'error' ? 'bg-rose-50 border-rose-300 text-rose-800' : 
                  state.feedbackType === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-300 text-slate-800'}"
                style="border-left-width: 6px;"
              >
                <h3 class="font-bold mb-1 flex items-center gap-1">
                  ${state.feedbackType === 'success' ? '👍 恭喜' : state.feedbackType === 'error' ? '💡 提示' : '⚠️ 提醒'}
                </h3>
                <p class="text-sm font-semibold leading-relaxed">${state.feedbackText}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
}

// 分頁 3：拍照上傳自檢
function renderPhotoSelfCheck() {
  const uploadState = AppState.uploadState;
  const points = uploadState.points || [];
  
  let stepText = '';
  if (points.length === 0) {
    stepText = '📍 <strong>第 1 步：</strong>請在相片上點選底邊的「1. 起點」。';
  } else if (points.length === 1) {
    stepText = '📍 <strong>第 2 步：</strong>請點選底邊與高相交的「2. 垂足 (直角處)」。';
  } else if (points.length === 2) {
    stepText = '📍 <strong>第 3 步：</strong>請點選高的「3. 頂點」。';
  } else {
    stepText = uploadState.checked ? 
      '✨ <strong>垂直度檢核完成！</strong>請查閱下方檢核數據與診斷回饋。' : 
      '📍 <strong>3 個關鍵點已標記完成！</strong>請點擊下方「📐 檢核作圖垂直度」按鈕進行檢核。';
  }

  return `
    <div class="main-grid fade-in max-w-5xl mx-auto px-4">
      <div class="glass-panel flex flex-col" style="min-height: 480px;">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span class="w-2.5 h-6 bg-slate-600 rounded-full inline-block"></span>
            拍照上傳實作自檢
          </h2>
          <div class="flex gap-2">
            ${uploadState.fileUploaded ? `
              <button class="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700" onclick="window.triggerFileInput()">
                🔄 換張照片
              </button>
            ` : `
              <button class="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700" onclick="window.useSamplePhoto()">
                🖼️ 使用範例圖
              </button>
            `}
          </div>
        </div>
        
        <input type="file" id="photo-file-input" accept="image/*" class="hidden" onchange="window.handlePhotoUpload(event)" />
        
        ${!uploadState.fileUploaded ? `
          <div class="upload-box flex-grow flex flex-col items-center justify-center gap-4 py-16 cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl hover:border-slate-400 transition-all bg-white" onclick="window.triggerFileInput()">
            <svg class="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <div class="text-center">
              <span class="text-slate-600 font-bold block text-base mb-1">點擊此處上傳或拍攝紙本作畫照片</span>
              <span class="text-slate-400 text-xs">支援手機拍照或上傳 JPG / PNG 圖檔</span>
            </div>
            <button class="btn btn-secondary text-xs px-4 py-2 mt-2" onclick="event.stopPropagation(); window.useSamplePhoto();">
              快速載入範例照片體驗
            </button>
          </div>
        ` : `
          <div class="mb-4 p-3 rounded-xl border bg-slate-50 border-slate-200 text-xs md:text-sm text-slate-700 flex justify-between items-center">
            <span>${stepText}</span>
            <div class="flex gap-2">
              <button class="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 rounded-lg font-bold text-xs transition-all flex items-center gap-1" onclick="window.undoPoint()" ${points.length === 0 ? 'disabled' : ''}>↩ 復原上一步</button>
              <button class="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold text-xs transition-all flex items-center gap-1" onclick="window.clearPoints()" ${points.length === 0 ? 'disabled' : ''}>🔄 全部重設</button>
            </div>
          </div>

          <div class="photo-workspace w-full flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100/70 p-3 mb-4 select-none overflow-hidden" style="min-height: 320px; max-height: 380px;">
            <div id="photo-canvas-container" class="relative inline-block select-none cursor-crosshair shadow-md rounded-lg overflow-hidden leading-none max-w-full max-h-full" onclick="window.handleWorkspaceClick(event)">
              <img id="photo-img-element" src="${uploadState.imageSrc}" class="block max-h-[340px] max-w-full w-auto h-auto object-contain select-none pointer-events-none" style="pointer-events: none;" alt="Uploaded drawing" />
              
              ${points.length > 0 ? (() => {
                const isPerp = uploadState.checked && uploadState.isPerpendicular;
                const isFailed = uploadState.checked && !uploadState.isPerpendicular;
                const heightColor = isPerp ? '#10B981' : (isFailed ? '#E11D48' : '#7E909A');
                
                return `
                  <svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 25; pointer-events: none;">
                    ${points.length >= 2 ? `
                      <line x1="${points[0].x}%" y1="${points[0].y}%" x2="${points[1].x}%" y2="${points[1].y}%" stroke="#6D8274" stroke-width="4" stroke-linecap="round" />
                      <text x="${(points[0].x + points[1].x)/2}%" y="${(points[0].y + points[1].y)/2 + 14}%" fill="#4B5F69" font-size="11" font-weight="bold" text-anchor="middle" filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))">底邊基準線</text>
                    ` : ''}
                    ${points.length >= 3 ? `
                      <line x1="${points[1].x}%" y1="${points[1].y}%" x2="${points[2].x}%" y2="${points[2].y}%" stroke="${heightColor}" stroke-width="4" stroke-linecap="round" stroke-dasharray="4" />
                      <text x="${(points[1].x + points[2].x)/2}%" y="${(points[1].y + points[2].y)/2 - 6}%" fill="${heightColor}" font-size="11" font-weight="bold" text-anchor="middle" filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))">
                        ${uploadState.checked ? (uploadState.isPerpendicular ? '垂直高 (直角)' : '高 (非直角)') : '所測量之高'}
                      </text>
                      ${uploadState.checked ? `
                        <circle cx="${points[1].x}%" cy="${points[1].y}%" r="14" fill="none" stroke="${heightColor}" stroke-width="1.5" stroke-dasharray="2" />
                        <text x="${points[1].x}%" y="${points[1].y - 8}%" fill="${heightColor}" font-size="12" font-weight="black" text-anchor="middle" filter="drop-shadow(0px 1px 2px rgba(255,255,255,0.9))">${uploadState.measuredAngle.toFixed(1)}°</text>
                      ` : ''}
                    ` : ''}
                  </svg>
                `;
              })() : ''}

              ${points.map((p, idx) => {
                const labels = ['1. 起點', '2. 垂足', '3. 頂點'];
                const colors = ['bg-rose-500', 'bg-sky-500', 'bg-emerald-500'];
                return `
                  <div class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer hover:scale-110 active:scale-95 transition-transform" 
                    style="left: ${p.x}%; top: ${p.y}%; z-index: 30;" 
                    title="點選此處可就地修正（清除此點及後續標記）"
                    onclick="window.deletePointFrom(${idx}); event.stopPropagation();"
                  >
                    <span class="w-6 h-6 rounded-full ${colors[idx]} border-2 border-white shadow-md flex items-center justify-center text-xs text-white font-black">${idx + 1}</span>
                    <span class="px-1.5 py-0.5 bg-slate-800 text-white rounded-md text-[9px] font-bold mt-1 shadow-sm opacity-90">${labels[idx]}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          ${points.length === 3 ? (() => {
            if (!uploadState.checked) {
              return `
                <div class="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl mb-4 flex justify-between items-center shadow-sm">
                  <div>
                    <span class="font-bold text-amber-900 block text-sm">📍 3 個關鍵端點已就緒！</span>
                    <span class="text-xs text-amber-700 font-medium">系統將依您點選的座標精準量測「底邊」與「高」之夾角</span>
                  </div>
                  <button class="btn btn-primary px-5 py-2.5 shadow font-bold text-sm flex items-center gap-1.5" onclick="window.verifyDrawingPerpendicular()">
                    📐 檢核作圖垂直度
                  </button>
                </div>
              `;
            } else {
              return `
                <div class="p-4 rounded-2xl border-2 mb-4 fade-in shadow-sm ${uploadState.isPerpendicular ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}">
                  <div class="flex justify-between items-center mb-2">
                    <h3 class="font-black text-base flex items-center gap-2">
                      <span>${uploadState.isPerpendicular ? '✅' : '⚠️'}</span>
                      <span>${uploadState.isPerpendicular ? '垂直度合格！符合 90° 直角規範' : '垂直度未達標：底邊與高未保持垂直'}</span>
                    </h3>
                    <button class="btn btn-outline text-xs px-3 py-1 bg-white hover:bg-slate-50" onclick="window.verifyDrawingPerpendicular()">
                      🔄 重新量測
                    </button>
                  </div>
                  <div class="text-sm space-y-2">
                    <p>📐 系統量測「底與高夾角」：<strong class="text-base font-black ${uploadState.isPerpendicular ? 'text-emerald-700' : 'text-rose-700'}">${uploadState.measuredAngle.toFixed(1)}°</strong>（與標準直角 90° 偏差 <strong class="${uploadState.isPerpendicular ? 'text-emerald-700' : 'text-rose-700'}">${uploadState.angleDiff.toFixed(1)}°</strong>）。</p>
                    <div class="p-3 bg-white/80 rounded-xl border ${uploadState.isPerpendicular ? 'border-emerald-200 text-emerald-800' : 'border-rose-200 text-rose-800'} text-xs leading-relaxed">
                      ${uploadState.isPerpendicular ? 
                        '✨ <strong>作圖評定：</strong>太棒了！您的直角三角板直角邊緊密貼齊直尺，量出的高與底邊精準垂直！這條高能正確代表幾何圖形的身高。' : 
                        '💡 <strong>作圖評定：</strong>量身高必須呈 90° 垂直！任何歪斜都會讓高線變成「斜線」，量到的長度會比實際高更長，算出的面積會偏大。建議使用直角三角板直角邊貼緊直尺重新作圖，或點擊上方「↩ 復原上一步」微調標註點。'}
                    </div>
                  </div>
                </div>
              `;
            }
          })() : ''}
        `}
      </div>
      
      <div class="flex flex-col gap-6">
        ${uploadState.fileUploaded ? `
          <div class="glass-panel">
            <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">紙本作畫自檢要點對照</h3>
            <p class="text-slate-600 text-sm mb-4">
              請對照左側您所標記的<strong>底邊實線</strong>與<strong>高的虛線</strong>，檢查紙本作畫是否符合以下原則：
            </p>
            
            <div class="space-y-3 text-sm">
              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                <strong class="text-slate-800 block mb-1">1️⃣ 垂直檢核（直尺與三角板密合）</strong>
                您的直角三角板直角邊，是否有緊貼底邊的直尺？如果畫歪了，量到的長度會變長（量成斜邊），導致算出的面積偏大。
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                <strong class="text-slate-800 block mb-1">2️⃣ 頂點檢核（從腳底到頭頂）</strong>
                垂直線段是否有精準通過對面的頂點（三角形）或連接到對面的平行邊（平行四邊形、梯形）？
              </div>

              <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed">
                <strong class="text-slate-800 block mb-1">3️⃣ 外部高與延長線檢核（鈍角三角形等）</strong>
                如果高落在圖形外面，底邊向外延伸的線段必須使用<strong>「虛線」</strong>，避免把原本的底邊變長喔！
              </div>
            </div>

            <div class="mt-6 flex justify-end">
              <button class="btn btn-outline text-xs" onclick="window.switchTab('heightMeasure');">
                📖 前往「為圖形量身高」看正確示範 ➔
              </button>
            </div>
          </div>
        ` : `
          <div class="glass-panel">
            <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">使用步驟指引</h3>
            <ul class="text-slate-600 text-sm space-y-3">
              <li class="flex items-start gap-2">
                <span class="text-slate-500 font-bold">1.</span>
                <span>在紙上畫出幾何圖形的高（用直尺與直角三角板實體作圖）。</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-slate-500 font-bold">2.</span>
                <span>用手機拍下作圖照片並點選上傳，或點擊「快速載入範例照片」體驗。</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-slate-500 font-bold">3.</span>
                <span>依序在相片中點選：<strong>起點</strong> ➔ <strong>垂足</strong> ➔ <strong>頂點</strong>。</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-slate-500 font-bold">4.</span>
                <span>點選<strong>「📐 檢核作圖垂直度」</strong>按鈕，系統將精準量測底與高之夾角，提供客觀診斷！</span>
              </li>
            </ul>
          </div>
        `}
      </div>
    </div>
  `;
}

// 分頁 4：複合圖形的面積 (支援題庫範例切換與底邊對齊格線)
function renderCompositeArea() {
  const comp = AppState.compositeArea;
  const activeMethodKey = comp.activeMethod;
  const methodConfig = compositeAreaConfig[activeMethodKey];
  const problemIdx = comp.problemIndex || 0;
  const currentProb = methodConfig.problems[problemIdx] || methodConfig.problems[0];

  const toggleBtnText = comp.step === 0 ? currentProb.toggleBtnText0 : currentProb.toggleBtnText1;
  const helperTip = currentProb.helperTip;

  const methodTabs = [
    { key: 'split', label: '1. 分割再加總' },
    { key: 'subtract', label: '2. 補完再刪去' },
    { key: 'translate', label: '3. 平移再合併' }
  ];

  const methodTabsHtml = methodTabs.map(tab => {
    const isActive = comp.activeMethod === tab.key;
    return `
      <button class="px-5 py-2.5 rounded-full font-bold text-sm transition-all border
        ${isActive ? 'bg-slate-700 text-white border-slate-700 shadow-md scale-105' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}"
        onclick="window.switchCompositeMethod('${tab.key}')"
      >
        ${tab.label}
      </button>
    `;
  }).join('');

  // 範例切換按鈕組
  const problemTabsHtml = methodConfig.problems.map((prob, idx) => {
    const isProbActive = problemIdx === idx;
    return `
      <button class="px-4 py-2 rounded-xl text-xs font-bold transition-all border
        ${isProbActive ? 'bg-slate-600 text-white border-slate-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}"
        onclick="window.switchCompositeProblem(${idx})"
      >
        ${prob.title}
      </button>
    `;
  }).join('');

  return `
    <div class="flex flex-col max-w-5xl mx-auto px-4 fade-in">
      <div class="flex justify-center gap-3 mb-4 flex-wrap">
        ${methodTabsHtml}
      </div>
      
      <!-- 範例次分頁導覽 -->
      <div class="flex justify-center gap-2 mb-6 flex-wrap">
        ${problemTabsHtml}
      </div>
      
      <div class="main-grid">
        <div class="glass-panel flex flex-col justify-between" style="min-height: 450px;">
          <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <div>
              <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span class="w-2.5 h-6 bg-slate-600 rounded-full inline-block"></span>
                ${methodConfig.name}
              </h2>
              <span class="text-slate-500 text-xs font-semibold">${currentProb.title}</span>
            </div>
            <button class="btn btn-primary text-xs px-4 py-2 font-bold shadow-sm" onclick="window.toggleCompositeStep()">
              ${toggleBtnText}
            </button>
          </div>
          
          <div class="svg-workspace p-6 border rounded-2xl flex-grow mb-6 relative overflow-visible bg-white">
            ${currentProb.svg(comp.step)}
          </div>
          
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            ${helperTip}
          </div>
        </div>
        
        <div class="flex flex-col gap-6">
          <div class="glass-panel">
            <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">心法思考導引</h3>
            <p class="text-slate-700 text-sm leading-relaxed mb-4">${methodConfig.desc}</p>
            
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div class="flex items-center gap-1.5 mb-2.5">
                <span class="w-2 h-4 bg-slate-600 rounded-full inline-block"></span>
                <span class="text-xs font-bold text-slate-800">多元解題想法 (幾何探究)</span>
              </div>
              
              <div class="space-y-2 mb-3 bg-white p-3 rounded-lg border border-slate-200/80">
                <div class="flex items-start gap-2 text-xs">
                  <span class="px-1.5 py-0.5 rounded bg-slate-700 text-white font-bold text-[10px] flex-shrink-0 mt-0.5">想法一</span>
                  <span class="text-slate-700 font-semibold leading-relaxed">${currentProb.idea1 || ''}</span>
                </div>
                ${currentProb.idea2 ? `
                  <div class="flex items-start gap-2 text-xs pt-1.5 border-t border-slate-100">
                    <span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px] flex-shrink-0 mt-0.5">想法二</span>
                    <span class="text-slate-600 font-medium leading-relaxed">${currentProb.idea2}</span>
                  </div>
                ` : ''}
              </div>

              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-amber-500 text-sm">💡</span>
                <span class="text-xs font-bold text-slate-700">幾何提問・自主推導</span>
              </div>
              <ul class="space-y-1.5 text-xs text-slate-700 font-medium">
                ${(currentProb.guidingQuestions || []).map((q, qIdx) => `
                  <li class="flex items-start gap-1.5">
                    <span class="text-slate-400 font-bold mt-0.5">${qIdx + 1}.</span>
                    <span class="leading-relaxed">${q}</span>
                  </li>
                `).join('')}
              </ul></div>
          </div>
          
          <div class="glass-panel">
            <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">動手算算看小挑戰</h3>
            <p class="text-slate-700 text-sm mb-3 font-medium">${currentProb.question}</p>
            
            <div class="flex gap-3 mb-3">
              <input type="number" id="composite-answer-input" placeholder="請輸入答案數字" class="flex-grow px-4 py-2 border rounded-xl border-slate-300 text-slate-800 text-sm font-bold focus:outline-none focus:border-slate-500" />
              <button class="btn btn-primary text-sm px-5" onclick="window.checkCompositeAnswer()">驗證答案</button>
            </div>
            
            ${comp.practiceFeedback ? `
              <div class="p-3 rounded-xl border text-xs font-bold fade-in
                ${comp.practiceFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'}">
                ${comp.practiceFeedback.text}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}



// --- 幾何拆解工作區互動處理 (無劇透・動態引導) ---
function getDisplayFormula(tmpl, parts, partInputs) {
  if (!tmpl) return "";
  partInputs = partInputs || {};
  parts = parts || [];
  let res = tmpl;
  parts.forEach(p => {
    const isVerified = partInputs[p.id] && partInputs[p.id].verified;
    const replacement = isVerified ? ("(" + p.expectedArea + ")") : "(？)";
    res = res.replace("{" + p.id + "}", replacement);
  });
  return res;
}

window.toggleDecompositionPart = function(partId) {
  const decomp = AppState.quiz.decompositionState;
  if (!decomp.activeParts) decomp.activeParts = [];
  const idx = decomp.activeParts.indexOf(partId);
  if (idx > -1) {
    decomp.activeParts.splice(idx, 1);
  } else {
    decomp.activeParts.push(partId);
  }
  renderContentAreaOnly();
};

window.expandAllDecompositionParts = function() {
  const currentQData = AppState.quiz.currentQuestions[AppState.quiz.currentQ];
  if (!currentQData || !currentQData.parts) return;
  AppState.quiz.decompositionState.activeParts = currentQData.parts.map(p => p.id);
  renderContentAreaOnly();
};

window.toggleDecompositionHint = function() {
  AppState.quiz.decompositionState.showHint = !AppState.quiz.decompositionState.showHint;
  renderContentAreaOnly();
};

window.verifyPartCalculation = function(partId) {
  const currentQData = AppState.quiz.currentQuestions[AppState.quiz.currentQ];
  if (!currentQData || !currentQData.parts) return;
  const part = currentQData.parts.find(p => p.id === partId);
  if (!part) return;

  const areaInput = document.getElementById('part-area-' + partId);
  const areaVal = areaInput ? parseFloat(areaInput.value.trim()) : NaN;

  // Read dimensions if present
  const dimInputs = {};
  let allDimsCorrect = true;
  if (part.inputs && part.inputs.length > 0) {
    part.inputs.forEach(inp => {
      const el = document.getElementById('part-dim-' + partId + '-' + inp.key);
      if (el) {
        const v = parseFloat(el.value.trim());
        dimInputs[inp.key] = v;
        if (isNaN(v) || Math.abs(v - inp.expected) > 0.01) {
          allDimsCorrect = false;
        }
      }
    });
  }

  const isAreaCorrect = !isNaN(areaVal) && Math.abs(areaVal - part.expectedArea) <= 0.1;
  const isAllCorrect = isAreaCorrect && allDimsCorrect;

  if (!AppState.quiz.decompositionState.partInputs) {
    AppState.quiz.decompositionState.partInputs = {};
  }

  AppState.quiz.decompositionState.partInputs[partId] = {
    dimInputs: dimInputs,
    areaVal: areaVal,
    verified: isAllCorrect,
    hasChecked: true
  };

  renderContentAreaOnly();
};

window.checkDecompositionFinalAnswer = function() {
  const qState = AppState.quiz;
  const currentQData = qState.currentQuestions[qState.currentQ];
  const inputEl = document.getElementById('decomp-final-answer');
  if (!inputEl) return;
  const userVal = parseFloat(inputEl.value.trim());
  if (isNaN(userVal)) {
    alert('請在輸入框中填寫計算後的數字答案！');
    return;
  }
  qState.hasAnswered = true;
  qState.selectedAnswer = userVal;
  const totalQs = qState.currentQuestions.length;
  const isCorrect = Math.abs(userVal - currentQData.correctAnswer) <= (currentQData.allowedDelta || 0.1);
  if (isCorrect) {
    qState.isCorrect = true;
    qState.showFeedback = true;
    qState.correctCount = (qState.correctCount || 0) + 1;
    qState.score = Math.round((qState.correctCount / totalQs) * 100);
  } else {
    qState.isCorrect = false;
    qState.showFeedback = true;
  }
  renderContentAreaOnly();
};


// 題目解析文字格式化 (自動處理換行與去除 \n 字符)
function formatExplanationHtml(expText) {
  if (!expText) return '';
  const lines = String(expText).replace(/\\n/g, '\n').split('\n');
  return lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<div class="py-0.5 leading-relaxed">${line}</div>`)
    .join('');
}
window.formatExplanationHtml = formatExplanationHtml;

// 分頁 5：小試身手挑戰 (分級題庫)
function renderChallenge() {
  const qState = AppState.quiz;
  const currentLvl = qState.currentLevel;
  const totalQs = qState.currentQuestions.length;
  
  if (totalQs === 0) {
    return `
      <div class="glass-panel text-center py-16 max-w-xl mx-auto fade-in">
        <h2 class="text-2xl font-bold mb-4 text-slate-800">載入測驗題目中...</h2>
        <button class="btn btn-primary" onclick="window.switchQuizLevel('basic')">開始基礎題練習</button>
      </div>
    `;
  }

  // 難度分級標籤列
  const levelTabsHtml = `
    <div class="flex justify-center gap-3 mb-6">
      <button onclick="window.switchQuizLevel('basic')" class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all border ${currentLvl === 'basic' ? 'bg-slate-700 text-white border-slate-700 shadow' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}">
        基礎題
      </button>
      <button onclick="window.switchQuizLevel('intermediate')" class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all border ${currentLvl === 'intermediate' ? 'bg-slate-700 text-white border-slate-700 shadow' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}">
        進階題
      </button>
      <button onclick="window.switchQuizLevel('advanced')" class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all border ${currentLvl === 'advanced' ? 'bg-slate-700 text-white border-slate-700 shadow' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}">
        挑戰題
      </button>
    </div>
  `;

  // 測驗結束畫面
  if (qState.isFinished) {
    const isPass = qState.score >= 75;
    return `
      <div class="fade-in">
        ${levelTabsHtml}
        <div class="glass-panel text-center py-12 max-w-xl mx-auto shadow-xl border border-slate-300">
          <div class="w-20 h-20 ${isPass ? 'bg-emerald-100' : 'bg-amber-100'} rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
            ${isPass ? '🏆' : '💪'}
          </div>
          <h2 class="text-3xl font-black text-slate-800 mb-2">挑戰完成！</h2>
          <p class="text-slate-500 font-semibold mb-6">
            ${isPass ? '太厲害了！你對這個單元的概念非常清晰精熟！' : '很棒的嘗試！可複習公式推導或複合圖形拆解，再回來挑戰一次！'}
          </p>
          
          <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 max-w-xs mx-auto">
            <span class="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">測驗總分</span>
            <span class="text-5xl font-black text-slate-800">${qState.score}</span>
            <span class="text-slate-500 font-bold text-sm block mt-2">滿分 100 分（答對 ${qState.correctCount} / ${totalQs} 題）</span>
          </div>
          
          <div class="flex gap-4 justify-center flex-wrap">
            <button class="btn btn-outline" onclick="window.resetChallenge()">🔄 再做一次本級題目</button>
            <button class="btn btn-primary" onclick="window.switchQuizLevel('${currentLvl === 'basic' ? 'intermediate' : currentLvl === 'intermediate' ? 'advanced' : 'basic'}')">
              ${currentLvl === 'basic' ? '前往進階題 ➔' : currentLvl === 'intermediate' ? '前往挑戰題 ➔' : '回到基礎題 ➔'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const currentQData = qState.currentQuestions[qState.currentQ];

  // 題目圖片或向量圖展示
  let mediaDisplayHtml = '';
  if (currentQData.image) {
    mediaDisplayHtml = `
      <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4 flex justify-center items-center overflow-hidden">
        <img src="${window.getPadletImageSrc(currentQData.image)}" alt="${currentQData.title}" class="max-h-72 w-auto max-w-full object-contain mx-auto rounded-lg" />
      </div>
    `;
  } else if (currentQData.diagram) {
    mediaDisplayHtml = `
      <div class="svg-workspace p-3 border rounded-xl bg-white mb-4">
        ${currentQData.diagram}
      </div>
    `;
  }

  // 判斷是否為「高階幾何拆解應用題」
  if (currentQData.isDecomposition || currentLvl === 'advanced') {
    const decompState = qState.decompositionState || { activeParts: [], partInputs: {}, showHint: false };
    const activeParts = decompState.activeParts || [];
    const partInputs = decompState.partInputs || {};
    const partsList = currentQData.parts || [];

    // 步驟 1：拆解圖形選擇按鈕
    const shapeSelectorButtons = partsList.map(part => {
      const isActive = activeParts.includes(part.id);
      return `
        <button onclick="window.toggleDecompositionPart('${part.id}')" 
          class="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 
          ${isActive ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}">
          <span>${isActive ? '✓' : '+'}</span>
          <span>${part.name}</span>
        </button>
      `;
    }).join('');

    // 步驟 2：各部分面積計算卡片 (無劇透！由學生自行輸入尺寸與計算)
    let partCardsHtml = '';
    if (activeParts.length === 0) {
      partCardsHtml = `
        <div class="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 font-medium">
          💡 點擊上方按鈕開始幾何拆解，或直接在步驟 3 進行組合計算。
        </div>
      `;
    } else {
      partCardsHtml = activeParts.map(partId => {
        const part = partsList.find(p => p.id === partId);
        if (!part) return '';
        const inputState = partInputs[partId] || {};
        const isVerified = inputState.verified;

        // 尺寸輸入欄位
        const dimsHtml = (part.inputs || []).map(inp => {
          const curVal = inputState.dimInputs && inputState.dimInputs[inp.key] !== undefined ? inputState.dimInputs[inp.key] : '';
          return `
            <label class="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
              <span>${inp.label}：</span>
              <input type="number" id="part-dim-${part.id}-${inp.key}" step="any" placeholder="填寫"
                value="${curVal}"
                ${qState.hasAnswered || isVerified ? 'disabled' : ''}
                class="w-14 px-1.5 py-0.5 border rounded bg-white text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-slate-500" />
            </label>
          `;
        }).join('');

        return `
          <div class="p-3.5 rounded-xl border border-slate-200 bg-white/90 shadow-sm mb-3 fade-in">
            <div class="flex justify-between items-center mb-1.5">
              <span class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                ${part.name}
              </span>
              <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                ${part.formula}
              </span>
            </div>

            <!-- 尺寸填寫區 -->
            <div class="flex flex-wrap gap-2 mb-2.5 items-center">
              ${dimsHtml}
            </div>

            <!-- 分塊計算與確認按鈕 -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-slate-600">分塊計算 ＝</span>
              <input type="number" id="part-area-${part.id}" step="any" placeholder="計算數值" 
                value="${inputState.areaVal !== undefined ? inputState.areaVal : ''}"
                ${qState.hasAnswered || isVerified ? 'disabled' : ''}
                class="w-24 px-3 py-1 border rounded-lg border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-500 ${isVerified ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white'}" />
              
              <button onclick="window.verifyPartCalculation('${part.id}')" 
                ${qState.hasAnswered || isVerified ? 'disabled' : ''}
                class="px-3 py-1 rounded-lg text-xs font-bold transition-all border 
                ${isVerified ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-700 text-white border-slate-700 hover:bg-slate-800'}">
                ${isVerified ? '✓ 正確' : '驗證分塊'}
              </button>
            </div>

            ${inputState.hasChecked ? (
              isVerified ? `
                <div class="text-[11px] font-bold text-emerald-600 mt-1.5 fade-in">
                  ✓ 分塊數據計算完全正確！已自動帶入步驟 3 算式中。
                </div>
              ` : `
                <div class="text-[11px] font-bold text-rose-600 mt-1.5 fade-in">
                  ⚠️ 尺寸或計算結果有誤，請再觀察圖形數據重試喔！
                </div>
              `
            ) : ''}
          </div>
        `;
      }).join('');
    }

    // 步驟 3：組合計算目標面積 (完全無劇透！未計算的部分一律以 (？) 呈現)
    const displayCombineFormula = getDisplayFormula(currentQData.combineTemplate, currentQData.parts, partInputs);

    // 提示與解析回饋區
    let feedbackHtml = '';
    if (qState.showFeedback) {
      if (qState.isCorrect) {
        feedbackHtml = `
          <div class="glass-panel bg-emerald-50 border-emerald-300 text-emerald-800 fade-in mt-4" style="border-left-width: 6px;">
            <h4 class="font-bold text-sm mb-1">🎉 答對了！幾何拆解非常精準！</h4>
            <div class="text-xs font-semibold leading-relaxed">${formatExplanationHtml(currentQData.explanation)}</div>
          </div>
        `;
      } else {
        feedbackHtml = `
          <div class="glass-panel bg-rose-50 border-rose-300 text-rose-800 fade-in mt-4" style="border-left-width: 6px;">
            <h4 class="font-bold text-sm mb-1">💡 解題思考引導</h4>
            <p class="text-xs font-semibold leading-relaxed mb-2">${currentQData.hint}</p>
            <div class="text-xs font-normal leading-relaxed text-rose-700 whitespace-pre-line bg-white/70 p-2.5 rounded-lg border border-rose-200">
              <strong class="block mb-1">詳細計算步驟：</strong>${formatExplanationHtml(currentQData.explanation)}
            </div>
          </div>
        `;
      }
    }

    // 下一步按鈕
    const nextBtnHtml = qState.hasAnswered ? `
      <div class="mt-5 flex justify-end">
        <button class="btn btn-primary py-3 px-6 shadow-md" onclick="window.nextQuizQuestion()">
          ${qState.currentQ === totalQs - 1 ? '完成挑戰 查看總分 🏁' : '下一題 ➔'}
        </button>
      </div>
    ` : '';

    return `
      <div class="fade-in">
        ${levelTabsHtml}
        
        <div class="main-grid" style="grid-template-columns: 1.1fr 1fr; gap: 24px;">
          <!-- 左側：真題情境與題目圖片 -->
          <div class="glass-panel flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-3">
                <span class="px-3 py-1 rounded-full font-bold text-xs bg-slate-200 text-slate-700">
                  ${currentQData.title}
                </span>
                <span class="text-slate-500 font-semibold text-sm">第 ${qState.currentQ + 1} / ${totalQs} 題</span>
              </div>
              
              <h2 class="text-base font-bold text-slate-800 mb-3 leading-relaxed">${currentQData.question}</h2>
              
              ${mediaDisplayHtml}
            </div>
            
            <div class="mt-2">
              <button onclick="window.toggleDecompositionHint()" class="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 transition-colors">
                <span>💡</span>
                <span>${decompState.showHint ? '收合解題思維引導' : '查看解題思維引導'}</span>
              </button>
              ${decompState.showHint ? `
                <div class="bg-amber-50/90 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-medium mt-2 fade-in leading-relaxed">
                  ${currentQData.hint}
                </div>
              ` : ''}
            </div>
          </div>
          
          <!-- 右側：幾何拆解與應用計算工作區 -->
          <div class="glass-panel flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-3 border-b border-slate-200/80 pb-2">
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📐</span> 幾何拆解與應用計算區
                </h3>
                <button onclick="window.expandAllDecompositionParts()" class="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline">
                  一鍵展開全部拆解
                </button>
              </div>

              <!-- 步驟 1：選擇拆解圖形 -->
              <div class="mb-4">
                <div class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">1</span>
                  選擇你想拆解出的圖形：
                </div>
                <div class="flex flex-wrap gap-2">
                  ${shapeSelectorButtons}
                </div>
              </div>

              <!-- 步驟 2：填入數據計算分塊面積 (無劇透) -->
              <div class="mb-4">
                <div class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">2</span>
                  填入數據計算各部分面積：
                </div>
                <div>
                  ${partCardsHtml}
                </div>
              </div>

              <!-- 步驟 3：組合計算目標面積 (動態帶入已算出的數據，未算出的維持 (？)) -->
              <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/90 shadow-inner">
                <div class="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span class="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-black">3</span>
                  組合計算目標面積：
                </div>
                <div class="text-[11px] font-bold text-slate-600 mb-3 bg-white px-3 py-2 rounded-lg border border-slate-200 leading-relaxed">
                  ${displayCombineFormula}
                </div>
                
                <div class="flex items-center gap-2">
                  <input type="number" id="decomp-final-answer" step="any" placeholder="請輸入答案數字" 
                    value="${qState.selectedAnswer !== null ? qState.selectedAnswer : ''}"
                    ${qState.hasAnswered ? 'disabled' : ''}
                    class="flex-grow px-4 py-2 border rounded-xl border-slate-300 text-slate-800 text-sm font-black focus:outline-none focus:border-slate-500 bg-white" />
                  <span class="text-xs font-bold text-slate-600 whitespace-nowrap">${currentQData.targetUnit || '平方公分'}</span>
                  <button class="btn btn-primary text-xs px-5 py-2 whitespace-nowrap shadow" 
                    ${qState.hasAnswered ? 'disabled' : ''}
                    onclick="window.checkDecompositionFinalAnswer()">
                    驗證答案
                  </button>
                </div>
              </div>
            </div>

            <div>
              ${feedbackHtml}
              ${nextBtnHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 基礎級與進階級：標準多選概念檢核題型 ---
  const optionsHtml = currentQData.options.map((opt, i) => {
    let btnClass = '';
    const isSelected = qState.selectedAnswer === i;
    const isCorrectAns = i === currentQData.answerIndex;
    
    if (qState.hasAnswered) {
      if (isCorrectAns) {
        btnClass = 'correct';
      } else if (isSelected) {
        btnClass = 'wrong';
      } else {
        btnClass = 'opacity-50';
      }
    } else {
      if (isSelected) {
        btnClass = 'selected';
      }
    }
    
    return `
      <button onclick="window.handleQuizAnswer(${i})" ${qState.hasAnswered ? 'disabled' : ''} 
        class="option-btn ${btnClass}"
      >
        ${opt}
      </button>
    `;
  }).join('');

  // 提示與解析回饋區
  let feedbackHtml = '';
  if (qState.showFeedback) {
    if (qState.isCorrect) {
      feedbackHtml = `
        <div class="glass-panel bg-emerald-50 border-emerald-300 text-emerald-800 fade-in mt-6" style="border-left-width: 6px;">
          <h4 class="font-bold text-sm mb-1">🎉 答對了！</h4>
          <div class="text-xs font-semibold leading-relaxed">${formatExplanationHtml(currentQData.explanation)}</div>
        </div>
      `;
    } else {
      feedbackHtml = `
        <div class="glass-panel bg-rose-50 border-rose-300 text-rose-800 fade-in mt-6" style="border-left-width: 6px;">
          <h4 class="font-bold text-sm mb-1">💡 觀念解析</h4>
          <div class="text-xs font-semibold leading-relaxed mb-2">${formatExplanationHtml(currentQData.explanation)}</div>
          <div class="bg-white/70 p-2.5 rounded-lg border border-rose-200 text-xs text-rose-700">
            <strong>解題思考引導：</strong>${currentQData.hint}
          </div>
        </div>
      `;
    }
  }

  // 下一步按鈕
  const nextBtnHtml = qState.hasAnswered ? `
    <div class="mt-6 flex justify-end">
      <button class="btn btn-primary py-3 px-6 shadow-md" onclick="window.nextQuizQuestion()">
        ${qState.currentQ === totalQs - 1 ? '完成挑戰 查看總分 🏁' : '下一題 ➔'}
      </button>
    </div>
  ` : '';

  return `
    <div class="fade-in">
      ${levelTabsHtml}
      
      <div class="main-grid">
        <div class="glass-panel flex flex-col justify-between" style="min-height: 400px;">
          <div class="flex justify-between items-center mb-4">
            <span class="px-3 py-1 rounded-full font-bold text-xs bg-slate-200 text-slate-700">
              ${currentQData.title || (currentLvl === 'basic' ? '基礎題' : currentLvl === 'intermediate' ? '進階題' : '挑戰題')}
            </span>
            <span class="text-slate-500 font-semibold text-sm">第 ${qState.currentQ + 1} / ${totalQs} 題</span>
          </div>
          
          <div class="flex-grow flex flex-col justify-center">
            <h2 class="text-lg font-bold text-slate-800 mb-4 leading-relaxed">${currentQData.question}</h2>
            ${mediaDisplayHtml}
          </div>
        </div>
        
        <div class="flex flex-col justify-between">
          <div class="glass-panel">
            <h3 class="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">請選擇您的答案</h3>
            <div class="options-grid">
              ${optionsHtml}
            </div>
            
            ${feedbackHtml}
            ${nextBtnHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

// 核心重繪函數
window.renderContentAreaOnly = function() {
  const contentEl = document.getElementById('content-area');
  if (!contentEl) return;
  
  if (AppState.activeTab === 'learn') {
    contentEl.innerHTML = renderLearn();
  } else if (AppState.activeTab === 'heightMeasure') {
    contentEl.innerHTML = renderHeightMeasure();
  } else if (AppState.activeTab === 'photoSelfCheck') {
    contentEl.innerHTML = renderPhotoSelfCheck();
    bindOverlayDragEvents();
  } else if (AppState.activeTab === 'compositeArea') {
    contentEl.innerHTML = renderCompositeArea();
  } else if (AppState.activeTab === 'challenge') {
    contentEl.innerHTML = renderChallenge();
  }
};

window.renderMain = function() {
  const appEl = document.getElementById('app');
  if (!appEl) return;
  
  let html = renderHeader();
  html += '<main class="max-w-6xl mx-auto px-4 mt-6">';
  
  // 僅在「公式探索」顯示形狀切換選單
  if (AppState.activeTab === 'learn') {
    html += renderSubMenu();
  }
  
  html += '<div id="content-area" class="mt-6">';
  
  if (AppState.activeTab === 'learn') {
    html += renderLearn();
  } else if (AppState.activeTab === 'heightMeasure') {
    html += renderHeightMeasure();
  } else if (AppState.activeTab === 'photoSelfCheck') {
    html += renderPhotoSelfCheck();
  } else if (AppState.activeTab === 'compositeArea') {
    html += renderCompositeArea();
  } else if (AppState.activeTab === 'challenge') {
    html += renderChallenge();
  }
  
  html += '</div></main>';
  
  // 加入首頁謝誌 Footer
  html += `
    <footer class="site-footer">
      <p>© 幾何圖形面積學院 —— 幫助學生從實作中發明面積公式</p>
      <div class="site-credits">
        「量身高」教學靈感來源：許扶堂 老師 ／ 網頁與自學提示設計：謝千慧 老師
      </div>
    </footer>
  `;
  
  appEl.innerHTML = html;
  
  // 為拍照自檢模式綁定拖拽事件
  bindOverlayDragEvents();
};

// 拖拽工具綁定
function bindOverlayDragEvents() {
  // 當 DOM 渲染完畢後，綁定拖曳邏輯
  setTimeout(() => {
    const ruler = document.getElementById('interactive-ruler');
    const setsquare = document.getElementById('interactive-setsquare');
    
    if (ruler) setupDrag(ruler);
    if (setsquare) setupDrag(setsquare);
  }, 100);
}

function setupDrag(el) {
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  
  el.style.cursor = 'move';
  el.addEventListener('mousedown', dragStart);
  el.addEventListener('touchstart', dragStart, { passive: false });

  function dragStart(e) {
    if (e.type === 'touchstart') {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    } else {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
    }
    
    // Get current bounding positions relative to parent container
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement.getBoundingClientRect();
    
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    
    el.style.left = initialLeft + 'px';
    el.style.top = initialTop + 'px';
    
    if (e.type === 'touchstart') {
      document.addEventListener('touchmove', dragMove, { passive: false });
      document.addEventListener('touchend', dragEnd);
    } else {
      document.addEventListener('mousemove', dragMove);
      document.addEventListener('mouseup', dragEnd);
    }
  }

  function dragMove(e) {
    let clientX, clientY;
    if (e.type === 'touchmove') {
      e.preventDefault(); // Prevent page scroll while dragging tools
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    el.style.left = (initialLeft + dx) + 'px';
    el.style.top = (initialTop + dy) + 'px';
  }

  function dragEnd(e) {
    if (e.type === 'touchend') {
      document.removeEventListener('touchmove', dragMove);
      document.removeEventListener('touchend', dragEnd);
    } else {
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragEnd);
    }
    
    // Save position back to AppState
    if (el.id === 'interactive-ruler') {
      AppState.uploadState.rulerLeft = el.style.left;
      AppState.uploadState.rulerTop = el.style.top;
    } else if (el.id === 'interactive-setsquare') {
      AppState.uploadState.setsquareLeft = el.style.left;
      AppState.uploadState.setsquareTop = el.style.top;
    }
  }
}

// 啟動加載
window.onload = function() {
  window.switchTab('learn');
};
