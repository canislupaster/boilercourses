"use client"

import { decodeQueryToSearchState, encodeSearchState, Search, SearchState } from "@/app/search";
import { Calendar } from "@/components/calendar";
import { CourseLink } from "@/components/card";
import { BarsStat, NameSemGPA, searchState, SelectionContext, simp, TermSelect, WrapStat } from "@/components/clientutil";
import Graph from "@/components/graph";
import { MainLayout } from "@/components/mainlayout";
import { Meters } from "@/components/proflink";
import { abbr, Anchor, capitalize, RedditButton, selectProps, Text, textColor } from "@/components/util";
import { AppCtx, setAPI } from "@/components/wrapper";
import { useContext, useEffect, useMemo, useState } from "react";
import { MultiValue, default as Select } from "react-select";
import { CourseId, emptyInstructorGrade, InstructorGrade, InstructorId, latestTermofTerms, mergeGrades, Section, SmallCourse, Term, termIdx, toInstructorGrade, toSmallCourse, trimCourseNum } from "../../../../shared/types";

export function Instructor({instructor}: {instructor: InstructorId}) {
	useEffect(() => {
		setAPI<InstructorId, number>("prof", {data: instructor.id, result: instructor})
		setAPI<InstructorId, string>("profbyname", {data: instructor.instructor.name, result: instructor})
	}, []);

	const i = instructor.instructor;
	const total = mergeGrades(i.grades.map(x=>toInstructorGrade(x.data)));

	const [courseSearch, setCourseSearch] = useState("");
	const [selCourse, setSelCourses] = useState<CourseId[]>([]);

	const statProps = {search:courseSearch, setSearch:setCourseSearch, searchName: "courses"};

	const allSecs: [CourseId,Term,Section][] = useMemo(()=>instructor.courses.flatMap(c=>
		Object.entries(c.course.sections)
			.flatMap(([term, secs]): [CourseId, Term, Section][] =>
				secs.filter(sec=>sec.instructors.find(j=>j.name==i.name)!==undefined).map(sec=>[
					c, term as Term, sec
				])
	)),[]);

	const defaultTerm = latestTermofTerms(allSecs.map(x=>x[1]))!;
	const [initSearch, setInitSearch] = searchState<{term: Term, search: Partial<SearchState>}>({
		term: defaultTerm, search: {instructors: [i.name]}
	}, (x) => {
		return {
			search: {...decodeQueryToSearchState(x), instructors: [i.name]},
			term: x.get("term") as Term ?? defaultTerm
		};
	}, (x) => {
		if (x==null) return;
		const p = encodeSearchState({...x.search, instructors: undefined});
		if (x.term!=defaultTerm) p.append("term", x.term);
		return p;
	});

	const [term, setTerm] = [initSearch.term, (t:Term)=>setInitSearch({...initSearch, term:t})];

	const [section, setSection] = useState<Section|null>(null);
	const idx = termIdx(term);

	const allTerms = useMemo(()=>[...new Set(allSecs.map(x=>x[1]))],[]);
	const termSecs = allSecs.filter(x=>x[1]==term);

	const termCourses = useMemo(() => 
		 instructor.courses.filter(c=>
			(Object.keys(c.course.sections) as Term[]).includes(term)), [term]);

	const courseGrades = useMemo(() => new Map(termCourses.map(c=> {
		const x = c.course.instructor[i.name];
		return [c.id,x==undefined ? emptyInstructorGrade : mergeGrades(Object.values(x))];
	})), [termCourses]);

	const searchCourses = useMemo(() => {
		const simpQ = simp(courseSearch);
		return termCourses.filter(c=>
			(Object.keys(c.course.sections) as Term[]).includes(term)
				&& simp(`${c.course.subject} ${c.course.course}\n${c.course.name}`).includes(simpQ)
		);
	}, [termCourses, courseSearch]);

	const graphGrades: [string,InstructorGrade][] = useMemo(() =>
		selCourse.map((c)=>[`${c.course.subject} ${trimCourseNum(c.course.course)}`, courseGrades.get(c.id)!])
	, [selCourse]);
	
	const semGPA = useMemo(() => 
		searchCourses.map((x): [CourseId, [Term,number|null,number][]]=>{
			const y = x.course.instructor[i.name];
			if (y==undefined) return [x,[]];
			return [
				x,
				Object.entries(y).filter(([term,])=>termIdx(term as Term)<=idx)
						.map(([term,g]) => [term as Term, g.gpa, g.numSections])
			];
		}), [searchCourses, term]);

	const days = [...new Set(termSecs.flatMap(x=>x[2].times.map(y=>y.day)))];
	const smallCalendar = days.length<=3;

	const smallCourses = useMemo(()=>new Map(
		instructor.courses.map(x=>[x.id, toSmallCourse(x)])
	), [])

	const calSecs = useMemo((): [SmallCourse, Section][]=>
		termSecs.map(x=>[smallCourses.get(x[0].id)!,x[2]]), [instructor, term]);

	const cal = calSecs.length>0 && <>
		<TermSelect term={term} setTerm={setTerm} terms={allTerms} label="Schedule for" />
		<Calendar sections={calSecs} term={term} />
	</>;

	const main=<MainLayout title={<>
		{i.name}

		{i.nicknames.length>0 && <Text v="sm" >
			<Text v="dim" >aka</Text> {i.nicknames.join("/")}
		</Text>}

		{i?.title && <Text v="bold" className="mt-0" >{capitalize(i.title)}</Text>}
	</>} left={<div className="flex flex-col gap-2 items-start" >
		{/* Other Links Buttons */}
		<Meters name={i.name} rmp={instructor.rmp ?? null} grade={total} className="w-full" gpaSub="(all sections)" />

		<div className={`mt-1 break-words flex flex-col gap-1 ${textColor.default}`} >
			{i?.dept && <p>
				<b className="font-extrabold" >Department:</b> {capitalize(i.dept)}
			</p>}

			{i?.email && <p>
				<b className="font-extrabold" >Email:</b> <Anchor href={`mailto:${i.email}`} >{i.email}</Anchor>
			</p>}

			{i?.office && <p>
				<b className="font-extrabold" >Office:</b> {i.office}
			</p>}

			{i?.site && <p className="text-lg mb-2" >
				<Anchor href={i.site} className={textColor.blueLink} >{i.site}</Anchor>
			</p>}
		</div>

		<RedditButton keywords={[i.name, ...i.nicknames]} />
	</div>} rightTabs={[{
		title: "GPA", key: "gpa",
		body: <WrapStat title="GPA by course" {...statProps} >
			<BarsStat vs={searchCourses.map(x=>[x, courseGrades.get(x.id)!.gpa])}
				type="gpa"
				lhs={x=> <CourseLink type="course" course={smallCourses.get(x.id)!} /> } />
		</WrapStat>
	}, {
		title: "GPA Breakdown", key: "gpaSemester",
		body: <WrapStat title="GPA by semester" {...statProps} >
			<NameSemGPA vs={semGPA}
				lhs={x=> <div className="text-lg font-bold" >
					<CourseLink type="course" course={smallCourses.get(x.id)!} />
				</div>} />
		</WrapStat>
	}, {
		title: "Grade distribution", key: "grades",
		body: <>
			<Select isMulti options={termCourses} value={selCourse} placeholder="Select courses"
				getOptionLabel={(x: CourseId) => `${x.course.subject}${trimCourseNum(x.course.course)}`}
				getOptionValue={x=>x.id.toString()}
				isOptionDisabled={(x:CourseId)=>courseGrades.get(x.id)!.gpa == null}
				onChange={(x: MultiValue<CourseId>)=>
					setSelCourses(x as CourseId[])
				}
				{...selectProps<CourseId, true>()}
			/>

			<Graph title={`Average grades by course for ${abbr(i.name, 35)}`} grades={graphGrades} />
		</>
	}]} right={<div className="flex flex-col gap-2" >
		{smallCalendar && cal}
	</div>} bottom={<>
		{!smallCalendar && cal}
		
		<div className="flex flex-col mt-2" >
			<Text v="big" className="mb-2" >All Courses</Text>
			<Search init={initSearch.search} setSearchState={(search)=>
					setInitSearch({...initSearch, search})
				}
				includeLogo={false} />
		</div>
	</>} />;

	const app = useContext(AppCtx);
	return <SelectionContext.Provider value={{
		selTerm(term) {
			if (allTerms.includes(term)) setTerm(term);
			else app.open({type: "error", name: "Term not available",
				msg: "We don't have data for this semester"})
		}, section, selSection(section) {setSection(section)}
	}} >
		{main}
	</SelectionContext.Provider>;
}