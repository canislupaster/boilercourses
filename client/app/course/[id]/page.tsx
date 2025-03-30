import { catchAPIError, courseById, getInfo } from "@/app/server";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { creditStr, formatTerm, instructorStr, latestTerm, sectionsByTerm, trimCourseNum } from "../../../../shared/types";
import { CourseDetailApp } from "./course";
import { metadataKeywords } from "@/components/util";

export async function generateMetadata(
  { params }: {params: Promise<{id: string}>},
): Promise<Metadata> {
	const id = Number.parseInt((await params).id);
	if (isNaN(id)) notFound();

	const course = (await courseById(id)).course;
	const terms = sectionsByTerm(course);

	const numStr = trimCourseNum(course.course).toString();
	const title = `${course.subject} ${numStr}: ${course.name}`;
	let desc = `${course.description}\n${creditStr(course)}.\nTaught by ${
		instructorStr(course)}.`;
	if (terms.length) desc+=`\nOffered ${terms.map(([x,_])=>formatTerm(x)).join(", ")}.`;

	const info = await getInfo();
	const subjectName = info.subjects.find(x=>x.abbr==course.subject)?.name;

  return {
    title,
    alternates: { canonical: `/course/${id}` },
		keywords: [
			...metadataKeywords.slice(0,8),
			`${course.subject} ${numStr}`, `${course.subject}${numStr}`,
			subjectName, terms.length>0 ? formatTerm(terms[0][0]) : null
		].filter(x=>x) as string[],
		description: desc,
		authors: [...new Set(course.sections[latestTerm(course)!]
			.flatMap(x=>x.instructors)
			.filter(x=>x.primary).map(x=>x.name))]
			.map(x=>({name:x})),
		openGraph: {
			url: `/course/${id}`,
			type: "website", title,
			description: desc,
			images: [`/course/${id}/thumb`]
		},
		twitter: {
			card: "summary_large_image",
			title, description: desc,
			images: [`/course/${id}/thumb`]
		}
  };
}

export default catchAPIError(async ({ params }: {params: Promise<{id: string}>}) => {
	const id = Number.parseInt((await params).id);
	if (isNaN(id)) notFound();

	const course = await courseById(id);
	return <CourseDetailApp {...course} />;
});