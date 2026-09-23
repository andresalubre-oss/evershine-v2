// backend/lib/pagasaBulletin.js
//
// PAGASA has no official public API, so this reads their public "Daily
// Weather" bulletin page directly and pulls out just the two most stable
// pieces of it: the "Issued at" timestamp and the Synopsis paragraph.
// Deliberately NOT parsing the region-by-region tables further down that
// page — their layout and groupings shift bulletin to bulletin, so a
// parser built against those would be far more likely to silently break.
// This is an unofficial scrape of a government site, not a supported
// integration: if PAGASA changes their page structure, extraction below
// will start failing loudly (see the thrown error), not silently return
// wrong data.

const BULLETIN_PAGE_URL = 'https://www.pagasa.dost.gov.ph/weather';

// PAGASA publishes the same-named PDF at this fixed path for whatever the
// current bulletin is — no scraping needed for this one, it's just a
// stable convention, and it's a good "if our scrape ever breaks, here's
// the real source" fallback link for the admin regardless.
const OFFICIAL_PDF_URL = 'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/pf.pdf';

// PAGASA issues a handful of bulletins a day, not continuously — no need
// to hit their site more often than this.
const CACHE_TTL_MS = 15 * 60 * 1000;
let cache = { data: null, fetchedAt: 0 };

async function getPagasaBulletin() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const response = await fetch(BULLETIN_PAGE_URL, {
      headers: {
        // Identifies the request honestly rather than spoofing a browser —
        // this is a small school project's admin dashboard, not a bot
        // trying to hide what it is.
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
    // A temporarily unreachable or reshuffled PAGASA page shouldn't make
    // the whole panel look broken if we still have a recent copy — prefer
    // showing that, clearly marked as stale, over a hard error.
    if (cache.data) {
      return { ...cache.data, stale: true };
    }
    throw err;
  }
}

module.exports = { getPagasaBulletin };
