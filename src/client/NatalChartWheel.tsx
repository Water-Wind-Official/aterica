import React, { useMemo } from "react";
import { type PlanetaryDignity, type Planet, type ZodiacSign, ZODIAC_SIGNS, SIGN_ELEMENTS, type HouseCusps, calculateHouseCusps, type Location } from "./planetaryUtils";

interface NatalChartWheelProps {
	dignities: PlanetaryDignity[];
	date: Date;
	location: Location | null;
	onPlanetHover?: (planet: PlanetaryDignity | null, event: React.MouseEvent) => void;
}

export function NatalChartWheel({ dignities, date, location, onPlanetHover }: NatalChartWheelProps) {
	const [houseCusps, setHouseCusps] = React.useState<HouseCusps | null>(null);
	const [isLoadingHouses, setIsLoadingHouses] = React.useState(true);

	// Calculate house cusps when location is available
	React.useEffect(() => {
		if (!location) {
			setIsLoadingHouses(false);
			return;
		}

		setIsLoadingHouses(true);
		calculateHouseCusps(date, location.latitude, location.longitude)
			.then((cusps) => {
				setHouseCusps(cusps);
				setIsLoadingHouses(false);
			})
			.catch((err) => {
				console.error("Error calculating house cusps:", err);
				setIsLoadingHouses(false);
			});
	}, [date, location]);

	const wheelSize = 500;
	const centerX = wheelSize / 2;
	const centerY = wheelSize / 2;
	const outerRadius = 240;
	const innerRadius = 180;
	const houseRadius = 160;
	const planetRadius = 140;

	// Convert longitude to angle for natal chart
	// In Western astrology charts:
	// - Ascendant (1st house cusp) is at the left (9 o'clock)
	// - MC (10th house cusp) is at the top (12 o'clock)
	// - 0° Aries is typically at the Ascendant position
	// We rotate so that the Ascendant is at the left
	const longitudeToAngle = (longitude: number): number => {
		// Convert to radians, rotate so 0° is at left (9 o'clock), clockwise
		return ((longitude - 90) * Math.PI / 180);
	};

	// Convert angle to x, y coordinates
	const angleToCoords = (angle: number, radius: number): [number, number] => {
		return [
			centerX + radius * Math.cos(angle),
			centerY + radius * Math.sin(angle),
		];
	};

	// Get planet emoji
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

	// Get sign abbreviation
	const getSignAbbr = (sign: ZodiacSign): string => {
		return sign.substring(0, 3).toUpperCase();
	};

	// Get element color
	const getElementColor = (element: string): string => {
		switch (element) {
			case "Fire": return "#ef4444";
			case "Earth": return "#84cc16";
			case "Air": return "#3b82f6";
			case "Water": return "#06b6d4";
			default: return "#999";
		}
	};

	// Render zodiac signs around the outer ring
	// Signs are positioned based on their actual positions in the chart
	const zodiacSigns = useMemo(() => {
		if (!houseCusps) {
			// Fallback: show signs at equal intervals
			return ZODIAC_SIGNS.map((sign, index) => {
				const signAngle = longitudeToAngle(index * 30);
				const [x, y] = angleToCoords(signAngle, outerRadius - 15);
				const element = SIGN_ELEMENTS[sign];
				const color = getElementColor(element);

				return (
					<g key={sign}>
						<text
							x={x}
							y={y}
							textAnchor="middle"
							dominantBaseline="middle"
							fill={color}
							fontSize="11"
							fontWeight="bold"
						>
							{getSignAbbr(sign)}
						</text>
					</g>
				);
			});
		}

		// Show signs at their actual positions based on house cusps
		const signPositions: { sign: ZodiacSign; angle: number }[] = [];
		houseCusps.houses.forEach((cusp, houseIndex) => {
			const signIndex = Math.floor(cusp / 30) % 12;
			const sign = ZODIAC_SIGNS[signIndex];
			const angle = longitudeToAngle(cusp);
			signPositions.push({ sign, angle });
		});

		return signPositions.map(({ sign, angle }, index) => {
			const [x, y] = angleToCoords(angle, outerRadius - 15);
			const element = SIGN_ELEMENTS[sign];
			const color = getElementColor(element);

			return (
				<g key={`${sign}-${index}`}>
					<text
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fill={color}
						fontSize="10"
						fontWeight="bold"
					>
						{getSignAbbr(sign)}
					</text>
				</g>
			);
		});
	}, [houseCusps]);

	// Render house cusps
	const houseLines = useMemo(() => {
		if (!houseCusps) return null;

		return houseCusps.houses.map((cusp, index) => {
			const angle = longitudeToAngle(cusp);
			const [x1, y1] = angleToCoords(angle, innerRadius);
			const [x2, y2] = angleToCoords(angle, outerRadius);

			return (
				<line
					key={`house-${index}`}
					x1={x1}
					y1={y1}
					x2={x2}
					y2={y2}
					stroke="#555"
					strokeWidth="1"
					opacity="0.5"
				/>
			);
		});
	}, [houseCusps]);

	// Render planets
	const planets = useMemo(() => {
		return dignities.map((dignity) => {
			const angle = longitudeToAngle(dignity.longitude);
			const [x, y] = angleToCoords(angle, planetRadius);
			const element = SIGN_ELEMENTS[dignity.sign];
			const color = getElementColor(element);

			return (
				<g 
					key={dignity.planet}
					onMouseEnter={(e) => onPlanetHover?.(dignity, e)}
					onMouseLeave={(e) => onPlanetHover?.(null, e)}
					style={{ cursor: 'pointer' }}
				>
					<circle
						cx={x}
						cy={y}
						r="12"
						fill={dignity.isRetrograde ? "#f87171" : color}
						stroke="#000"
						strokeWidth="1"
						opacity="0.8"
					/>
					<text
						x={x}
						y={y}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="14"
						fill="#000"
						fontWeight="bold"
					>
						{getPlanetEmoji(dignity.planet)}
					</text>
					{/* Planet label */}
					<text
						x={x}
						y={y + 20}
						textAnchor="middle"
						dominantBaseline="middle"
						fontSize="10"
						fill={color}
					>
						{dignity.planet}
					</text>
				</g>
			);
		});
	}, [dignities]);

	// Render house numbers
	const houseNumbers = useMemo(() => {
		if (!houseCusps) return null;

		return houseCusps.houses.map((cusp, index) => {
			// Calculate midpoint of house (average of this cusp and next)
			const nextCusp = houseCusps.houses[(index + 1) % 12];
			const houseMidAngle = longitudeToAngle((cusp + nextCusp) / 2);
			const [x, y] = angleToCoords(houseMidAngle, houseRadius);

			return (
				<text
					key={`house-num-${index}`}
					x={x}
					y={y}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="11"
					fill="#888"
					fontWeight="bold"
				>
					{index + 1}
				</text>
			);
		});
	}, [houseCusps]);

	return (
		<div className="natal-chart-section">
			<h3>
				Wheel{" "}
				<span 
					className="info-icon"
					onMouseEnter={(e) => {
						// Tooltip would be handled by parent
					}}
					onMouseLeave={() => {}}
				>
					ℹ️
				</span>
			</h3>
			{isLoadingHouses && location ? (
				<div className="loading-message">
					<p>Calculating houses...</p>
				</div>
			) : !location ? (
				<div className="error-message">
					<p>Location required for natal chart calculation</p>
				</div>
			) : (
				<div className="natal-chart-container">
					<svg
						width={wheelSize}
						height={wheelSize}
						viewBox={`0 0 ${wheelSize} ${wheelSize}`}
						className="natal-chart-wheel"
					>
						{/* Outer circle */}
						<circle
							cx={centerX}
							cy={centerY}
							r={outerRadius}
							fill="none"
							stroke="#333"
							strokeWidth="2"
						/>
						
						{/* Inner circle */}
						<circle
							cx={centerX}
							cy={centerY}
							r={innerRadius}
							fill="none"
							stroke="#333"
							strokeWidth="1"
						/>

						{/* House cusp lines */}
						{houseLines}

						{/* House numbers */}
						{houseNumbers}

						{/* Zodiac signs */}
						{zodiacSigns}

						{/* Planets */}
						{planets}

						{/* Ascendant and MC indicators */}
						{houseCusps && (
							<>
								{/* Ascendant line (1st house cusp) */}
								<line
									x1={angleToCoords(longitudeToAngle(houseCusps.ascendant), innerRadius)[0]}
									y1={angleToCoords(longitudeToAngle(houseCusps.ascendant), innerRadius)[1]}
									x2={angleToCoords(longitudeToAngle(houseCusps.ascendant), outerRadius)[0]}
									y2={angleToCoords(longitudeToAngle(houseCusps.ascendant), outerRadius)[1]}
									stroke="#06b6d4"
									strokeWidth="2"
									opacity="0.8"
								/>
								{/* MC line (10th house cusp) */}
								<line
									x1={angleToCoords(longitudeToAngle(houseCusps.mc), innerRadius)[0]}
									y1={angleToCoords(longitudeToAngle(houseCusps.mc), innerRadius)[1]}
									x2={angleToCoords(longitudeToAngle(houseCusps.mc), outerRadius)[0]}
									y2={angleToCoords(longitudeToAngle(houseCusps.mc), outerRadius)[1]}
									stroke="#ef4444"
									strokeWidth="2"
									opacity="0.8"
								/>
								{/* Ascendant label */}
								<text
									x={angleToCoords(longitudeToAngle(houseCusps.ascendant), outerRadius + 10)[0]}
									y={angleToCoords(longitudeToAngle(houseCusps.ascendant), outerRadius + 10)[1]}
									textAnchor="middle"
									dominantBaseline="middle"
									fill="#06b6d4"
									fontSize="10"
									fontWeight="bold"
								>
									ASC
								</text>
								{/* MC label */}
								<text
									x={angleToCoords(longitudeToAngle(houseCusps.mc), outerRadius + 10)[0]}
									y={angleToCoords(longitudeToAngle(houseCusps.mc), outerRadius + 10)[1]}
									textAnchor="middle"
									dominantBaseline="middle"
									fill="#ef4444"
									fontSize="10"
									fontWeight="bold"
								>
									MC
								</text>
							</>
						)}

						{/* Center point */}
						<circle
							cx={centerX}
							cy={centerY}
							r="3"
							fill="#fff"
						/>
					</svg>
				</div>
			)}
		</div>
	);
}
