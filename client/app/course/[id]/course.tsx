"use client"

import { CourseNotificationButton } from "@/components/availability";
import { Calendar, calendarDays } from "@/components/calendar";
import { CourseChips, GPAIndicator } from "@/components/card";
import { Alert, BarsStat, NameSemGPA, useSearchState, SelectionContext, ShowMore, simp, TermSelect, useDebounce, useMd, WrapStat, SelectId } from "@/components/clientutil";
import { Community } from "@/components/community";
import { InstructorList } from "@/components/instructorlist";
import { MainLayout } from "@/components/mainlayout";
import { Prereqs } from "@/components/prereqs";
import { ProfLink } from "@/components/proflink";
import { Restrictions } from "@/components/restrictions";
import { SimilarCourses } from "@/components/similar";
import { Anchor, bgColor, Button, CatalogLinkButton, containerDefault, Divider, firstLast, LinkButton, Loading, RedditButton, selectProps, Text } from "@/components/util";
import { AppCtx, setAPI, useAPIResponse, useInfo } from "@/components/wrapper";
import { IconPaperclip, IconWorld } from "@tabler/icons-react";
import Image from "next/image";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MultiValue } from "react-select";
import { allCourseInstructors, Attachment, CourseId, CourseInstructor, creditStr, emptyInstructorGrade, formatTerm, InstructorGrade, latestTerm, mergeGrades, PreReqs, RMPInfo, Section, sectionsByTerm, SmallCourse, Term, termIdx, toSmallCourse, trimCourseNum, abbr } from "../../../../shared/types";
import boilerexams from "../../../public/boilerexams-icon.png";
import boilerexamsCourses from "../../boilerexamsCourses.json";
import { EnrollmentChart, Graph } from "@/components/graph";

const useSmall = (cid: CourseId) => useMemo(()=>toSmallCourse(cid), [cid]);

const instructorGradeViewComponent = (type: "rmp"|"gpa") =>
	function InstructorGradeView({xs,cid,term}: {
		xs: [CourseInstructor, Term][], cid: CourseId, term: Term
	}) {
		let res: (RMPInfo|null)[]|null=null;
		const small = useSmall(cid);
		const isMd = useMd();

		if (type=="rmp") {
			// eslint-disable-next-line react-hooks/rules-of-hooks
			const o=useAPIResponse<(RMPInfo|null)[],string[]>("rmp", {data: xs.map(x=>x[0].name)});
			if (o==null) return <Loading/>

			res=o.res;
		}

		const out: [[CourseInstructor, Term], number|null, boolean][] = xs.map(([i,inTerm],j) => {
			if (type=="gpa" && cid.course.instructor[i.name]!=undefined) {
				const g = mergeGrades(Object.values(cid.course.instructor[i.name]));
				if (g.gpa!=null) return [[i,inTerm],g.gpa,inTerm==term];
			} else if (type=="rmp" && res!=null && res[j]!=null && res[j].numRatings>0) {
				return [[i,inTerm],res[j].avgRating,inTerm==term];
			}

			return [[i,inTerm],null,inTerm==term]
		});

		return <BarsStat lhs={([i, inTerm], b)=>{
			return <ProfLink x={i} className="font-semibold text-nowrap"
				course={small} term={inTerm} labelTerm={!b}
				label={abbr(i.name, (isMd ? 35 : 20) - (!b ? 13 : 0))} />;
		}} className="grid-cols-[4fr_10fr_1fr]" vs={out} type={type} />
	}

const GPAView = instructorGradeViewComponent("gpa");
const RMPView = instructorGradeViewComponent("rmp");

function InstructorSemGPA({xs, term, cid}: {
	xs: [CourseInstructor, Term][], term: Term, cid: CourseId
}) {
	const idx = termIdx(term);

	const vs = xs.map(([x,inTerm]): [[CourseInstructor, Term], [Term, number|null, number][], boolean] => {
		const termGrades = cid.course.instructor[x.name] ?? {};

		const semGrades = Object.entries(termGrades).filter(([sem,]) => termIdx(sem as Term)<=idx)
			.map(([sem,v]): [Term, number|null, number]=>[sem as Term, v?.gpa ?? null, v?.numSections ?? 0]);

		return [[x, inTerm], semGrades, inTerm==term];
	});
	
	const small = useSmall(cid);
	return <NameSemGPA vs={vs} lhs={([i, inTerm], b)=>
		<ProfLink className='font-bold text-lg' x={i} course={small}
			term={inTerm} labelTerm={!b} />
	} />;
}

const averageInstructor = {type: "avg"} as const;

