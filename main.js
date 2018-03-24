const repo = `https://raw.githubusercontent.com/nodejs/security-wg/master/vuln`;
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
  vulns.set(name, vuln);
  return vuln;
}

async function showNext(step = 1) {
  if (!shown) return;
  const vuln = await getNext(shown, step);
  if (!vuln) return show('');
  return show(vuln.name);
}

async function getNext(name, step = 1) {
  const { type, id } = parseName(name);
  for (let i = 1; i <= 10; i++) {
    const vuln = await get(buildName(type, id + i * step));
    if (vuln) return vuln;
  }
  return null;
}

async function preload(name) {
  await get(name);
  for (let i = 0; i < 2; i++) {
    const vuln = await getNext(name);
    if (!vuln) return;
    name = vuln.name;
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
  eid('eco-module').innerText = vuln.module_name;
  eid('eco-module').href = `https://www.npmjs.com/package/${vuln.module_name}`;
  eid('eco-recommendation').innerText = vuln.recommendation || '';
  eid('eco-references').innerText = vuln.references || '';
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

eid('next').addEventListener('click', () => {
  showNext(1).catch(e => { throw e; });
});

eid('previous').addEventListener('click', () => {
  showNext(-1).catch(e => { throw e; });
});

window.addEventListener('hashchange', () => {
  showHash().catch(e => { throw e; });
}, false);

main().catch(e => { throw e; });
