import { Group } from "@visx/group";
import { Bar } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import type { DailyCount } from "../../lib/types";
import { WIDTH, HEIGHT, MARGIN, colors } from "./TrendChart.css";

interface Props {
	data: DailyCount[];
	// Number of trailing days that fall inside the currently-selected filter
	// window — shaded on the chart per spec §7, since the chart's own scope
	// (fixed 30 days) is wider than what the aggregate strip describes.
	selectedWindowDays: number;
}

export default function TrendChart({ data, selectedWindowDays }: Props) {
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
		<svg width={WIDTH} height={HEIGHT} role="img" aria-label={`Incidents per day, last ${data.length} days`}>
			<Group left={MARGIN.left} top={MARGIN.top}>
				<rect
					x={xScale(data[shadedFrom]?.date ?? "")}
					width={innerWidth - (xScale(data[shadedFrom]?.date ?? "") ?? 0)}
					height={innerHeight}
					fill={colors.shaded}
					opacity={0.6}
				/>
				{data.map((d) => {
					const barHeight = innerHeight - (yScale(d.count) ?? 0);
					const barX = xScale(d.date) ?? 0;
					return (
						<Bar key={d.date} x={barX} y={innerHeight - barHeight} width={xScale.bandwidth()} height={barHeight} fill={colors.bar}>
							<title>
								{d.date}: {d.count} incident{d.count === 1 ? "" : "s"}
							</title>
						</Bar>
					);
				})}
				<AxisLeft
					scale={yScale}
					numTicks={3}
					stroke={colors.axis}
					tickStroke={colors.axis}
					tickLabelProps={() => ({ fontSize: 10, fill: colors.tickLabel, dx: -4 })}
				/>
				<AxisBottom
					top={innerHeight}
					scale={xScale}
					stroke={colors.axis}
					tickStroke={colors.axis}
					tickValues={[...tickDates]}
					tickLabelProps={() => ({ fontSize: 10, fill: colors.tickLabel })}
				/>
			</Group>
		</svg>
	);
}