function CoursePrereqs({prereqs}: {prereqs: PreReqs}) {
	const isCoReq = (x: PreReqs): boolean => {
		if (x.type=="leaf") return "corequisite" in x.leaf && x.leaf.corequisite==true;
		else return !x.vs.some(y=>!isCoReq(y));
	};

	const coreqs: PreReqs[]=[], reqs: PreReqs[]=[];
	if (prereqs.type=="and") {
		for (const req of prereqs.vs) {
			(isCoReq(req) ? coreqs : reqs).push(req);
		}
	} else if (prereqs.type=="leaf" && isCoReq(prereqs)) {
		coreqs.push(prereqs);
	} else {
		reqs.push(prereqs);
	}
	
	const reqArr = (title: string, reqs: PreReqs[]) => reqs.length ? <>
		<Text v="md" className="mb-2" >{title}</Text>
		<ShowMore className="mb-2" >
			<Prereqs prereqs={reqs.length==1 ? reqs[0] : {type: "and", vs: reqs}} />
		</ShowMore>
	</> : "";

	return <>
		{reqArr("Corequisites", coreqs)}
		{reqArr("Prerequisites", reqs)}
	</>;
}

function CourseDetail(cid: CourseId) {
	useAPIResponse<void, number>("view", { data: cid.id });

	const latest = latestTerm(cid.course)!;
	const [term, setTerm] = useSearchState<Term>(latest, (p) => p.get("term") as Term|null,
		(x)=> x==latest ? null : new URLSearchParams([["term",x]]))

	const course = cid.course;
	const subjNum = `${course.subject} ${trimCourseNum(course.course)}`;

	const [instructorSearch, setInstructorSearch] = useState("");

	const small = useSmall(cid);
	const instructors = useMemo(()=>small.termInstructors[term] ?? [], [small.termInstructors, term]);
	const instructorToTerm = useMemo(()=> new Map<string, Term>([
		...sectionsByTerm(cid.course).flatMap(([secTerm,secs])=>
			secs.flatMap(sec=>sec.instructors.map(i=>[i.name, secTerm] satisfies [string, Term]))),
		...cid.course.sections[term].flatMap(sec=>sec.instructors.map(i=>[i.name, term] satisfies [string, Term]))
	]), [cid.course, term]);
	const allInstructors = useMemo(()=>allCourseInstructors(cid.course, term), [cid.course, term]);

	const searchInstructors = useDebounce(useCallback(() => {
		const v = simp(instructorSearch);
		return allInstructors.filter(x => simp(x.name).includes(v))
			.map((v): [CourseInstructor, Term]=>[v, instructorToTerm.get(v.name)!]);
	}, [instructorSearch, allInstructors, instructorToTerm]), 100);

	const [section, setSection] = useState<Section|null>(null);
	const app = useContext(AppCtx);

	const smallCalendar = useMemo(()=>calendarDays(course, term).length<=3, [course,term]);
	//memo so object reference is stable, otherwise calendar might rerender too often!
	const calSections = useMemo(()=>
		course.sections[term].map((x):[SmallCourse, Section]=>[small,x]),
	[course.sections, small, term]);

	const attachmentsTerm = (Object.entries(course?.attachments ?? {}) as [Term, Attachment[]][])
		.sort(([a],[b]) => termIdx(b)-termIdx(a));

	const catalog=`https://selfservice.mypurdue.purdue.edu/prod/bwckctlg.p_disp_course_detail?cat_term_in=${useInfo().terms[term]!.id}&subj_code_in=${course.subject}&crse_numb_in=${course.course}`;

	const statProps = {search:instructorSearch, setSearch:setInstructorSearch, searchName: "instructors"};

	const gradesForTerm = useMemo(()=>
		mergeGrades(Object.values(course.instructor).map(x=>x[term] ?? emptyInstructorGrade)), [course.instructor, term]);

	const hasGrades = allInstructors.some(x=>course.instructor[x.name]!==undefined);
	type GradeInstructorOption = ({type:"instructor", term: Term}&CourseInstructor)|typeof averageInstructor;
	const [selectedInstructors, setSelInstructors] = useState<GradeInstructorOption[]>(
		hasGrades ? [averageInstructor] : []
	);

	const graphGrades: [string,InstructorGrade][] = useMemo(() =>
		selectedInstructors.map(x =>
			x.type=="avg" ? ["Average",
				mergeGrades(Object.values(course.instructor).flatMap(x=>Object.values(x)))]
			: [x.name,course.instructor[x.name]==undefined ? emptyInstructorGrade
				: mergeGrades(Object.values(course.instructor[x.name]))]
		), [course.instructor, selectedInstructors]);

	const gradeInstructors: GradeInstructorOption[] = useMemo(()=>
		[averageInstructor, ...allInstructors.map((x): GradeInstructorOption=>{
			const t = instructorToTerm.get(x.name)!;
			return {type: "instructor", ...x, term: t};
		}).sort((a,b) => {
			return (a.type=="avg" ? 0 : ((a.name in course.instructor ? 0 : 2) + (a.term==term ? 0 : 1)))
				- (b.type=="avg" ? 0 : ((b.name in course.instructor ? 0 : 2) + (b.term==term ? 0 : 1)));
		})], [allInstructors, course.instructor, instructorToTerm, term]);

	let learningOutcomes: React.ReactNode|undefined;
	if (Array.isArray(course.learningOutcomes)) {
		learningOutcomes=<div className="flex flex-col gap-2 mb-1" >
			{course.learningOutcomes.map((m,i)=><p key={i} >
				<Text className={`p-2 py-1 rounded-full ${bgColor.secondary} text-center mr-2`} v="smbold" >{i+1}</Text>
				{m}
			</p>)}
		</div>;
	} else if (course.learningOutcomes) {
		learningOutcomes=<p className="mb-2" >{course.learningOutcomes}</p>;
	}

	return <SelectionContext.Provider value={{
		selTerm(term) {
			if (term in course.sections) setTerm(term);
			else app.open({type: "error", name: "Term not available",
				msg: "We don't have data for this semester"})
		}, selSection:setSection, deselectSection(section) {
			setSection(s=>s==section ? null : s);
		}, section
	}} >
		<MainLayout left={<>
			<div className="flex flex-col gap-4 -mt-3 mb-1">
				<div className="flex flex-row flex-wrap mb-1 gap-1 items-center">
					{/* Credits Display */}
					<Text v="sm" >{creditStr(course)}</Text>

					{/* Separator Display */}
					<Divider className="mx-1" />
					<CourseChips course={small} />
				</div>
				
				<TermSelect term={term} setTerm={(t)=>setTerm(t!)}
					terms={Object.keys(course.sections) as Term[]} label="Data from" />

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
						subjNum, ...instructors.map(x => `"${firstLast(x.name)}"`)
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

			{learningOutcomes!=undefined && <Text v="bold" className="mb-1" >
				Learning Outcomes
			</Text>}
			{learningOutcomes}

			<Text v="dim" className="mt-1 mb-3" >Course {subjNum} from Purdue University - West Lafayette.</Text>

			{/* Prerequisites */}
			{course.prereqs=="failed"
				? <Text v="err" >Failed to parse prerequisites. Please use the <Anchor href={catalog} >catalog</Anchor>.</Text>
				: (course.prereqs!="none" && <CoursePrereqs prereqs={course.prereqs} />)}

			<Restrictions restrictions={course.restrictions} />

			{attachmentsTerm.length>0 && <>
				<Text v="md" className="mt-2 mb-1" >Attachments</Text>
				<div className={`p-2 flex flex-col gap-2 ${containerDefault} overflow-y-auto max-h-32 md:max-h-60 mb-1`} >
					{attachmentsTerm.map(([t, attachments]) => <React.Fragment key={t} >
						<Text v="bold" >{formatTerm(t)}</Text>
						<div className="flex flex-row gap-2 flex-wrap" >
							{attachments.map((attach,i) => {
								const inner = <div className="flex flex-col gap-0.5 items-start justify-stretch" >
									<Text v="smbold" >{abbr(attach.name, 35)}</Text>
									<div className="flex flex-row flex-wrap" >
										<Text v="dim" >{abbr(attach.author, 20)}</Text>
										<Divider/>
										<Text v="dim" >updated {new Date(attach.updated).toLocaleDateString()}</Text> 
									</div>
								</div>;

								//bro why is the height fixed to 1rem while width is like auto...
								const icon = attach.type=="web" ? <IconWorld className="h-auto" /> : <IconPaperclip className="h-auto" />;
								const cls = bgColor.secondary;

								if (attach.href)
									return <LinkButton key={i} className={cls} icon={icon} href={attach.href} >{inner}</LinkButton>
								else return <Button className={cls} icon={icon} key={i} onClick={()=>{
									app.open({type: "other", name: "Secured resource", modal: <>
										<p>To access this resource, login and then look up the course in Purdue{"'"}s Course Insights.</p>
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
					<GPAView xs={searchInstructors} cid={cid} term={term} />
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
					<RMPView xs={searchInstructors} cid={cid} term={term} />
				</WrapStat>
			},
			{
				key: "grades", title: "Grade distribution",
				body: <>
					<SelectId isMulti options={gradeInstructors}
						placeholder="Select instructors"
						value={selectedInstructors}
						getOptionLabel={
							x=>x.type=="avg" ? "Average" : x.term==term ? x.name : `${x.name} (${formatTerm(x.term)})`
						}
						getOptionValue={x=>x.type=="avg" ? "" : x.name}
						onChange={(x: MultiValue<GradeInstructorOption>)=>
							setSelInstructors(x as GradeInstructorOption[])}
						isOptionDisabled={(x: GradeInstructorOption) =>
							(x.type=="avg" && !hasGrades) || (x.type!="avg" && !(x.name in course.instructor))}
						{...selectProps<GradeInstructorOption,true>()}
					/>

					<Graph title={`Average grades by instructor for ${subjNum}`} grades={graphGrades} />
				</>
			},
			{
				key: "enrollment", title: "Enrollment",
				body: <>
					<EnrollmentChart course={cid} term={term} />
				</>
			}
		]} bottom={<>
			{!smallCalendar && calSections.length>0 && <Calendar sections={calSections} term={term} />}

			<Community course={small} />
			<SimilarCourses id={cid.id} />
		</>} title={<>
			{subjNum}: {course.name}
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