import { useEffect, useState } from "react";
import { Group } from "@visx/group";
import { Bar } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import type { DailyCount } from "../../lib/types";
import { WIDTH, MOBILE_DAYS, HEIGHT, MARGIN, colors } from "./TrendChart.css";

interface Props {
	data: DailyCount[];
	// Number of trailing days that fall inside the currently-selected filter
	// window — shaded on the chart per spec §7, since the chart's own scope
	// (fixed 30 days) is wider than what the aggregate strip describes.
	selectedWindowDays: number;
	locale: string;
}

function useIsNarrow() {
	const [isNarrow, setIsNarrow] = useState(false);
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const mq = window.matchMedia("(max-width: 640px)");
		setIsNarrow(mq.matches);
		const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);
	return isNarrow;
}

export default function TrendChart({ data: fullData, selectedWindowDays: fullSelectedWindowDays, locale }: Props) {
	const tickDateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
	const numberFormat = new Intl.NumberFormat(locale);
	// Narrow viewports show fewer trailing days rather than compressing bars
	// below legibility, per spec §16 — the shaded overlay still tracks the
	// (clamped) selected window within whatever's visible.
	const isNarrow = useIsNarrow();
	const data = isNarrow ? fullData.slice(-MOBILE_DAYS) : fullData;
	const selectedWindowDays = Math.min(fullSelectedWindowDays, data.length);

	const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
	const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

	const maxCount = Math.max(1, ...data.map((d) => d.count));

	const xScale = scaleBand<string>({
		domain: data.map((d) => d.date),
		range: [0, innerWidth],
		padding: 0.2,
	});
	const yScale = scaleLinear<number>({
		domain: [0, maxCount],
		range: [innerHeight, 0],
	});

	const shadedFrom = Math.max(0, data.length - selectedWindowDays);

	// Sparse tick labels: first day, last day, and the shaded-window boundary —
	// dense per-day labels are illegible at this width for a 30-day axis.
	const tickDates = new Set<string>([data[0]?.date, data[data.length - 1]?.date, data[shadedFrom]?.date].filter(Boolean) as string[]);

	return (
		<svg
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			style={{ width: "100%", height: "auto", maxWidth: WIDTH }}
			role="img"
			aria-label={`Incidents per day, last ${data.length} days`}
		>
			<Group left={MARGIN.left} top={MARGIN.top}>
				<rect
					x={xScale(data[shadedFrom]?.date ?? "")}
					width={innerWidth - (xScale(data[shadedFrom]?.date ?? "") ?? 0)}
					height={innerHeight}
					fill={colors.shaded}
					opacity={0.6}
				/>
				{data.map((d, i) => {
					const barHeight = innerHeight - (yScale(d.count) ?? 0);
					const barX = xScale(d.date) ?? 0;
					const titleText = `${tickDateFormat.format(new Date(`${d.date}T00:00:00Z`))}: ${numberFormat.format(d.count)} incident${d.count === 1 ? "" : "s"}`;
					return (
						<Bar
							key={d.date}
							x={barX}
							y={innerHeight - barHeight}
							width={xScale.bandwidth()}
							height={barHeight}
							fill={i >= shadedFrom ? colors.barSelected : colors.bar}
						>
							<title>{titleText}</title>
						</Bar>
					);
				})}
				<AxisLeft
					scale={yScale}
					numTicks={3}
					stroke={colors.axis}
					tickStroke={colors.axis}
					tickFormat={(v) => numberFormat.format(v as number)}
					tickLabelProps={() => ({ fontSize: 10, fill: colors.tickLabel, dx: -4 })}
				/>
				<AxisBottom
					top={innerHeight}
					scale={xScale}
					stroke={colors.axis}
					tickStroke={colors.axis}
					tickValues={[...tickDates]}
					tickFormat={(v) => tickDateFormat.format(new Date(`${v}T00:00:00Z`))}
					tickLabelProps={() => ({ fontSize: 10, fill: colors.tickLabel })}
				/>
			</Group>
		</svg>
	);
}
