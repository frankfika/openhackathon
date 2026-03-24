#!/bin/bash
set -e

echo "================================================"
echo "  OpenHackathon 全栈部署脚本"
echo "================================================"

APP_DIR="/opt/openhackathon"
DB_NAME="openhackathon"
DB_USER="openhackathon"
PORT=3001

# ── 1. Node.js ────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo ">>> 安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo ">>> Node.js $(node --version) 已安装"
fi

# ── 2. PostgreSQL ──────────────────────────────────
if ! command -v psql &>/dev/null; then
  echo ">>> 安装 PostgreSQL..."
  apt-get install -y postgresql postgresql-contrib
fi
systemctl start postgresql && systemctl enable postgresql
echo ">>> PostgreSQL 已就绪"

# ── 3. Nginx ───────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo ">>> 安装 Nginx..."
  apt-get install -y nginx
fi
systemctl start nginx && systemctl enable nginx
echo ">>> Nginx 已就绪"

# ── 4. PM2 ────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo ">>> 安装 PM2..."
  npm install -g pm2
fi
echo ">>> PM2 已就绪"

# ── 5. 数据库初始化 ────────────────────────────────
echo ">>> 配置 PostgreSQL 数据库..."
# 检查是否已有 .env（保留现有密码）
if [ -f "$APP_DIR/.env" ] && grep -q "DATABASE_URL" "$APP_DIR/.env"; then
  DB_PASS=$(grep DATABASE_URL "$APP_DIR/.env" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
  echo ">>> 使用已有数据库密码"
else
  DB_PASS=$(openssl rand -hex 16)
  echo ">>> 生成新数据库密码"
fi

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || \
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
echo ">>> 数据库 $DB_NAME 已就绪"

# ── 6. 克隆 / 更新代码 ────────────────────────────
echo ">>> 获取最新代码..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone https://github.com/frankfika/openhackathon.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 7. 环境变量 ────────────────────────────────────
echo ">>> 写入 .env..."
JWT_SECRET=$(openssl rand -hex 32)
cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
JWT_SECRET="$JWT_SECRET"
NODE_ENV="production"
PORT=$PORT
EOF
echo ">>> .env 已写入"

# ── 8. 安装依赖 + 构建 ────────────────────────────
cd "$APP_DIR"
echo ">>> npm install..."
npm install

echo ">>> npm run build..."
npm run build

# ── 9. 数据库迁移 ──────────────────────────────────
echo ">>> 数据库迁移..."
export $(grep -v '^#' .env | xargs)
npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss
echo ">>> 数据库迁移完成"

# ── 10. PM2 启动 ───────────────────────────────────
echo ">>> PM2 启动应用..."
pm2 delete openhackathon 2>/dev/null || true
pm2 start npm --name openhackathon -- start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | grep "sudo" | bash 2>/dev/null || true
echo ">>> 应用已启动"

# ── 11. Nginx 反向代理 ─────────────────────────────
echo ">>> 配置 Nginx..."
cat > /etc/nginx/sites-available/openhackathon <<'NGINXCONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/openhackathon /etc/nginx/sites-enabled/openhackathon
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo ">>> Nginx 配置完成"

# ── 完成 ───────────────────────────────────────────
echo ""
echo "================================================"
echo "  部署完成！"
echo ""
echo "  访问地址: http://$(curl -s ifconfig.me)"
echo "  PM2 状态: pm2 status"
echo "  应用日志: pm2 logs openhackathon"
echo "================================================"
