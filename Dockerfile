# ==========================================
# Stage 1: 依存関係のインストール (deps)
# ==========================================
FROM node:22-alpine AS deps
WORKDIR /app

# ネイティブビルド等が必要な場合に備え libc6-compat を追加
RUN apk add --no-cache libc6-compat

# パッケージ定義ファイルをコピー
COPY package.json package-lock.json ./

# 開発用・ビルド用を含む全依存関係をインストール (キャッシュクリーン付き)
RUN npm ci && npm cache clean --force

# ==========================================
# Stage 2: アプリケーションのビルド (builder)
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# フロントエンド(Vite)およびサーバー(esbuild)のビルドを実行 -> ./dist に出力
ENV NODE_ENV=production
RUN npm run build

# 本番実行に必要な依存関係のみを抽出
RUN npm prune --omit=dev && npm cache clean --force

# ==========================================
# Stage 3: 本番実行用軽量イメージ (runner)
# ==========================================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# セキュリティのため非rootユーザー(node)を使用
USER node

# ビルド成果物と本番用node_modules、必要な設定ファイルのみをコピー
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Cloud Runのデフォルトポート
EXPOSE 8080

# サーバー起動 (dist/server.cjs)
CMD ["node", "dist/server.cjs"]
