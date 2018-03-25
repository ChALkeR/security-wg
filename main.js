const repo = `https://raw.githubusercontent.com/nodejs/security-wg/master/vuln`;
const downloadsApi = `https://api.npmjs.org/downloads/point`;
const dtitle = document.title;
let shown;

function eid(id) {
  return document.getElementById(id);
}

function sleep(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

function parseName(name) {
  if (!/^[A-Z\-]+-[1-9][0-9]*$/.test(name)) throw new Error('Invalid vuln id');
  const id = parseInt(name.split('-').pop(), 10);
  if (name === `NSWG-ECO-${id}`) return { type: 'npm', id };
  if (name === `NSWG-CORE-${id}`) return { type: 'core', id };
  throw new Error('Invalid vuln id');
}

function buildName(type, id) {
  switch (type) {
    case 'npm': return `NSWG-ECO-${id}`;
    case 'core': return `NSWG-CORE-${id}`;
  }
}

const maxIds = { npm: 0, core: 0 };
const none = new Set();
const vulns = new Map();
async function get(name) {
  if (vulns.has(name)) return vulns.get(name);
  if (none.has(name)) return null;
  const { type, id } = parseName(name);
  if (!['npm', 'core'].includes(type)) throw new Error('Invalid type');
  if (!/^[1-9][0-9]*$/.test(id)) throw new Error('Invalid id');
  const res = await fetch(`${repo}/${type}/${id}.json`);
  if (res.status === 404) {
    none.add(name);
    return null;
  } else if (res.status !== 200) {
    await sleep(1000);
    return get(name);
  }
  const vuln = await res.json();
  if (vuln.id > maxIds[type]) {
    maxIds[type] = vuln.id;
    if (shown) {
      const vuln0 = vulns.get(shown);
      if (vuln0 && vuln0.type === type && vuln0.id < vuln.id) {
        eid('next').style.display = 'block';
      }
    }
  }
  vuln.type = type;
  vuln.name = name;
  for (const key of ['publish_date']) {
    if (vuln[key]) vuln[key] = new Date(vuln[key]);
  }
  vulns.set(name, vuln);
  if (vuln.module_name) {
    fetch(`${downloadsApi}/last-month/${vuln.module_name}`)
      .then(res => res.json())
      .then(info => {
        if (!info.downloads || info.package !== vuln.module_name) return;
        vuln.downloads = info.downloads;
        if (name === shown) eid('eco-downloads').innerText = vuln.downloads;
      })
      .catch(e => console.error(e));
  }
  return vuln;
}

async function showNext(step = 1) {
  if (!shown) return;
  const vuln = await getNext(shown, step);
  if (!vuln) return;
  return show(vuln.name);
}

async function getNext(name, step = 1) {
  const { type, id } = parseName(name);
  for (let i = 1; i <= 30; i++) {
    const n = id + i * step;
    if (n < 1) return null;
    const vuln = await get(buildName(type, n));
    if (vuln) return vuln;
  }
  return null;
}

async function preload(name) {
  await get(name);
  let nameNext = name;
  for (let i = 0; i < 2; i++) {
    const vuln = await getNext(nameNext);
    if (!vuln) break;
    nameNext = vuln.name;
  }
  let namePrev = name;
  for (let i = 0; i < 2; i++) {
    const vuln = await getNext(namePrev, -1);
    if (!vuln) break;
    namePrev = vuln.name;
  }
}

function display(vuln) {
  if (!vuln) return displayIntroduction();
  document.title = `${vuln.name} — ${dtitle}`;
  eid('title').innerText = vuln.name;
  eid('header').style.display = 'block';
  eid('previous').style.display = vuln.id > 1 ? 'block' : 'none';
  eid('next').style.display = vuln.id < maxIds[vuln.type] ? 'block' : 'none';
  eid('introduction').style.display = 'none';
  preload(vuln.name).catch(e => { throw e; });
  switch (vuln.type) {
    case 'npm': return displayNpm(vuln);
    case 'core': return displayCore(vuln);
  }
}

function displayNpm(vuln) {
  eid('eco-title').innerText = vuln.title;
  eid('eco-overview').innerText = vuln.overview || '';
  eid('eco-module-link').innerText = vuln.module_name;
  eid('eco-module-link').href = `https://www.npmjs.com/package/${vuln.module_name}`;
  eid('eco-cvss').innerText = vuln.cvss_vector;
  eid('eco-score').innerText = vuln.cvss_score;
  eid('eco-author').innerText = vuln.author;
  eid('eco-publish').innerText = vuln.publish_date.toISOString().slice(0, 10);
  eid('eco-vulnerable').innerText = vuln.vulnerable_versions || '?';
  eid('eco-patched').innerText = vuln.patched_versions || '?';
  eid('eco-cves').innerText = vuln.cves.join(', ') || 'none';
  eid('eco-recommendation').innerText = vuln.recommendation || '';
  eid('eco-references').innerText = vuln.references || '';
  eid('eco-downloads').innerText = vuln.downloads || '?';
  eid('core').style.display = 'none';
  eid('eco').style.display = 'block';
}

function displayCore(vuln) {
}

function displayIntroduction() {
  document.title = dtitle;
  eid('title').innerText = dtitle;
  eid('header').style.display = 'block';
  eid('core').style.display = 'none';
  eid('eco').style.display = 'none';
  eid('previous').style.display = 'none';
  eid('next').style.display = 'none';
  eid('introduction').style.display = 'block';
}

async function show(name) {
  if (name === shown) return;
  shown = name;
  if (name) {
    let vuln;
    try {
      vuln = await get(name);
    } catch (e) {
      return show('');
    }
    display(vuln);
  } else {
    displayIntroduction();
  }
  document.location.hash = name ? `#${name}` : '';
}

async function showHash() {
  const name = document.location.hash.slice(1);
  await show(name);
  eid('loading').style.display = 'none';
}

async function main() {
  await showHash();
  await Promise.all(['NSWG-ECO-1', 'NSWG-CORE-1'].map(preload));
}

eid('next').addEventListener('mousedown', () => {
  showNext(1).catch(e => { throw e; });
});

eid('previous').addEventListener('mousedown', () => {
  showNext(-1).catch(e => { throw e; });
});

window.addEventListener('hashchange', () => {
  showHash().catch(e => { throw e; });
}, false);

document.addEventListener('keydown', event => {
  switch (event.key) {
    case 'ArrowRight':
      showNext(1).catch(e => { throw e; });
      break;
    case 'ArrowLeft':
      showNext(-1).catch(e => { throw e; });
      break;
  }
}, false);

main().catch(e => { throw e; });
