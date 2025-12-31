import React, { useState, useEffect } from "react";
import { getAllPlanetaryDignities, getDayRuler, getHourRuler, type PlanetaryDignity, type Planet } from "./planetaryUtils";

interface PlanetaryRegistryProps {
	className?: string;
}

export function PlanetaryRegistry({ className }: PlanetaryRegistryProps) {
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedTime, setSelectedTime] = useState(
		new Date().toTimeString().slice(0, 5)
	);
	const [dignities, setDignities] = useState<PlanetaryDignity[]>([]);
	const [dayRuler, setDayRuler] = useState<Planet>("Sun");
	const [hourRuler, setHourRuler] = useState<Planet>("Sun");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Combine date and time
		const [hours, minutes] = selectedTime.split(":").map(Number);
		const dateTime = new Date(selectedDate);
		dateTime.setHours(hours, minutes, 0, 0);

		setIsLoading(true);
		setError(null);

		getAllPlanetaryDignities(dateTime)
			.then((allDignities) => {
				setDignities(allDignities);
				setDayRuler(getDayRuler(dateTime));
				setHourRuler(getHourRuler(dateTime));
				setIsLoading(false);
			})
			.catch((err) => {
				console.error("Error calculating planetary positions:", err);
				setError(err.message || "Failed to calculate planetary positions");
				setIsLoading(false);
			});
	}, [selectedDate, selectedTime]);

	const getScoreColor = (score: number): string => {
		if (score >= 4) return "#4ade80"; // Green - very good
		if (score >= 1) return "#86efac"; // Light green - good
		if (score >= -1) return "#fbbf24"; // Yellow - neutral
		if (score >= -4) return "#fb923c"; // Orange - bad
		return "#f87171"; // Red - very bad
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
			Uranus: "♅",
			Neptune: "♆",
			Pluto: "♇",
		};
		return emojis[planet];
	};

	const formatDateInput = (date: Date): string => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
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
			</div>

			<div className="current-rulers">
				<p className="ruler-info">
					<span className="ruler-label">Day Ruler:</span>{" "}
					<span className="ruler-value">{getPlanetEmoji(dayRuler)} {dayRuler}</span>
				</p>
				<p className="ruler-info">
					<span className="ruler-label">Hour Ruler:</span>{" "}
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
				<div className="planets-grid">
					{dignities.map((dignity) => (
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
								
								<div className="planet-dignity">
									<span className="dignity-emoji">{getDignityEmoji(dignity.dignity)}</span>
									<span className="dignity-label">{dignity.dignity}</span>
								</div>

								{dignity.isRetrograde && (
									<div className="retrograde-badge">℞ Retrograde</div>
								)}
							</div>

							<div className="planet-score">
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
					))}
				</div>
			)}
		</div>
	);
}

