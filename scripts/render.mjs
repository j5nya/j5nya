// Renders the profile cards (Manrope + JetBrains Mono, monochrome) from live GitHub data. Run: GITHUB_TOKEN=... node scripts/render.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = 'j5nya';
const NAME = 'watanabe';
const KANJI = '渡辺';
const SUBTITLE = 'reverse engineering · game clients · roblox revivals';
const TAGS = ['C#', 'Java', 'C', 'Luau', 'TypeScript'];
const STACK = [
  ['Main', [['dotnet', 'C#'], ['openjdk', 'Java'], ['c', 'C'], ['lua', 'Luau'], ['typescript', 'TypeScript']]],
  ['Tools', [['git', 'Git'], ['linux', 'Linux'], ['postgresql', 'PostgreSQL'], ['roblox', 'Roblox'], ['intellijidea', 'IntelliJ']]],
];
const PROJECTS = ['SoneroFpsUnlocker', 'ECBootstraper'];

const W = 880, HALF = 434;
const { brand: BRAND, lucide: LUC } = JSON.parse(readFileSync('scripts/icons.json', 'utf8'));
const BG = m => readFileSync(`scripts/scene/bg-${m}.png`).toString('base64');
const font = f => readFileSync(`scripts/fonts/${f}`).toString('base64');
const SANS = font('Manrope-Variable.woff2'), MONO = font('JetBrainsMono-Variable.woff2');

