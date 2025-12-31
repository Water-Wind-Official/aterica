// Planetary Essential Dignity calculations using Swiss Ephemeris
// Based on traditional astrology with high-precision calculations

import SwissEPH from "sweph-wasm";

export type Planet = 
	| "Sun" 
	| "Moon" 
	| "Mercury" 
	| "Venus" 
	| "Mars" 
	| "Jupiter" 
	| "Saturn";

export type ZodiacSign = 
	| "Aries" 
	| "Taurus" 
	| "Gemini" 
	| "Cancer" 
	| "Leo" 
	| "Virgo" 
	| "Libra" 
	| "Scorpio" 
	| "Sagittarius" 
	| "Capricorn" 
	| "Aquarius" 
	| "Pisces";

export interface PlanetaryDignity {
	planet: Planet;
	sign: ZodiacSign;
	dignity: "Domicile" | "Exaltation" | "Detriment" | "Fall" | "Neutral";
	score: number; // -10 to +10
	isRetrograde: boolean;
}

// Swiss Ephemeris planet numbers
const PLANET_NUMBERS: Record<Planet, number> = {
	Sun: 0,
	Moon: 1,
	Mercury: 2,
	Venus: 3,
	Mars: 4,
	Jupiter: 5,
	Saturn: 6,
};

// Essential Dignity tables
const PLANETARY_DIGNITIES: Record<Planet, {
	domiciles: ZodiacSign[];
	exaltation: ZodiacSign;
	detriment: ZodiacSign[];
	fall: ZodiacSign;
}> = {
	Sun: {
		domiciles: ["Leo"],
		exaltation: "Aries",
		detriment: ["Aquarius"],
		fall: "Libra",
	},
	Moon: {
		domiciles: ["Cancer"],
		exaltation: "Taurus",
		detriment: ["Capricorn"],
		fall: "Scorpio",
	},
	Mercury: {
		domiciles: ["Gemini", "Virgo"],
		exaltation: "Virgo",
		detriment: ["Sagittarius", "Pisces"],
		fall: "Pisces",
	},
	Venus: {
		domiciles: ["Taurus", "Libra"],
		exaltation: "Pisces",
		detriment: ["Aries", "Scorpio"],
		fall: "Virgo",
	},
	Mars: {
		domiciles: ["Aries", "Scorpio"],
		exaltation: "Capricorn",
		detriment: ["Libra", "Taurus"],
		fall: "Cancer",
	},
	Jupiter: {
		domiciles: ["Sagittarius", "Pisces"],
		exaltation: "Cancer",
		detriment: ["Gemini", "Virgo"],
		fall: "Capricorn",
	},
	Saturn: {
		domiciles: ["Capricorn", "Aquarius"],
		exaltation: "Libra",
		detriment: ["Cancer", "Leo"],
		fall: "Aries",
	},
};

