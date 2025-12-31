// Planetary Essential Dignity calculations
// Based on traditional astrology

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

// Simplified calculation: Get sign from date (this is a placeholder - 
// in production you'd use a proper ephemeris library like swisseph or an API)
// This uses approximate orbital periods to simulate planetary positions
function getPlanetSign(planet: Planet, date: Date): ZodiacSign {
	const signs: ZodiacSign[] = [
		"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
		"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
	];
	
	// Approximate orbital periods in days (for sign calculation)
	const orbitalPeriods: Record<Planet, number> = {
		Sun: 365.25,        // ~1 year (tropical year)
		Moon: 27.32,        // ~27.3 days (sidereal month)
		Mercury: 88,        // ~88 days
		Venus: 225,         // ~225 days
		Mars: 687,          // ~687 days
		Jupiter: 4333,      // ~12 years
		Saturn: 10759,      // ~29.5 years
	};
	
	// Use a reference date (Jan 1, 2000) and calculate days since
	const referenceDate = new Date(2000, 0, 1);
	const daysSince = (date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
	
	// Calculate which sign the planet is in based on its orbital period
	const period = orbitalPeriods[planet];
	const cycles = daysSince / period;
	const signIndex = Math.floor((cycles % 1) * 12);
	
	return signs[Math.abs(signIndex) % 12];
}

// Calculate Essential Dignity score for a planet
export function calculateDignityScore(
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

// Get all planets with their current dignity
export function getAllPlanetaryDignities(date: Date): PlanetaryDignity[] {
	const planets: Planet[] = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
	
	return planets.map(planet => {
		const sign = getPlanetSign(planet, date);
		// Simplified: assume not retrograde (in production, calculate from ephemeris)
		const isRetrograde = false;
		return calculateDignityScore(planet, sign, isRetrograde);
	});
}

// Get day ruler (simplified)
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

