import { catchAPIError, courseById } from "@/app/server";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { creditStr, formatTerm, instructorStr, latestTerm, sectionsByTerm, trimCourseNum } from "../../../../shared/types";
import { CourseDetailApp } from "./course";

export async function generateMetadata(
  { params }: {params: {id: string}},
): Promise<Metadata> {
	const id = Number.parseInt(params.id);
	if (isNaN(id)) notFound();

	const course = (await courseById(id)).course;

	const simpleTitle = `${course.subject} ${trimCourseNum(course.course)}: ${course.name}`;
	const title = `${simpleTitle} at Purdue`
	const desc = `${course.description}\n${creditStr(course)}.\nTaught by ${
		instructorStr(course)}.\nOffered ${sectionsByTerm(course)
		.map(([x,_])=>formatTerm(x)).join(", ")}.`;

  return {
    title: simpleTitle,
    alternates: { canonical: `/course/${id}` },
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
  }
}

export default catchAPIError(async ({ params }: {params: {id: string}}) => {
	const id = Number.parseInt(params.id);
	if (isNaN(id)) notFound();

	const course = await courseById(id);
	return <CourseDetailApp {...course} />;
});