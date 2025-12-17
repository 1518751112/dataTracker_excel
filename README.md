# DataTracker Excel (TS 增强版)

## 启动
- 复制 `.env.example` 为 `.env` 并填写 `LARK_CLIENT_ID/LARK_CLIENT_SECRET/LARK_REDIRECT_URI`
- 安装依赖：`npm i`
- 开发模式：`npm run dev`

## 主要API
- `GET /api/auth/callback?code=...&create=true&app_name=测试表格&table_name=数据表名称`
  - 交换 code 为 access_token；可选创建应用与表
- `POST /api/bitable/upsert`
  - Body：`{ appToken, tableId, data: {key: value}, uniqueKey, sortField?: { name, order } }`
  - 行为：确保字段存在；可选设置视图排序；按唯一键查找并更新或创建
- `GET /api/bitable/records?appToken=...&tableId=...&viewId=...`
  - 列出表记录（可指定视图）

## 说明
- 保留原 `app.js` 不改动；新增 TS 服务端位于 `src/`。
- 多维表格接口默认使用 `Authorization: Bearer {access_token}`，确保 OAuth 获得的 token 未过期。

