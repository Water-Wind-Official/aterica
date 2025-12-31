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
	longitude: number; // For alignment calculations
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

// Element associations for signs
export type Element = "Fire" | "Earth" | "Air" | "Water";

export const SIGN_ELEMENTS: Record<ZodiacSign, Element> = {
	Aries: "Fire",
	Taurus: "Earth",
	Gemini: "Air",
	Cancer: "Water",
	Leo: "Fire",
	Virgo: "Earth",
	Libra: "Air",
	Scorpio: "Water",
	Sagittarius: "Fire",
	Capricorn: "Earth",
	Aquarius: "Air",
	Pisces: "Water",
};

export interface PlanetaryAlignment {
	planets: Planet[];
	type: "Conjunction" | "Opposition" | "Grand Trine" | "T-Square" | "Grand Cross" | "Stellium" | "Linear";
	description: string;
	strength: number; // 0-100
}

export interface UpcomingEvent {
	type: "Solstice" | "Equinox" | "Eclipse" | "Meteor Shower" | "Planetary Alignment";
	name: string;
	date: Date;
	description: string;
}

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
		longitude: 0, // Will be set by caller
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
			const dignity = calculateDignityScore(planet, sign, isRetrograde);
			return { ...dignity, longitude };
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

// Calculate angular distance between two longitudes (0-180°)
function angularDistance(lon1: number, lon2: number): number {
	let diff = Math.abs(lon1 - lon2);
	if (diff > 180) diff = 360 - diff;
	return diff;
}

// Normalize longitude to 0-360
function normalizeLongitude(lon: number): number {
	lon = lon % 360;
	if (lon < 0) lon += 360;
	return lon;
}

// Check if planets form a straight line (alignment)
// This detects conjunctions, oppositions, and linear alignments
export function detectAlignments(dignities: PlanetaryDignity[]): PlanetaryAlignment[] {
	const alignments: PlanetaryAlignment[] = [];
	const tolerance = 8; // degrees tolerance for alignment
	
	// Check for conjunctions (planets close together)
	for (let i = 0; i < dignities.length; i++) {
		for (let j = i + 1; j < dignities.length; j++) {
			const dist = angularDistance(dignities[i].longitude, dignities[j].longitude);
			if (dist <= tolerance) {
				alignments.push({
					planets: [dignities[i].planet, dignities[j].planet],
					type: "Conjunction",
					description: `${dignities[i].planet} and ${dignities[j].planet} are in conjunction`,
					strength: Math.round(100 * (1 - dist / tolerance)),
				});
			}
		}
	}
	
	// Check for oppositions (180° apart)
	for (let i = 0; i < dignities.length; i++) {
		for (let j = i + 1; j < dignities.length; j++) {
			const dist = angularDistance(dignities[i].longitude, dignities[j].longitude);
			if (Math.abs(dist - 180) <= tolerance) {
				alignments.push({
					planets: [dignities[i].planet, dignities[j].planet],
					type: "Opposition",
					description: `${dignities[i].planet} and ${dignities[j].planet} are in opposition`,
					strength: Math.round(100 * (1 - Math.abs(dist - 180) / tolerance)),
				});
			}
		}
	}
	
	// Check for linear alignments (3+ planets forming a line)
	// This checks if planets are roughly aligned in a straight line
	for (let i = 0; i < dignities.length; i++) {
		for (let j = i + 1; j < dignities.length; j++) {
			for (let k = j + 1; k < dignities.length; k++) {
				const lon1 = normalizeLongitude(dignities[i].longitude);
				const lon2 = normalizeLongitude(dignities[j].longitude);
				const lon3 = normalizeLongitude(dignities[k].longitude);
				
				// Sort longitudes
				const sorted = [lon1, lon2, lon3].sort((a, b) => a - b);
				
				// Check if they form a line (consecutive or wrap around)
				const dist1 = sorted[1] - sorted[0];
				const dist2 = sorted[2] - sorted[1];
				const dist3 = 360 - sorted[2] + sorted[0]; // wrap around distance
				
				// Check if any two distances are similar (forming a line)
				const linearTolerance = 15; // degrees
				if (Math.abs(dist1 - dist2) <= linearTolerance || 
					Math.abs(dist2 - dist3) <= linearTolerance ||
					Math.abs(dist3 - dist1) <= linearTolerance) {
					alignments.push({
						planets: [dignities[i].planet, dignities[j].planet, dignities[k].planet],
						type: "Linear",
						description: `${dignities[i].planet}, ${dignities[j].planet}, and ${dignities[k].planet} form a linear alignment`,
						strength: 75,
					});
				}
			}
		}
	}
	
	// Check for stellium (3+ planets in same sign)
	const signGroups: Record<ZodiacSign, PlanetaryDignity[]> = {} as any;
	dignities.forEach(d => {
		if (!signGroups[d.sign]) signGroups[d.sign] = [];
		signGroups[d.sign].push(d);
	});
	
	Object.entries(signGroups).forEach(([sign, planets]) => {
		if (planets.length >= 3) {
			alignments.push({
				planets: planets.map(p => p.planet),
				type: "Stellium",
				description: `${planets.length} planets in ${sign}`,
				strength: planets.length * 15,
			});
		}
	});
	
	return alignments;
}

