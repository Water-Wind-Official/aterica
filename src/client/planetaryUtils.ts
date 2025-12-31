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
export type Element = "Fire" | "Earth" | "Air" | "Water" | "Spirit";

export type Tattva = "Akasha" | "Vayu" | "Tejas" | "Apas" | "Prithvi";

export interface ElementalBreakdown {
	source: "Base Percentages" | "Planetary Positions" | "Planetary Hour" | "Tattva" | "Constants" | "Latitude" | "Time of Day" | "Season" | "Weather";
	weight: number; // percentage weight (not used in new system, kept for compatibility)
	fire: number;
	earth: number;
	air: number;
	water: number;
	spirit: number;
	details?: string; // Description of this component
}

export interface ElementalProfile {
	fire: number;
	earth: number;
	air: number;
	water: number;
	spirit: number;
	planetaryHour: Planet;
	tattva: Tattva;
	moonSign?: ZodiacSign;
	breakdown: ElementalBreakdown[]; // Visual breakdown of calculation
}

export interface Location {
	latitude: number;
	longitude: number;
	zipCode?: string;
}

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
	visibility?: string; // For meteor showers - where they're visible
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

// Calculate sunrise and sunset times using Swiss Ephemeris
export async function calculateSunriseSunset(
	date: Date,
	latitude: number,
	longitude: number
): Promise<{ sunrise: Date; sunset: Date }> {
	const swe = await initSwissEphemeris();
	
	// Swiss Ephemeris swe_rise_trans calculates local sunrise/sunset for the given longitude
	// The date parameter represents the user's selected date/time (in browser's local timezone)
	// We need to determine which calendar day we want sunrise/sunset for
	// Use local date components to get the correct day, then convert to UT for Julian Day
	const localYear = date.getFullYear();
	const localMonth = date.getMonth() + 1;
	const localDay = date.getDate();
	// Create a date at noon local time for that calendar day
	const localNoon = new Date(localYear, localMonth - 1, localDay, 12, 0, 0);
	// Convert to UT components for Swiss Ephemeris (which expects UT)
	const year = localNoon.getUTCFullYear();
	const month = localNoon.getUTCMonth() + 1;
	const day = localNoon.getUTCDate();
	const hour = localNoon.getUTCHours() + localNoon.getUTCMinutes() / 60;
	const julianDay = swe.swe_julday(year, month, day, hour, 1);
	
	// Calculate sunrise (SE_CALC_RISE = 1)
	// swe_rise_trans returns { flag, error, data } where data is the Julian Day
	const sunriseResult = swe.swe_rise_trans(
		julianDay,
		0, // Sun
		null, // No star name
		0, // No special flags
		1, // SE_CALC_RISE
		[longitude, latitude, 0], // [longitude, latitude, elevation]
		1013.25, // Standard atmospheric pressure (mbar)
		15.0 // Standard temperature (celsius)
	);
	
	// Calculate sunset (SE_CALC_SET = 2)
	const sunsetResult = swe.swe_rise_trans(
		julianDay,
		0, // Sun
		null,
		0,
		2, // SE_CALC_SET
		[longitude, latitude, 0],
		1013.25,
		15.0
	);
	
	// Check for errors
	if (sunriseResult.flag < 0 || sunsetResult.flag < 0) {
		throw new Error(`Sunrise/sunset calculation error: ${sunriseResult.error || sunsetResult.error}`);
	}
	
	// Convert Julian Day back to Date
	const sunriseDate = await julianDayToDate(sunriseResult.data);
	const sunsetDate = await julianDayToDate(sunsetResult.data);
	
	return { sunrise: sunriseDate, sunset: sunsetDate };
}

// Convert Julian Day to Date (local time)
// Swiss Ephemeris swe_rise_trans calculates local sunrise/sunset for the given longitude
// The Julian Day it returns represents the local time, but in UT format
// We need to interpret it as local time for the location
async function julianDayToDate(jd: number): Promise<Date> {
	const swe = await initSwissEphemeris();
	const result = swe.swe_revjul(jd, 1); // 1 = Gregorian
	const hour = result.hour || 0;
	const minute = Math.floor((hour % 1) * 60);
	const second = Math.floor(((hour % 1) * 60 % 1) * 60);
	// Swiss Ephemeris swe_rise_trans with longitude returns local time for that location
	// but as a UT Julian Day. We interpret the components as local time.
	// Create Date in local timezone (not UTC) since swe_rise_trans already accounted for longitude
	return new Date(result.year, result.month - 1, result.day, Math.floor(hour), minute, second);
}

