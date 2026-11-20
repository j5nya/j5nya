// Renders the profile cards (shadcn / Vercel look) from live GitHub data. Run: GITHUB_TOKEN=... node scripts/render.mjs
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
const ICONS = JSON.parse(readFileSync('scripts/icons.json', 'utf8'));
const font = f => readFileSync(`scripts/fonts/${f}`).toString('base64');
const SANS = font('Geist-Variable.woff2'), MONO = font('GeistMono-Variable.woff2');

const THEMES = {
  light: { bg: '#ffffff', fg: '#09090b', muted: '#71717a', border: '#e4e4e7', secondary: '#f4f4f5', heat: ['#f4f4f5', '#d4d4d8', '#a1a1aa', '#52525b', '#18181b'], bars: ['#18181b', '#52525b', '#a1a1aa', '#d4d4d8', '#e4e4e7'] },
  dark: { bg: '#09090b', fg: '#fafafa', muted: '#a1a1aa', border: '#27272a', secondary: '#18181b', heat: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#fafafa'], bars: ['#fafafa', '#a1a1aa', '#71717a', '#3f3f46', '#27272a'] },
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// shortcut: average glyph width instead of real metrics, fine for short labels in Geist
const textW = (s, size, mono = false) => [...s].reduce((w, c) => w + (/[　-鿿]/.test(c) ? 1 : mono ? 0.6 : /[ilj.,·|:']/.test(c) ? 0.3 : /[A-Z#mwMW]/.test(c) ? 0.68 : 0.55), 0) * size;
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

function svg(w, h, t, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
<style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${SANS}) format("woff2");font-weight:100 900}
@font-face{font-family:GM;src:url(data:font/woff2;base64,${MONO}) format("woff2");font-weight:100 900}
text{font-family:G,-apple-system,"Segoe UI",sans-serif;fill:${t.fg}}
.m{font-family:GM,ui-monospace,Consolas,monospace}.mu{fill:${t.muted}}
.a{opacity:0;animation:a .6s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes a{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.a{animation:none;opacity:1}}
</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>`;
}
const title = (t, s, x = 24, y = 36) => `<text x="${x}" y="${y}" font-size="14" font-weight="600" class="a">${esc(s)}</text>`;
const badge = (t, label, x, y, mono = true) => {
  const w = textW(label, 12, mono) + 18;
  return [`<g class="a"><rect x="${x}" y="${y}" width="${w}" height="24" rx="6" fill="${t.secondary}" stroke="${t.border}"/><text x="${x + 9}" y="${y + 16}" font-size="12" font-weight="500"${mono ? ' class="m"' : ''}>${esc(label)}</text></g>`, w];
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
  const H = 200, cx = 24 + 60, cy = H / 2;
  let x = 172, chips = '';
  for (const tag of TAGS) { const [s, w] = badge(t, tag, x, 132); chips += s; x += w + 8; }
  const kw = textW(KANJI, 13) + 16;
  return svg(W, H, t, `
<defs><clipPath id="av"><circle cx="${cx}" cy="${cy}" r="60"/></clipPath></defs>
<g class="a"><image href="${avatarUri}" x="${cx - 60}" y="${cy - 60}" width="120" height="120" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
<circle cx="${cx}" cy="${cy}" r="60.5" stroke="${t.border}"/></g>
<g class="a" style="animation-delay:.05s"><text x="172" y="78" font-size="36" font-weight="600" letter-spacing="-1.2">${esc(NAME)}</text>
<text x="${174 + textW(NAME, 36) - 1.2 * NAME.length + 12}" y="78" font-size="14" class="m mu">@${LOGIN}</text></g>
<text x="172" y="108" font-size="15" class="mu a" style="animation-delay:.1s">${esc(SUBTITLE)}</text>
<g style="animation-delay:.15s">${chips}</g>
<g class="a"><rect x="${W - 24 - kw}" y="24" width="${kw}" height="24" rx="6" stroke="${t.border}"/><text x="${W - 24 - kw / 2}" y="41" font-size="13" text-anchor="middle" class="mu">${KANJI}</text></g>`);
}

function stack(t) {
  const H = 64 + STACK.length * 44;
  let body = title(t, 'Stack');
  STACK.forEach(([group, items], gi) => {
    const y = 60 + gi * 44;
    body += `<text x="24" y="${y + 21}" font-size="13" class="mu a">${esc(group)}</text>`;
    let x = 104;
    items.forEach(([icon, label], ii) => {
      const w = textW(label, 13) + 46;
      body += `<g class="a" style="animation-delay:${(gi * 5 + ii) * 0.03}s"><rect x="${x}" y="${y}" width="${w}" height="32" rx="8" stroke="${t.border}"/>
<g transform="translate(${x + 12} ${y + 9}) scale(.5833)"><path d="${ICONS[icon]}" fill="${t.fg}"/></g>
<text x="${x + 34}" y="${y + 21}" font-size="13" font-weight="500">${esc(label)}</text></g>`;
      x += w + 8;
    });
  });
  return svg(W, H, t, body);
}

function project(t, r) {
  const H = 132, desc = r.description || 'No description';
  const short = desc.length > 52 ? desc.slice(0, 50) + '…' : desc;
  const lang = r.primaryLanguage?.name;
  return svg(HALF, H, t, `
<g class="a"><path transform="translate(24 22) scale(1)" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" fill="${t.muted}"/>
<text x="48" y="35" font-size="15" font-weight="600">${esc(r.name)}</text></g>
<text x="24" y="66" font-size="13" class="mu a" style="animation-delay:.05s">${esc(short)}</text>
<g class="a" style="animation-delay:.1s" font-size="12">
${lang ? `<circle cx="29" cy="102" r="5" fill="${t.fg}"/><text x="40" y="106" class="mu">${esc(lang)}</text>` : ''}
<text x="${lang ? 52 + textW(lang, 12) : 24}" y="106" class="mu">★ ${fmt(r.stargazerCount)}</text></g>`);
}

function stats(t) {
  const H = 262, metrics = [['Stars', stars], ['Contributions', cal.totalContributions], ['Repositories', data.repositories.totalCount], ['Followers', data.followers.totalCount]];
  const colW = (W - 48) / 4;
  let body = title(t, 'Activity') + `<text x="${W - 24}" y="36" font-size="12" text-anchor="end" class="mu a">last 12 months</text>`;
  metrics.forEach(([label, v], i) => {
    const x = 24 + i * colW;
    if (i) body += `<line x1="${x}" y1="60" x2="${x}" y2="112" stroke="${t.border}"/>`;
    body += `<g class="a" style="animation-delay:${i * 0.05}s"><text x="${x + (i ? 16 : 0)}" y="76" font-size="12" class="mu">${label}</text><text x="${x + (i ? 16 : 0)}" y="106" font-size="26" font-weight="600" letter-spacing="-.6">${fmt(v)}</text></g>`;
  });
  body += `<line x1="24" y1="132" x2="${W - 24}" y2="132" stroke="${t.border}"/>`;
  const weeks = cal.weeks.slice(-53), cell = 11, gap = 4.5;
  const gx = (W - (weeks.length * (cell + gap) - gap)) / 2;
  body += '<g class="a" style="animation-delay:.15s">';
  weeks.forEach((w, wi) => w.contributionDays.forEach(d => {
    const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
    body += `<rect x="${(gx + wi * (cell + gap)).toFixed(1)}" y="${(148 + dow * (cell + 2.5)).toFixed(1)}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[LEVEL[d.contributionLevel]]}"/>`;
  }));
  return svg(W, H, t, body + '</g>');
}

function languages(t) {
  const H = 156;
  let body = title(t, 'Languages'), x = 24;
  const barW = HALF - 48;
  body += `<clipPath id="bar"><rect x="24" y="56" width="${barW}" height="8" rx="4"/></clipPath><g clip-path="url(#bar)" class="a">`;
  topLangs.forEach(([, size], i) => { const w = size / langTotal * barW; body += `<rect x="${x}" y="56" width="${w + 0.5}" height="8" fill="${t.bars[i]}"/>`; x += w; });
  body += `<rect x="${x}" y="56" width="${24 + barW - x}" height="8" fill="${t.bars[4]}"/></g>`;
  topLangs.slice(0, 4).forEach(([name, size], i) => {
    const cx = 24 + (i % 2) * (barW / 2), cy = 96 + Math.floor(i / 2) * 28;
    body += `<g class="a" style="animation-delay:${0.05 + i * 0.04}s"><circle cx="${cx + 4}" cy="${cy - 4}" r="4" fill="${t.bars[i]}" stroke="${t.border}"/><text x="${cx + 16}" y="${cy}" font-size="13" font-weight="500">${esc(name)}</text><text x="${cx + barW / 2 - 12}" y="${cy}" font-size="12" text-anchor="end" class="m mu">${(size / langTotal * 100).toFixed(1)}%</text></g>`;
  });
  return svg(HALF, H, t, body);
}

function streakCard(t) {
  const H = 156, last = days.slice(-14);
  let body = title(t, 'Streak');
  [['Current', streak.current], ['Longest', streak.longest]].forEach(([label, v], i) => {
    const x = 24 + i * 150;
    body += `<g class="a" style="animation-delay:${i * 0.05}s"><text x="${x}" y="70" font-size="12" class="mu">${label}</text><text x="${x}" y="102" font-size="26" font-weight="600" letter-spacing="-.6">${v}<tspan font-size="13" font-weight="400" class="mu" dx="6">days</tspan></text></g>`;
  });
  const cw = (HALF - 48 - 13 * 4) / 14;
  last.forEach((d, i) => { body += `<rect class="a" style="animation-delay:${0.1 + i * 0.02}s" x="${(24 + i * (cw + 4)).toFixed(1)}" y="128" width="${cw.toFixed(1)}" height="18" rx="4" fill="${t.heat[LEVEL[d.contributionLevel]]}" stroke="${t.border}"/>`; });
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
