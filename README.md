# DataTracker Excel (TS 增强版)

一个基于 **TypeScript + Express** 的飞书多维表格数据管理服务，用于与飞书/Lark 多维表格 API 集成，实现数据的自动化读写与管理。

---

## 📁 目录结构

```
dataTracker_excel/
├── client/                     # 前端静态页面
│   ├── index.html             # 主页面（OAuth 登录入口）
│   ├── callback.html          # OAuth 回调页面
│   ├── success.html           # 操作成功页面
│   ├── api.js                 # API 封装
│   ├── auth.js                # 授权处理
│   └── styles.css             # 样式文件
├── data/                       # 本地数据缓存目录（运行时生成）
│   └── bitable.json           # 多维表格元数据缓存
├── logs/                       # 日志目录（运行时生成）
├── src/                        # TypeScript 源码目录
│   ├── index.ts               # 应用入口，Express 服务器配置
│   ├── config/                # 配置模块
│   │   └── env.ts             # 环境变量配置
│   ├── lib/                   # 工具库
│   │   ├── logger.ts          # Winston 日志配置
│   │   ├── localData.ts       # 本地数据管理（多维表格元数据缓存）
│   │   └── tasks/             # 定时任务
│   │       ├── index.ts       # 任务入口
│   │       └── task.server.ts # 任务服务（ASIN反查关键词等）
│   ├── routes/                # API 路由
│   │   ├── auth.ts            # 授权路由（/api/auth/*）
│   │   └── bitable.ts         # 多维表格路由（/api/bitable/*）
│   ├── services/              # 业务逻辑层
│   │   ├── bitable.ts         # 飞书多维表格 API 封装
│   │   ├── larkAuth.ts        # 飞书 OAuth 认证
│   │   ├── http.ts            # HTTP 请求工具
│   │   └── backend.datascaler.ts  # 后端数据服务（ASIN关键词反查）
│   └── types/                 # 类型定义
│       └── bitable.ts         # 多维表格相关类型
├── .env.example               # 环境变量示例
├── package.json               # 项目依赖
└── tsconfig.json              # TypeScript 配置
```

---

## 🚀 项目用途

- **飞书多维表格集成**：通过 OAuth 授权，操作飞书/Lark 多维表格（创建、读取、更新记录）
- **数据自动化同步**：定时任务自动同步 ASIN 关键词反查数据到飞书表格
- **本地数据缓存**：支持多维表格元数据本地缓存管理

---

## 🛠 环境要求

- **Node.js**: >= 18.x
- **包管理器**: npm / pnpm
- **飞书开放平台应用**: 需要创建飞书自建应用并获取 Client ID/Secret

---

## ⚙️ 环境配置

1. 复制环境变量示例文件：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填写以下配置：
   ```env
   # 飞书/Lark API 域名
   LARK_DOMAIN=https://open.larksuite.com  # 国际版
   # LARK_DOMAIN=https://open.feishu.cn    # 国内版

   # 飞书自建应用凭证
   LARK_CLIENT_ID=cli_xxxxxxxxxxxxxxxxx
   LARK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx
   LARK_REDIRECT_URI=http://127.0.0.1:3001/callback.html

   # 飞书文件夹 Token（用于创建多维表格）
   LARK_FOLDER_TOKEN=xxxxxxxxxxxxxx

   # 服务端口
   PORT=3001

   # 日志级别
   LOG_LEVEL=info

   # 后端数据服务地址（ASIN反查）
   BACKEND_SERVER_URL=http://your-backend-server
   ```

---

## 🏃 运行项目

### 安装依赖
```bash
npm install
# 或
pnpm install
```

### 开发模式（热重载）
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm run start
```

---

## 📡 主要 API

### 授权相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/callback` | OAuth 回调，交换 access_token |

**参数**：`code` (授权码), `create` (是否创建表格), `app_name` (应用名), `table_name` (表名)

---

### 多维表格操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/bitable/create` | 创建多维表格应用和数据表 |
| POST | `/api/bitable/upsert` | 按唯一键插入或更新单条记录 |
| POST | `/api/bitable/upsert/batch` | 批量插入或更新记录 |
| GET | `/api/bitable/records` | 获取表记录列表 |
| GET | `/api/health` | 健康检查 |

---

### 请求示例

**创建多维表格**
```bash
curl -X POST http://localhost:3001/api/bitable/create \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"appName": "测试表格", "tableName": "数据表"}'
```

**批量更新记录**
```bash
curl -X POST http://localhost:3001/api/bitable/upsert/batch \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "appToken": "WZBnbZcb5aRgI3s7R8Mlw1Q1gdh",
    "tableId": "tblNwvba88WNH47B",
    "uniqueKey": "id",
    "data": [{"id": "1", "name": "测试"}]
  }'
```

---

## 📋 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.6.x | 类型安全 |
| Express | 5.x | Web 框架 |
| Axios | 1.x | HTTP 客户端 |
| Winston | 3.x | 日志管理 |
| node-cron | 3.x | 定时任务 |
| dayjs | 1.x | 日期处理 |

---

## 📝 说明

- 保留原 `app.js` 不改动；新增 TS 服务端位于 `src/`
- 多维表格接口默认使用 `Authorization: Bearer {access_token}`，确保 OAuth 获得的 token 未过期
- 日志文件按日自动轮转，保留 30 天，单文件限制 3MB
- 本地数据缓存在 `data/` 目录，用于存储多维表格元数据

---

## 📜 License

ISC
