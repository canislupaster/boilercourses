import { CircularProgress, CircularProgressProps } from "@nextui-org/progress";
import { useContext } from "react";
import { Collapse } from "react-collapse";
import { twMerge } from "tailwind-merge";
import { CourseInstructor, formatTerm, InstructorGrade, InstructorId, mergeGrades, RMPInfo, scheduleAbbr, Section, SmallCourse, Term, termIdx } from "../../shared/types";
import { AppTooltip, SelectionContext, StyleClasses, useMd, useGpaColor } from "./clientutil";
import { SectionLink } from "./sectionlink";
import { Anchor, capitalize, Chip, chipColorKeys, firstLast, Loading, shitHash, Text } from "./util";
import { useAPIResponse, useCourse } from "./wrapper";

export const CircProg = ({cssColor,...props}: CircularProgressProps&{cssColor?: string}) =>
	<StyleClasses f={(r)=> <CircularProgress ref={r}
		classNames={{
			base: "mx-auto",
			svg: "w-24 h-24",
			indicator: `strokeColor`,
			track: `strokeColorTransparent stroke-black dark:stroke-white`,
			value: `text-2xl font-semibold textColor`,
		}}
		strokeWidth={3} size="lg" showValueLabel={true}
		aria-label="Statistic" {...props}
	/>} classStyles={{
		strokeColor: {stroke: cssColor},
		strokeColorTransparent: {stroke: cssColor, strokeOpacity: "10%"},
		textColor: {color: cssColor}
	}} />;

export const Meter = ({v,type}: {v:number|null, type: "gpa"|"rmp"}) => {
	const gpaColor = useGpaColor();

	if (v==null) {
		return <>
			<div className="relative w-full" >
				<div className='absolute right-0 left-0 top-0 bottom-0 flex flex-col items-center justify-center backdrop-blur-sm z-10'>
					<Text v="bold" className="text-center mt-2" >No data</Text>
				</div>

				<CircProg valueLabel="?" value={0} />
			</div>
		</>;
	} else {
		return <CircProg cssColor={gpaColor(type=="gpa" ? v : v-1)}
			valueLabel={v.toFixed(1)} value={v}
			minValue={type=="gpa" ? 0 : 1} maxValue={type=="gpa" ? 4 : 5} />;
	}
};

export function Meters({children, name, rmp, grade, className, gpaSub}: {name: string, children?: React.ReactNode, rmp: RMPInfo|null, grade: InstructorGrade|null, className?: string, gpaSub: string}) {
	const rmpUrl = rmp?.rmpUrl ?? `https://www.ratemyprofessors.com/search/professors/783?q=${firstLast(name)}`;
	const nrating = rmp?.numRatings;

	return <div className={twMerge("flex flex-row gap-2 items-stretch justify-center", className)} >
		<div className="relative flex flex-col w-full flex-1 p-4 rounded-xl gap-2 hover:scale-[1.05] transition-all items-center justify-evenly" >
			<Meter v={nrating==0 ? null : (rmp?.avgRating ?? null)} type="rmp" />
			<div className="flex flex-col items-center" >
				<Anchor target="_blank" className="text-center" href={rmpUrl} >
					<Text v="bold" >
						RateMyProfessor
					</Text>
				</Anchor>
				{rmp && <Text v="dim" >
					{nrating} rating{nrating!=1&&"s"}
				</Text>}
			</div>
		</div>

		<div className="relative flex flex-col w-full flex-1 p-4 rounded-xl gap-2 hover:scale-[1.05] transition-all items-center justify-evenly" >
			<Meter v={grade?.gpa ?? null} type="gpa" />
			<div className="flex flex-col items-center" >
				<Text v="bold" >
					Average GPA<br/>{gpaSub}
				</Text>
				{grade?.numSections!=null && grade?.numSections>0 && <Text v="dim" >
					{grade.numSections} section{grade.numSections!=1&&"s"}
				</Text>}
			</div>
		</div>

		{children}
	</div>;
}

