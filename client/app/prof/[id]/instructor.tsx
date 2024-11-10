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
import { CourseId, emptyInstructorGrade, formatTerm, InstructorGrade, InstructorId, latestTermofTerms, mergeGrades, Section, SmallCourse, Term, termIdx, toInstructorGrade, toSmallCourse, trimCourseNum } from "../../../../shared/types";

export function Instructor({instructor}: {instructor: InstructorId}) {
	useEffect(() => {
		setAPI<InstructorId, number>("prof", {data: instructor.id, result: instructor})
		setAPI<InstructorId, string>("profbyname", {data: instructor.instructor.name, result: instructor})
	}, []);

	const i = instructor.instructor;
	const total = useMemo(()=>mergeGrades(i.grades.map(x=>toInstructorGrade(x.data))),[]);

	type SelCourse = CourseId|{id: "avg"};
	const [courseSearch, setCourseSearch] = useState("");
	const [selCourse, setSelCourses] = useState<SelCourse[]>([{id: "avg"}]);

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

	const allCourses = useMemo(() => 
		 instructor.courses.map((c): [CourseId, Term]=>{
			const ts = Object.keys(c.course.sections) as Term[];
			return [c, ts.includes(term) ? term : latestTermofTerms(ts)!];
		}), [term]);

	const courseGrades = useMemo(() => new Map(allCourses.map(([c])=> {
		const x = c.course.instructor[i.name];
		return [c.id,x==undefined ? emptyInstructorGrade : mergeGrades(Object.values(x))];
	})), [allCourses]);

	const searchCourses = useMemo(() => {
		const simpQ = simp(courseSearch);
		return allCourses.filter(([c])=>
			simp(`${c.course.subject} ${c.course.course}\n${c.course.name}`).includes(simpQ)
		);
	}, [allCourses, courseSearch]);

	const graphGrades: [string,InstructorGrade][] = useMemo(() =>
		selCourse.map((c)=>[
			c.id=="avg" ? "Average" : `${c.course.subject} ${trimCourseNum(c.course.course)}`,
			c.id=="avg" ? total : courseGrades.get(c.id)!
		]), [selCourse]);
	
	const semGPA = useMemo(() => 
		searchCourses.map(([x, inTerm]): [[CourseId, Term], [Term,number|null,number][],boolean]=>{
			const y = x.course.instructor[i.name];
			if (y==undefined) return [[x, inTerm], [], inTerm==term];
			return [
				[x, inTerm],
				Object.entries(y).filter(([term,])=>termIdx(term as Term)<=idx)
						.map(([term,g]) => [term as Term, g.gpa, g.numSections]),
				inTerm==term
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

	const renderLHS = (big: boolean) => (x: [CourseId, Term], b: boolean) =>
		<CourseLink type="course" course={smallCourses.get(x[0].id)!} className="flex-nowrap whitespace-nowrap" >
			<span className={`font-display font-extrabold ${big ? "text-lg" : "text-md"}`} >{x[0].course.subject} {trimCourseNum(x[0].course.course)}</span>
			{!b && <Text v="dim" >({formatTerm(x[1])})</Text>}
		</CourseLink>;

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
				<Anchor href={i.site} className={textColor.blueLink} target="_blank" >{i.site}</Anchor>
			</p>}
		</div>

		<RedditButton keywords={[i.name, ...i.nicknames]} />
	</div>} rightTabs={[{
		title: "GPA", key: "gpa",
		body: <WrapStat title="GPA by course" {...statProps} >
			<BarsStat vs={searchCourses.map(x=>[x, courseGrades.get(x[0].id)!.gpa, x[1]==term])}
				type="gpa" lhs={renderLHS(false)} />
		</WrapStat>
	}, {
		title: "GPA Breakdown", key: "gpaSemester",
		body: <WrapStat title="GPA by semester" {...statProps} >
			<NameSemGPA vs={semGPA} lhs={renderLHS(true)} />
		</WrapStat>
	}, {
		title: "Grade distribution", key: "grades",
		body: <>
			<Select isMulti options={[{id: "avg"}, ...allCourses.map(x=>x[0])]}
				value={selCourse} placeholder="Select courses"
				getOptionLabel={(x: SelCourse) =>
					x.id=="avg" ? "Average" : `${x.course.subject}${trimCourseNum(x.course.course)}`}
				getOptionValue={x=>x.id.toString()}
				isOptionDisabled={(x:SelCourse)=>
					total.gpa==null || (x.id!="avg" && courseGrades.get(x.id)?.gpa==undefined)}
				onChange={(x: MultiValue<SelCourse>)=>setSelCourses(x as CourseId[])}
				{...selectProps<SelCourse, true>()}
			/>

			<Graph title={`Average grades by course for ${abbr(i.name, 35)}`} grades={graphGrades} />
		</>
	}]} right={<div className="flex flex-col gap-2" >
		{smallCalendar && cal}
	</div>} bottom={<>
		{!smallCalendar && cal}
		
		<div className="flex flex-col mt-2" >
			<Text v="big" className="mb-2" >Courses taught</Text>
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