const THEMES = {
  light: { mode: 'light', bg: '#f5f5f6', fg: '#09090b', muted: '#71717a', border: '#e4e4e7', secondary: '#ffffff', heat: ['#e6e6e9', '#d4d4d8', '#a1a1aa', '#52525b', '#18181b'], bars: ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8', '#e4e4e7'] },
  dark: { mode: 'dark', bg: '#18181b', fg: '#fafafa', muted: '#a1a1aa', border: '#27272a', secondary: '#27272a', heat: ['#27272a', '#3f3f46', '#71717a', '#a1a1aa', '#fafafa'], bars: ['#fafafa', '#a1a1aa', '#71717a', '#3f3f46', '#27272a'] },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// shortcut: average glyph width instead of real metrics, fine for short labels in Manrope
const textW = (s, size, mono = false) => [...s].reduce((w, c) => w + (/[　-鿿]/.test(c) ? 1 : mono ? 0.6 : /[ilj.,·|:']/.test(c) ? 0.3 : /[A-Z#mwMW]/.test(c) ? 0.68 : 0.55), 0) * size;
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

function svg(w, h, t, body, bare = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
<style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${SANS}) format("woff2");font-weight:200 800}
@font-face{font-family:GM;src:url(data:font/woff2;base64,${MONO}) format("woff2");font-weight:100 900}
text{font-family:G,-apple-system,"Segoe UI",sans-serif;fill:${t.fg}}
.m{font-family:GM,ui-monospace,Consolas,monospace}.mu{fill:${t.muted}}
${process.env.NOANIM ? '' : '.a{opacity:0;animation:a .6s cubic-bezier(.2,.8,.2,1) forwards}'}
@keyframes a{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.a{animation:none;opacity:1}}
</style>
${bare ? '' : `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.bg}"/>`}
${body}
</svg>`;
}
const lu = (name, x, y, size, color, sw = 1.5) => `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${LUC[name]}</g>`;
const tile = (t, name, x, y) => lu(name, x, y + 6, 16, t.fg);
const title = (t, s, icon, x = 24, y = 22) => `<g class="a">${tile(t, icon, x, y)}<text x="${x + 26}" y="${y + 19}" font-size="15" font-weight="600" letter-spacing="-.2">${esc(s)}</text></g>`;
const badge = (t, label, x, y, mono = true) => {
  const w = textW(label, 12, mono) + 18;
  return [`<g class="a"><rect x="${x}" y="${y}" width="${w}" height="24" rx="6" fill="${t.secondary}" fill-opacity=".85"/><text x="${x + 9}" y="${y + 16}" font-size="12" font-weight="500"${mono ? ' class="m"' : ''}>${esc(label)}</text></g>`, w];
};

async function gql(query, variables) {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-render' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(JSON.stringify(j.errors || j));
  return j.data;
}

const data = (await gql(`query($login:String!){user(login:$login){
  avatarUrl(size:256) followers{totalCount}
  contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}
  repositories(first:100,ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC){totalCount nodes{name description stargazerCount forkCount primaryLanguage{name} languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
}}`, { login: LOGIN })).user;

const avatar = Buffer.from(await (await fetch(data.avatarUrl)).arrayBuffer());
const avatarUri = `data:image/jpeg;base64,${avatar.toString('base64')}`;
const repos = data.repositories.nodes;
const stars = repos.reduce((s, r) => s + r.stargazerCount, 0);
const cal = data.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap(w => w.contributionDays);
const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

function streaks(days) {
  let longest = 0, run = 0;
  for (const d of days) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
  let i = days.length - 1, current = 0;
  if (i >= 0 && !days[i].contributionCount) i--; // today with no commits yet does not break the streak
  for (; i >= 0 && days[i].contributionCount; i--) current++;
  return { current, longest };
}
const streak = streaks(days);

const langs = {};
for (const r of repos) for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
const langTotal = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 5);

// ---- cards
function hero(t) {
  const H = 280, cx = 32 + 64, cy = 116;
  let x = 32, chips = '';
  for (const tag of TAGS) { const [c, w] = badge(t, tag, x, 220); chips += c; x += w + 8; }
  return svg(W, H, t, `
<defs><clipPath id="card"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="11.5"/></clipPath><clipPath id="av"><circle cx="${cx}" cy="${cy}" r="56"/></clipPath>
<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset=".38" stop-color="${t.bg}" stop-opacity=".9"/><stop offset=".62" stop-color="${t.bg}" stop-opacity="0"/></linearGradient></defs>
<g clip-path="url(#card)"><image href="data:image/png;base64,${BG(t.mode)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/><rect width="${W}" height="${H}" fill="url(#fade)"/></g>
<g class="a"><circle cx="${cx}" cy="${cy}" r="60" fill="${t.bg}"/><image href="${avatarUri}" x="${cx - 56}" y="${cy - 56}" width="112" height="112" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/></g>
<g class="a" style="animation-delay:.05s"><rect x="${cx + 30}" y="${cy + 36}" width="22" height="22" rx="11" fill="${t.bg}"/><circle cx="${cx + 41}" cy="${cy + 47}" r="5" fill="#22c55e"/></g>
<g class="a" style="animation-delay:.08s"><text x="180" y="104" font-size="40" font-weight="650" letter-spacing="-1.6">${esc(NAME)}</text>
<text x="182" y="134" font-size="14" class="m mu">@${LOGIN}</text></g>
<g class="a" style="animation-delay:.12s">${lu('terminal', 182, 150, 15, t.muted)}<text x="204" y="162" font-size="14" class="mu">${esc(SUBTITLE)}</text></g>
<g style="animation-delay:.16s">${chips}</g>`, true);
}

function stack(t) {
  const H = 78 + STACK.length * 92;
  let body = title(t, 'Stack', 'layers');
  STACK.forEach(([group, items], gi) => {
    const y = 76 + gi * 92, cw = (W - 48 - 88) / items.length;
    body += `<g class="a">${lu(gi ? 'wrench' : 'code-xml', 24, y + 30, 14, t.muted)}<text x="44" y="${y + 41}" font-size="13" class="mu">${esc(group)}</text></g>`;
    items.forEach(([icon, label], ii) => {
      const x = 112 + ii * cw, c = t.fg;
      body += `<g class="a" style="animation-delay:${(gi * 5 + ii) * 0.04}s">
<rect x="${x}" y="${y}" width="${cw - 10}" height="76" rx="10" fill="${t.secondary}"/>
<g transform="translate(${x + (cw - 10) / 2 - 10} ${y + 16}) scale(.8333)"><path d="${BRAND[icon].d}" fill="${c}"/></g>
<text x="${x + (cw - 10) / 2}" y="${y + 64}" font-size="12" font-weight="500" text-anchor="middle">${esc(label)}</text></g>`;
    });
  });
  return svg(W, H, t, body);
}

function project(t, r) {
  const H = 136, desc = r.description || 'No description';
  const short = desc.length > 52 ? desc.slice(0, 50) + '…' : desc;
  const lang = r.primaryLanguage?.name;
  return svg(HALF, H, t, `
<g class="a">${tile(t, 'book-marked', 24, 22)}
<text x="50" y="41" font-size="15" font-weight="600" letter-spacing="-.2">${esc(r.name)}</text>${lu('sparkles', HALF - 40, 28, 16, t.muted)}</g>
<text x="24" y="78" font-size="13" class="mu a" style="animation-delay:.05s">${esc(short)}</text>
<g class="a" style="animation-delay:.1s" font-size="12">
${lang ? `${lu('code-xml', 24, 98, 14, t.muted)}<text x="44" y="110" class="mu">${esc(lang)}</text>` : ''}
${(() => { const sx = lang ? 60 + textW(lang, 12) : 24; return `${lu('star', sx, 98, 14, t.muted)}<text x="${sx + 20}" y="110" class="mu">${fmt(r.stargazerCount)}</text>${lu('git-fork', sx + 44, 98, 14, t.muted)}<text x="${sx + 64}" y="110" class="mu">${fmt(r.forkCount)}</text>`; })()}</g>`);
}

function stats(t) {
  const H = 290, metrics = [['Stars', stars, 'star'], ['Contributions', cal.totalContributions, 'git-commit-horizontal'], ['Repositories', data.repositories.totalCount, 'folder-git-2'], ['Followers', data.followers.totalCount, 'users']];
  const colW = (W - 48) / 4;
  let body = title(t, 'Activity', 'activity') + `<g class="a">${lu('calendar-days', W - 128, 29, 14, t.muted)}<text x="${W - 24}" y="41" font-size="12" text-anchor="end" class="mu">last 12 months</text></g>`;
  metrics.forEach(([label, v, icon], i) => {
    const x = 24 + i * colW, px = x;
    body += `<g class="a" style="animation-delay:${i * 0.05}s">${lu(icon, px, 77, 14, t.muted)}<text x="${px + 20}" y="89" font-size="12" class="mu">${label}</text><text x="${px}" y="126" font-size="28" font-weight="650" letter-spacing="-.8">${fmt(v)}</text></g>`;
  });
  const weeks = cal.weeks.slice(-53), cell = 11, gap = 4.5;
  const gx = (W - (weeks.length * (cell + gap) - gap)) / 2;
  body += '<g class="a" style="animation-delay:.15s">';
  weeks.forEach((w, wi) => w.contributionDays.forEach(d => {
    const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
    body += `<rect x="${(gx + wi * (cell + gap)).toFixed(1)}" y="${(176 + dow * (cell + 2.5)).toFixed(1)}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[LEVEL[d.contributionLevel]]}"/>`;
  }));
  return svg(W, H, t, body + '</g>');
}

function languages(t) {
  const H = 176;
  let body = title(t, 'Languages', 'languages'), x = 24;
  const barW = HALF - 48;
  body += `<clipPath id="bar"><rect x="24" y="72" width="${barW}" height="8" rx="4"/></clipPath><g clip-path="url(#bar)" class="a">`;
  topLangs.forEach(([, size], i) => { const w = size / langTotal * barW; body += `<rect x="${x}" y="72" width="${w + 0.5}" height="8" fill="${t.bars[i]}"/>`; x += w; });
  body += `<rect x="${x}" y="72" width="${24 + barW - x}" height="8" fill="${t.bars[4]}"/></g>`;
  topLangs.slice(0, 4).forEach(([name, size], i) => {
    const cx = 24 + (i % 2) * (barW / 2), cy = 114 + Math.floor(i / 2) * 28;
    body += `<g class="a" style="animation-delay:${0.05 + i * 0.04}s"><circle cx="${cx + 4}" cy="${cy - 4}" r="4" fill="${t.bars[i]}"/><text x="${cx + 16}" y="${cy}" font-size="13" font-weight="500">${esc(name)}</text><text x="${cx + barW / 2 - 12}" y="${cy}" font-size="12" text-anchor="end" class="m mu">${(size / langTotal * 100).toFixed(1)}%</text></g>`;
  });
  return svg(HALF, H, t, body);
}

function streakCard(t) {
  const H = 176, last = days.slice(-14);
  let body = title(t, 'Streak', 'flame');
  [['Current', streak.current, 'flame'], ['Longest', streak.longest, 'trophy']].forEach(([label, v, icon], i) => {
    const x = 24 + i * 150;
    body += `<g class="a" style="animation-delay:${i * 0.05}s">${lu(icon, x, 72, 14, t.muted)}<text x="${x + 20}" y="84" font-size="12" class="mu">${label}</text><text x="${x}" y="118" font-size="26" font-weight="600" letter-spacing="-.6">${v}<tspan font-size="13" font-weight="400" class="mu" dx="6">days</tspan></text></g>`;
  });
  const cw = (HALF - 48 - 13 * 4) / 14;
  last.forEach((d, i) => { body += `<rect class="a" style="animation-delay:${0.1 + i * 0.02}s" x="${(24 + i * (cw + 4)).toFixed(1)}" y="138" width="${cw.toFixed(1)}" height="18" rx="4" fill="${t.heat[LEVEL[d.contributionLevel]]}"/>`; });
  return svg(HALF, H, t, body);
}

// ---- write
mkdirSync('assets', { recursive: true });
const cards = { hero, stack, stats, languages, streak: streakCard };
const projects = PROJECTS.map(n => repos.find(r => r.name === n)).filter(Boolean);
for (const [mode, t] of Object.entries(THEMES)) {
  for (const [name, fn] of Object.entries(cards)) writeFileSync(`assets/${name}-${mode}.svg`, fn(t));
  for (const r of projects) writeFileSync(`assets/project-${r.name.toLowerCase()}-${mode}.svg`, project(t, r));
}

const pic = (name, alt, width = '100%') => `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" width="${width}" alt="${esc(alt)}"></picture>`;
writeFileSync('README.md', `<div align="center">

${pic('hero', `${NAME} — ${SUBTITLE}`)}

${pic('stack', 'Stack')}

${projects.map(r => `<a href="https://github.com/${LOGIN}/${r.name}">${pic(`project-${r.name.toLowerCase()}`, r.name, '49.3%')}</a>`).join(' ')}

${pic('stats', 'Activity')}

${pic('languages', 'Languages', '49.3%')} ${pic('streak', 'Streak', '49.3%')}

</div>
`);
console.log(`rendered: ${repos.length} repos, ${cal.totalContributions} contributions, streak ${streak.current}/${streak.longest}`);
