'use strict';

/**
 * 骑马钉（saddle-stitch）拼版核心逻辑。
 *
 * 模型约定：
 * - 每张纸横向放置，物理上分为 A、B 两个半张。正面观察时 A 在左、B 在右。
 * - 一个帖（signature）由 S 张纸套叠而成，含 4S 个页位；第 1 张在最外层。
 * - 页码分配（左装订，帖内页位序号 1..P，P = 4S，第 i 张 i=1..S）：
 *     正面: A = P-2(i-1)（大页码）, B = 2i-1（小页码）
 *     背面: A 的背面 = P-(2i-1),       B 的背面 = 2i
 *   即小页码背面紧跟其后（1 的背面是 2），大页码背面是其前一号（4 的背面是 3）。
 * - 右装订为左装订的镜像：A、B 两半张页码对调。
 *
 * 背面观察坐标变换（纸张为横向，长边为上/下水平边，短边为左/右垂直边）：
 * - 长边翻转（绕水平长边翻纸）：左右位置不变，内容上下颠倒 → 视图左=A.back、右=B.back，均旋转 180°。
 * - 短边翻转（绕垂直短边翻纸）：左右位置互换，内容保持正立 → 视图左=B.back、右=A.back，不旋转。
 */

const BINDINGS = ['left', 'right'];
const FLIPS = ['long', 'short'];

function validateInput({ pages, sheetsPerSignature, binding, flip }) {
  const errors = [];
  if (!Number.isInteger(pages) || pages < 1) {
    errors.push('成品页数 pages 必须为 ≥1 的整数');
  }
  if (!Number.isInteger(sheetsPerSignature) || sheetsPerSignature < 1) {
    errors.push('每帖张数 sheetsPerSignature 必须为 ≥1 的整数');
  }
  if (!BINDINGS.includes(binding)) {
    errors.push(`装订方向 binding 必须为 ${BINDINGS.join(' 或 ')}`);
  }
  if (!FLIPS.includes(flip)) {
    errors.push(`翻转方式 flip 必须为 ${FLIPS.join(' 或 ')}`);
  }
  return errors;
}

/** 帖内页位序号 → 实际页码信息（超出成品页数即为补空白页） */
function makeSlot(base, ordinal, pages) {
  const page = base + ordinal;
  const blank = page > pages;
  return { page: blank ? null : page, blank };
}

function imposeSheet(base, pagesPerSig, sheetIndex, binding, flip, pages) {
  const i = sheetIndex; // 1..S，1 为最外层
  const low1 = 2 * i - 1;              // 小页码（正面）
  const high1 = pagesPerSig - 2 * (i - 1); // 大页码（正面）
  const low2 = 2 * i;                  // 小页码的背面
  const high2 = pagesPerSig - (2 * i - 1); // 大页码的背面

  // 物理半张 A（正面视角左）与 B（正面视角右）各自的正/背面页位序号
  let halfA;
  let halfB;
  if (binding === 'left') {
    halfA = { front: high1, back: high2 };
    halfB = { front: low1, back: low2 };
  } else {
    halfA = { front: low1, back: low2 };
    halfB = { front: high1, back: high2 };
  }

  const front = {
    left: makeSlot(base, halfA.front, pages),
    right: makeSlot(base, halfB.front, pages),
  };

  // 背面视图：按翻转方式做坐标变换
  let back;
  let backRotated;
  if (flip === 'long') {
    // 长边翻转：左右不变，内容旋转 180°
    back = {
      left: makeSlot(base, halfA.back, pages),
      right: makeSlot(base, halfB.back, pages),
    };
    backRotated = true;
  } else {
    // 短边翻转：左右镜像，内容正立
    back = {
      left: makeSlot(base, halfB.back, pages),
      right: makeSlot(base, halfA.back, pages),
    };
    backRotated = false;
  }

  return {
    index: i,
    front,
    back,
    backRotated,
    flipAxis: flip === 'long' ? 'horizontal' : 'vertical',
  };
}

/**
 * 生成完整拼版方案。
 * @param {object} opts
 * @param {number} opts.pages 成品页数
 * @param {number} opts.sheetsPerSignature 每帖张数
 * @param {'left'|'right'} opts.binding 装订方向
 * @param {'long'|'short'} opts.flip 双面翻转方式
 */
function impose(opts) {
  const errors = validateInput(opts);
  if (errors.length > 0) {
    const err = new Error(errors.join('；'));
    err.statusCode = 400;
    throw err;
  }

  const { pages, sheetsPerSignature, binding, flip } = opts;
  const pagesPerSignature = sheetsPerSignature * 4;
  const signatureCount = Math.ceil(pages / pagesPerSignature);
  const paddedPages = signatureCount * pagesPerSignature;

  const signatures = [];
  for (let s = 0; s < signatureCount; s++) {
    const base = s * pagesPerSignature;
    const sheets = [];
    for (let i = 1; i <= sheetsPerSignature; i++) {
      sheets.push(imposeSheet(base, pagesPerSignature, i, binding, flip, pages));
    }
    signatures.push({
      index: s + 1,
      pageStart: base + 1,
      pageEnd: Math.min(base + pagesPerSignature, pages),
      sheets,
    });
  }

  return {
    input: { pages, sheetsPerSignature, binding, flip },
    pagesPerSignature,
    signatureCount,
    paddedPages,
    blankPages: paddedPages - pages,
    signatures,
  };
}

module.exports = { impose, validateInput, BINDINGS, FLIPS };
