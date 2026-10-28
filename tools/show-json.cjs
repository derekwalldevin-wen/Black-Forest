/* 小工具：把一个 JSON 文件读出来打屏。验收脚本用来核对探针结果。
 * 用 node 读文件，避免 PowerShell 按 ANSI 代码页读 UTF-8 中文变成乱码。 */
const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error('usage: node tools/show-json.cjs <file>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (Array.isArray(data)) {
  for (const item of data) {
    if (item && item.eval) console.log('EVAL  ' + item.eval);
    else console.log('STEP  ' + JSON.stringify(item));
  }
} else {
  console.log(JSON.stringify(data, null, 2));
}