// Get Planetary Hour based on sunrise/sunset
// For night hours before sunrise, sunset should be yesterday's sunset
export function getPlanetaryHour(
	currentTime: Date,
	sunrise: Date,
	sunset: Date,
	prevSunset?: Date
): { hour: number; ruler: Planet; isDay: boolean } {
	// Chaldean order: Saturn -> Jupiter -> Mars -> Sun -> Venus -> Mercury -> Moon
	const chaldeanOrder: Planet[] = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
	
	// Determine if we're in day or night period
	const isDay = currentTime >= sunrise && currentTime < sunset;
	
	let hourLength: number;
	let timeSinceStart: number;
	let startTime: Date;
	
	if (isDay) {
		// Day hours: from sunrise to sunset, divided into 12
		const dayLength = sunset.getTime() - sunrise.getTime();
		hourLength = dayLength / 12;
		timeSinceStart = currentTime.getTime() - sunrise.getTime();
		startTime = sunrise;
	} else {
		// Night hours: from sunset to next sunrise, divided into 12
		// For night hours, we need to determine which night period we're in
		let nightStart: Date;
		let nightEnd: Date;
		
		if (currentTime < sunrise) {
			// Before sunrise today - use previous night (yesterday's sunset to today's sunrise)
			// Use prevSunset if provided (actual calculated sunset from yesterday), otherwise fall back
			nightStart = prevSunset || (() => {
				const ps = new Date(sunset);
				ps.setDate(ps.getDate() - 1);
				return ps;
			})();
			nightEnd = sunrise;
		} else {
			// After sunset today - use current night (today's sunset to tomorrow's sunrise)
			nightStart = sunset;
			nightEnd = new Date(sunrise);
			nightEnd.setDate(nightEnd.getDate() + 1);
		}
		
		const nightLength = nightEnd.getTime() - nightStart.getTime();
		hourLength = nightLength / 12;
		timeSinceStart = currentTime.getTime() - nightStart.getTime();
		startTime = nightStart;
	}
	
	// Calculate which hour we're in (0-11)
	const hourNumber = Math.floor(timeSinceStart / hourLength);
	// Clamp to valid range (0-11)
	const clampedHourNumber = Math.max(0, Math.min(11, hourNumber));
	
	// Get the day of week for the start of the period (sunrise for day, sunset for night)
	const periodStartDate = new Date(startTime);
	const dayOfWeek = periodStartDate.getDay();
	
	// First hour of day is ruled by the day ruler
	const dayRulers: Planet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
	const dayRuler = dayRulers[dayOfWeek];
	const dayRulerIndex = chaldeanOrder.indexOf(dayRuler);
	
	// Calculate which planet rules this hour
	// The first hour (0) is the day ruler, then we cycle through Chaldean order
	const hourIndex = (dayRulerIndex + clampedHourNumber) % 7;
	const ruler = chaldeanOrder[hourIndex];
	
	return { hour: clampedHourNumber + 1, ruler, isDay };
}

// Get Tattva for current time (2-hour cycles starting at sunrise, 24-minute sub-periods)
export function getTattva(currentTime: Date, sunrise: Date): Tattva {
	const timeSinceSunrise = currentTime.getTime() - sunrise.getTime();
	const minutesSinceSunrise = timeSinceSunrise / (1000 * 60);
	
	// Tattva cycle is 2 hours (120 minutes), repeating
	const cyclePosition = minutesSinceSunrise % 120;
	
	// Each tattva is 24 minutes
	if (cyclePosition < 24) return "Akasha";
	if (cyclePosition < 48) return "Vayu";
	if (cyclePosition < 72) return "Tejas";
	if (cyclePosition < 96) return "Apas";
	return "Prithvi";
}

