"use client"

import { BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { motion, useSpring } from "framer-motion";
import { useContext, useEffect, useMemo, useState } from "react";
import { Bar, Line } from 'react-chartjs-2';
import { CourseId, Grade, gradeGPA, InstructorGrade, scheduleAbbr, Section, Term, toSmallCourse } from "../../shared/types";
import { SelectionContext, useGpaColor } from "./clientutil";
import { SectionLinkPopup } from "./sectionlink";
import { Anchor, bgColor, Loading, Text } from "./util";
import { AppCtx, useAPIResponse } from "./wrapper";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	LineElement,
	PointElement,
	Title,
	Tooltip,
	Filler,
	Legend
);

const graphColors = [
  "#87CEFA", "#98FB98", "#FFA07A", "#FFE4B5", "#F0E68C", "#FF6347", "#FFD700", "#B0E0E6", "#00FA9A", "#FF4500", "#BDB76B", "#8FBC8F", "#FF69B4", "#FA8072", "#FFDAB9", "#FFE4E1", "#F0FFF0", "#FFEC8B", "#FFE4C4", "#D2B48C", "#DDA0DD", "#FFD700", "#FFEBCD",
];

const useGraphLabelGridColors = () => {
	const dark = useContext(AppCtx).theme=="dark";
	const label = dark ? "#ededed" : "#000000";
	const grid = dark ? "#d1d5db" : "#74777a";
	return {label, grid};
}

export const Graph = ({grades, title}: { grades: [string, InstructorGrade][], title: string }) => {
	const allLetterGrades: Grade[]=[...new Set(grades.flatMap(x=>Object.entries(x[1].grade)
		.filter(([k,v])=>k in gradeGPA && v>0).map(([k,])=>k) as Grade[]))];
	allLetterGrades.sort((a,b) => gradeGPA[b]!-gradeGPA[a]!
		-(a=="E"?0.1:0)+(b=='E'? 0.1:0)-(a=="A+"?0.1:0)+(b=='A+'? 0.1:0));

	const datasets = grades.map((x,i) => {
		const d = allLetterGrades.map(g=>x[1].grade[g] ?? 0);
		const tot = d.length==0 ? 1 : d.reduce((a,b)=>a+b);

		return {
			backgroundColor: graphColors[i%graphColors.length],
			label: x[0],
			data: d.map(y=>100*y/tot),
			barPercentage: 1
		};
	});

	const {label, grid} = useGraphLabelGridColors();
	return <div className={`md:mt-4 mt-2 mb-4 w-full h-96 mx-auto p-4 pt-0 rounded-xl ${bgColor.secondary}`} >
		<div className="h-full w-full mb-4">
			<Bar
				options={{
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'top',
							labels: { color: label }
						},
						tooltip: {
							callbacks: {
								title(ctx) {return ctx.map(x=>x.dataset.label!);},
								label(ctx) {
									return ctx.parsed.x!=null && ctx.parsed.y!=null ? `${allLetterGrades[ctx.parsed.x]}: ${ctx.parsed.y.toFixed(0)}%` : undefined;
								}
							},
							intersect: false
						},
						title: {
							display: true,
							text: title,
							color: label,
							font: {size: 18}
						},
					},
					scales: {
						y: {
							min: 0,
							max: 100,
							title: {
								display: true,
								text: '% of Students',
								color: label
							},
							grid: { color: grid },
							ticks: { color: grid, callback: (value) => `${value}%` }
						},
						x: {
							grid: { color: grid },
							ticks: { color: grid }
						}
					}
				}} data={{
					labels: allLetterGrades, datasets
				}} />
		</div>
	</div>;
}

type ChartData = {
	sections: {
		crn: number, dropRate: number,
		counts: {enrollment: number, time: string}[],
	}[],
	dropRate: number
};