// Zodiac signs in order (0° = Aries, 30° = Taurus, etc.)
const ZODIAC_SIGNS: ZodiacSign[] = [
	"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
	"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

// Initialize Swiss Ephemeris (call this once, cache the result)
let sweInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function initSwissEphemeris(): Promise<any> {
	if (sweInstance) {
		return sweInstance;
	}
	
	if (initPromise) {
		return initPromise;
	}
	
	initPromise = (async () => {
		// Use CDN path - works perfectly for Cloudflare deployments
		// No need to serve WASM files locally when using CDN
		const cdnPath = "https://unpkg.com/sweph-wasm@2.6.9/dist/wasm/swisseph.wasm";
		const swe = await SwissEPH.init(cdnPath);
		await swe.swe_set_ephe_path(); // Use default ephemeris files from CDN
		sweInstance = swe;
		return swe;
	})();
	
	return initPromise;
}

// Convert longitude (0-360°) to zodiac sign
function longitudeToSign(longitude: number): ZodiacSign {
	// Normalize to 0-360
	longitude = longitude % 360;
	if (longitude < 0) longitude += 360;
	
	// Each sign is 30 degrees
	const signIndex = Math.floor(longitude / 30);
	return ZODIAC_SIGNS[signIndex];
}

// Get planet position from Swiss Ephemeris
async function getPlanetPosition(
	swe: any,
	planet: Planet,
	date: Date
): Promise<{ longitude: number; isRetrograde: boolean }> {
	const planetNumber = PLANET_NUMBERS[planet];
	
	// Convert date to Julian Day
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1; // Swiss Ephemeris uses 1-12
	const day = date.getUTCDate();
	const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
	
	const julianDay = swe.swe_julday(year, month, day, hour, 1); // 1 = Gregorian calendar
	
	// Calculate planet position
	// Try with speed flag first (0x0002 = SEFLG_SPEED)
	let flag = 0x0002;
	let result = swe.swe_calc_ut(julianDay, planetNumber, flag);
	
	// Check for errors
	if (result && typeof result === 'object' && 'error' in result && result.error) {
		// Try without speed flag as fallback
		flag = 0;
		result = swe.swe_calc_ut(julianDay, planetNumber, flag);
		if (result && typeof result === 'object' && 'error' in result && result.error) {
			throw new Error(`Swiss Ephemeris error: ${result.error}`);
		}
	}
	
	// Handle array result: [longitude, latitude, distance, speedInLongitude, speedInLatitude, speedInDistance]
	const positions = Array.isArray(result) ? result : (result && typeof result === 'object' ? Object.values(result) : [result]);
	const longitude = positions[0] || 0;
	
	// Determine retrograde motion
	let isRetrograde = false;
	if (flag === 0x0002 && positions[3] !== undefined) {
		// Speed in longitude is at index 3 when speed flag is used
		// Negative speed = retrograde motion
		isRetrograde = positions[3] < 0;
	} else {
		// Fallback: calculate speed by comparing positions at two nearby times
		// Use 1 hour difference to calculate speed
		const julianDay1 = julianDay;
		const julianDay2 = julianDay + (1 / 24.0); // 1 hour later
		
		const result1 = swe.swe_calc_ut(julianDay1, planetNumber, 0);
		const result2 = swe.swe_calc_ut(julianDay2, planetNumber, 0);
		
		const pos1 = Array.isArray(result1) ? result1 : (result1 && typeof result1 === 'object' ? Object.values(result1) : [result1]);
		const pos2 = Array.isArray(result2) ? result2 : (result2 && typeof result2 === 'object' ? Object.values(result2) : [result2]);
		
		const long1 = pos1[0] || 0;
		const long2 = pos2[0] || 0;
		
		// Normalize longitude difference (handle 360° wrap)
		let diff = long2 - long1;
		if (diff > 180) diff -= 360;
		if (diff < -180) diff += 360;
		
		// Negative change = retrograde
		isRetrograde = diff < 0;
	}
	
	return { longitude, isRetrograde };
}

// Calculate Essential Dignity score for a planet
function calculateDignityScore(
	planet: Planet,
	sign: ZodiacSign,
	isRetrograde: boolean = false
): PlanetaryDignity {
	const dignities = PLANETARY_DIGNITIES[planet];
	let dignity: PlanetaryDignity["dignity"] = "Neutral";
	let score = 0;

	// Check Domicile (Home - strongest)
	if (dignities.domiciles.includes(sign)) {
		dignity = "Domicile";
		score = 5;
	}
	// Check Exaltation (Honored guest)
	else if (sign === dignities.exaltation) {
		dignity = "Exaltation";
		score = 4;
	}
	// Check Detriment (Exile - weak)
	else if (dignities.detriment.includes(sign)) {
		dignity = "Detriment";
		score = -5;
	}
	// Check Fall (Humiliated - weakest)
	else if (sign === dignities.fall) {
		dignity = "Fall";
		score = -4;
	}

	// Retrograde penalty
	if (isRetrograde) {
		score -= 2;
	}

	// Clamp score to -10 to +10
	score = Math.max(-10, Math.min(10, score));

	return {
		planet,
		sign,
		dignity,
		score,
		isRetrograde,
	};
}

// Get all planets with their current dignity using Swiss Ephemeris
export async function getAllPlanetaryDignities(date: Date): Promise<PlanetaryDignity[]> {
	const swe = await initSwissEphemeris();
	const planets: Planet[] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
	
	const results = await Promise.all(
		planets.map(async (planet) => {
			const { longitude, isRetrograde } = await getPlanetPosition(swe, planet, date);
			const sign = longitudeToSign(longitude);
			return calculateDignityScore(planet, sign, isRetrograde);
		})
	);
	
	return results;
}

// Get day ruler
export function getDayRuler(date: Date): Planet {
	const dayOfWeek = date.getDay();
	const dayRulers: Planet[] = [
		"Sun",   // Sunday
		"Moon",  // Monday
		"Mars",  // Tuesday
		"Mercury", // Wednesday
		"Jupiter", // Thursday
		"Venus",   // Friday
		"Saturn",  // Saturday
	];
	return dayRulers[dayOfWeek];
}

// Get planetary hour ruler (simplified - would need lat/long for accurate calculation)
export function getHourRuler(date: Date): Planet {
	// Chaldean order: Saturn -> Jupiter -> Mars -> Sun -> Venus -> Mercury -> Moon
	const chaldeanOrder: Planet[] = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
	const hoursSinceMidnight = date.getHours();
	const hourIndex = hoursSinceMidnight % 7;
	return chaldeanOrder[hourIndex];
}