// Map planet to element
function planetToElement(planet: Planet): Element {
	switch (planet) {
		case "Sun":
		case "Mars":
			return "Fire";
		case "Mercury":
		case "Jupiter":
			return "Air";
		case "Venus":
			return "Water"; // Can also be Earth, but using Water per tradition
		case "Saturn":
			return "Earth";
		case "Moon":
			return "Water";
	}
}

// Map Tattva to element
function tattvaToElement(tattva: Tattva): Element {
	switch (tattva) {
		case "Akasha":
			return "Spirit";
		case "Vayu":
			return "Air";
		case "Tejas":
			return "Fire";
		case "Apas":
			return "Water";
		case "Prithvi":
			return "Earth";
	}
}

// Calculate elemental profile using buff system:
// Start at 0, add buffs from various sources, convert to percentages
export async function calculateElementalProfile(
	date: Date,
	location: Location,
	weather: string | null = null
): Promise<ElementalProfile> {
	// Get sunrise and sunset for today
	const { sunrise, sunset } = await calculateSunriseSunset(date, location.latitude, location.longitude);
	
	// If the time is before sunrise, we also need yesterday's sunset for night hours
	let prevSunset = sunset;
	if (date < sunrise) {
		const prevDate = new Date(date);
		prevDate.setDate(prevDate.getDate() - 1);
		const prevDayTimes = await calculateSunriseSunset(prevDate, location.latitude, location.longitude);
		prevSunset = prevDayTimes.sunset;
	}
	
	const planetaryHour = getPlanetaryHour(date, sunrise, sunset, prevSunset);
	const tattva = getTattva(date, sunrise);
	
	const tattvaElement = tattvaToElement(tattva);
	
	// Get all planetary positions
	const dignities = await getAllPlanetaryDignities(date);
	
	const moonDignity = dignities.find(d => d.planet === "Moon");
	const moonSign = moonDignity?.sign;
	
	// Start with base percentages (non-competitive system)
	const basePercentages = {
		fire: 50,
		earth: 50,
		air: 60,
		water: 50,
		spirit: 0,
	};
	
	// Buffs/debuffs as percentage points to add/subtract
	const buffs = {
		fire: 0,
		earth: 0,
		air: 0,
		water: 0,
		spirit: 0,
	};
	
	// 1. Planetary Position Buffs (halved)
	dignities.forEach(dignity => {
		const element = SIGN_ELEMENTS[dignity.sign];
		
		switch (dignity.planet) {
			case "Sun":
				buffs[element.toLowerCase() as "fire" | "earth" | "air" | "water"] += 9; // 18 / 2
				break;
			case "Moon":
				buffs[element.toLowerCase() as "fire" | "earth" | "air" | "water"] += 6; // 12 / 2
				break;
			case "Mercury":
			case "Venus":
			case "Mars":
			case "Jupiter":
			case "Saturn":
				buffs[element.toLowerCase() as "fire" | "earth" | "air" | "water"] += 4; // 8 / 2
				break;
		}
	});
	
	// 2. Tattva Hour Buff (+10)
	if (tattvaElement !== "Spirit") {
		buffs[tattvaElement.toLowerCase() as "fire" | "earth" | "air" | "water"] += 10;
	}
	
	// 3. Planetary Hour Buff (+10) - based on specific mapping
	const planetaryHourElement = getPlanetaryHourElement(planetaryHour.ruler);
	if (planetaryHourElement !== "Spirit") {
		buffs[planetaryHourElement.toLowerCase() as "fire" | "earth" | "air" | "water"] += 10;
	}
	
	// 4. Constant Buffs
	buffs.earth += 12; // We're on Earth
	buffs.water += 5;  // Surrounded by water
	buffs.air += 10;   // Surrounded by air
	buffs.fire += 5;   // Constant fire presence
	
	// 5. Latitude-based Buffs (mutually exclusive: fire at equator, water at poles, 0 at 45°)
	// Also applies debuff to opposite element (half the buff amount)
	const latitude = Math.abs(location.latitude); // Use absolute value (works for both hemispheres)
	let latitudeFireBuff = 0;
	let latitudeWaterBuff = 0;
	
	if (latitude <= 45) {
		// From equator (0°) to 45° parallel - fire buff decreases linearly
		// At 0°: +40 fire, -20 water
		// At 45°: 0 fire, 0 water
		const ratio = latitude / 45;
		latitudeFireBuff = 40 * (1 - ratio);
		latitudeWaterBuff = -20 * (1 - ratio); // Debuff to opposite element
	} else {
		// From 45° to poles (90°) - water buff increases linearly
		// At 45°: 0 fire, 0 water
		// At 90°: -20 fire, +40 water
		const ratio = (latitude - 45) / 45;
		latitudeWaterBuff = 40 * ratio;
		latitudeFireBuff = -20 * ratio; // Debuff to opposite element
	}
	
	buffs.fire += latitudeFireBuff;
	buffs.water += latitudeWaterBuff;
	
	// 6. Time-based Buffs
	const hour = date.getHours();
	// Fire: +14 between 9 AM (9) and 4 PM (16)
	if (hour >= 9 && hour < 16) {
		buffs.fire += 14;
	}
	// Water: +14 between 8 PM (20) and 3 AM (3)
	if (hour >= 20 || hour < 3) {
		buffs.water += 14;
	}
	
	// 7. Season-based Buffs (+16 for current season)
	const season = getSeason(date, location.latitude);
	switch (season) {
		case "Winter":
			buffs.water += 16;
			break;
		case "Fall":
			buffs.air += 16;
			break;
		case "Spring":
			buffs.earth += 16;
			break;
		case "Summer":
			buffs.fire += 16;
			break;
	}
	
	// 8. Weather-based Buffs
	if (weather) {
		switch (weather) {
			case "Clear":
				buffs.earth += 5;
				buffs.air += 2;
				break;
			case "Sunny":
				buffs.fire += 16;
				break;
			case "Windy":
				buffs.air += 22;
				break;
			case "Drizzle":
				buffs.water += 16;
				buffs.air += 3;
				break;
			case "Rainstorm":
				buffs.water += 22;
				buffs.air += 22;
				break;
			case "ThunderStorm":
				buffs.water += 22;
				buffs.air += 22;
				buffs.fire += 11;
				break;
		}
	}
	
	// Convert buffs to percentage points and add to base percentages
	// Allow values to exceed 100% - just display the actual value
	const profile: ElementalProfile = {
		fire: Math.max(0, basePercentages.fire + buffs.fire),
		earth: Math.max(0, basePercentages.earth + buffs.earth),
		air: Math.max(0, basePercentages.air + buffs.air),
		water: Math.max(0, basePercentages.water + buffs.water),
		spirit: Math.max(0, basePercentages.spirit + buffs.spirit),
		planetaryHour: planetaryHour.ruler,
		tattva,
		moonSign,
		breakdown: [],
	};
	
	// Calculate breakdown for display
	const breakdown: ElementalBreakdown[] = [];
	
	// Planetary Positions breakdown
	const positionBuffs = { fire: 0, earth: 0, air: 0, water: 0 };
	dignities.forEach(dignity => {
		const element = SIGN_ELEMENTS[dignity.sign];
		let buff = 0;
		if (dignity.planet === "Sun") buff = 9; // 18 / 2
		else if (dignity.planet === "Moon") buff = 6; // 12 / 2
		else buff = 4; // 8 / 2
		positionBuffs[element.toLowerCase() as "fire" | "earth" | "air" | "water"] += buff;
	});
	
	breakdown.push({
		source: "Planetary Positions",
		weight: 0,
		fire: positionBuffs.fire,
		earth: positionBuffs.earth,
		air: positionBuffs.air,
		water: positionBuffs.water,
		spirit: 0,
		details: dignities.map(d => `${d.planet} in ${d.sign} (${SIGN_ELEMENTS[d.sign]})`).join(", "),
	});
	
	// Tattva breakdown
	breakdown.push({
		source: "Tattva",
		weight: 0,
		fire: tattvaElement === "Fire" ? 10 : 0,
		earth: tattvaElement === "Earth" ? 10 : 0,
		air: tattvaElement === "Air" ? 10 : 0,
		water: tattvaElement === "Water" ? 10 : 0,
		spirit: 0,
		details: `Current Tattva: ${tattva} (${tattvaElement} element)`,
	});
	
	// Planetary Hour breakdown
	breakdown.push({
		source: "Planetary Hour",
		weight: 0,
		fire: planetaryHourElement === "Fire" ? 10 : 0,
		earth: planetaryHourElement === "Earth" ? 10 : 0,
		air: planetaryHourElement === "Air" ? 10 : 0,
		water: planetaryHourElement === "Water" ? 10 : 0,
		spirit: 0,
		details: `${planetaryHour.ruler} Hour (${planetaryHourElement} element)`,
	});
	
	// Base percentages breakdown
	breakdown.push({
		source: "Base Percentages",
		weight: 0,
		fire: 50,
		earth: 50,
		air: 60,
		water: 50,
		spirit: 0,
		details: "Base: Fire (50%), Earth (50%), Air (60%), Water (50%)",
	});
	
	// Constants breakdown
	breakdown.push({
		source: "Constants",
		weight: 0,
		fire: 5,
		earth: 12,
		air: 10,
		water: 5,
		spirit: 0,
		details: "Earth (+12), Air (+10), Fire (+5), Water (+5)",
	});
	
	// Latitude breakdown (recalculate for display)
	const latitudeBuffsDisplay = { fire: 0, earth: 0, air: 0, water: 0 };
	if (latitude <= 45) {
		const ratio = latitude / 45;
		latitudeBuffsDisplay.fire = 40 * (1 - ratio);
		latitudeBuffsDisplay.water = -20 * (1 - ratio); // Debuff to opposite element
	} else {
		const ratio = (latitude - 45) / 45;
		latitudeBuffsDisplay.water = 40 * ratio;
		latitudeBuffsDisplay.fire = -20 * ratio; // Debuff to opposite element
	}
	breakdown.push({
		source: "Latitude",
		weight: 0,
		fire: latitudeBuffsDisplay.fire,
		earth: 0,
		air: 0,
		water: latitudeBuffsDisplay.water,
		spirit: 0,
		details: `Latitude: ${location.latitude.toFixed(2)}°`,
	});
	
	// Time breakdown
	const timeFireBuff = (hour >= 9 && hour < 16) ? 14 : 0;
	const timeWaterBuff = (hour >= 20 || hour < 3) ? 14 : 0;
	breakdown.push({
		source: "Time of Day",
		weight: 0,
		fire: timeFireBuff,
		earth: 0,
		air: 0,
		water: timeWaterBuff,
		spirit: 0,
		details: `Hour: ${hour}:00`,
	});
	
	// Season breakdown
	const seasonBuffs = { fire: 0, earth: 0, air: 0, water: 0 };
	if (season === "Summer") seasonBuffs.fire = 16;
	else if (season === "Spring") seasonBuffs.earth = 16;
	else if (season === "Fall") seasonBuffs.air = 16;
	else if (season === "Winter") seasonBuffs.water = 16;
	
	breakdown.push({
		source: "Season",
		weight: 0,
		fire: seasonBuffs.fire,
		earth: seasonBuffs.earth,
		air: seasonBuffs.air,
		water: seasonBuffs.water,
		spirit: 0,
		details: `Current Season: ${season}`,
	});
	
	// Weather breakdown
	if (weather) {
		const weatherBuffs = { fire: 0, earth: 0, air: 0, water: 0 };
		switch (weather) {
			case "Clear":
				weatherBuffs.earth = 5;
				weatherBuffs.air = 2;
				break;
			case "Sunny":
				weatherBuffs.fire = 16;
				break;
			case "Windy":
				weatherBuffs.air = 22;
				break;
			case "Drizzle":
				weatherBuffs.water = 16;
				weatherBuffs.air = 3;
				break;
			case "Rainstorm":
				weatherBuffs.water = 22;
				weatherBuffs.air = 22;
				break;
			case "ThunderStorm":
				weatherBuffs.water = 22;
				weatherBuffs.air = 22;
				weatherBuffs.fire = 11;
				break;
		}
		breakdown.push({
			source: "Weather",
			weight: 0,
			fire: weatherBuffs.fire,
			earth: weatherBuffs.earth,
			air: weatherBuffs.air,
			water: weatherBuffs.water,
			spirit: 0,
			details: `Weather: ${weather}`,
		});
	}
	
	profile.breakdown = breakdown;
	
	return profile;
}

