import { twMerge } from "tailwind-merge";
import { CourseId, creditStr, formatTerm, InstructorGrade, latestTermofTerms, SmallCourse, Term, toSmallCourse, trimCourseNum, abbr } from "../../shared/types";
import attributeToGenEd from "../app/attributeToGenEd.json";
import { AppLink, AppTooltip, useGpaColor, useMd } from "./clientutil";
import { Stars } from "./community";
import { InstructorList } from "./instructorlist";
import { Anchor, bgColor, borderColor, Chip, containerDefault, Divider, Loading, Text, textColor } from "./util";
import { AppCtx, useAPIResponse } from "./wrapper";
import { IconEye } from "@tabler/icons-react";
import { useContext } from "react";

export function Card({ course, type, term: optTerm, className, extra, score, selected }: {
  type: "card"|"frameless"|"list", term?: Term, className?: string,
  course: SmallCourse, extra?: React.ReactNode, score?: number, selected?: boolean
}) {
  const terms = Object.keys(course.termInstructors) as Term[];
  const term = optTerm ?? latestTermofTerms(terms)!;
  const url = `/course/${course.id}${optTerm ? `?term=${optTerm}` : ""}`;
  const app = useContext(AppCtx);

  const creditGPAViews = <>
    <Text v="sm" >{creditStr(course)}</Text>
    <div className="z-10" >
      <GPAIndicator grades={course.grades} smol />
    </div>
    <AppTooltip content="Views" className="z-10" >
      <div className={`${containerDefault} flex flex-row gap-0.5 px-1.5 py-0.5 items-center`} >
        <IconEye/> <span className="font-display font-medium" >{course.views>1000 ? `${Math.round(course.views/1000)}K` : course.views}</span>
      </div>
    </AppTooltip>
  </>;

  if (type=="list") {
    const normScore = score ? 1 - 1/(1 + score*score/10000) : null;

    return <div className={twMerge(`flex flex-col gap-1 relative ${normScore!=null ? "md:px-3 px-0.5 md:pl-5" : ""} py-3 pl-2 md:pb-4 pt-2 md:pt-3 border-t last:border-b`, borderColor.default, className)} >
      {normScore!=null && <div className="absolute -left-2 md:left-0 -bottom-px -top-px w-2" style={{
        backgroundColor: app.theme=="dark"
          ? `hsl(${(1-normScore) * 240}, ${normScore*50+40}%, ${normScore*50+15}%)`
          : `hsl(${(1-normScore) * 240}, ${normScore*70+20}%, ${80-normScore*30}%)`
      }} />}

      <Text v="lg" className="md:text-2xl underline-offset-2 underline decoration-dashed decoration-1" >{course.subject} {trimCourseNum(course.course)}: {course.name}</Text>
      {course.varTitle && <Text v="bold" className="-mt-1" >{course.varTitle}</Text>}

      <div className="flex flex-row flex-wrap items-center gap-1.5 mb-1" >
        {creditGPAViews}
        {course.avgRating!=null && <div className="flex flex-row gap-2 font-display font-black text-md items-center" >
          <Stars sz={18} rating={course.avgRating} /> {course.ratings}
        </div>}
        <Divider/>
        <CourseChips course={course} />
      </div>

      {extra}

      <Text v="sm" className="grow" >
        <span>{course.description}</span>
      </Text>

      <InstructorList className="z-10" whomst={course.termInstructors[term]} term={term} course={course} />

      <AppLink href={url} className={
        `border-none outline-none absolute left-0 right-0 top-0 bottom-0 hover:bg-cyan-800/5 dark:hover:bg-cyan-100/5 transition ${
          selected ? "bg-cyan-800/10" : "bg-transparent"
        }`
      } />
    </div>;
  } else {
    const body = <>
      {course.varTitle && <Text v="bold" >{course.varTitle}</Text>}

      <div className="flex flex-row flex-wrap items-center gap-1 my-1">
        {creditGPAViews}
      </div>
      {course.avgRating!=null && <div className="flex flex-row gap-2 font-display font-black text-md items-center" >
        <Stars sz={18} rating={course.avgRating} /> {course.ratings}
      </div>}

      {extra}

      <Text v="sm" className="grow mt-2" >
        <span>{abbr(course.description)}</span>
      </Text>

      {/* higher z index for selectability */}
      {course.termInstructors[term].length>0 && <div className="flex flex-wrap flex-row lg:text-sm text-sm gap-x-1 items-center gap-y-0.5 z-10 mt-2" >
        <Text v="smbold">Taught by</Text>
        <InstructorList short className="my-2 contents" whomst={course.termInstructors[term]} term={term} course={course} />
      </div>}

      <div className="flex flex-row flex-wrap gap-1 mt-2" ><CourseChips course={course} /></div>
    </>;

    if (type=="frameless") return <>
      <Anchor href={url} >
        <Text v="lg" >
          {course.subject} {trimCourseNum(course.course)}: {course.name}
        </Text>
      </Anchor>

      {body}
    </>;
    else return <div className={twMerge("p-6 flex flex-col text-left rounded-md shadow-md hover:scale-[101%] md:hover:scale-[103%] transition hover:transition relative", bgColor.secondary, className)} >
      <Text v="lg" >{course.subject} {trimCourseNum(course.course)}: {course.name}</Text>

      {body}

      <AppLink href={url} className="bg-transparent border-none outline-none absolute left-0 right-0 top-0 bottom-0" />
    </div>;
  }
};

