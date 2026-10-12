const sharp = require('sharp');
const points = [[190,350],[330,245],[470,315],[610,160],[768,100],[926,160],[1066,315],[1206,245],[1346,350]];
const shapes = points.map(([x,y],i) => `<path d="M 768 830 Q ${x} 550 ${x} ${y}" fill="none" stroke="#aaa" stroke-width="12"/><circle cx="${x}" cy="${y}" r="58" fill="#35664b" stroke="#e8c184" stroke-width="5"/><text x="${x}" y="${y+16}" text-anchor="middle" font-size="48" fill="white">${i+1}</text>`).join('');
sharp(Buffer.from(`<svg width="1536" height="1024" xmlns="http://www.w3.org/2000/svg"><rect width="1536" height="1024" fill="#12101a"/>${shapes}</svg>`)).png().toFile('docs/art/nine-head-layout-guide.png');
