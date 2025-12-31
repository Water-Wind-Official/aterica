import React, { useMemo, memo } from "react";
import { type PlanetaryDignity, type Planet, type ZodiacSign, ZODIAC_SIGNS, SIGN_ELEMENTS, type HouseCusps, calculateHouseCusps, type Location } from "./planetaryUtils";

interface NatalChartWheelProps {
	dignities: PlanetaryDignity[];
	date: Date;
	location: Location | null;
	onPlanetHover?: (planet: PlanetaryDignity | null, event: React.MouseEvent) => void;
}

export const NatalChartWheel = memo(function NatalChartWheel({ dignities, date, location, onPlanetHover }: NatalChartWheelProps) {
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
	// Signs are positioned at their natural zodiac boundaries (0° Aries, 30° Taurus, etc.)
	// Each sign occupies 30 degrees of the zodiac wheel
	const zodiacSigns = useMemo(() => {
		return ZODIAC_SIGNS.map((sign, index) => {
			// Each sign starts at index * 30 degrees (0° Aries, 30° Taurus, etc.)
			// Position the sign label at the start of each sign (0° into each sign)
			const signStartLongitude = index * 30;
			const angle = longitudeToAngle(signStartLongitude);
			const [x, y] = angleToCoords(angle, outerRadius - 10);
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
	}, [longitudeToAngle, angleToCoords, outerRadius]);

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

	// Calculate angular distance between two longitudes (0-180°)
	const angularDistance = (lon1: number, lon2: number): number => {
		let diff = Math.abs(lon1 - lon2);
		if (diff > 180) diff = 360 - diff;
		return diff;
	};

	// Find which house a planet is in based on its longitude
	const getHouseForPlanet = (longitude: number): number | null => {
		if (!houseCusps) return null;
		
		// Normalize longitude to 0-360
		let normalizedLon = longitude % 360;
		if (normalizedLon < 0) normalizedLon += 360;
		
		// Find which house this longitude falls into
		for (let i = 0; i < 12; i++) {
			const cusp1 = houseCusps.houses[i];
			const cusp2 = houseCusps.houses[(i + 1) % 12];
			
			// Handle wrap-around for last house
			if (i === 11) {
				// Last house wraps around
				if (normalizedLon >= cusp1 || normalizedLon < cusp2) {
					return i + 1; // House 12
				}
			} else {
				if (normalizedLon >= cusp1 && normalizedLon < cusp2) {
					return i + 1; // Houses 1-11
				}
			}
		}
		
		return null;
	};

	// Get degree within sign (0-29)
	const getDegreeInSign = (longitude: number): number => {
		const normalizedLon = longitude % 360;
		return Math.floor(normalizedLon % 30);
	};

	// Render lines from planets to center
	const planetToCenterLines = useMemo(() => {
		return dignities.map((dignity) => {
			const angle = longitudeToAngle(dignity.longitude);
			const [x, y] = angleToCoords(angle, planetRadius);
			
			return (
				<line
					key={`planet-center-${dignity.planet}`}
					x1={x}
					y1={y}
					x2={centerX}
					y2={centerY}
					stroke="#444"
					strokeWidth="0.5"
					opacity="0.2"
				/>
			);
		});
	}, [dignities, longitudeToAngle, angleToCoords, planetRadius]);

	// Render aspect lines between ALL planets
	const aspectLines = useMemo(() => {
		const lines: JSX.Element[] = [];
		const aspectTolerance = 8; // degrees tolerance for aspects
		
		// All major and minor aspects with appropriate colors
		const aspects = [
			{ angle: 0, name: 'Conjunction', color: '#666', strokeWidth: 0.5, opacity: 0.4 }, // Gray for conjunctions
			{ angle: 30, name: 'Semi-Sextile', color: '#888', strokeWidth: 0.3, opacity: 0.3 }, // Light gray
			{ angle: 45, name: 'Semi-Square', color: '#ff6b6b', strokeWidth: 0.3, opacity: 0.3 }, // Light red
			{ angle: 60, name: 'Sextile', color: '#4ecdc4', strokeWidth: 0.4, opacity: 0.4 }, // Cyan/blue for harmonious
			{ angle: 72, name: 'Quintile', color: '#95e1d3', strokeWidth: 0.3, opacity: 0.3 }, // Light green
			{ angle: 90, name: 'Square', color: '#ff6b6b', strokeWidth: 0.5, opacity: 0.5 }, // Red for challenging
			{ angle: 120, name: 'Trine', color: '#4ecdc4', strokeWidth: 0.5, opacity: 0.5 }, // Cyan/blue for harmonious
			{ angle: 135, name: 'Sesquiquadrate', color: '#ff6b6b', strokeWidth: 0.3, opacity: 0.3 }, // Light red
			{ angle: 150, name: 'Quincunx', color: '#ffa500', strokeWidth: 0.3, opacity: 0.3 }, // Orange
			{ angle: 180, name: 'Opposition', color: '#ff6b6b', strokeWidth: 0.5, opacity: 0.5 }, // Red for challenging
		];

		for (let i = 0; i < dignities.length; i++) {
			for (let j = i + 1; j < dignities.length; j++) {
				const dist = angularDistance(dignities[i].longitude, dignities[j].longitude);
				
				// Check each aspect and draw the closest matching one
				let bestAspect = null;
				let bestDist = Infinity;
				
				for (const aspect of aspects) {
					const aspectDist = Math.abs(dist - aspect.angle);
					if (aspectDist <= aspectTolerance && aspectDist < bestDist) {
						bestDist = aspectDist;
						bestAspect = aspect;
					}
				}
				
				if (bestAspect) {
					const angle1 = longitudeToAngle(dignities[i].longitude);
					const angle2 = longitudeToAngle(dignities[j].longitude);
					const [x1, y1] = angleToCoords(angle1, planetRadius);
					const [x2, y2] = angleToCoords(angle2, planetRadius);
					
					lines.push(
						<line
							key={`aspect-${i}-${j}-${bestAspect.angle}`}
							x1={x1}
							y1={y1}
							x2={x2}
							y2={y2}
							stroke={bestAspect.color}
							strokeWidth={bestAspect.strokeWidth}
							opacity={bestAspect.opacity}
						/>
					);
				}
			}
		}
		
		return lines;
	}, [dignities, longitudeToAngle, angleToCoords, planetRadius]);

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
					onMouseEnter={(e) => {
						e.stopPropagation();
						onPlanetHover?.(dignity, e);
					}}
					onMouseLeave={(e) => {
						e.stopPropagation();
						onPlanetHover?.(null, e);
					}}
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
	}, [dignities, longitudeToAngle, angleToCoords, planetRadius]);

	// Render house numbers
	const houseNumbers = useMemo(() => {
		if (!houseCusps) return null;

		return houseCusps.houses.map((cusp, index) => {
			// Calculate midpoint of house (average of this cusp and next)
			const nextCusp = houseCusps.houses[(index + 1) % 12];
			// Handle wrap-around for the last house
			let houseMidLongitude;
			if (index === 11) {
				// Last house: midpoint between 12th cusp and 1st cusp
				// If nextCusp < cusp, we've wrapped around
				if (nextCusp < cusp) {
					houseMidLongitude = (cusp + nextCusp + 360) / 2;
					if (houseMidLongitude >= 360) houseMidLongitude -= 360;
				} else {
					houseMidLongitude = (cusp + nextCusp) / 2;
				}
			} else {
				houseMidLongitude = (cusp + nextCusp) / 2;
			}
			const houseMidAngle = longitudeToAngle(houseMidLongitude);
			const [x, y] = angleToCoords(houseMidAngle, 170);

			const houseNumber = index + 1;
			return (
				<text
					key={`house-num-${index}`}
					x={x}
					y={y}
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize="13"
					fill="#aaa"
					fontWeight="bold"
					style={{ pointerEvents: 'none', userSelect: 'none' }}
				>
					{houseNumber}
				</text>
			);
		});
	}, [houseCusps, longitudeToAngle, angleToCoords, houseRadius]);

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

						{/* Aspect lines between planets - render first so they're behind everything */}
						{aspectLines}

						{/* House cusp lines */}
						{houseLines}

						{/* Lines from planets to center */}
						{planetToCenterLines}

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
}, (prevProps, nextProps) => {
	// Custom comparison function to prevent re-renders when tooltip state changes
	// Only re-render if dignities, date, or location actually change
	
	// Compare dignities arrays by checking length and each element
	if (prevProps.dignities.length !== nextProps.dignities.length) {
		return false; // Re-render if lengths differ
	}
	
	for (let i = 0; i < prevProps.dignities.length; i++) {
		const prev = prevProps.dignities[i];
		const next = nextProps.dignities[i];
		if (prev.planet !== next.planet || 
		    prev.longitude !== next.longitude ||
		    prev.sign !== next.sign ||
		    prev.isRetrograde !== next.isRetrograde) {
			return false; // Re-render if any planet data changed
		}
	}
	
	// Compare dates
	if (prevProps.date.getTime() !== nextProps.date.getTime()) {
		return false; // Re-render if date changed
	}
	
	// Compare location
	if (prevProps.location?.latitude !== nextProps.location?.latitude ||
	    prevProps.location?.longitude !== nextProps.location?.longitude) {
		return false; // Re-render if location changed
	}
	
	// Props are equal, skip re-render
	return true;
});
