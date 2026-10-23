function lum(hex) {
  const rgb = hex.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16) / 255);
  const a = rgb.map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function ratio(c1, c2) {
  const l1 = lum(c1);
  const l2 = lum(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const darkCards = ['#0f172a', '#1e293b'];

const darkCandidates = [
  // Emerald
  { name: 'Emerald solid dark (dark bg, light text)', bg: '#064e3b', text: '#a7f3d0', border: '#34d399' },
  { name: 'Emerald solid dark 2', bg: '#022c22', text: '#6ee7b7', border: '#10b981' },
  { name: 'Emerald bright solid (light bg, dark text)', bg: '#34d399', text: '#022c22', border: '#6ee7b7' },
  
  // Rose
  { name: 'Rose solid dark (dark bg, light text)', bg: '#4c0519', text: '#fecdd3', border: '#fb7185' },
  { name: 'Rose bright solid (light bg, dark text)', bg: '#fb7185', text: '#4c0519', border: '#fda4af' },
  
  // Amber
  { name: 'Amber solid dark (dark bg, light text)', bg: '#451a03', text: '#fde68a', border: '#fbbf24' },
  { name: 'Amber bright solid (light bg, dark text)', bg: '#f59e0b', text: '#000000', border: '#fbbf24' },

  // Sky
  { name: 'Sky solid dark (dark bg, light text)', bg: '#082f49', text: '#bae6fd', border: '#38bdf8' },
  { name: 'Sky bright solid (light bg, dark text)', bg: '#38bdf8', text: '#082f49', border: '#7dd3fc' },

  // Purple
  { name: 'Purple solid dark (dark bg, light text)', bg: '#3b0764', text: '#e9d5ff', border: '#c084fc' },
  { name: 'Purple bright solid (light bg, dark text)', bg: '#c084fc', text: '#3b0764', border: '#d8b4fe' },

  // Indigo
  { name: 'Indigo solid dark (dark bg, light text)', bg: '#1e1b4b', text: '#c7d2fe', border: '#818cf8' },
  { name: 'Indigo bright solid (light bg, dark text)', bg: '#818cf8', text: '#1e1b4b', border: '#a5b4fc' },

  // Slate
  { name: 'Slate solid dark (dark bg, light text)', bg: '#1e293b', text: '#f1f5f9', border: '#94a3b8' },
  { name: 'Slate bright solid (light bg, dark text)', bg: '#94a3b8', text: '#0f172a', border: '#cbd5e1' }
];

for (const t of darkCandidates) {
  const textContrast = ratio(t.bg, t.text);
  for (const card of darkCards) {
    const bgCardContrast = ratio(t.bg, card);
    const borderCardContrast = ratio(t.border, card);
    console.log(`${t.name} vs ${card}: Text/BG = ${textContrast.toFixed(2)}:1 (>=4.5: ${textContrast >= 4.5}), BG/Card = ${bgCardContrast.toFixed(2)}:1, Border/Card = ${borderCardContrast.toFixed(2)}:1 (>=3.0: ${borderCardContrast >= 3.0})`);
  }
}

