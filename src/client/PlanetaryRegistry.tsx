import React, { useState, useEffect, useCallback } from "react";
import { 
	getAllPlanetaryDignities, 
	getDayRuler, 
	getHourRuler, 
	detectAlignments,
	getUpcomingEvents,
	calculateElementalProfile,
	zipCodeToLocation,
	SIGN_ELEMENTS,
	type PlanetaryDignity, 
	type Planet,
	type Element,
	type PlanetaryAlignment,
	type UpcomingEvent,
	type ElementalProfile,
	type Location,
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
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [tooltip, setTooltip] = useState<TooltipState>({ show: false, content: "", x: 0, y: 0 });
	const [selectedWeather, setSelectedWeather] = useState<string | null>("Clear");
	
	// Multi-step date picker state
	const [datePickerStep, setDatePickerStep] = useState<"year" | "month" | "day" | null>(null);
	const [tempYear, setTempYear] = useState<string>("");
	const [tempMonth, setTempMonth] = useState<number | null>(null);
	const [tempDay, setTempDay] = useState<number | null>(null);

	// Initialize with default location (90210) and try to get location from browser
	useEffect(() => {
		// Set default location to 90210 (Beverly Hills, CA)
		const setDefaultLocation = async () => {
			const defaultLoc = await zipCodeToLocation("90210");
			if (defaultLoc) {
				setLocation(defaultLoc);
			}
		};
		
		setDefaultLocation();
		
		// Try to get location from browser (will override default if successful)
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					});
				},
				() => {
					// User denied or error - that's okay, use default
				}
			);
		}
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
				setError("Could not find location for that zip code. Using browser location if available.");
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
		])
			.then((results) => {
				const allDignities = results[0] as PlanetaryDignity[];
				const events = results[1] as UpcomingEvent[];
				const profile = results[2] as ElementalProfile | null;

				setDignities(allDignities);
				setAlignments(detectAlignments(allDignities));
				setUpcomingEvents(events);
				setElementalProfile(profile);
				
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

	// Memoize planet hover handler to prevent re-renders
	const handlePlanetHover = useCallback((planet: PlanetaryDignity | null, event: React.MouseEvent) => {
		if (planet) {
			const details = `${planet.planet} in ${planet.sign} (${SIGN_ELEMENTS[planet.sign]}) - ${planet.dignity}${planet.isRetrograde ? ' (Retrograde)' : ''}`;
			showTooltip(details, event);
		} else {
			hideTooltip();
		}
	}, [showTooltip, hideTooltip]);

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

	const getElementBreakdown = (profile: ElementalProfile, element: Element): string => {
		const elementKey = element.toLowerCase() as "fire" | "earth" | "air" | "water" | "spirit";
		const total = profile[elementKey];
		
		const parts: string[] = [];
		let basePercentage = 0;
		let totalBuffs = 0;
		
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
		
		return `${element} Breakdown:\n${parts.join("\n")}\n\nTotal Adjustments: ${totalBuffs > 0 ? "+" : ""}${Math.round(totalBuffs)}\nFinal Percentage: ${Math.round(total)}%`;
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
		score: "Energy score from -10 to +10. Positive = good vibes, negative = challenging. Based on Essential Dignity and retrograde status.",
		retrograde: "When a planet appears to move backward. Generally weakens the planet's energy and can cause delays or reversals.",
		element: "Each zodiac sign belongs to an element: Fire (action, passion), Earth (stability, practicality), Air (intellect, communication), Water (emotion, intuition).",
		alignment: "Planetary alignments occur when planets form geometric patterns. Conjunctions = together, Oppositions = opposite, Linear = straight line formation.",
		dayRuler: "Each day of the week is ruled by a planet. The day ruler influences the overall energy of that day.",
		hourRuler: "Each hour is ruled by a planet in Chaldean order. Planetary hours are location-specific (based on local sunrise/sunset), not timezone-based, so they vary by location even within the same timezone. The hour ruler influences the energy of that specific time.",
	};

	return (
		<div className={`planetary-registry ${className || ""}`}>
			<h2>Planetary Energy Registry</h2>
			
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
											const breakdown = getElementBreakdown(elementalProfile, "Spirit");
											showTooltip(breakdown, e);
										}}
										onMouseLeave={hideTooltip}
									>
										<span className="element-emoji">✨</span>
										<span className="element-name">Spirit</span>
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
									style={{
										borderColor: getScoreColor(dignity.score),
										boxShadow: `0 0 20px ${getScoreColor(dignity.score)}40`,
									}}
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

									<div 
										className="planet-score"
										onMouseEnter={(e) => showTooltip(tooltipContent.score, e)}
										onMouseLeave={hideTooltip}
									>
										<div
											className="score-bar"
											style={{
												width: `${((dignity.score + 10) / 20) * 100}%`,
												backgroundColor: getScoreColor(dignity.score),
											}}
										/>
										<span className="score-value">{dignity.score > 0 ? "+" : ""}{dignity.score}</span>
									</div>
								</div>
							);
						})}
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
									<div key={idx} className="alignment-card">
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