// Get planetary hour element based on specific mapping
function getPlanetaryHourElement(planet: Planet): Element {
	switch (planet) {
		case "Sun":
		case "Mars":
			return "Fire";
		case "Jupiter":
		case "Mercury":
			return "Air";
		case "Moon":
		case "Venus":
			return "Water";
		case "Saturn":
			return "Earth";
	}
}

// Get current season based on date and latitude
function getSeason(date: Date, latitude: number): "Winter" | "Spring" | "Summer" | "Fall" {
	const month = date.getMonth(); // 0-11
	const isNorthern = latitude >= 0;
	
	if (isNorthern) {
		// Northern Hemisphere
		if (month >= 2 && month <= 4) return "Spring"; // Mar, Apr, May
		if (month >= 5 && month <= 7) return "Summer"; // Jun, Jul, Aug
		if (month >= 8 && month <= 10) return "Fall"; // Sep, Oct, Nov
		return "Winter"; // Dec, Jan, Feb
	} else {
		// Southern Hemisphere (seasons reversed)
		if (month >= 2 && month <= 4) return "Fall";
		if (month >= 5 && month <= 7) return "Winter";
		if (month >= 8 && month <= 10) return "Spring";
		return "Summer";
	}
}


// Simple zip code to lat/long lookup using free geocoding API
export async function zipCodeToLocation(zipCode: string): Promise<Location | null> {
	try {
		// Use a free geocoding API (Nominatim OpenStreetMap)
		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&format=json&limit=1`,
			{
				headers: {
					'User-Agent': 'Aterica Planetary App'
				}
			}
		);
		
		if (!response.ok) {
			return null;
		}
		
		const data = await response.json();
		if (data && data.length > 0) {
			return {
				latitude: parseFloat(data[0].lat),
				longitude: parseFloat(data[0].lon),
				zipCode,
			};
		}
		
		return null;
	} catch (error) {
		console.error("Error geocoding zip code:", error);
		return null;
	}
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
	
	// Add major meteor showers (approximate dates) with visibility information
	const meteorShowers = [
		{ 
			name: "Quadrantids", 
			month: 0, 
			day: 3, 
			description: "Peak meteor shower in January",
			visibility: "Best visible in Northern Hemisphere. Radiant point in Bootes constellation. Visible from North America, Europe, and Asia. Best viewing: Late night to dawn, away from city lights."
		},
		{ 
			name: "Lyrids", 
			month: 3, 
			day: 22, 
			description: "Spring meteor shower",
			visibility: "Visible from both hemispheres, but best in Northern Hemisphere. Radiant point in Lyra constellation. Best viewing: After midnight, especially in rural areas with dark skies."
		},
		{ 
			name: "Perseids", 
			month: 7, 
			day: 12, 
			description: "Most popular summer meteor shower",
			visibility: "Best visible in Northern Hemisphere. Radiant point in Perseus constellation. Excellent visibility from North America, Europe, and Asia. Best viewing: Late evening to dawn, peak around 2-3 AM local time."
		},
		{ 
			name: "Orionids", 
			month: 9, 
			day: 21, 
			description: "Autumn meteor shower",
			visibility: "Visible from both hemispheres. Radiant point in Orion constellation. Best viewing: After midnight in both Northern and Southern Hemispheres. Good visibility worldwide."
		},
		{ 
			name: "Leonids", 
			month: 10, 
			day: 17, 
			description: "November meteor shower",
			visibility: "Visible from both hemispheres. Radiant point in Leo constellation. Best viewing: After midnight. Can produce meteor storms every 33 years. Good visibility worldwide."
		},
		{ 
			name: "Geminids", 
			month: 11, 
			day: 14, 
			description: "Peak winter meteor shower",
			visibility: "Visible from both hemispheres, excellent in Northern Hemisphere. Radiant point in Gemini constellation. Best viewing: Around 2 AM local time. One of the most reliable showers, visible worldwide with peak rates of 100+ meteors per hour."
		},
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
				visibility: shower.visibility,
			});
		}
	});
	
	// Sort by date
	events.sort((a, b) => a.date.getTime() - b.date.getTime());
	
	return events.slice(0, 10); // Return next 10 events
}
