import { twMerge } from "tailwind-merge";
import { CourseId, creditStr, formatTerm, InstructorGrade, latestTermofTerms, SmallCourse, Term, toSmallCourse, trimCourseNum } from "../../shared/types";
import attributeToGenEd from "../app/attributeToGenEd.json";
import { AppLink, AppTooltip, useGpaColor, useMd } from "./clientutil";
import { Stars } from "./community";
import { InstructorList } from "./instructorlist";
import { abbr, Anchor, bgColor, borderColor, Chip, containerDefault, Loading, Text, textColor } from "./util";
import { useAPI } from "./wrapper";
import { IconEye } from "@tabler/icons-react";

//ideally maybe have term inherited from search semester filter.............?????
//causes hydration errors due to nested links (card and professors, gpa, etc)
export function Card({ course, frameless, termFilter, className, extra }: {frameless?: boolean, termFilter?: Term[], className?: string, course: SmallCourse, extra?: React.ReactNode}) {
  const terms = Object.keys(course.termInstructors) as Term[];
  const term = latestTermofTerms(terms, termFilter) ?? latestTermofTerms(terms)!;
  const url = `/course/${course.id}?term=${term}`;

  const body = <>
    <Text v="sm" className="flex flex-row flex-wrap items-center gap-1">
      {creditStr(course)} <GPAIndicator grades={course.grades} smol />
      <div className={`${containerDefault} flex flex-row gap-0.5 px-1 py-0.5 pr-1.5 items-center`} >
        <IconEye/> <span className="font-display font-bold" >{course.views}</span>
      </div>
    </Text>
    {course.avgRating!=null && <div className="flex flex-row gap-2 font-display font-black text-md items-center" >
      <Stars sz={18} rating={course.avgRating} /> {course.ratings}
    </div>}

    {extra}

    <InstructorList short className="my-2" whomst={course.termInstructors[term]} term={term} course={course} />

    <Text v="sm" className="grow" >
      <span>{abbr(course.description)}</span>
    </Text>

    <div className="flex flex-row flex-wrap">
      <CourseChips course={course} />
    </div>
  </>;

  if (frameless) return (
    <div className="flex flex-col gap-1">
      <Anchor href={url} >
        <Text v="lg" >
          {course.subject} {trimCourseNum(course.course)}: {course.name}
        </Text>
      </Anchor>
      {body}
    </div>
  );
  else return (
    <AppLink href={url}
      className={twMerge("flex flex-col gap-1 p-6 rounded-md shadow-md hover:scale-[101%] md:hover:scale-[103%] transition hover:transition cursor-pointer", bgColor.secondary, className)} >
        <Text v="lg" >{course.subject} {trimCourseNum(course.course)}: {course.name}</Text>
        {course.varTitle && 
          <Text v="bold" >{course.varTitle}</Text>}
        {body}
    </AppLink>
  );
};

type LookupOrCourse = {type:"lookup", subject: string, num: number}|{type:"course", course: SmallCourse};

function useLookupOrCourse(props: LookupOrCourse): [SmallCourse|"notFound"|null, string, number] {
  let cid: "notFound"|SmallCourse|null=null;
  let subject:string, num:number;
  //cant change type! different hooks
  if (props.type=="lookup") {
    subject=props.subject; num=props.num;
    while (num<1e4) num*=10;

    const res = useAPI<CourseId[], {subject: string, course: number}>("lookup", {
      data: { subject: subject, course: num }
    });

    if (res!=null) cid=res.res.length==0 ? "notFound" : toSmallCourse(res.res[0]);
  } else {
    cid=props.course; subject=cid.subject; num=cid.course;
  }

  return [cid, subject, num];
}

export function CourseLinkPopup({extra, ...props}: LookupOrCourse&{extra?: React.ReactNode}) {
  const [cid, subject, num] = useLookupOrCourse(props); //may be mounted separately from courselink, so needs to fetch (cached) separately

  return <div className="pt-2 pb-1 px-2" >{cid==null ? <Loading label={`Loading ${subject}${num}`} />
    : (cid=="notFound" ? <div className="p-2" >
      {extra ? <>
        <Text v="lg" className="mb-2" >{subject} {num}</Text>
        {extra}
        <p className="mt-2" >We don't have any more information on this course</p>
      </> : <>
        <Text v="lg" >Course not found</Text>
        <p>Maybe it's been erased from the structure of the universe, or it just isn't on our servers...</p>
      </>}
    </div>
      : <Card frameless extra={extra} course={cid} />)
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
    {course.scheduleTypes.map((s) => (
      <Chip color="purple" key={s}> {s} </Chip>
    ))}

    <Chip color="blue" >
      {formatTerm(latestTermofTerms(Object.keys(course.termInstructors) as Term[])!)}
    </Chip>

    {geneds.map((gened) => (
      <Chip color="teal" key={gened} >
        {gened}
      </Chip>
    ))}
  </>;
}

export function GPAIndicator({grades,smol,tip}:{grades: InstructorGrade, smol?:boolean, tip?:string}) {
  return <AppTooltip content={tip ?? (grades.gpaSections==0 ? "No data" : `Averaged over ${grades.gpaSections} section${grades.gpaSections==1?"":"s"} (all time)`)} >
    <div className={`${textColor.contrast} flex flex-row cursor-pointer font-display ${smol ? "font-bold gap-1" : "font-extrabold gap-2"} items-center m-1 p-1 rounded-md px-3 ${grades.gpa==null ? bgColor.default : ""} border ${borderColor.default}`}
      style={{backgroundColor: useGpaColor()(grades.gpa)}} >
      <span className={smol ? "text-xs font-light" : "font-normal"} >GPA</span>
      <h2 className={smol ? "text-sm" : "text-2xl"} >{grades.gpa?.toFixed(2) ?? "?"}</h2>
    </div>
  </AppTooltip>;
}