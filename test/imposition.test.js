'use strict';

const assert = require('assert');
const { impose } = require('../lib/imposition');

/** 从拼版方案还原每张纸的物理半张（A=正面视角左，B=正面视角右） */
function physicalHalves(sheet, flip) {
  const frontA = sheet.front.left;
  const frontB = sheet.front.right;
  let backA;
  let backB;
  if (flip === 'long') {
    // 长边翻转：视图左右与物理左右一致
    backA = sheet.back.left;
    backB = sheet.back.right;
  } else {
    // 短边翻转：视图左右相对物理左右镜像
    backA = sheet.back.right;
    backB = sheet.back.left;
  }
  return { frontA, frontB, backA, backB };
}

/**
 * 模拟裁切折叠后的阅读顺序。
 * 左装订：先依次翻各张的 B 半（正面→背面），再逆序翻各张的 A 半（背面→正面）；
 * 右装订为镜像：先 A 半后 B 半。
 */
function readingOrder(signature, flip, binding) {
  const halves = signature.sheets.map((s) => physicalHalves(s, flip));
  const order = [];
  if (binding === 'left') {
    for (const h of halves) order.push(h.frontB, h.backB);
    for (const h of [...halves].reverse()) order.push(h.backA, h.frontA);
  } else {
    for (const h of halves) order.push(h.frontA, h.backA);
    for (const h of [...halves].reverse()) order.push(h.backB, h.frontB);
  }
  return order;
}

function checkReadingOrder(plan) {
  for (const sig of plan.signatures) {
    const order = readingOrder(sig, plan.input.flip, plan.input.binding);
    const base = (sig.index - 1) * plan.pagesPerSignature;
    order.forEach((slot, idx) => {
      const expected = base + idx + 1;
      if (expected <= plan.input.pages) {
        assert.strictEqual(slot.page, expected,
          `第${sig.index}帖阅读顺序第${idx + 1}位应为第${expected}页，实际为${slot.page}`);
        assert.strictEqual(slot.blank, false);
      } else {
        assert.strictEqual(slot.blank, true,
          `第${sig.index}帖阅读顺序第${idx + 1}位应为补空白页`);
        assert.strictEqual(slot.page, null);
      }
    });
  }
}

// 1. 经典单张 4 页：正面 4|1，短边翻转背面视图 2|3，长边翻转背面视图 3|2 且旋转
{
  const short = impose({ pages: 4, sheetsPerSignature: 1, binding: 'left', flip: 'short' });
  const sheet = short.signatures[0].sheets[0];
  assert.deepStrictEqual(
    [sheet.front.left.page, sheet.front.right.page], [4, 1]);
  assert.deepStrictEqual(
    [sheet.back.left.page, sheet.back.right.page], [2, 3]);
  assert.strictEqual(sheet.backRotated, false);

  const long = impose({ pages: 4, sheetsPerSignature: 1, binding: 'left', flip: 'long' });
  const sheetL = long.signatures[0].sheets[0];
  assert.deepStrictEqual(
    [sheetL.back.left.page, sheetL.back.right.page], [3, 2]);
  assert.strictEqual(sheetL.backRotated, true);
}

// 2. 两张 8 页：外张 8|1 / 2|7，内张 6|3 / 4|5（短边翻转视图）
{
  const plan = impose({ pages: 8, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  const [s1, s2] = plan.signatures[0].sheets;
  assert.deepStrictEqual([s1.front.left.page, s1.front.right.page], [8, 1]);
  assert.deepStrictEqual([s1.back.left.page, s1.back.right.page], [2, 7]);
  assert.deepStrictEqual([s2.front.left.page, s2.front.right.page], [6, 3]);
  assert.deepStrictEqual([s2.back.left.page, s2.back.right.page], [4, 5]);
}

// 3. 右装订为左装订镜像
{
  const plan = impose({ pages: 4, sheetsPerSignature: 1, binding: 'right', flip: 'short' });
  const sheet = plan.signatures[0].sheets[0];
  assert.deepStrictEqual([sheet.front.left.page, sheet.front.right.page], [1, 4]);
  assert.deepStrictEqual([sheet.back.left.page, sheet.back.right.page], [3, 2]);
}

// 4. 不足整帖自动补空白：5 页、每帖 1 张 → 补齐 8 页、3 个空白页
{
  const plan = impose({ pages: 5, sheetsPerSignature: 1, binding: 'left', flip: 'long' });
  assert.strictEqual(plan.paddedPages, 8);
  assert.strictEqual(plan.blankPages, 3);
  assert.strictEqual(plan.signatureCount, 2);
}

// 5. 多帖拆分：20 页、每帖 2 张（8 页/帖）→ 3 帖，页码区间衔接
{
  const plan = impose({ pages: 20, sheetsPerSignature: 2, binding: 'left', flip: 'short' });
  assert.strictEqual(plan.signatureCount, 3);
  assert.strictEqual(plan.paddedPages, 24);
  assert.deepStrictEqual(
    plan.signatures.map((s) => [s.pageStart, s.pageEnd]),
    [[1, 8], [9, 16], [17, 20]]);
}

// 6. 全参数组合下模拟折叠阅读顺序均正确
for (const pages of [1, 4, 5, 8, 12, 16, 20, 25, 32]) {
  for (const sheets of [1, 2, 3]) {
    for (const binding of ['left', 'right']) {
      for (const flip of ['long', 'short']) {
        const plan = impose({ pages, sheetsPerSignature: sheets, binding, flip });
        checkReadingOrder(plan);
      }
    }
  }
}

// 7. 非法输入报错
assert.throws(() => impose({ pages: 0, sheetsPerSignature: 1, binding: 'left', flip: 'long' }));
assert.throws(() => impose({ pages: 4, sheetsPerSignature: 0, binding: 'left', flip: 'long' }));
assert.throws(() => impose({ pages: 4, sheetsPerSignature: 1, binding: 'up', flip: 'long' }));
assert.throws(() => impose({ pages: 4, sheetsPerSignature: 1, binding: 'left', flip: 'diag' }));

console.log('全部拼版测试通过 ✔');
