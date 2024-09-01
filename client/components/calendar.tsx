import { useContext, useMemo, useState } from "react";
import { SelectionContext, ShowMore, simp, useDebounce } from "./clientutil";
import { Course, CourseId, CourseInstructor, Day, Section, ServerInfo, SmallCourse, Term, validDays } from "../../shared/types";
import { SectionLink } from "./sectionlink";
import { abbr, Input } from "./util";
import React from "react";
import { IconFilter } from "@tabler/icons-react";

function minutesInDay(t: string) {
	const re = /(\d+):(\d+) (am|pm)/;
	const m = t.match(re);
	if (m==null) throw "invalid time";

	return 60*(Number.parseInt(m[1])%12)+Number.parseInt(m[2])+(m[3]=="pm" ? 12*60 : 0);
}

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

	const filterSecs = useDebounce(() => {
		const v = simp(search);
		return secs.filter(([_,x]) => simp(`
			${x.crn}
			${x.section}
			${x.scheduleType}
			${x.name ?? ""}
			${x.instructors.map(v=>v.name).join("\n")}
			${x.times.map(v=>`${v.day} ${v.time}`).join("\n")}
		`).includes(v));
	}, 100, [secs, search]);

	const sortedDays = [...new Set(filterSecs
		.flatMap(sec=>sec[1].times.map(v=>v.day)))]
		.map(x=>validDays.indexOf(x))
		.sort().map(x=>validDays[x]);
 
	return <div className="flex flex-col items-stretch gap-4 rounded-xl bg-zinc-900 border-zinc-600 border p-2 md:p-4" >
		<Input value={search} onChange={ev=>setSearch(ev.target.value)}
			placeholder="Filter sections..." icon={<IconFilter/>} />
		{sortedDays.length==0 ?
			<h2 className="font-display font-bold text-xl mx-auto" key="none" >
				{search ? "No matches" : "Empty course schedule"}
			</h2>
		: <ShowMore forceShowMore={search!=""} ><div className='flex flex-col md:flex-row flex-nowrap gap-2' >
			{sortedDays.map(d => {
				const inD = filterSecs
					.flatMap(x=>x[1].times.filter(y=>y.day==d && y.time!="TBA")
					.map((t):[number, string, string, SmallCourse, Section]=> {
						const r = t.time.split(" - ");
						if (r.length!=2) throw "invalid time range";
						return [minutesInDay(r[0]), r[0], r[1], ...x];
					})).sort((a,b) => a[0]-b[0]);

				return <div key={d} className='last:border-r-0 md:border-r-2 border-gray-500 flex-1 pr-2'>
						<p className='text-right text-gray-500' >{d}</p>
						<div>
							{ inD.map(([_,start,end,c,sec], i) => {
								const hi = sec.crn==selCtx.section?.crn;

								let name = sec.instructors.find(x=>x.primary)?.name;
								const content = [sec.section, start];

								if (name!=undefined) {
									name = abbr(name, 20);
									content.push(sec.scheduleType.slice(0,3));
								}

								return <SectionLink key={i} term={term} section={sec} course={c}
									className={`w-full ${hi ? "bg-amber-600" : "bg-zinc-700 hover:bg-zinc-600"} py-1 px-2 rounded-md transition-all mt-1 first:mt-0 cursor-pointer`} >

									<p className="font-bold font-display" >{name ?? sec.scheduleType}</p>
									{sec.name && <p className="font-bold font-display text-sm" >{sec.name}</p>}
									<div className={`text-xs flex flex-row items-stretch gap-1 ${hi ? "text-white" : "text-gray-400"}`} >
										{content.map((x,i) => <React.Fragment key={i} >
											<span>{x}</span>
											{i<content.length-1 && <div className={`mx-1 w-px my-0.5 ${hi ? "bg-white" : "bg-gray-400"}`} ></div>}
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