import { IconFilter } from "@tabler/icons-react";
import React, { useCallback, useContext, useState } from "react";
import { twMerge } from "tailwind-merge";
import { Course, minutesInDay, scheduleAbbr, Section, SmallCourse, Term, validDays } from "../../shared/types";
import { SelectionContext, ShowMore, simp, useDebounce } from "./clientutil";
import { SectionLink } from "./sectionlink";
import { abbr, bgColor, borderColor, containerDefault, Divider, Input, Text, textColor } from "./util";

export function calendarDays(course: Course, term: Term) {
	const secs = course.sections[term];
	const days = [...new Set(secs.flatMap(x => x.times).map(x=>x.day))];
	return days;
}

export function Calendar({sections: secs, term}: {
	sections: [SmallCourse, Section][], term: Term
}) {
	const selCtx = useContext(SelectionContext);

	const [search, setSearch] = useState("");

	const filterSecs = useDebounce(useCallback(() => {
		const v = simp(search);
		return secs.filter(([,x]) => simp(`
			${x.crn}
			${x.section}
			${x.scheduleType}
			${x.name ?? ""}
			${x.instructors.map(v=>v.name).join("\n")}
			${x.times.map(v=>`${v.day} ${v.time}`).join("\n")}
		`).includes(v));
	}, [secs, search]), 100);

	const sortedDays = [...new Set(filterSecs
		.flatMap(sec=>sec[1].times.map(v=>v.day)))]
		.map(x=>validDays.indexOf(x))
		.sort().map(x=>validDays[x]);
 
	return <div className={twMerge("flex flex-col items-stretch gap-4 rounded-xl p-2 md:p-4", containerDefault, bgColor.secondary)} >
		<Input value={search} onChange={ev=>setSearch(ev.target.value)}
			placeholder="Filter sections..." icon={<IconFilter/>} />
		{sortedDays.length==0 ?
			<Text v="bold" className="mx-auto" key="none" >
				{search ? "No matches" : "Empty course schedule"}
			</Text>
		: <ShowMore forceShowMore={search!=""} inContainer="secondary" ><div className='flex flex-col md:flex-row flex-nowrap gap-2' >
			{sortedDays.map(d => {
				const inD = filterSecs
					.flatMap(x=>x[1].times.filter(y=>y.day==d && y.time!="TBA")
					.map((t):[number, string, string, SmallCourse, Section]=> {
						const r = t.time.split(" - ");
						if (r.length!=2) throw new Error("invalid time range");
						return [minutesInDay(r[0]), r[0], r[1], ...x];
					})).sort((a,b) => a[0]-b[0]);

				return <div key={d} className={`last:border-r-0 md:border-r-2 ${borderColor.default} flex-1 pr-2`} >
						<Text v="dim" className='text-right' >{d}</Text>
						<div>
							{ inD.map(([,start,,c,sec], i) => {
								const hi = sec.crn==selCtx.section?.crn;

								let name = sec.instructors.find(x=>x.primary)?.name;
								const content = [sec.section, start];

								if (name!=undefined) {
									name = abbr(name, 20);
									content.push(scheduleAbbr(sec.scheduleType));
								}

								return <SectionLink key={i} term={term} section={sec} course={c}
									className={`w-full ${hi ? bgColor.highlight : bgColor.default} py-1 px-2 rounded-md transition-all mt-1 first:mt-0 cursor-pointer`} >

									<p className="font-bold font-display" >{name ?? sec.scheduleType}</p>
									{sec.name && <p className="font-bold font-display text-sm" >{sec.name}</p>}
									<div className={`text-xs flex flex-row items-center gap-1 ${hi ? textColor.contrast : textColor.gray}`} >
										{content.map((x,i) => <React.Fragment key={i} >
											<span>{x}</span>
											{i<content.length-1 && <Divider className={`mx-0.5 h-3 ${hi ? bgColor.contrast : bgColor.divider}`} />}
										</React.Fragment>)}
									</div>
								</SectionLink>
							}) }
						</div>
				</div>;
			})}
		</div></ShowMore>}
	</div>;
}