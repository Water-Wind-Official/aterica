import React, { useState, useEffect } from "react";
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

	// Try to get location from browser on mount
	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					});
				},
				() => {
					// User denied or error - that's okay
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
			location ? calculateElementalProfile(dateTime, location) : Promise.resolve(null),
		])
			.then((results) => {
				const allDignities = results[0] as PlanetaryDignity[];
				const events = results[1] as UpcomingEvent[];
				const profile = results[2] as ElementalProfile | null;

				setDignities(allDignities);
				setAlignments(detectAlignments(allDignities));
				setUpcomingEvents(events);
				setElementalProfile(profile);
				setDayRuler(getDayRuler(dateTime));
				setHourRuler(getHourRuler(dateTime));
				setIsLoading(false);
			})
			.catch((err) => {
				console.error("Error calculating planetary positions:", err);
				setError(err.message || "Failed to calculate planetary positions");
				setIsLoading(false);
			});
	}, [selectedDate, selectedTime, location]);

	const showTooltip = (content: string, event: React.MouseEvent) => {
		setTooltip({
			show: true,
			content,
			x: event.clientX,
			y: event.clientY,
		});
	};

	const hideTooltip = () => {
		setTooltip({ show: false, content: "", x: 0, y: 0 });
	};

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

	const formatDateInput = (date: Date): string => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const formatEventDate = (date: Date): string => {
		return date.toLocaleDateString("en-US", { 
			month: "short", 
			day: "numeric",
			year: "numeric" 
		});
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
		hourRuler: "Each hour is ruled by a planet in Chaldean order. The hour ruler influences the energy of that specific time.",
	};

	return (
		<div className={`planetary-registry ${className || ""}`}>
			<h2>Planetary Energy Registry</h2>
			
			<div className="datetime-controls">
				<div className="control-group">
					<label htmlFor="date-input">Date:</label>
					<input
						id="date-input"
						type="date"
						value={formatDateInput(selectedDate)}
						onChange={(e) => setSelectedDate(new Date(e.target.value))}
					/>
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
							<h3>
								Elemental Energy Profile{" "}
								<span 
									className="info-icon"
									onMouseEnter={(e) => showTooltip("Combines Planetary Positions (50%), Planetary Hour (30%), and Tattva (20%)", e)}
									onMouseLeave={hideTooltip}
								>
									ℹ️
								</span>
							</h3>
							
							{/* Final Composition - Compact Grid */}
							<div className="elemental-composition-grid">
								<div className="element-compact" style={{ "--percent": `${elementalProfile.fire}%`, "--color": "#ef4444" } as React.CSSProperties}>
									<span className="element-emoji">🔥</span>
									<span className="element-name">Fire</span>
									<span className="element-percent">{elementalProfile.fire.toFixed(1)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div className="element-compact" style={{ "--percent": `${elementalProfile.earth}%`, "--color": "#84cc16" } as React.CSSProperties}>
									<span className="element-emoji">🌍</span>
									<span className="element-name">Earth</span>
									<span className="element-percent">{elementalProfile.earth.toFixed(1)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div className="element-compact" style={{ "--percent": `${elementalProfile.air}%`, "--color": "#3b82f6" } as React.CSSProperties}>
									<span className="element-emoji">💨</span>
									<span className="element-name">Air</span>
									<span className="element-percent">{elementalProfile.air.toFixed(1)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								<div className="element-compact" style={{ "--percent": `${elementalProfile.water}%`, "--color": "#06b6d4" } as React.CSSProperties}>
									<span className="element-emoji">💧</span>
									<span className="element-name">Water</span>
									<span className="element-percent">{elementalProfile.water.toFixed(1)}%</span>
									<div className="element-bar-mini"></div>
								</div>
								{elementalProfile.spirit > 0 && (
									<div className="element-compact" style={{ "--percent": `${elementalProfile.spirit}%`, "--color": "#a855f7" } as React.CSSProperties}>
										<span className="element-emoji">✨</span>
										<span className="element-name">Spirit</span>
										<span className="element-percent">{elementalProfile.spirit.toFixed(1)}%</span>
										<div className="element-bar-mini"></div>
									</div>
								)}
							</div>

							{/* Compact Breakdown */}
							<div className="breakdown-compact">
								{elementalProfile.breakdown.map((component, idx) => (
									<div key={idx} className="breakdown-item">
										<div className="breakdown-label-compact">
											<span className="breakdown-name">{component.source}</span>
											<span className="breakdown-weight-badge">{component.weight}%</span>
										</div>
										<div className="breakdown-elements-compact">
											{component.fire > 0 && <span className="breakdown-element-tag" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}>🔥 {component.fire.toFixed(1)}%</span>}
											{component.earth > 0 && <span className="breakdown-element-tag" style={{ backgroundColor: "rgba(132, 204, 22, 0.2)", color: "#84cc16" }}>🌍 {component.earth.toFixed(1)}%</span>}
											{component.air > 0 && <span className="breakdown-element-tag" style={{ backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#3b82f6" }}>💨 {component.air.toFixed(1)}%</span>}
											{component.water > 0 && <span className="breakdown-element-tag" style={{ backgroundColor: "rgba(6, 182, 212, 0.2)", color: "#06b6d4" }}>💧 {component.water.toFixed(1)}%</span>}
											{component.spirit > 0 && <span className="breakdown-element-tag" style={{ backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#a855f7" }}>✨ {component.spirit.toFixed(1)}%</span>}
										</div>
									</div>
								))}
							</div>
						</div>
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
								{upcomingEvents.slice(0, 5).map((event, idx) => (
									<div 
										key={idx} 
										className="event-card"
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
											<span className="event-date">{formatEventDate(event.date)}</span>
										</div>
										<h4 className="event-name">
											{event.name}
											{event.type === "Meteor Shower" && (
												<span className="visibility-indicator" title="Hover for visibility information"> 👁️</span>
											)}
										</h4>
										<p className="event-description">{event.description}</p>
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
