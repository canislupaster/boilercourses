"use client"

import { CourseNotificationButton } from "@/components/availability";
import { Calendar, calendarDays } from "@/components/calendar";
import { CourseChips, GPAIndicator } from "@/components/card";
import { Alert, BarsStat, NameSemGPA, searchState, SelectionContext, ShowMore, simp, TermSelect, useDebounce, useMd, WrapStat } from "@/components/clientutil";
import { Community } from "@/components/community";
import Graph from "@/components/graph";
import { InstructorList } from "@/components/instructorlist";
import { MainLayout } from "@/components/mainlayout";
import { Prereqs } from "@/components/prereqs";
import { ProfLink } from "@/components/proflink";
import { Restrictions } from "@/components/restrictions";
import { SimilarCourses } from "@/components/similar";
import { abbr, Anchor, bgColor, Button, CatalogLinkButton, containerDefault, Divider, firstLast, LinkButton, Loading, RedditButton, selectProps, Text } from "@/components/util";
import { AppCtx, setAPI, useAPI, useInfo } from "@/components/wrapper";
import { IconPaperclip, IconWorld } from "@tabler/icons-react";
import Image from "next/image";
import React, { useContext, useEffect, useMemo, useState } from "react";
import Select, { MultiValue } from "react-select";
import { Attachment, CourseId, CourseInstructor, creditStr, emptyInstructorGrade, formatTerm, InstructorGrade, InstructorGrades, latestTerm, mergeGrades, RMPInfo, Section, SmallCourse, Term, termIdx, toSmallCourse, trimCourseNum } from "../../../../shared/types";
import boilerexams from "../../../public/boilerexams-icon.png";
import boilerexamsCourses from "../../boilerexamsCourses.json";

const useSmall = (cid: CourseId) => useMemo(()=>toSmallCourse(cid),[cid.id]);

function InstructorGradeView({xs,type,cid,term}: {xs: CourseInstructor[], cid: CourseId, term: Term, type:"rmp"|"gpa"}) {
	let res: (RMPInfo|null)[]|null=null;
	const small = useSmall(cid);
	const isMd = useMd();
	if (type=="rmp") {
		const o=useAPI<(RMPInfo|null)[],string[]>("rmp", {data: xs.map(x=>x.name)});
		if (o==null) return <Loading/>

		res=o.res;
	}

	const out: [CourseInstructor, number|null][] = xs.map((i,j) => {
		if (type=="gpa" && cid.course.instructor[i.name]!=undefined) {
			const g = mergeGrades(Object.values(cid.course.instructor[i.name]));
			if (g.gpa!=null) return [i,g.gpa];
		} else if (type=="rmp" && res!=null && res[j]!=null && res[j].numRatings>0) {
			return [i,res[j].avgRating];
		}

		return [i,null]
	});

	return <BarsStat lhs={i=>
			<ProfLink x={i} className="font-semibold text-nowrap"
				course={small} term={term}
				label={abbr(i.name, isMd ? 35 : 20)} />
			} className="grid-cols-[4fr_10fr_1fr] "
			vs={out} type={type} />
}

function InstructorSemGPA({xs, term, cid}: {xs: CourseInstructor[], term: Term, cid: CourseId}) {
	const idx = termIdx(term);

	const vs = xs.map((x): [CourseInstructor, InstructorGrades] => [
			x, cid.course.instructor[x.name] ?? {}
		]).map(([i,x]): [CourseInstructor, [Term, number|null, number][]] => [
			i, Object.entries(x).filter(([sem,]) => termIdx(sem as Term)<=idx)
				.map(([sem,v])=>[sem as Term, v?.gpa ?? null, v?.numSections ?? 0]),
		]);
	
	const small = useSmall(cid);
	return <NameSemGPA vs={vs} lhs={i=>
		<ProfLink className='font-bold text-lg' x={i} course={small} term={term} />
	} />;
}

const averageInstructor = {type: "avg"} as const;

