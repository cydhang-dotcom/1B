import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const TARGET_DIR = process.platform === 'win32'
  ? 'C:\\\\ibanbu.com\\www.ibanbu.com_V3\\static\\OneBiz'
  : '/Users/yjj/ibanbu/www.ibanbu.com_V3/static/OneBiz';

console.log('🚀 开始构建和部署...\n');

// 1. 运行 npm run build
console.log('📦 步骤 1/3: 运行 npm run build...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ 构建完成\n');
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}

// 2. 清空目标目录
console.log('🗑️  步骤 2/3: 清空目标目录...');
if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  console.log('✅ 目标目录已清空\n');
} else {
  console.log('ℹ️  目标目录不存在，将创建新目录\n');
}

// 3. 复制文件
console.log('📋 步骤 3/3: 复制文件到目标目录...');
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('❌ dist 目录不存在！');
  process.exit(1);
}

fs.cpSync(distDir, TARGET_DIR, { recursive: true });
console.log('✅ 文件复制完成\n');

console.log('🎉 部署成功！');
console.log(`📂 目标目录: ${TARGET_DIR}`);
