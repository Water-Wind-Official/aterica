import React, { useState, useEffect, useCallback } from "react";
import { 
	getAllPlanetaryDignities, 
	getDayRuler, 
	getHourRuler, 
	detectAlignments,
	getUpcomingEvents,
	calculateElementalProfile,
	zipCodeToLocation,
	calculateHouseCusps,
	longitudeToSign,
	getMoonPhase,
	ZODIAC_SIGNS,
	SIGN_ELEMENTS,
	type PlanetaryDignity, 
	type Planet,
	type Element,
	type PlanetaryAlignment,
	type UpcomingEvent,
	type ElementalProfile,
	type Location,
	type ZodiacSign,
	type HouseCusps,
	type MoonPhaseInfo,
} from "./planetaryUtils";
import { NatalChartWheel } from "./NatalChartWheel";

interface PlanetaryRegistryProps {
	className?: string;
}

interface TooltipState {
	show: boolean;
	content: string;
	x: number;
	y: number;
}

export function PlanetaryRegistry({ className }: PlanetaryRegistryProps) {
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedTime, setSelectedTime] = useState(
		new Date().toTimeString().slice(0, 5)
	);
	const [zipCode, setZipCode] = useState("");
	const [location, setLocation] = useState<Location | null>(null);
	const [dignities, setDignities] = useState<PlanetaryDignity[]>([]);
	const [alignments, setAlignments] = useState<PlanetaryAlignment[]>([]);
	const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
	const [elementalProfile, setElementalProfile] = useState<ElementalProfile | null>(null);
	const [dayRuler, setDayRuler] = useState<Planet>("Sun");
	const [hourRuler, setHourRuler] = useState<Planet>("Sun");
	const [houseCusps, setHouseCusps] = useState<HouseCusps | null>(null);
	const [moonPhase, setMoonPhase] = useState<MoonPhaseInfo | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [tooltip, setTooltip] = useState<TooltipState>({ show: false, content: "", x: 0, y: 0 });
	const [selectedWeather, setSelectedWeather] = useState<string | null>("Clear");
	
	// Multi-step date picker state
	const [datePickerStep, setDatePickerStep] = useState<"year" | "month" | "day" | null>(null);
	const [tempYear, setTempYear] = useState<string>("");
	const [tempMonth, setTempMonth] = useState<number | null>(null);
	const [tempDay, setTempDay] = useState<number | null>(null);

	// Initialize with default location (90210)
	useEffect(() => {
		// Set default location to 90210 (Beverly Hills, CA)
		const setDefaultLocation = async () => {
			const defaultLoc = await zipCodeToLocation("90210");
			if (defaultLoc) {
				setLocation(defaultLoc);
			}
		};
		
		setDefaultLocation();
	}, []);

	// Handle zip code lookup
	const handleZipCodeChange = async (zip: string) => {
		setZipCode(zip);
		if (zip.length === 5 && /^\d{5}$/.test(zip)) {
			// Try to lookup location
			const loc = await zipCodeToLocation(zip);
			if (loc) {
				setLocation(loc);
			} else {
				setError("Could not find location for that zip code.");
			}
		}
	};

	useEffect(() => {
		// Combine date and time
		const [hours, minutes] = selectedTime.split(":").map(Number);
		const dateTime = new Date(selectedDate);
		dateTime.setHours(hours, minutes, 0, 0);

		setIsLoading(true);
		setError(null);

		Promise.all([
			getAllPlanetaryDignities(dateTime),
			getUpcomingEvents(dateTime, 365),
			location ? (async () => {
				const events = await getUpcomingEvents(dateTime, 365);
				return calculateElementalProfile(dateTime, location, selectedWeather, events);
			})() : Promise.resolve(null),
			location ? calculateHouseCusps(dateTime, location.latitude, location.longitude) : Promise.resolve(null),
			getMoonPhase(dateTime),
		])
			.then((results) => {
				const allDignities = results[0] as PlanetaryDignity[];
				const events = results[1] as UpcomingEvent[];
				const profile = results[2] as ElementalProfile | null;
				const cusps = results[3] as HouseCusps | null;
				const moonPhaseInfo = results[4] as MoonPhaseInfo;

				setDignities(allDignities);
				setAlignments(detectAlignments(allDignities));
				setUpcomingEvents(events);
				setElementalProfile(profile);
				setHouseCusps(cusps);
				setMoonPhase(moonPhaseInfo);
				
				// Always calculate day ruler from the actual date/time
				const dayRuler = getDayRuler(dateTime);
				setDayRuler(dayRuler);
				
				// Use the planetary hour from the profile if available (which uses proper sunrise/sunset calculation)
				// Otherwise fall back to simplified calculation (should rarely happen if location is set)
				if (profile) {
					setHourRuler(profile.planetaryHour);
				} else {
					setHourRuler(getHourRuler(dateTime));
				}
				setIsLoading(false);
			})
			.catch((err) => {
				console.error("[PlanetaryRegistry] Error calculating planetary positions:", err);
				setError(err.message || "Failed to calculate planetary positions");
				setIsLoading(false);
			});
	}, [selectedDate, selectedTime, location, selectedWeather]);

	const showTooltip = useCallback((content: string, event: React.MouseEvent) => {
		setTooltip({
			show: true,
			content,
			x: event.clientX,
			y: event.clientY,
		});
	}, []);

	const hideTooltip = useCallback(() => {
		setTooltip({ show: false, content: "", x: 0, y: 0 });
	}, []);

	// Format longitude to degrees and minutes
	const formatLongitude = useCallback((longitude: number): string => {
		const degrees = Math.floor(longitude);
		const minutes = Math.floor((longitude - degrees) * 60);
		return `${degrees}°${minutes.toString().padStart(2, '0')}'`;
	}, []);

	// Memoize planet hover handler to prevent re-renders
	const handleAngularPointHover = useCallback((point: { name: string; description: string; longitude: number; sign: ZodiacSign } | null, event: React.MouseEvent) => {
		if (point) {
			showTooltip(point.description, event);
		} else {
			hideTooltip();
		}
	}, [showTooltip, hideTooltip]);

	const handleSignHover = useCallback((sign: ZodiacSign | null, event: React.MouseEvent) => {
		if (sign) {
			const signDescriptions: Record<ZodiacSign, string> = {
				Aries: "The Ram - First sign of the zodiac. Represents new beginnings, initiative, courage, and assertiveness. Ruled by Mars.",
				Taurus: "The Bull - Represents stability, sensuality, material security, patience, and determination. Ruled by Venus.",
				Gemini: "The Twins - Represents communication, curiosity, adaptability, and duality. Ruled by Mercury.",
				Cancer: "The Crab - Represents emotions, nurturing, home, family, and intuition. Ruled by the Moon.",
				Leo: "The Lion - Represents creativity, confidence, self-expression, and leadership. Ruled by the Sun.",
				Virgo: "The Virgin - Represents analysis, service, perfectionism, and attention to detail. Ruled by Mercury.",
				Libra: "The Scales - Represents balance, harmony, relationships, and diplomacy. Ruled by Venus.",
				Scorpio: "The Scorpion - Represents transformation, intensity, depth, and mystery. Ruled by Mars (traditional) and Pluto (modern).",
				Sagittarius: "The Archer - Represents adventure, philosophy, expansion, and freedom. Ruled by Jupiter.",
				Capricorn: "The Goat - Represents ambition, discipline, structure, and achievement. Ruled by Saturn.",
				Aquarius: "The Water Bearer - Represents innovation, independence, humanitarianism, and originality. Ruled by Saturn (traditional) and Uranus (modern).",
				Pisces: "The Fish - Represents intuition, compassion, spirituality, and dreams. Ruled by Jupiter (traditional) and Neptune (modern).",
			};
			showTooltip(signDescriptions[sign], event);
		} else {
			hideTooltip();
		}
	}, [showTooltip, hideTooltip]);

	const handleHouseHover = useCallback((house: number | null, event: React.MouseEvent) => {
		if (house) {
			const houseDescriptions: Record<number, string> = {
				1: "1st House - The House of Self\n\nRepresents your identity, appearance, first impressions, and how you present yourself to the world. The Ascendant (rising sign) is the cusp of this house. Planets here influence your personality, physical body, and approach to new beginnings.",
				2: "2nd House - The House of Possessions\n\nRepresents your material resources, values, money, possessions, and sense of security. Planets here show how you earn and manage money, what you value, and your relationship with material things.",
				3: "3rd House - The House of Communication\n\nRepresents communication, siblings, short trips, learning, writing, and your immediate environment. Planets here influence how you think, communicate, and relate to siblings and neighbors.",
				4: "4th House - The House of Home\n\nRepresents your home, family, roots, private life, and emotional foundation. The IC (Imum Coeli) is the cusp of this house. Planets here show your relationship with family, your home environment, and your deepest emotional needs.",
				5: "5th House - The House of Creativity\n\nRepresents creativity, romance, children, self-expression, entertainment, and pleasure. Planets here influence your creative talents, love affairs, how you have fun, and your relationship with children.",
				6: "6th House - The House of Health\n\nRepresents work, health, daily routines, service, and your approach to wellness. Planets here show your work environment, health habits, daily responsibilities, and how you serve others.",
				7: "7th House - The House of Partnerships\n\nRepresents partnerships, marriage, relationships, contracts, and open enemies. The Descendant is the cusp of this house. Planets here influence your approach to relationships, what you seek in a partner, and how you relate to others.",
				8: "8th House - The House of Transformation\n\nRepresents transformation, shared resources, death, rebirth, sexuality, and mysteries. Planets here show how you handle joint finances, deal with change, and your approach to deep psychological matters.",
				9: "9th House - The House of Philosophy\n\nRepresents higher learning, philosophy, religion, long-distance travel, publishing, and beliefs. Planets here influence your worldview, spiritual beliefs, and quest for meaning and understanding.",
				10: "10th House - The House of Career\n\nRepresents career, public image, reputation, authority, and life direction. The MC (Midheaven) is the cusp of this house. Planets here show your career path, public standing, and how you're seen by the world.",
				11: "11th House - The House of Friendships\n\nRepresents friendships, groups, hopes, dreams, and humanitarian causes. Planets here influence your social circle, your ideals, and your involvement in community or group activities.",
				12: "12th House - The House of the Subconscious\n\nRepresents the subconscious, hidden matters, spirituality, secrets, and self-undoing. Planets here show your hidden strengths and weaknesses, spiritual practices, and things that operate behind the scenes.",
			};
			showTooltip(houseDescriptions[house] || `House ${house}`, event);
		} else {
			hideTooltip();
		}
	}, [showTooltip, hideTooltip]);

	// Get planet meanings for tooltips
	const getPlanetMeaning = (planet: Planet): string => {
		const planetMeanings: Record<Planet, string> = {
			Sun: "The Sun represents your core identity, ego, life force, and vitality. It shows your essential self, how you shine, and what gives you energy and purpose.",
			Moon: "The Moon represents your emotions, instincts, inner needs, and subconscious patterns. It shows how you process feelings, what makes you feel secure, and your emotional responses.",
			Mercury: "Mercury represents communication, thinking, learning, and how you process information. It shows your mental style, how you express ideas, and your approach to learning and teaching.",
			Venus: "Venus represents love, beauty, values, relationships, and what you find attractive. It shows your approach to love, your aesthetic preferences, and what you value in life.",
			Mars: "Mars represents action, drive, energy, passion, and how you assert yourself. It shows your motivation, how you pursue goals, and your approach to conflict and competition.",
			Jupiter: "Jupiter represents expansion, growth, philosophy, optimism, and abundance. It shows where you seek meaning, how you grow, and what brings you luck and opportunities.",
			Saturn: "Saturn represents discipline, structure, limitations, responsibility, and life lessons. It shows where you face challenges, what you must work hard for, and areas requiring maturity and commitment.",
		};
		return planetMeanings[planet];
	};

	// Get alignment type implications
	const getAlignmentImplications = (type: PlanetaryAlignment["type"]): string => {
		const alignmentImplications: Record<PlanetaryAlignment["type"], string> = {
			Conjunction: "Conjunction (0°)\n\nWhen planets are in conjunction, their energies blend and intensify. This creates a powerful fusion of their qualities, often making these planets work together as a unified force. The conjunction amplifies both planets' influences, creating a strong focus in the area of life they represent.",
			Opposition: "Opposition (180°)\n\nOppositions create tension and polarity between planets. This aspect often manifests as internal conflict, external challenges, or a need to balance opposing forces. It can create awareness through contrast, requiring you to integrate or balance the energies of both planets.",
			"Grand Trine": "Grand Trine (120° triangle)\n\nA Grand Trine forms when three planets create an equilateral triangle in the chart. This creates a harmonious flow of energy, often indicating natural talent, ease, and flow in the areas represented. However, it can also lead to complacency if not actively engaged.",
			"T-Square": "T-Square (90° + 180°)\n\nA T-Square forms when two planets oppose each other while both square a third planet. This creates dynamic tension and challenge, often driving action and growth. It indicates areas requiring effort, adjustment, and active problem-solving.",
			"Grand Cross": "Grand Cross (90° square pattern)\n\nA Grand Cross forms when four planets create a square pattern with oppositions and squares. This creates intense pressure and multiple challenges, requiring significant effort to resolve. It often indicates a person with great potential who must work through complex obstacles.",
			Stellium: "Stellium (3+ planets in one sign)\n\nA Stellium occurs when multiple planets cluster in the same zodiac sign. This creates an intense focus and emphasis on that sign's qualities. The sign's energy becomes dominant in the chart, creating both strengths and potential imbalances in that area of life.",
			Linear: "Linear Alignment (planets in a line)\n\nWhen planets form a linear alignment, their energies flow in a sequential pattern. This can create a focused, directional energy flow, often indicating a clear path or progression in the areas of life these planets represent.",
		};
		return alignmentImplications[type];
	};

	// Handle alignment hover
	const handleAlignmentHover = useCallback((alignment: PlanetaryAlignment, event: React.MouseEvent) => {
		const alignmentInfo = getAlignmentImplications(alignment.type);
		const planetInfo = alignment.planets.map(planet => `• ${planet}: ${getPlanetMeaning(planet)}`).join('\n\n');
		
		const tooltipContent = `${alignmentInfo}\n\nPlanets Involved:\n\n${planetInfo}`;
		showTooltip(tooltipContent, event);
	}, [showTooltip]);

	// Helper to get house for a longitude
	const getHouseForLongitude = useCallback((longitude: number): number | null => {
		if (!houseCusps) return null;
		
		let normalizedLon = longitude % 360;
		if (normalizedLon < 0) normalizedLon += 360;
		
		for (let i = 0; i < 12; i++) {
			const cusp1 = houseCusps.houses[i];
			const cusp2 = houseCusps.houses[(i + 1) % 12];
			
			if (i === 11) {
				if (normalizedLon >= cusp1 || normalizedLon < cusp2) {
					return i + 1;
				}
			} else {
				if (normalizedLon >= cusp1 && normalizedLon < cusp2) {
					return i + 1;
				}
			}
		}
		
		return null;
	}, [houseCusps]);

	// Get sign description (simplified)
	const getSignDescription = (sign: ZodiacSign): string => {
		const descriptions: Record<ZodiacSign, string> = {
			Aries: "assertive, pioneering, independent",
			Taurus: "stable, sensual, practical",
			Gemini: "curious, communicative, adaptable",
			Cancer: "nurturing, emotional, protective",
			Leo: "creative, confident, expressive",
			Virgo: "analytical, service-oriented, detail-focused",
			Libra: "harmonious, diplomatic, relationship-oriented",
			Scorpio: "intense, transformative, secretive",
			Sagittarius: "adventurous, philosophical, freedom-loving",
			Capricorn: "ambitious, disciplined, traditional",
			Aquarius: "innovative, independent, humanitarian",
			Pisces: "intuitive, compassionate, dreamy",
		};
		return descriptions[sign];
	};

	// Get zodiac sign symbol
	const getZodiacSymbol = (sign: ZodiacSign): string => {
		const symbols: Record<ZodiacSign, string> = {
			Aries: "♈",
			Taurus: "♉",
			Gemini: "♊",
			Cancer: "♋",
			Leo: "♌",
			Virgo: "♍",
			Libra: "♎",
			Scorpio: "♏",
			Sagittarius: "♐",
			Capricorn: "♑",
			Aquarius: "♒",
			Pisces: "♓",
		};
		return symbols[sign];
	};

	// Get planet interpretation for zodiac dash (simplified)
	const getPlanetInterpretationForZodiacDash = (planet: Planet, sign: ZodiacSign, house: number | null, dignity: PlanetaryDignity["dignity"], element: Element): string => {
		const planetBase = getPlanetMeaning(planet);
		const signDesc = getSignDescription(sign);
		const houseDesc = house ? `House ${house}` : "";
		
		return `${planetBase}\n\nIn ${sign}: ${signDesc}\n${houseDesc ? `In ${houseDesc}: Influences this area of life.` : ''}\n\nDignity: ${dignity}`;
	};

	const handlePlanetHover = useCallback((planet: PlanetaryDignity | null, interpretation: string | null, event: React.MouseEvent) => {
		if (planet) {
			// If interpretation is provided (from summary panel), use it
			if (interpretation) {
				showTooltip(interpretation, event);
			} else {
				// Otherwise show detailed technical info (from wheel hover)
				const totalDegrees = formatLongitude(planet.longitude);
				const signDegrees = planet.longitude % 30;
				const signDeg = Math.floor(signDegrees);
				const signMin = Math.floor((signDegrees - signDeg) * 60);
				const element = SIGN_ELEMENTS[planet.sign];
				const retrogradeText = planet.isRetrograde ? ' (Retrograde)' : '';
				
				// Find aspects to other planets
				const aspects: string[] = [];
				dignities.forEach(otherPlanet => {
					if (otherPlanet.planet !== planet.planet) {
						const dist = Math.abs(planet.longitude - otherPlanet.longitude);
						const angularDist = dist > 180 ? 360 - dist : dist;
						
						if (angularDist <= 8) aspects.push(`${otherPlanet.planet} (Conjunction)`);
						else if (Math.abs(angularDist - 30) <= 8) aspects.push(`${otherPlanet.planet} (Semi-Sextile)`);
						else if (Math.abs(angularDist - 45) <= 8) aspects.push(`${otherPlanet.planet} (Semi-Square)`);
						else if (Math.abs(angularDist - 60) <= 8) aspects.push(`${otherPlanet.planet} (Sextile)`);
						else if (Math.abs(angularDist - 72) <= 8) aspects.push(`${otherPlanet.planet} (Quintile)`);
						else if (Math.abs(angularDist - 90) <= 8) aspects.push(`${otherPlanet.planet} (Square)`);
						else if (Math.abs(angularDist - 120) <= 8) aspects.push(`${otherPlanet.planet} (Trine)`);
						else if (Math.abs(angularDist - 135) <= 8) aspects.push(`${otherPlanet.planet} (Sesquiquadrate)`);
						else if (Math.abs(angularDist - 150) <= 8) aspects.push(`${otherPlanet.planet} (Quincunx)`);
						else if (Math.abs(angularDist - 180) <= 8) aspects.push(`${otherPlanet.planet} (Opposition)`);
					}
				});
				
				const aspectsText = aspects.length > 0 ? `\n\nAspects: ${aspects.join(', ')}` : '';
				
				// Get house if available (from planet summary)
				const house = (planet as any).house;
				const houseText = house ? `\nHouse: ${house}${house === 1 || house === 21 ? 'st' : house === 2 || house === 22 ? 'nd' : house === 3 || house === 23 ? 'rd' : 'th'}` : '';
				
				const details = `${planet.planet} ${totalDegrees} ${planet.sign}${houseText}\n${signDeg}°${signMin.toString().padStart(2, '0')}' ${planet.sign} - ${planet.dignity}${retrogradeText}\n${element} Element${aspectsText}`;
				showTooltip(details, event);
			}
		} else {
			hideTooltip();
		}
	}, [showTooltip, hideTooltip, formatLongitude, dignities]);

	const getScoreColor = (score: number): string => {
		if (score >= 4) return "#4ade80";
		if (score >= 1) return "#86efac";
		if (score >= -1) return "#fbbf24";
		if (score >= -4) return "#fb923c";
		return "#f87171";
	};

	const getElementColor = (element: Element): string => {
		switch (element) {
			case "Fire": return "#ef4444";
			case "Earth": return "#84cc16";
			case "Air": return "#3b82f6";
			case "Water": return "#06b6d4";
			case "Spirit": return "#a855f7";
		}
	};

	const getDignityEmoji = (dignity: PlanetaryDignity["dignity"]): string => {
		switch (dignity) {
			case "Domicile": return "🏠";
			case "Exaltation": return "⭐";
			case "Detriment": return "🚫";
			case "Fall": return "⬇️";
			default: return "➖";
		}
	};

	const getPlanetEmoji = (planet: Planet): string => {
		const emojis: Record<Planet, string> = {
			Sun: "☉",
			Moon: "☽",
			Mercury: "☿",
			Venus: "♀",
			Mars: "♂",
			Jupiter: "♃",
			Saturn: "♄",
		};
		return emojis[planet];
	};

	const getElementEmoji = (element: Element): string => {
		switch (element) {
			case "Fire": return "🔥";
			case "Earth": return "🌍";
			case "Air": return "💨";
			case "Water": return "💧";
			case "Spirit": return "✨";
		}
	};

	const getMoonPhaseEmoji = (phase: MoonPhaseInfo["phase"]): string => {
		switch (phase) {
			case "New Moon": return "🌑";
			case "Waxing Crescent": return "🌒";
			case "First Quarter": return "🌓";
			case "Waxing Gibbous": return "🌔";
			case "Full Moon": return "🌕";
			case "Waning Gibbous": return "🌖";
			case "Last Quarter": return "🌗";
			case "Waning Crescent": return "🌘";
		}
	};

	const getElementBreakdown = (profile: ElementalProfile, element: Element | "Akasha"): string => {
		// Handle "Akasha" as an alias for "Spirit"
		const actualElement = element === "Akasha" ? "Spirit" : element;
		const elementKey = actualElement.toLowerCase() as "fire" | "earth" | "air" | "water" | "spirit";
		const total = profile[elementKey];
		
		const parts: string[] = [];
		let basePercentage = 0;
		let totalBuffs = 0;
		
		// Special handling for Akasha to show detailed breakdown
		if (element === "Akasha") {
			const akashaComponent = profile.breakdown.find(c => c.source === "Akasha");
			if (akashaComponent && akashaComponent.details) {
				// Show the detailed breakdown from the details field
				const detailLines = akashaComponent.details.split(", ");
				detailLines.forEach(detail => {
					parts.push(detail);
				});
				// Calculate total adjustments (sum of all contributions)
				totalBuffs = total;
			} else {
				// Fallback to standard breakdown
				profile.breakdown.forEach(component => {
					const componentValue = component[elementKey];
					if (component.source === "Base Percentages") {
						basePercentage = componentValue;
						parts.push(`Base: ${Math.round(componentValue)}%`);
					} else if (componentValue !== 0) {
						totalBuffs += componentValue;
						const sign = componentValue > 0 ? "+" : "";
						parts.push(`${component.source}: ${sign}${Math.round(componentValue)}`);
					}
				});
			}
		} else {
			// Standard breakdown for other elements
			profile.breakdown.forEach(component => {
				const componentValue = component[elementKey];
				if (component.source === "Base Percentages") {
					basePercentage = componentValue;
					parts.push(`Base: ${Math.round(componentValue)}%`);
				} else if (componentValue !== 0) {
					totalBuffs += componentValue;
					const sign = componentValue > 0 ? "+" : "";
					parts.push(`${component.source}: ${sign}${Math.round(componentValue)}`);
				}
			});
		}
		
		const displayName = element === "Akasha" ? "Akasha" : element;
		return `${displayName} Breakdown:\n${parts.join("\n")}\n\nTotal Adjustments: ${totalBuffs > 0 ? "+" : ""}${Math.round(totalBuffs)}\nFinal Percentage: ${Math.round(total)}%`;
	};

	const formatDateInput = (date: Date): string => {
		return date.toLocaleDateString("en-US", { 
			month: "short", 
			day: "numeric",
			year: "numeric" 
		});
	};
	
	const handleDateButtonClick = () => {
		setTempYear(selectedDate.getFullYear().toString());
		setTempMonth(selectedDate.getMonth());
		setTempDay(selectedDate.getDate());
		setDatePickerStep("year");
	};
	
	const handleYearSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const year = parseInt(tempYear);
		if (year >= 1000 && year <= 9999) {
			setDatePickerStep("month");
		}
	};
	
	const handleMonthSelect = (month: number) => {
		setTempMonth(month);
		setDatePickerStep("day");
	};
	
	const handleDaySelect = (day: number) => {
		if (tempYear && tempMonth !== null) {
			const year = parseInt(tempYear);
			const newDate = new Date(year, tempMonth, day);
			setSelectedDate(newDate);
			setDatePickerStep(null);
		}
	};
	
	const getDaysInMonth = (year: number, month: number): number => {
		return new Date(year, month + 1, 0).getDate();
	};
	
	const getFirstDayOfMonth = (year: number, month: number): number => {
		return new Date(year, month, 1).getDay();
	};
	
	const getMonthName = (month: number): string => {
		const date = new Date(2000, month, 1);
		return date.toLocaleDateString("en-US", { month: "long" });
	};

	const formatEventDate = (date: Date): string => {
		return date.toLocaleDateString("en-US", { 
			month: "short", 
			day: "numeric",
			year: "numeric" 
		});
	};

	// Format event date with duration information
	const formatEventDateWithDuration = (event: UpcomingEvent): string => {
		const dateStr = formatEventDate(event.date);
		
		// Add duration information based on event type
		let duration = "";
		if (event.type === "Solstice" || event.type === "Equinox") {
			duration = " (Duration: 1 day)";
		} else if (event.type === "Meteor Shower") {
			duration = " (Peak: 3 days)";
		} else if (event.type === "Eclipse") {
			duration = " (Duration: 24 hours)";
		} else if (event.type === "Planetary Alignment") {
			duration = " (Duration: 24 hours)";
		}
		
		return dateStr + duration;
	};

	// Check if an event is currently happening (based on selected date/time)
	const isEventHappening = (event: UpcomingEvent): boolean => {
		// Use the selected date/time for comparison
		const [hours, minutes] = selectedTime.split(":").map(Number);
		const currentDateTime = new Date(selectedDate);
		currentDateTime.setHours(hours, minutes, 0, 0);
		
		const eventDate = new Date(event.date);
		
		// For solstices and equinoxes, consider them "happening" on the exact day
		if (event.type === "Solstice" || event.type === "Equinox") {
			const dayDiff = Math.abs(currentDateTime.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
			return dayDiff <= 1; // Within 1 day
		}
		
		// For meteor showers, they typically span several days, so check if we're within the peak period
		if (event.type === "Meteor Shower") {
			const dayDiff = Math.abs(currentDateTime.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
			return dayDiff <= 3; // Within 3 days of peak
		}
		
		// For eclipses and planetary alignments, check if within 24 hours
		if (event.type === "Eclipse" || event.type === "Planetary Alignment") {
			const hourDiff = Math.abs(currentDateTime.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
			return hourDiff <= 24; // Within 24 hours
		}
		
		return false;
	};

	const planetToElementName = (planet: Planet): string => {
		switch (planet) {
			case "Sun":
			case "Mars":
				return "Fire";
			case "Mercury":
			case "Jupiter":
				return "Air";
			case "Venus":
			case "Moon":
				return "Water";
			case "Saturn":
				return "Earth";
		}
	};

	const tattvaToElementName = (tattva: any): string => {
		switch (tattva) {
			case "Akasha": return "Spirit";
			case "Vayu": return "Air";
			case "Tejas": return "Fire";
			case "Apas": return "Water";
			case "Prithvi": return "Earth";
		}
		return "";
	};

	const tattvaToName = (tattva: any): string => tattva || "";

	const tooltipContent = {
		dignity: "Essential Dignity measures a planet's strength based on its zodiac sign. Domicile (🏠) = home, strongest. Exaltation (⭐) = honored guest. Detriment (🚫) = exile, weak. Fall (⬇️) = humiliated, weakest.",
		retrograde: "When a planet appears to move backward. Generally weakens the planet's energy and can cause delays or reversals.",
		element: "Each zodiac sign belongs to an element: Fire (action, passion), Earth (stability, practicality), Air (intellect, communication), Water (emotion, intuition).",
		alignment: "Planetary alignments occur when planets form geometric patterns. Conjunctions = together, Oppositions = opposite, Linear = straight line formation.",
		dayRuler: "Each day of the week is ruled by a planet. The day ruler influences the overall energy of that day.",
		hourRuler: "Each hour is ruled by a planet in Chaldean order. Planetary hours are location-specific (based on local sunrise/sunset), not timezone-based, so they vary by location even within the same timezone. The hour ruler influences the energy of that specific time.",
	};

	return (
		<div className={`planetary-registry ${className || ""}`}>
			<div className="datetime-controls">
				<div className="control-group">
					<label htmlFor="date-input">Date:</label>
					<button
						id="date-input"
						type="button"
						className="date-picker-button"
						onClick={handleDateButtonClick}
					>
						{formatDateInput(selectedDate)}
					</button>
				</div>
				<div className="control-group">
					<label htmlFor="time-input">Time:</label>
					<input
						id="time-input"
						type="time"
						value={selectedTime}
						onChange={(e) => setSelectedTime(e.target.value)}
					/>
				</div>
				<div className="control-group">
					<label htmlFor="zip-input">Zip Code:</label>
					<input
						id="zip-input"
						type="text"
						placeholder="90210"
						value={zipCode}
						onChange={(e) => handleZipCodeChange(e.target.value)}
						maxLength={5}
						pattern="[0-9]*"
					/>
				</div>
				{location && (
					<div className="location-info">
						📍 Lat: {location.latitude.toFixed(2)}, Long: {location.longitude.toFixed(2)}
					</div>
				)}
			</div>
			
			{/* Multi-step Date Picker Modal */}
			{datePickerStep && (
				<div className="date-picker-modal-overlay" onClick={() => setDatePickerStep(null)}>
					<div className="date-picker-modal" onClick={(e) => e.stopPropagation()}>
						{datePickerStep === "year" && (
							<div className="date-picker-step">
								<h3>Select Year</h3>
								<form onSubmit={handleYearSubmit}>
									<input
										type="text"
										className="year-input"
										value={tempYear}
										onChange={(e) => {
											const val = e.target.value.replace(/\D/g, "");
											if (val.length <= 4) setTempYear(val);
										}}
										placeholder="YYYY"
										autoFocus
									/>
									<div className="date-picker-actions">
										<button type="button" onClick={() => setDatePickerStep(null)}>Cancel</button>
										<button type="submit" disabled={tempYear.length !== 4}>Next</button>
									</div>
								</form>
							</div>
						)}
						
						{datePickerStep === "month" && tempYear && (
							<div className="date-picker-step">
								<h3>Select Month</h3>
								<div className="month-grid">
									{Array.from({ length: 12 }, (_, i) => (
										<button
											key={i}
											className={`month-button ${tempMonth === i ? "selected" : ""}`}
											onClick={() => handleMonthSelect(i)}
										>
											{getMonthName(i).slice(0, 3)}
										</button>
									))}
								</div>
								<div className="date-picker-actions">
									<button type="button" onClick={() => setDatePickerStep("year")}>Back</button>
									<button type="button" onClick={() => setDatePickerStep(null)}>Cancel</button>
								</div>
							</div>
						)}
						
						{datePickerStep === "day" && tempYear && tempMonth !== null && (
							<div className="date-picker-step">
								<h3>{getMonthName(tempMonth)} {tempYear}</h3>
								<div className="calendar">
									<div className="calendar-header">
										{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
											<div key={day} className="calendar-day-header">{day}</div>
										))}
									</div>
									<div className="calendar-grid">
										{Array.from({ length: getFirstDayOfMonth(parseInt(tempYear), tempMonth) }, (_, i) => (
											<div key={`empty-${i}`} className="calendar-day empty"></div>
										))}
										{Array.from({ length: getDaysInMonth(parseInt(tempYear), tempMonth) }, (_, i) => {
											const day = i + 1;
											return (
												<button
													key={day}
													className={`calendar-day ${tempDay === day ? "selected" : ""}`}
													onClick={() => handleDaySelect(day)}
												>
													{day}
												</button>
											);
										})}
									</div>
								</div>
								<div className="date-picker-actions">
									<button type="button" onClick={() => setDatePickerStep("month")}>Back</button>
									<button type="button" onClick={() => setDatePickerStep(null)}>Cancel</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			<div className="current-rulers">
				<p className="ruler-info">
					<span 
						className="ruler-label"
						onMouseEnter={(e) => showTooltip(tooltipContent.dayRuler, e)}
						onMouseLeave={hideTooltip}
					>
						Day Ruler:{" "}
					</span>
					<span className="ruler-value">{getPlanetEmoji(dayRuler)} {dayRuler}</span>
				</p>
				<p className="ruler-info">
					<span 
						className="ruler-label"
						onMouseEnter={(e) => showTooltip(tooltipContent.hourRuler, e)}
						onMouseLeave={hideTooltip}
					>
						Hour Ruler:{" "}
					</span>
					<span className="ruler-value">{getPlanetEmoji(hourRuler)} {hourRuler}</span>
				</p>
			</div>

			{error && (
				<div className="error-message">
					<p>⚠️ {error}</p>
				</div>
			)}

			{isLoading ? (
				<div className="loading-message">
					<p>Calculating planetary positions...</p>
				</div>
			) : (
				<>
					{/* Elemental Profile Section */}
					{elementalProfile && (
						<div className="elemental-profile-section">
							<div className="elemental-profile-header">
								<h3>
									Elemental Energy Profile{" "}
									<span 
										className="info-icon"
										onMouseEnter={(e) => showTooltip("Combines Planetary Positions, Planetary Hour, Tattva, Constants, Latitude, Time, Season, and Weather", e)}
										onMouseLeave={hideTooltip}
									>
										ℹ️
									</span>
								</h3>
								<div className="weather-selector">
									<span className="weather-label">Weather:</span>
									<div className="weather-buttons">
										<button 
											className={`weather-button ${selectedWeather === "Clear" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("Clear")}
										>
											Clear
										</button>
										<button 
											className={`weather-button ${selectedWeather === "Sunny" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("Sunny")}
										>
											Sunny
										</button>
										<button 
											className={`weather-button ${selectedWeather === "Windy" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("Windy")}
										>
											Windy
										</button>
										<button 
											className={`weather-button ${selectedWeather === "Drizzle" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("Drizzle")}
										>
											Drizzle
										</button>
										<button 
											className={`weather-button ${selectedWeather === "Rainstorm" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("Rainstorm")}
										>
											Rainstorm
										</button>
										<button 
											className={`weather-button ${selectedWeather === "ThunderStorm" ? "selected" : ""}`}
											onClick={() => setSelectedWeather("ThunderStorm")}
										>
											ThunderStorm
										</button>
									</div>
								</div>
							</div>
							
							{/* Final Composition - Compact Grid */}
							<div className="elemental-composition-grid">
								<div 
									className="element-compact" 
									style={{ "--percent": `${elementalProfile.fire}%`, "--color": "#ef4444" } as React.CSSProperties}
									onMouseEnter={(e) => {
										const breakdown = getElementBreakdown(elementalProfile, "Fire");
										showTooltip(breakdown, e);
									}}
									onMouseLeave={hideTooltip}
								>
									<span className="element-emoji">🔥</span>
									<span className="element-name">Fire</span>
									<span className="element-percent">{Math.round(elementalProfile.fire)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div 
									className="element-compact" 
									style={{ "--percent": `${elementalProfile.earth}%`, "--color": "#84cc16" } as React.CSSProperties}
									onMouseEnter={(e) => {
										const breakdown = getElementBreakdown(elementalProfile, "Earth");
										showTooltip(breakdown, e);
									}}
									onMouseLeave={hideTooltip}
								>
									<span className="element-emoji">🌍</span>
									<span className="element-name">Earth</span>
									<span className="element-percent">{Math.round(elementalProfile.earth)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div 
									className="element-compact" 
									style={{ "--percent": `${elementalProfile.air}%`, "--color": "#3b82f6" } as React.CSSProperties}
									onMouseEnter={(e) => {
										const breakdown = getElementBreakdown(elementalProfile, "Air");
										showTooltip(breakdown, e);
									}}
									onMouseLeave={hideTooltip}
								>
									<span className="element-emoji">💨</span>
									<span className="element-name">Air</span>
									<span className="element-percent">{Math.round(elementalProfile.air)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div 
									className="element-compact" 
									style={{ "--percent": `${elementalProfile.water}%`, "--color": "#06b6d4" } as React.CSSProperties}
									onMouseEnter={(e) => {
										const breakdown = getElementBreakdown(elementalProfile, "Water");
										showTooltip(breakdown, e);
									}}
									onMouseLeave={hideTooltip}
								>
									<span className="element-emoji">💧</span>
									<span className="element-name">Water</span>
									<span className="element-percent">{Math.round(elementalProfile.water)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								{elementalProfile.spirit > 0 && (
									<div 
										className="element-compact" 
										style={{ "--percent": `${elementalProfile.spirit}%`, "--color": "#a855f7" } as React.CSSProperties}
										onMouseEnter={(e) => {
											const breakdown = getElementBreakdown(elementalProfile, "Akasha");
											showTooltip(breakdown, e);
										}}
										onMouseLeave={hideTooltip}
									>
										<span className="element-emoji">✨</span>
										<span className="element-name">Akasha</span>
										<span className="element-percent">{Math.round(elementalProfile.spirit)}%</span>
										<div className="element-bar-mini"></div>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Planets Grid */}
					<div className="planets-grid">
						{dignities.map((dignity) => {
							const element = SIGN_ELEMENTS[dignity.sign];
							return (
								<div
									key={dignity.planet}
									className="planet-card"
								>
									<div className="planet-header">
										<span className="planet-emoji">{getPlanetEmoji(dignity.planet)}</span>
										<h3 className="planet-name">{dignity.planet}</h3>
									</div>
									
									<div className="planet-details">
										<div className="planet-sign">
											<span className="sign-label">Sign:</span>{" "}
											<span className="sign-value">{dignity.sign}</span>
										</div>

										<div 
											className="planet-element"
											style={{ color: getElementColor(element) }}
											onMouseEnter={(e) => showTooltip(tooltipContent.element, e)}
											onMouseLeave={hideTooltip}
										>
											<span className="element-emoji">{getElementEmoji(element)}</span>
											<span className="element-name">{element}</span>
										</div>
										
										<div 
											className="planet-dignity"
											onMouseEnter={(e) => showTooltip(tooltipContent.dignity, e)}
											onMouseLeave={hideTooltip}
										>
											<span className="dignity-emoji">{getDignityEmoji(dignity.dignity)}</span>
											<span className="dignity-label">{dignity.dignity}</span>
										</div>

										{dignity.isRetrograde && (
											<div 
												className="retrograde-badge"
												onMouseEnter={(e) => showTooltip(tooltipContent.retrograde, e)}
												onMouseLeave={hideTooltip}
											>
												℞ Retrograde
											</div>
										)}
									</div>

								</div>
							);
						})}
						
						{/* Moon Phase Card */}
						{moonPhase && (
							<div className="planet-card">
								<div className="planet-header">
									<span className="planet-emoji">{getMoonPhaseEmoji(moonPhase.phase)}</span>
									<h3 className="planet-name">Moon Phase</h3>
								</div>
								
								<div className="planet-details">
									<div className="planet-sign">
										<span className="sign-label">Phase:</span>{" "}
										<span className="sign-value">{moonPhase.phase}</span>
									</div>
									
									<div className="planet-sign">
										<span className="sign-label">Illumination:</span>{" "}
										<span className="sign-value">{moonPhase.illumination}%</span>
									</div>
									
									<div className="planet-sign">
										<span className="sign-label">Age:</span>{" "}
										<span className="sign-value">{moonPhase.age} days</span>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Upcoming Events Section */}
					{upcomingEvents.length > 0 && (
						<div className="events-section">
							<h3>Upcoming Astrological Events</h3>
							<div className="events-list">
								{upcomingEvents.slice(0, 5).map((event, idx) => {
									const isHappening = isEventHappening(event);
									return (
										<div 
											key={idx} 
											className={`event-card ${isHappening ? 'event-happening' : ''}`}
											onMouseEnter={(e) => {
												if (event.type === "Meteor Shower" && event.visibility) {
													showTooltip(event.visibility || "", e);
												}
											}}
											onMouseLeave={() => {
												if (event.type === "Meteor Shower") {
													hideTooltip();
												}
											}}
										>
										<div className="event-header">
											<span className="event-type">{event.type}</span>
											<span className="event-date">{formatEventDateWithDuration(event)}</span>
										</div>
										<h4 className="event-name">
											{event.name}
											{event.type === "Meteor Shower" && (
												<span className="visibility-indicator" title="Hover for visibility information"> 👁️</span>
											)}
										</h4>
										<p className="event-description">{event.description}</p>
									</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Natal Chart Wheel Section */}
					{dignities.length > 0 && (
						<NatalChartWheel 
							dignities={dignities}
							date={(() => {
								const [hours, minutes] = selectedTime.split(":").map(Number);
								const dateTime = new Date(selectedDate);
								dateTime.setHours(hours, minutes, 0, 0);
								return dateTime;
							})()}
							location={location}
							onPlanetHover={handlePlanetHover}
							onAngularPointHover={handleAngularPointHover}
							onSignHover={handleSignHover}
							onHouseHover={handleHouseHover}
						/>
					)}

					{/* Alignments Section */}
					{alignments.length > 0 && (
						<div className="alignments-section">
							<h3>
								Active Alignments{" "}
								<span 
									className="info-icon"
									onMouseEnter={(e) => showTooltip(tooltipContent.alignment, e)}
									onMouseLeave={hideTooltip}
								>
									ℹ️
								</span>
							</h3>
							<div className="alignments-grid">
								{alignments.map((alignment, idx) => (
									<div 
										key={idx} 
										className="alignment-card"
										onMouseEnter={(e) => handleAlignmentHover(alignment, e)}
										onMouseLeave={hideTooltip}
										style={{ cursor: 'pointer' }}
									>
										<div className="alignment-header">
											<span className="alignment-type">{alignment.type}</span>
											<span className="alignment-strength">{alignment.strength}%</span>
										</div>
										<p className="alignment-planets">
											{alignment.planets.map(p => getPlanetEmoji(p)).join(" ")} {alignment.planets.join(", ")}
										</p>
										<p className="alignment-description">{alignment.description}</p>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Zodiac Dash Section */}
					{houseCusps && dignities.length > 0 && (
						<div className="zodiac-dash-section">
							<div className="zodiac-dash-title-row">
								<h3>Zodiac Dash</h3>
								<div className="zodiac-dash-datetime">
									<span className="zodiac-dash-datetime-label">Chart Time:</span>
									<span className="zodiac-dash-datetime-value">
										{formatDateInput(selectedDate)} {selectedTime}
									</span>
								</div>
							</div>
							<div className="zodiac-dash-grid">
								{ZODIAC_SIGNS.map((sign) => {
									// Find which houses this sign occupies (signs on house cusps)
									const housesInSign: number[] = [];
									for (let i = 0; i < 12; i++) {
										const cusp = houseCusps.houses[i];
										const signOfCusp = longitudeToSign(cusp);
										if (signOfCusp === sign) {
											housesInSign.push(i + 1);
										}
									}

									// Find planets in this sign
									const planetsInSign = dignities.filter(d => d.sign === sign);
									
									// Get element
									const element = SIGN_ELEMENTS[sign];
									const elementColor = getElementColor(element);

									// Only show signs that have houses or planets
									if (housesInSign.length === 0 && planetsInSign.length === 0) {
										return null;
									}

									return (
										<div 
											key={sign}
											className="zodiac-dash-card"
											onMouseEnter={(e) => handleSignHover(sign, e)}
											onMouseLeave={hideTooltip}
											style={{ 
												cursor: 'pointer', 
												borderLeft: `4px solid ${elementColor}`,
												boxShadow: `0 0 20px ${elementColor}15, inset 0 0 20px ${elementColor}05`
											}}
										>
											<div className="zodiac-dash-header">
												<span className="zodiac-dash-symbol" style={{ color: elementColor }}>
													{getZodiacSymbol(sign)}
												</span>
												<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
													<span className="zodiac-dash-sign" style={{ color: elementColor }}>
														{sign}
													</span>
													<span className="zodiac-dash-element">{getElementEmoji(element)} {element}</span>
												</div>
											</div>
											
											{housesInSign.length > 0 && (
												<div className="zodiac-dash-houses">
													<span className="zodiac-dash-label">Houses:</span>
													<span className="zodiac-dash-houses-list">
														{housesInSign.map((house) => {
															const houseSuffix = house === 1 ? 'st' : house === 2 ? 'nd' : house === 3 ? 'rd' : 'th';
															return (
																<span 
																	key={house}
																	className="zodiac-dash-house-badge"
																	onMouseEnter={(e) => {
																		e.stopPropagation();
																		handleHouseHover(house, e);
																	}}
																	onMouseLeave={(e) => {
																		e.stopPropagation();
																		hideTooltip();
																	}}
																>
																	{house}{houseSuffix}
																</span>
															);
														})}
													</span>
												</div>
											)}

											{planetsInSign.length > 0 && (
												<div className="zodiac-dash-planets">
													<span className="zodiac-dash-label">Planets:</span>
													<span className="zodiac-dash-planets-list">
														{planetsInSign.map((dignity) => (
															<span 
																key={dignity.planet}
																className="zodiac-dash-planet"
																onMouseEnter={(e) => {
																	e.stopPropagation();
																	const house = getHouseForLongitude(dignity.longitude);
																	const element = SIGN_ELEMENTS[dignity.sign];
																	const interpretation = getPlanetInterpretationForZodiacDash(dignity.planet, dignity.sign, house, dignity.dignity, element);
																	handlePlanetHover(dignity, interpretation, e);
																}}
																onMouseLeave={(e) => {
																	e.stopPropagation();
																	hideTooltip();
																}}
															>
																{getPlanetEmoji(dignity.planet)} {dignity.planet}
															</span>
														))}
													</span>
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</>
			)}

			{/* Tooltip */}
			{tooltip.show && (
				<div 
					className="tooltip"
					style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y + 10}px` }}
				>
					{tooltip.content}
				</div>
			)}
		</div>
	);
}
