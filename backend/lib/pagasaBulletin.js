const BULLETIN_PAGE_URL = 'https://www.pagasa.dost.gov.ph/weather';

const OFFICIAL_PDF_URL = 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/pf.pdf';


const CACHE_TTL_MS = 15 * 60 * 1000;
let cache = { data: null, fetchedAt: 0 };

async function getPagasaBulletin() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const response = await fetch(BULLETIN_PAGE_URL, {
      headers: {
      
        'User-Agent': 'EvershineBookingAdminDashboard/1.0 (school project; evershinebooking.com)',
      },
    });
    if (!response.ok) {
      throw new Error(`PAGASA's site returned ${response.status}`);
    }
    const html = await response.text();

    const issuedMatch = html.match(/<b>\s*Issued at:\s*(.+?)\s*<\/b>/i);
    const synopsisMatch = html.match(/panel-heading">\s*Synopsis\s*<\/div>\s*<div class="panel-body">\s*<p>([\s\S]*?)<\/p>/i);

    if (!issuedMatch) {
      throw new Error("Couldn't find the bulletin timestamp on PAGASA's page — their layout may have changed.");
    }

    const result = {
      issuedAt: issuedMatch[1].replace(/\s+/g, ' ').trim(),
      synopsis: synopsisMatch ? synopsisMatch[1].replace(/\s+/g, ' ').trim() : null,
      sourceUrl: BULLETIN_PAGE_URL,
      pdfUrl: OFFICIAL_PDF_URL,
      fetchedAt: new Date().toISOString(),
      stale: false,
    };
    cache = { data: result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
  
    if (cache.data) {
      return { ...cache.data, stale: true };
    }
    throw err;
  }
}

module.exports = { getPagasaBulletin };