function ProfSectionList({secs, course, term}: {secs: Section[], course: SmallCourse, term: Term}) {
	const byType = new Map<string, Section[]>();
	for (const v of secs) byType.set(v.scheduleType, [...(byType.get(v.scheduleType) ?? []), v]);

	return <>{
		[...byType.entries()].map(([ty,x]) =>
			<Chip color={chipColorKeys[shitHash(ty)%chipColorKeys.length]} key={ty} className={`inline-flex flex-row items-center flex-wrap ${x.length>4 ? "rounded-sm p-2" : ""}`} >
				{scheduleAbbr(ty)}

				{x.map((s,i)=>
					<SectionLink course={course} term={term} section={s} className="ml-1 inline-flex flex-row items-center flex-wrap" key={s.crn} >
						<Anchor>{s.section}</Anchor>{i<x.length-1 && ", "}
					</SectionLink>
				)}
			</Chip>
		)
	}</>;
}

function ProfData({x, course, term}: {x: CourseInstructor, course: SmallCourse, term: Term}) {
	const data = useAPIResponse<InstructorId, string>("profbyname", {data: x.name, handleErr(e) {
		if (e.error=="notFound") return null;
	}})?.res ?? null;

	const selCtx = useContext(SelectionContext);

	const full = useCourse(course.id)?.course;
	if (full==null) return <Loading/>;

	const ts = Object.entries(full.sections).filter(([,v]) => v.some(
		s=>s.instructors.find(v=>v.name==x.name)
	)).map(([k,]) => k as Term).sort((a,b) => termIdx(b)-termIdx(a));

	const secs = full.sections[term].filter(v => v.instructors.find(y=>y.name==x.name));

	const g = full.instructor[x.name]!=undefined
		? mergeGrades(Object.values(full.instructor[x.name])) : null;

	const i = data?.instructor;

	return <div className="pt-3 flex flex-col items-center" >
		{data==null ?
			<p className="text-2xl font-display font-extrabold text-center" >
				{x.name}
			</p>
			: <Anchor href={`/prof/${data.id}`} className="text-2xl font-display font-extrabold text-center" >
				{x.name}
			</Anchor>}
		{x.primary && <Text v="smbold" >Primary instructor</Text>}

		<span className="my-2" ></span>

		<Collapse isOpened>
			<div className="flex flex-col w-full item-center text-center" >
				{i?.title && <p className="font-bold" >{capitalize(i.title)}</p>}
				
				{i?.dept && <p className="text-xs mb-2" >
					<b className="font-extrabold" >Department:</b> {capitalize(i.dept)}
				</p>}

				<Meters name={x.name} rmp={data?.rmp ?? null} grade={g} gpaSub="(this course)" />
			</div>
		</Collapse>

		<Text v="sm" >
			Taught <Text v="smbold" >{ts.length} section{ts.length>1 ? "s" : ""} {ts.length==1 ? ` in ${formatTerm(ts[0])}` : ` (${formatTerm(ts[ts.length-1])} - ${formatTerm(ts[0])})`}</Text>
		</Text>

		<div className="w-full flex-row flex items-center p-3 gap-1 flex-wrap" >
			<div className="inline-flex flex-row flex-wrap items-center gap-1" >
				<b>Sections:</b> <ProfSectionList secs={secs} course={course} term={term} />
			</div>

			<div className="inline-flex flex-row flex-wrap items-center gap-1">
				<b>Terms:</b>
				<div className="inline-flex flex-row flex-wrap items-center gap-1" >
					{ts.map(t => <Chip color="blue" className="cursor-pointer" key={t}
						onClick={()=>selCtx.selTerm(t)} >{formatTerm(t)}</Chip>)}
				</div>
			</div>
		</div>
	</div>;
}

export function ProfLink({x, label, className, course, term, labelTerm}: {
	x: CourseInstructor, label?: string, className?: string,
	course: SmallCourse, term: Term, labelTerm?: boolean
}) {
	return <AppTooltip placement={useMd() ? "left" : "bottom"} content={
		<ProfData x={x} course={course} term={term} />
	} >
		<div className={twMerge("inline-block", className)} >
			<Anchor className={className} >{label ?? x.name}</Anchor>
			{labelTerm && <Text v="dim" className="ml-1" >({formatTerm(term)})</Text>}
		</div>
	</AppTooltip>;
}