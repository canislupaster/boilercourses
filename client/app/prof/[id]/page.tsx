import { catchAPIError, profById } from "@/app/server";
import { capitalize } from "@/components/util";
import { Metadata } from "next";
import { CourseId, formatTerm, sectionsByTerm, Term, termIdx, trimCourseNum } from "../../../../shared/types";
import { Instructor } from "./instructor";

export async function generateMetadata(
  { params }: {params: Promise<{id: string}>},
): Promise<Metadata> {
	const i = await profById(Number.parseInt((await params).id));

	const title = `${i.instructor.name} at Purdue`;
	const fs = i.instructor.name.split(/\s+/);
	const first=fs.length==0 ? undefined : fs[0], last=fs.length<=1 ? undefined : fs[fs.length-1];
	let desc = i.instructor.title==null ? "Instructor" : capitalize(i.instructor.title);
	if (i.instructor.dept) desc+=` in the ${capitalize(i.instructor.dept)} department`;
	desc += " at Purdue"

	const shortCourseName = (x: CourseId) => `${x.course.subject} ${trimCourseNum(x.course.course)}`;

	const sCourses = i.courses.map((x): [CourseId, Term]=>{
		const lastTerm = sectionsByTerm(x.course).find(([,sec])=>sec.some(s=>
			s.instructors.some(i2=>i2.name==i.instructor.name)))![0];
		return [x,lastTerm];
	})
		.sort(([,v],[,y])=>termIdx(y)-termIdx(v))
		.map((x)=>`${shortCourseName(x[0])} (${formatTerm(x[1])})`);

	if (sCourses.length>1) {
		desc+=` who teaches ${sCourses.slice(0,-1).join(", ")} and ${sCourses[sCourses.length-1]}`;
	} else if (sCourses.length==1) {
		desc+=` who teaches ${sCourses[0]}`;
	}

  return {
    title: i.instructor.name,
		description: desc,
		alternates: { canonical: `/prof/${i.id}` },
		openGraph: {
			type: "profile",
			url: `/prof/${i.id}`,
			images: [`/prof/${i.id}/thumb`],
			firstName: first, lastName: last,
			username: i.instructor.email
		},
		twitter: {
			card: "summary_large_image",
			title, description: desc, 
			images: [`/prof/${i.id}/thumb`]
		}
  }
}

export default catchAPIError(async ({ params }: {params: Promise<{id: string}>}) => {
	const i = await profById(Number.parseInt((await params).id));
	return <Instructor instructor={i} />;
});