type LookupOrCourse = {type:"lookup", subject: string, num: number}|{type:"course", course: SmallCourse};

function useLookupOrCourse(props: LookupOrCourse): [SmallCourse|"notFound"|null, string, number] {
  let cid: "notFound"|SmallCourse|null=null;

  const data: {subject: string, course: number} = props.type=="lookup" ? {
    subject: props.subject, course: props.num
  } : {
    subject: props.course.subject, course: props.course.course
  };

  if (data) {
    while (data.course<1e4) data.course*=10;
  }

  //cant change type! different hooks
  const res = useAPIResponse<CourseId[], {subject: string, course: number}>("lookup", {
    data,
    disabled: props.type!="lookup"
  });

  if (props.type=="lookup") {
    if (res!=null) cid=res.res.length==0 ? "notFound" : toSmallCourse(res.res[0]);
  } else {
    cid=props.course;
  }

  return [cid, data.subject, data.course];
}

export function CourseLinkPopup({extra, ...props}: LookupOrCourse&{extra?: React.ReactNode}) {
  const [cid, subject, num] = useLookupOrCourse(props); //may be mounted separately from courselink, so needs to fetch (cached) separately

  return <div className="pt-2 pb-1 px-2" >{cid==null ? <Loading label={`Loading ${subject}${num}`} />
    : (cid=="notFound" ? <div className="p-2" >
      {extra ? <>
        <Text v="lg" className="mb-2" >{subject} {num}</Text>
        {extra}
        <p className="mt-2" >We don{"'"}t have any more information on this course</p>
      </> : <>
        <Text v="lg" >Course not found</Text>
        <p>Maybe it{"'"}s been erased from the structure of the universe, or it just isn{"'"}t on our servers...</p>
      </>}
    </div>
      : <Card type="frameless" extra={extra} course={cid} />)
  }</div>;
}

export function CourseLink({className,children,...props}: {className?: string,children?:React.ReactNode}&LookupOrCourse) {
  const [cid, subject, num] = useLookupOrCourse(props);

  return <AppTooltip placement={useMd() ? "right" : "bottom"} content={<CourseLinkPopup {...props} />} >
    <Anchor className={twMerge("font-display", cid=="notFound" || cid==null ? "no-underline" : "", className)} >
      {children ?? `${subject} ${trimCourseNum(num)}`}
    </Anchor>
  </AppTooltip>
}

export function CourseChips({course}: {course: SmallCourse}) {
	const geneds = course.attributes.map(x => attributeToGenEd[x as keyof typeof attributeToGenEd])
		.filter(x=>x!=undefined);

  return <>
    <Chip color="blue" >
      {formatTerm(latestTermofTerms(Object.keys(course.termInstructors) as Term[])!)}
    </Chip>

    {course.scheduleTypes.map((s) => (
      <Chip color="purple" key={s}> {s} </Chip>
    ))}

    {geneds.map((gened) => (
      <Chip color="teal" key={gened} >
        {gened}
      </Chip>
    ))}
  </>;
}

export function GPAIndicator({grades,smol,tip}:{grades: InstructorGrade, smol?:boolean, tip?:string}) {
  return <AppTooltip content={tip ?? (grades.gpaSections==0 ? "No data" : `Averaged over ${grades.gpaSections} section${grades.gpaSections==1?"":"s"} (all time)`)} >
    <div className={`${textColor.contrast} flex flex-row cursor-pointer font-display ${smol ? "font-bold gap-1" : "font-extrabold gap-2"} items-center p-1 rounded-md px-3 ${grades.gpa==null ? bgColor.default : ""} border ${borderColor.default}`}
      style={{backgroundColor: useGpaColor()(grades.gpa)}} >
      <span className={smol ? "text-xs font-light" : "font-normal"} >GPA</span>
      <h2 className={smol ? "text-sm" : "text-2xl"} >{grades.gpa?.toFixed(2) ?? "?"}</h2>
    </div>
  </AppTooltip>;
}