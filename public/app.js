'use strict';

const els = {
  pages: document.getElementById('pages'),
  sheets: document.getElementById('sheets'),
  binding: document.getElementById('binding'),
  flip: document.getElementById('flip'),
  generate: document.getElementById('generate'),
  exportBtn: document.getElementById('export'),
  summary: document.getElementById('summary'),
  error: document.getElementById('error'),
  list: document.getElementById('canvas-list'),
};

let lastPlan = null;

const PANEL_W = 400;
const PANEL_H = 300;
const PANEL_GAP = 48;
const PAD = 24;
const TITLE_H = 34;

function slotLabel(slot) {
  return slot.blank ? '空白' : String(slot.page);
}

/** 绘制一个页位单元格；rotated 为 true 时内容旋转 180°（长边翻转的背面） */
function drawCell(ctx, x, y, w, h, slot, rotated) {
  ctx.save();
  ctx.strokeStyle = '#c8d0da';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.translate(x + w / 2, y + h / 2);
  if (rotated) {
    ctx.rotate(Math.PI);
  }

  if (slot.blank) {
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
    ctx.fillStyle = '#8b949e';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('空白', 0, 0);
  } else {
    ctx.fillStyle = '#2f3b4c';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slotLabel(slot), 0, -6);
    // 页向标记：指向页面顶部的箭头，便于确认翻转后的朝向
    ctx.fillStyle = '#9aa4b2';
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 10);
    ctx.lineTo(-6, -h / 2 + 22);
    ctx.lineTo(6, -h / 2 + 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 绘制一张纸的一个面（正面或背面视图） */
function drawPanel(ctx, ox, oy, title, left, right, opts) {
  const { rotated = false, axis = null, axisLabel = '' } = opts;

  ctx.fillStyle = '#444c56';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, ox + PANEL_W / 2, oy + 20);

  const sx = ox + PAD;
  const sy = oy + TITLE_H;
  const sw = PANEL_W - PAD * 2;
  const sh = PANEL_H - TITLE_H - PAD;

  // 纸面
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = '#2f3b4c';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, sw, sh);

  // 左右页位
  const cellW = sw / 2;
  drawCell(ctx, sx, sy, cellW, sh, left, rotated);
  drawCell(ctx, sx + cellW, sy, cellW, sh, right, rotated);

  // 折页中线（订口）
  ctx.save();
  ctx.strokeStyle = '#b6bfc9';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx + cellW, sy);
  ctx.lineTo(sx + cellW, sy + sh);
  ctx.stroke();
  ctx.restore();

  // 翻转轴示意
  if (axis) {
    ctx.save();
    ctx.strokeStyle = '#cf6a12';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    if (axis === 'horizontal') {
      ctx.moveTo(sx - 12, sy + sh / 2);
      ctx.lineTo(sx + sw + 12, sy + sh / 2);
    } else {
      ctx.moveTo(sx + sw / 2, sy - 8);
      ctx.lineTo(sx + sw / 2, sy + sh + 8);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#cf6a12';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(axisLabel, sx + sw / 2, sy + sh + 20);
    ctx.restore();
  }
}

function renderSheet(sigIndex, sheet, plan) {
  const card = document.createElement('div');
  card.className = 'sheet-card';

  const h3 = document.createElement('h3');
  h3.textContent = `第 ${sigIndex} 帖 · 第 ${sheet.index} 张（共 ${plan.input.sheetsPerSignature} 张）`;
  card.appendChild(h3);

  const width = PANEL_W * 2 + PANEL_GAP;
  const height = PANEL_H + 30;
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const bindingName = plan.input.binding === 'left' ? '左装订' : '右装订';
  const flipName = plan.input.flip === 'long' ? '长边翻转' : '短边翻转';

  drawPanel(
    ctx, 0, 0,
    `正面（${bindingName}）`,
    sheet.front.left, sheet.front.right,
    {}
  );
  drawPanel(
    ctx, PANEL_W + PANEL_GAP, 0,
    `背面（${flipName}${sheet.backRotated ? '·页向旋转180°' : '·页向正立'}）`,
    sheet.back.left, sheet.back.right,
    {
      rotated: sheet.backRotated,
      axis: sheet.flipAxis,
      axisLabel: sheet.flipAxis === 'horizontal' ? '⟲ 长边翻转轴' : '⟲ 短边翻转轴',
    }
  );

  card.appendChild(canvas);
  return card;
}

async function generate() {
  els.error.hidden = true;
  els.list.innerHTML = '';
  els.summary.textContent = '';
  els.exportBtn.disabled = true;
  lastPlan = null;

  const params = new URLSearchParams({
    pages: els.pages.value,
    sheets: els.sheets.value,
    binding: els.binding.value,
    flip: els.flip.value,
  });

  let plan;
  try {
    const res = await fetch(`/api/impose?${params}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '生成失败');
    }
    plan = data;
  } catch (err) {
    els.error.textContent = err.message;
    els.error.hidden = false;
    return;
  }

  lastPlan = plan;
  els.summary.textContent =
    `成品 ${plan.input.pages} 页 · 每帖 ${plan.input.sheetsPerSignature} 张（${plan.pagesPerSignature} 页/帖）· ` +
    `共 ${plan.signatureCount} 帖 · 补齐至 ${plan.paddedPages} 页（补空白 ${plan.blankPages} 页）`;

  for (const sig of plan.signatures) {
    for (const sheet of sig.sheets) {
      els.list.appendChild(renderSheet(sig.index, sheet, plan));
    }
  }

  els.exportBtn.disabled = false;
}

function exportJson() {
  if (!lastPlan) return;
  const blob = new Blob([JSON.stringify(lastPlan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'imposition-plan.json';
  a.click();
  URL.revokeObjectURL(url);
}

els.generate.addEventListener('click', generate);
els.exportBtn.addEventListener('click', exportJson);

generate();
