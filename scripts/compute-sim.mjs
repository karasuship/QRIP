import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readCsv(file) {
  const p = path.join(root, 'engine', 'data', file);
  if (!fs.existsSync(p)) return new Map();
  const txt = fs.readFileSync(p, 'utf8');
  const map = new Map();
  for (const line of txt.split('\n').slice(1)) {
    const parts = line.trim().split(',');
    if (parts.length < 2) continue;
    const d = parts[0].trim();
    const v = parseFloat(parts[1]);
    if (d && !isNaN(v)) map.set(d, v);
  }
  return map;
}

const sp500 = readCsv('sp500_daily.csv');
const vix   = readCsv('vix.csv');
const hyg   = readCsv('hyg.csv');
const dxy   = readCsv('dxy.csv');
const rsp   = readCsv('rsp.csv');

const dates = Array.from(sp500.keys()).sort();
const START = '2008-01-01';
const startIdx = dates.findIndex(d => d >= START);
const sp500Start = sp500.get(dates[startIdx]);

const MONTHLY = 100;
const SIGNAL_EXTRA = 300;

let dcaShares = 0, phi2Shares = 0, lastMonth = '';
let ath = sp500Start, athIdx = startIdx;

const monthly = [], signals = [];

for (let i = startIdx; i < dates.length; i++) {
  const d = dates[i];
  const price = sp500.get(d);
  if (price > ath) { ath = price; athIdx = i; }

  const ageAth = i - athIdx;
  const athDd = price / ath - 1;

  const month = d.slice(0, 7);
  if (month !== lastMonth) {
    lastMonth = month;
    dcaShares  += MONTHLY / price;
    phi2Shares += MONTHLY / price;
  }

  const prevPrice = i > 0 ? sp500.get(dates[i-1]) : price;
  const dayRet = price / prevPrice - 1;

  let vol20 = 0;
  if (i - startIdx >= 20) {
    const slice = dates.slice(i-20, i+1).map(dd => sp500.get(dd));
    const rets = slice.slice(1).map((v, j) => Math.log(v / slice[j]));
    const mean = rets.reduce((a,b) => a+b, 0) / rets.length;
    const vrn  = rets.reduce((a,b) => a+(b-mean)**2, 0) / (rets.length-1);
    vol20 = Math.sqrt(vrn * 252);
  }

  const vixVal = vix.get(d) ?? 0;
  const c1 = vixVal > 30;

  const hygNow = hyg.get(d);
  const hyg3d  = i >= 3 ? hyg.get(dates[i-3]) : undefined;
  const c2 = hygNow !== undefined && hyg3d !== undefined && hygNow < hyg3d;

  const dxyNow = dxy.get(d);
  const dxy5d  = i >= 5 ? dxy.get(dates[i-5]) : undefined;
  const c3 = dxyNow !== undefined && dxy5d !== undefined && dxyNow > dxy5d;

  const c4 = ageAth <= 90;

  let hyg60hi = -Infinity;
  for (let j = Math.max(startIdx, i-60); j <= i; j++) {
    const h = hyg.get(dates[j]);
    if (h !== undefined && h > hyg60hi) hyg60hi = h;
  }
  const c5 = hygNow !== undefined && hyg60hi > 0 && hygNow / hyg60hi - 1 <= -0.08;

  const rspNow = rsp.get(d);
  const rsp5d  = i >= 5 ? rsp.get(dates[i-5]) : undefined;
  const sp5d   = i >= 5 ? sp500.get(dates[i-5]) : undefined;
  const c6 = rspNow !== undefined && rsp5d !== undefined && sp5d !== undefined &&
             (rspNow / rsp5d - 1) < (price / sp5d - 1);

  const crs = [c1,c2,c3,c4,c5,c6].filter(Boolean).length;
  const ageAthOk = !(ageAth >= 91 && ageAth <= 252);
  const phi2Active = athDd <= -0.10 && dayRet <= -0.02 && vol20 > 0.25 && ageAthOk && crs >= 2;

  if (phi2Active) {
    phi2Shares += SIGNAL_EXTRA / price;
    signals.push({ date: d, price: Math.round(price), crs, athDd: Math.round(athDd*1000)/1000 });
  }

  const nextMonth = i+1 < dates.length ? dates[i+1].slice(0,7) : '';
  if (nextMonth !== month || i === dates.length - 1) {
    monthly.push({
      date: month,
      dca:  dcaShares * price,
      phi2: phi2Shares * price,
      sp500: (price / sp500Start) * 100,
    });
  }
}

const base = monthly[0]?.dca ?? 1;
for (const m of monthly) {
  m.dca  = Math.round(m.dca  / base * 100 * 10) / 10;
  m.phi2 = Math.round(m.phi2 / base * 100 * 10) / 10;
  m.sp500 = Math.round(m.sp500 * 10) / 10;
}

const dcaFinal  = monthly[monthly.length-1]?.dca  ?? 100;
const phi2Final = monthly[monthly.length-1]?.phi2 ?? 100;
const years = (dates.length - startIdx) / 252;

const result = {
  monthly,
  signals,
  totalSignals: signals.length,
  signalsPerYear: Math.round(signals.length / years * 10) / 10,
  dcaFinal,
  phi2Final,
  alpha: Math.round((phi2Final - dcaFinal) * 10) / 10,
};

const outDir = path.join(root, 'app', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sim-result.json'), JSON.stringify(result, null, 2));

console.log(`Done: ${signals.length} signals (${result.signalsPerYear}/yr), DCA=${dcaFinal.toFixed(1)} phi2=${phi2Final.toFixed(1)} alpha=+${result.alpha}`);
