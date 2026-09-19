# 骑马钉小册子拼版预演

基于 Node.js + Express + 原生 Canvas 的骑马钉（saddle-stitch）拼版预演 Web 应用。

输入成品页数、每帖张数、装订方向与双面翻转方式后，系统自动将不足整帖的部分补为空白页，按帖拆分页码，计算每张纸正/反面的左右页位；背面依据长边/短边翻转方式执行坐标变换，保证裁切折叠后的阅读顺序正确。画布逐张绘制纸面、页码、空白位与翻转方向，并可导出拼版清单 JSON。

## 快速开始（Docker）

```bash
docker compose up --build
```

启动后访问：**http://localhost:3000**

## 本地开发

```bash
npm install
npm start        # 默认端口 3000，可用 PORT 环境变量覆盖
npm test         # 运行拼版逻辑测试（含折叠后阅读顺序模拟校验）
```

## 功能说明

- **成品页数**：任意正整数，不足整帖自动补空白页（画布与 JSON 中标记为「空白」）。
- **每帖张数**：每帖 S 张纸，即每帖 4S 个页位，页码按帖拆分。
- **装订方向**：左装订 / 右装订（右装订为镜像拼版）。
- **双面翻转**：
  - 长边翻转：背面视图左右位置不变，页向旋转 180°；
  - 短边翻转：背面视图左右镜像，页向正立。
- **画布预演**：逐张显示每张纸的正面与背面，标注页码、空白位、页向箭头与翻转轴。
- **导出 JSON**：一键下载完整拼版清单（帖 → 张 → 正/背面左右页位）。

## API

```
GET /api/impose?pages=16&sheets=2&binding=left&flip=long
```

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `pages` | ≥1 整数 | 成品页数 |
| `sheets` | ≥1 整数 | 每帖张数 |
| `binding` | `left` / `right` | 装订方向 |
| `flip` | `long` / `short` | 双面翻转方式 |

返回拼版清单 JSON：`signatures[].sheets[].front/back.{left,right}` 为各页位（`page` 为页码，`blank` 标记补空白页），`backRotated` 表示背面页向是否旋转 180°，`flipAxis` 为翻转轴方向。

## 项目结构

```
├── server.js            # Express 服务与 API
├── lib/imposition.js    # 拼版核心逻辑（页码分配 + 翻转坐标变换）
├── public/              # 前端（原生 Canvas 预演）
├── test/                # 拼版逻辑测试
├── Dockerfile
└── docker-compose.yml
```
