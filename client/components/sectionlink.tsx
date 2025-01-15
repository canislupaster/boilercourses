import React, { useContext } from "react";
import { Day, Section, SmallCourse, Term, validDays } from "../../shared/types";
import { SectionNotifications } from "./availability";
import { CourseLink } from "./card";
import { AppTooltip, IsInTooltipContext, SelectionContext, useMd } from "./clientutil";
import { InstructorList } from "./instructorlist";
import { CatalogLinkButton, Text } from "./util";
import { useInfo } from "./wrapper";

export type SectionLinkProps = {
	term: Term, course: SmallCourse, children: React.ReactNode, section: Section, className?: string
};

function SectionLinkPopup({course, section, term}: {course: SmallCourse, section: Section, term: Term}) {
	const byTimes = new Map<string,Day[]>();

	for (const x of section.times)
		byTimes.set(x.time, [...(byTimes.get(x.time) ?? []), x.day]);

	const isInTooltip = useContext(IsInTooltipContext);

	return <div className={`flex flex-col p-2 items-start ${isInTooltip ? "max-w-60" : ""}`} >
		<Text v="bold"  >
			<CourseLink type="course" course={course} />
		</Text>
		{section.name && <Text v="lg" >
			{section.name}
		</Text>} 
		<Text v={section.name==undefined ? "lg" : "bold"} >
			Section {section.section}
		</Text>
		<Text v="sm" className="text-sm mb-3" >CRN {section.crn}</Text>

		{[...byTimes.entries()].map(([k,v]) =>
			<p key={k} >
				<b>{v.map(x=>validDays.indexOf(x)).sort().map(i=>validDays[i]).join("")}</b>, {k}
			</p>
		)}

		<div className="flex flex-col gap-1 mt-3 items-start" >
			<InstructorList whomst={section.instructors} course={course} term={term} />
			<p>{section.dateRange.map(x => new Date(x).toLocaleDateString()).join(" to ")}</p>

			{section.room && <p>
				<Text v="smbold" className="mr-2" >Location{section.room.length>1 ? "s" : ""}:</Text>
				{section.room.join(", ")}
			</p>}

			{section.seats && <p>
				<Text v="smbold" className="mr-2" >Enrollment:</Text>
				{section.seats.used}/{section.seats.left+section.seats.used}
			</p>}

			<SectionNotifications section={section} small={course} term={term} />

			<CatalogLinkButton href={`https://selfservice.mypurdue.purdue.edu/prod/bwckschd.p_disp_detail_sched?term_in=${useInfo().terms[term]!.id}&crn_in=${section.crn}`} />
		</div>
	</div>;
}

export function SectionLink({children, section, className, ...rest}: SectionLinkProps) {
	const selCtx=useContext(SelectionContext);
	const mq = useMd();

	return <AppTooltip placement={mq ? "right" : "top"}
		onChange={x => {
			if (x) selCtx.selSection(section);
			else selCtx.deselectSection(section);
		}}
		content={
			<SectionLinkPopup {...rest} section={section} />
		} className={className} >
			{children}
		</AppTooltip>;
}