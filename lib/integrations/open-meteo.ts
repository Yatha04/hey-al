// Open-Meteo weather: free, no API key. Two calls: geocode the city, then the forecast.

const TIMEOUT_MS = 5000;

// WMO weather codes (https://open-meteo.com/en/docs), as words Al can say.
const CONDITIONS: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy",
  45: "foggy", 48: "foggy",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "rain showers", 81: "rain showers", 82: "heavy rain showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail",
};

export type Place = { city: string; zip: string; timezone: string };

type Day = { date: string; conditions: string; highF: number; lowF: number; chanceOfRainPercent: number };

export type Weather = {
  current: { conditions: string; temperatureF: number; feelsLikeF: number; windMph: number };
  today: Day;
  tomorrow: Day;
};

type GeocodeResponse = { results?: { latitude: number; longitude: number; postcodes?: string[] }[] };

type ForecastResponse = {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function getWeather(place: Place): Promise<Weather> {
  // Many US towns share a name, so pick the match whose postcodes include the person's ZIP.
  const geo = await getJson<GeocodeResponse>(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: place.city, count: "10", countryCode: "US" })}`,
  );
  const match = geo.results?.find((r) => r.postcodes?.includes(place.zip)) ?? geo.results?.[0];
  if (!match) throw new Error(`Open-Meteo found no place named ${place.city}`);

  const forecast = await getJson<ForecastResponse>(
    `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
      latitude: String(match.latitude),
      longitude: String(match.longitude),
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: place.timezone, // so "today" is the person's today
      forecast_days: "2",
    })}`,
  );
  const { current, daily } = forecast;
  const day = (i: number): Day => ({
    date: daily.time[i],
    conditions: CONDITIONS[daily.weather_code[i]] ?? "mixed",
    highF: Math.round(daily.temperature_2m_max[i]),
    lowF: Math.round(daily.temperature_2m_min[i]),
    chanceOfRainPercent: daily.precipitation_probability_max[i],
  });
  return {
    current: {
      conditions: CONDITIONS[current.weather_code] ?? "mixed",
      temperatureF: Math.round(current.temperature_2m),
      feelsLikeF: Math.round(current.apparent_temperature),
      windMph: Math.round(current.wind_speed_10m),
    },
    today: day(0),
    tomorrow: day(1),
  };
}
