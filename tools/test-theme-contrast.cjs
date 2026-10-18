const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const box={PAL:{},CARD:{},FONT:'',TYPE_STYLE:{}};vm.createContext(box);vm.runInContext(fs.readFileSync('src/core/theme.js','utf8'),box);
for(const realm of ['gothic','shanhai']){vm.runInContext(`applyTheme('${realm}')`,box);assert(vm.runInContext('cardRuleContrast(CARD)',box)>=4.5);}
assert.throws(()=>vm.runInContext("THEMES.gothic.card.rules=0x251c17;applyTheme('gothic')",box),/4.5/);
console.log('PASS: both applied palettes meet 4.5:1; low-contrast regression is rejected');
