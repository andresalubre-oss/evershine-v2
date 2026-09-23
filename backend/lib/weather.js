// backend/lib/weather.js
//
// Admin-only weather/marine conditions for the Padre Burgos <-> Limasawa
// crossing, via Open-Meteo (open, free, no API key — see the docs at
// https://open-meteo.com). This is a convenience indicator for the admin,
// not a substitute for an official PAGASA advisory: Open-Meteo aggregates
// global/regional models (ECMWF, GFS, JMA, etc), not a Philippines-specific
// one, so it's fine for a general read on conditions but shouldn't be
// treated as authoritative for actual sailing/safety decisions. The
// "advisory" field below is our own simple threshold rule, not anything
// Open-Meteo itself calculates or endorses.

const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';

// Roughly the midpoint of the strait between Padre Burgos (10.0296, 125.0170)
// and Limasawa Island (9.9078, 125.0750) — the two ports are close enough
// that one coordinate pair reasonably represents the crossing itself.
const LAT = 9.9687;
const LON = 125.0460;

// Plain-language labels for Open-Meteo's WMO weather codes — only the
// subset that's realistic for this tropical coastal location (no snow
// codes, etc).
const WEATHER_CODE_LABELS = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

function weatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || 'Unknown';
}

// Our own general-purpose thresholds, not an official standard — flags
// conditions that would give a small ferry/banca operator pause. Easy to
// tune here if they turn out too sensitive/insensitive in practice.
function advisoryLevel(windKmh, waveM) {
  const wind = Number(windKmh) || 0;
  const wave = waveM == null ? 0 : Number(waveM);
  if (wind > 40 || wave > 2.0) return 'rough';
  if (wind > 25 || wave > 1.0) return 'caution';
  return 'normal';
}

// Cached in memory (not in the database — this is live third-party data,
// not something the app owns) so the admin dashboard doesn't re-hit
// Open-Meteo on every page load/tab switch. 30 minutes comfortably matches
// how often marine forecasts actually change.
const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = { data: null, fetchedAt: 0 };

async function fetchOpenMeteo(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }
  return response.json();
}

async function getWeather() {
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const forecastUrl =
    `${FORECAST_API}?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum` +
    `&timezone=Asia%2FManila&forecast_days=5`;

  const marineUrl =
    `${MARINE_API}?latitude=${LAT}&longitude=${LON}` +
    `&current=wave_height,wave_period` +
    `&daily=wave_height_max,wave_period_max` +
    `&timezone=Asia%2FManila&forecast_days=5`;

  // Marine data can occasionally be unavailable for a given point/model
  // update window even when the regular forecast is fine — fetched
  // separately (not Promise.all with a shared catch) so a marine hiccup
  // still leaves the rest of the forecast usable rather than failing the
  // whole tab.
  const forecast = await fetchOpenMeteo(forecastUrl);
  let marine = null;
  try {
    marine = await fetchOpenMeteo(marineUrl);
  } catch (err) {
    console.error('Marine forecast unavailable:', err.message);
  }

  const currentWaveHeight = marine?.current?.wave_height ?? null;
  const currentWavePeriod = marine?.current?.wave_period ?? null;

  const result = {
    location: { latitude: LAT, longitude: LON, label: 'Padre Burgos ↔ Limasawa strait' },
    generatedAt: new Date().toISOString(),
    current: {
      temperatureC: forecast.current.temperature_2m,
      windSpeedKmh: forecast.current.wind_speed_10m,
      windDirectionDeg: forecast.current.wind_direction_10m,
      precipitationMm: forecast.current.precipitation,
      condition: weatherLabel(forecast.current.weather_code),
      waveHeightM: currentWaveHeight,
      wavePeriodS: currentWavePeriod,
      advisory: advisoryLevel(forecast.current.wind_speed_10m, currentWaveHeight),
    },
    daily: forecast.daily.time.map((date, i) => {
      const windMax = forecast.daily.wind_speed_10m_max[i];
      const waveMax = marine?.daily?.wave_height_max?.[i] ?? null;
      return {
        date,
        condition: weatherLabel(forecast.daily.weather_code[i]),
        tempMaxC: forecast.daily.temperature_2m_max[i],
        tempMinC: forecast.daily.temperature_2m_min[i],
        windSpeedMaxKmh: windMax,
        precipitationMm: forecast.daily.precipitation_sum[i],
        waveHeightMaxM: waveMax,
        wavePeriodMaxS: marine?.daily?.wave_period_max?.[i] ?? null,
        advisory: advisoryLevel(windMax, waveMax),
      };
    }),
    marineDataAvailable: marine !== null,
  };

  cache = { data: result, fetchedAt: Date.now() };
  return result;
}

module.exports = { getWeather };