// Get upcoming astrological events
export async function getUpcomingEvents(startDate: Date, daysAhead: number = 365): Promise<UpcomingEvent[]> {
	const events: UpcomingEvent[] = [];
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + daysAhead);
	
	// Calculate solstices and equinoxes
	const currentYear = startDate.getFullYear();
	const nextYear = endDate.getFullYear();
	
	for (let year = currentYear; year <= nextYear; year++) {
		// Spring Equinox (around March 20)
		const springEquinox = new Date(year, 2, 20);
		if (springEquinox >= startDate && springEquinox <= endDate) {
			events.push({
				type: "Equinox",
				name: "Spring Equinox",
				date: springEquinox,
				description: "Day and night are equal length. Spring begins in the Northern Hemisphere.",
			});
		}
		
		// Summer Solstice (around June 21)
		const summerSolstice = new Date(year, 5, 21);
		if (summerSolstice >= startDate && summerSolstice <= endDate) {
			events.push({
				type: "Solstice",
				name: "Summer Solstice",
				date: summerSolstice,
				description: "Longest day of the year. Summer begins in the Northern Hemisphere.",
			});
		}
		
		// Fall Equinox (around September 22)
		const fallEquinox = new Date(year, 8, 22);
		if (fallEquinox >= startDate && fallEquinox <= endDate) {
			events.push({
				type: "Equinox",
				name: "Autumn Equinox",
				date: fallEquinox,
				description: "Day and night are equal length. Autumn begins in the Northern Hemisphere.",
			});
		}
		
		// Winter Solstice (around December 21)
		const winterSolstice = new Date(year, 11, 21);
		if (winterSolstice >= startDate && winterSolstice <= endDate) {
			events.push({
				type: "Solstice",
				name: "Winter Solstice",
				date: winterSolstice,
				description: "Shortest day of the year. Winter begins in the Northern Hemisphere.",
			});
		}
	}
	
	// Add major meteor showers (approximate dates)
	const meteorShowers = [
		{ name: "Quadrantids", month: 0, day: 3, description: "Peak meteor shower in January" },
		{ name: "Lyrids", month: 3, day: 22, description: "Spring meteor shower" },
		{ name: "Perseids", month: 7, day: 12, description: "Most popular summer meteor shower" },
		{ name: "Orionids", month: 9, day: 21, description: "Autumn meteor shower" },
		{ name: "Leonids", month: 10, day: 17, description: "November meteor shower" },
		{ name: "Geminids", month: 11, day: 14, description: "Peak winter meteor shower" },
	];
	
	meteorShowers.forEach(shower => {
		const eventDate = new Date(currentYear, shower.month, shower.day);
		if (eventDate < startDate) {
			eventDate.setFullYear(currentYear + 1);
		}
		if (eventDate >= startDate && eventDate <= endDate) {
			events.push({
				type: "Meteor Shower",
				name: shower.name,
				date: eventDate,
				description: shower.description,
			});
		}
	});
	
	// Sort by date
	events.sort((a, b) => a.date.getTime() - b.date.getTime());
	
	return events.slice(0, 10); // Return next 10 events
}