function CourseDetail(cid: CourseId) {
	const latest = latestTerm(cid.course)!;
	const [term, setTerm] = searchState<Term>(latest, (p) => p.get("term") as Term|null,
		(x)=> x==latest ? null : new URLSearchParams([["term",x]]))

	const course = cid.course;

	const [instructorSearch, setInstructorSearch] = useState("");

	const small = useSmall(cid);
	const instructors = useMemo(()=>small.termInstructors[term] ?? [], [term]);

	const searchInstructors = useDebounce(() => {
		const v = simp(instructorSearch);
		return instructors.filter(x => simp(x.name).includes(v));
	}, 100, [term, instructorSearch]);

	const [section, setSection] = useState<Section|null>(null);
	const app = useContext(AppCtx);

	const smallCalendar = useMemo(()=>calendarDays(course, term).length<=3, [course,term]);
	//memo so object reference is stable, otherwise calendar might rerender too often!
	const calSections = useMemo(()=>course.sections[term].map((x):[SmallCourse, Section]=>[small,x]), [course,term]);
	const attachmentsTerm = (Object.entries(course?.attachments ?? {}) as [Term, Attachment[]][])
		.sort(([a],[b]) => termIdx(b)-termIdx(a));

	const catalog=`https://selfservice.mypurdue.purdue.edu/prod/bwckctlg.p_disp_course_detail?cat_term_in=${useInfo().terms[term]!.id}&subj_code_in=${course.subject}&crse_numb_in=${course.course}`;

	const statProps = {search:instructorSearch, setSearch:setInstructorSearch, searchName: "instructors"};

	const gradesForTerm = useMemo(()=>
		mergeGrades(Object.values(course.instructor).map(x=>x[term] ?? emptyInstructorGrade)), [term]);

	const hasGrades = instructors.some(x=>course.instructor[x.name]!==undefined);
	type GradeInstructorOption = ({type:"instructor"}&CourseInstructor)|typeof averageInstructor;
	const [selectedInstructors, setSelInstructors] = useState<GradeInstructorOption[]>(
		hasGrades ? [averageInstructor] : []
	);

	const graphGrades: [string,InstructorGrade][] = useMemo(() =>
		selectedInstructors.map(x =>
			x.type=="avg" ? ["Average",
				mergeGrades(Object.values(course.instructor).flatMap(x=>Object.values(x)))]
			: [x.name,course.instructor[x.name]==undefined ? emptyInstructorGrade
				: mergeGrades(Object.values(course.instructor[x.name]))]
		), [selectedInstructors, term, course]);

	const gradeInstructors: GradeInstructorOption[] = useMemo(()=>
		[averageInstructor, ...instructors.map((x): GradeInstructorOption=>
			({type: "instructor", ...x}))], [instructors]);

	return <SelectionContext.Provider value={{
		selTerm(term) {
			if (term in course.sections) setTerm(term);
			else app.open({type: "error", name: "Term not available",
				msg: "We don't have data for this semester"})
		}, selSection:setSection, section
	}} >
		<MainLayout left={<>
			<div className="flex flex-col gap-4 -mt-3 mb-1">
				<div className="flex flex-row flex-wrap mb-1 items-center">
					{/* Credits Display */}
					<Text v="sm" >{creditStr(course)}</Text>

					{/* Separator Display */}
					<Divider/>
					<CourseChips course={small} />
				</div>
				
				<TermSelect term={term} setTerm={setTerm} terms={Object.keys(course.sections) as Term[]} label="Data from" />

				{term!=latest && <Alert txt={`Most course data, except for sections and instructors, is from ${formatTerm(latest)}. Fall back to the catalog for exact data from an older term.`} title="Note" />}

				<InstructorList course={small} term={term} whomst={instructors} />
			</div>

			{/* Other Links Buttons */}
			<div className="flex flex-row flex-wrap my-2 gap-1 items-center">
				{gradesForTerm.gpa!=null ?
					<GPAIndicator grades={gradesForTerm} tip={`Averaged over ${gradesForTerm.gpaSections} section${gradesForTerm.gpaSections==1?"":"s"} from ${formatTerm(term)}`} />
					: <GPAIndicator grades={small.grades} />
				}

				<RedditButton keywords={[
						`${course.subject}${trimCourseNum(course.course)}`,
						...instructors.map(x => `"${firstLast(x.name)}"`)
					]} />

				<CatalogLinkButton href={catalog} />

				{boilerexamsCourses.includes(`${course.subject}${course.course}`) &&
					<LinkButton href={`https://www.boilerexams.com/courses/${course.subject}${course.course}/topics`}
						className="theme:bg-yellow-600 theme:hover:bg-yellow-700 transition-all duration-300 ease-out"
						icon={<Image src={boilerexams} alt="Boilerexams" className="filter w-auto h-full invert dark:invert-0" />} >

						Boilerexams
					</LinkButton>
				}
			</div>


			{/* Description */}
			<Text v="sm" className="mt-1 mb-3" >{course.description}</Text>
			<Text v="dim" className="mt-1 mb-3" >Course {course.subject} {course.course} from Purdue University - West Lafayette.</Text>

			{/* Prerequisites */}
			{course.prereqs=="failed" ? <Text v="err" >Failed to parse prerequisites. Please use the <Anchor href={catalog} >catalog</Anchor>.</Text>
				: (course.prereqs!="none" && <>
						<Text v="md" className="mb-4" >Prerequisites</Text>
						<ShowMore className="mb-4" >
							<Prereqs prereqs={course.prereqs} />
						</ShowMore>
					</>)}

			<Restrictions restrictions={course.restrictions} />

			{attachmentsTerm.length>0 && <>
				<Text v="md" >Attachments</Text>
				<div className={`border p-2 flex flex-col gap-2 ${containerDefault} overflow-y-auto max-h-[8rem] md:max-h-[15rem]`} >
					{attachmentsTerm.map(([t, attachments]) => <React.Fragment key={t} >
						<Text v="bold" >{formatTerm(t)}</Text>
						<div className="flex flex-row gap-2 flex-wrap" >
							{attachments.map((attach,i) => {
								const inner = <div className="flex flex-col gap-1 items-start justify-stretch" >
									<Text v="smbold" >{abbr(attach.name, 35)}</Text>
									<div className="flex flex-row flex-wrap" >
										<Text v="dim" >{abbr(attach.author, 20)}</Text>
										<Divider/>
										<Text v="dim" >updated {new Date(attach.updated).toLocaleDateString()}</Text> 
									</div>
								</div>;

								const icon = attach.type=="web" ? <IconWorld/> : <IconPaperclip/>;
								const cls = bgColor.secondary;

								if (attach.href)
									return <LinkButton key={i} className={cls} icon={icon} href={attach.href} >{inner}</LinkButton>
								else return <Button className={cls} icon={icon} key={i} onClick={()=>{
									app.open({type: "other", name: "Secured resource", modal: <>
										<p>To access this resource, login and then look up the course in Purdue's Course Insights.</p>
									</>, actions: [
										{name: "Continue to Course Insights", status: "primary", act(ctx) {
											window.open("https://sswis.mypurdue.purdue.edu/CourseInsights/", "_blank");
											ctx.closeModal();
										}}
									]})
								}} >
									{inner}
								</Button>
							})}
						</div>
					</React.Fragment>)}
				</div>
			</>}
		</>} right={<>
			{smallCalendar && calSections.length>0 && <Calendar sections={calSections} term={term} />}
		</>} rightTabs={[
			{
				key: "GPA", title: "GPA",
				body: <WrapStat title="GPA by professor" {...statProps} >
					<InstructorGradeView xs={searchInstructors} type="gpa" cid={cid} term={term} />
				</WrapStat>
			},
			{
				key: "gpaSemester", title: "GPA Breakdown",
				body: <WrapStat title="GPA by semester" {...statProps} >
					<InstructorSemGPA xs={searchInstructors} cid={cid} term={term} />
				</WrapStat>
			},
			{
				key: "rmp", title: "Rating",
				body: <WrapStat title="RateMyProfessor ratings" {...statProps} >
					<InstructorGradeView xs={searchInstructors} type="rmp" cid={cid} term={term} />
				</WrapStat>
			},
			{
				key: "grades", title: "Grade distribution",
				body: <>
					<Select isMulti options={gradeInstructors}
						placeholder="Select instructors"
						value={selectedInstructors}
						getOptionLabel={x => x.type=="avg" ? "Average" : x.name}
						getOptionValue={x=>x.type=="avg" ? "" : x.name}
						onChange={(x: MultiValue<GradeInstructorOption>)=>
							setSelInstructors(x as GradeInstructorOption[])}
						isOptionDisabled={(x: GradeInstructorOption) =>
							(x.type=="avg" && !hasGrades) || (x.type!="avg" && course.instructor[x.name]==undefined)}
						{...selectProps<GradeInstructorOption,true>()}
					/>

					<Graph title="Average grades by instructor" grades={graphGrades} />
				</>
			}
		]} bottom={<>
			{!smallCalendar && calSections.length>0 && <Calendar sections={calSections} term={term} />}

			<Community course={small} />
			<SimilarCourses id={cid.id} />
		</>} title={<>
			{course.subject} {trimCourseNum(course.course)}: {course.name}
		</>} extraButtons={
			<CourseNotificationButton course={cid} />
		} />
	</SelectionContext.Provider>;
}

export function CourseDetailApp(props: CourseId) {
	useEffect(()=>{
		setAPI<CourseId, number>("course", {data: props.id, result: props})
	});

	return <CourseDetail {...props} />;
}