function EnrollmentChartInner({course, term, data}: {
	course: CourseId, term: Term, data: ChartData
}) {
	const [withSections, totalCounts] = useMemo(()=>{
		const byCrn = new Map(course.course.sections[term].map(x=>[x.crn, x]));

		const sorted = data.sections
			.flatMap(x=>x.counts.map(y=>({enrollment: y.enrollment, time: Date.parse(y.time), sec: x})))
			.sort((a,b)=>a.time-b.time);
		const contributionBySection = new Map<typeof data.sections[0],number>();

		let now=0;
		const totals: {enrollment: number, time: number}[] = [];
		for (let i=0; i<sorted.length; i++) {
			const j=i;
			for (; i<sorted.length && sorted[j].time==sorted[i].time; i++) {
				const old = contributionBySection.get(sorted[i].sec) ?? 0;
				now+=sorted[i].enrollment-old;
				contributionBySection.set(sorted[i].sec, sorted[i].enrollment);
			}

			totals.push({enrollment: now, time: sorted[i-1].time});
		}

		return [
			data.sections
				.map(x=>byCrn.has(x.crn) ? {
					...x, counts: x.counts.map(count=>({
						enrollment: count.enrollment, time: Date.parse(count.time)
					})),
					section: byCrn.get(x.crn)!
				} : null)
				.filter(x=>x).map(x=>x!), // 😠
			totals
		];
	}, [course.course, data, term]);

	const smallCourse = useMemo(()=>toSmallCourse(course), [course]);

	const {label, grid} = useGraphLabelGridColors();

	const [stacked, setStacked] = useState(true);

	const springOpts = {bounce: 0, duration: 1000};
	const tooltipX = useSpring(0, springOpts);
	const tooltipY = useSpring(0, springOpts);
	const tooltipOpacity = useSpring(0, springOpts);

	const [tooltip, setTooltip] = useState<{
		section: Section|null, time: number,
		enrollment: number, dropRate: number
	}|null>(null);

	const commonDatasetProps = (i: number, big?: boolean) => ({
		backgroundColor: `${i==-1 ? grid : graphColors[i%graphColors.length]}bb`,
		pointRadius: big ? 7 : 3,
		pointHoverRadius: big ? 10 : 5,
		segment: {
			borderWidth: 1,
			borderColor: `${label}55`,
		},
		fill: "stack"
	} as const);

	const selCtx=useContext(SelectionContext);
	useEffect(()=>{
		const sec = tooltip?.section;
		if (sec) {
			selCtx.selSection(sec);
			return ()=>selCtx.deselectSection(sec);
		}
	}, [tooltip?.section, selCtx]);

	const useDropNote = (x: number|null, sec: boolean) => {
		const col = useGpaColor()(x==null ? null : 0.3/Math.max(0.0001, x));

		return x!=null && <p className="mb-2" >
			Approximately <Text v="bold" style={{backgroundColor: col}} className="rounded-md p-1" >
				{Math.round(x*1e4)/1e2}%
			</Text> of students dropped this {sec ? "section" : "course"}
		</p>;
	}

	const tooltipDropNote = useDropNote(tooltip?.dropRate ?? null, true);

	return <>
		<motion.div inert className={`absolute left-0 top-0 dark:bg-zinc-900/75 bg-zinc-150/75 rounded-md p-1 max-w-80 z-50`}
			style={{x: tooltipX, y: tooltipY, opacity: tooltipOpacity}} >
			{tooltip && <SectionLinkPopup course={smallCourse} term={term} section={tooltip.section ?? undefined} noEnrollment >
				<Text className="mb-1" >
					<Text v="bold" className={`${bgColor.sky} rounded-md p-1`} >
					{tooltip.enrollment}</Text> enrolled at{" "}
					{new Date(tooltip.time).toLocaleString(undefined, {
						timeStyle: "short", dateStyle: "short"
					})}
				</Text>

				{stacked && tooltipDropNote}
			</SectionLinkPopup>}
		</motion.div>

		<p className="mb-2" >
			Viewing <Text v="bold" >{stacked ? "by section" : "total enrollment"}</Text>.
			{" "}
			<Anchor onClick={()=>setStacked(!stacked)} >{stacked ? "See total enrollment?" : "Stack by section?"}</Anchor>
		</p>

		{useDropNote(data.dropRate, false)}

		<div className={`md:mt-4 mt-2 mb-4 w-full h-96 mx-auto p-4 pt-0 rounded-xl ${bgColor.secondary}`} >
			<div className="h-full w-full mb-4">
				<Line options={{
					responsive: true,
					maintainAspectRatio: false,
					elements: {
						line: {
							tension: 0.0
						}
					},
					plugins: {
						legend: {
							display: false
						},
						tooltip: {
							enabled: false,
							boxWidth: 100,
							external(ctx) {
								const canvas = ctx.tooltip.chart.canvas;

								tooltipOpacity.set(ctx.tooltip.opacity);
								const x=canvas.offsetLeft + ctx.tooltip.x;
								const y=canvas.offsetTop + ctx.tooltip.y;

								if (!tooltip) {
									tooltipX.jump(x); tooltipY.jump(y);
								} else {
									tooltipX.set(x); tooltipY.set(y);
								}

								if (ctx.tooltip.dataPoints.length==0 || ctx.tooltip.opacity<0.1) {
									setTooltip(null);
									return;
								}

								const pt = ctx.tooltip.dataPoints[0];
								if (pt.parsed.x==null || pt.parsed.y==null) return;

								const newTip = {
									section: "section" in pt.dataset ? pt.dataset.section as Section : null,
									time: pt.parsed.x, enrollment: pt.parsed.y,
									dropRate: "dropRate" in pt.dataset ? pt.dataset.dropRate as number : data.dropRate
								};

								if (newTip.section!=tooltip?.section || newTip.time!=tooltip?.time)
									setTooltip(newTip);
							},
							intersect: false
						},
						title: {
							display: true,
							text: "Enrollment over time",
							color: label
						},
					},
					scales: {
						y: {
							type: "linear",
							stacked,
							min: 0,
							title: {
								display: true,
								text: "Number of students",
								color: label
							},
							grid: { color: grid },
							ticks: { color: grid }
						},
						x: {
							type: "linear",
							grid: { color: grid },
							ticks: {
								color: grid,
								callback(v) {
									return new Date(v).toLocaleDateString();
								}
							}
						}
					}
				}} data={{
					datasets: stacked ? withSections.map((x,i)=>{
						const name = x.section.instructors.find(x=>x.primary)?.name;

						return {
							label: `${scheduleAbbr(x.section.scheduleType)} ${x.section.section}${name ? ` with ${name}` : ""}`,
							section: x.section,
							data: x.counts.map(count=>({x: count.time, y: count.enrollment})),
							dropRate: x.dropRate,
							...commonDatasetProps(selCtx.section==null || selCtx.section==x.section ? i : -1)
						} as const;
					}) : [{
						label: "Total enrollment",
						data: totalCounts.map(v=>({x: v.time, y: v.enrollment})),
						...commonDatasetProps(0, true)
					}]
				}} />
			</div>
		</div>
	</>;
}

export function EnrollmentChart({course, term}: {course: CourseId, term: Term}) {
	const chartData = useAPIResponse<ChartData, {course: number, term: Term}>("/chart", {
		data: {course: course.id, term}
	});

	if (!chartData) return <Loading/>;

	const nonempty = chartData.res.sections.filter(x=>x.counts.length>0 && x.counts.some(y=>y.enrollment>0));
	if (nonempty.length==0) return <Text v="md" className="mb-5 text-center" >No data available</Text>;

	return <EnrollmentChartInner term={term} course={course} data={chartData.res} />;
}