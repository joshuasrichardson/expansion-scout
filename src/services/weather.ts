/**
 * Today's field-work weather via Open-Meteo (https://open-meteo.com) — free,
 * keyless, and privacy-clean: the request carries ONLY coordinates, never
 * anything about the business. Field operators live and die by the sky, so the
 * Daily Mission and Today's Plan surface one plain-English line about it.
 *
 * Same resilience contract as every other external source: short timeout,
 * null on any failure, and the UI simply omits the line — never blocks.
 */

export interface DayWeather {
  /** e.g. "Sunny", "Light rain". */
  summary: string;
  maxTempF: number;
  precipChancePct: number;
  /** True when it's a reasonable day to be working / walking in outside. */
  goodForFieldWork: boolean;
  /** One plain-English planning line for the owner. */
  hint: string;
}

const TIMEOUT_MS = 4000;

/** WMO weather codes → a short human word. */
function describe(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Mostly sunny';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Storms';
}

export async function getTodayWeather(
  latitude: number,
  longitude: number,
): Promise<DayWeather | null> {
  // A profile without a resolved location can't be forecast.
  if (!latitude && !longitude) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}` +
      '&daily=temperature_2m_max,precipitation_probability_max,weather_code' +
      '&temperature_unit=fahrenheit&forecast_days=1&timezone=auto';
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        temperature_2m_max?: number[];
        precipitation_probability_max?: number[];
        weather_code?: number[];
      };
    };
    const maxTempF = json.daily?.temperature_2m_max?.[0];
    const precip = json.daily?.precipitation_probability_max?.[0] ?? 0;
    const code = json.daily?.weather_code?.[0] ?? 0;
    if (typeof maxTempF !== 'number') return null;

    const summary = describe(code);
    const goodForFieldWork = precip < 40 && maxTempF >= 35 && maxTempF <= 102;
    const hint = goodForFieldWork
      ? `${summary}, high ${Math.round(maxTempF)}° — a good day to be out making the rounds.`
      : precip >= 40
        ? `${summary}, ${precip}% chance of precipitation — favor calls and emails today.`
        : `${summary}, high ${Math.round(maxTempF)}° — plan around the temperature today.`;

    return { summary, maxTempF, precipChancePct: precip, goodForFieldWork, hint };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
