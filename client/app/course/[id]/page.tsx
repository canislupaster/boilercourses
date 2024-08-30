import { Metadata } from "next";
import { courseById, getInfo } from "@/app/server";
import { CourseDetailApp } from "./course";
import { notFound } from "next/navigation";
import { latestTerm, trimCourseNum } from "../../../../shared/types";

export async function generateMetadata(
  { params }: {params: {id: string}},
): Promise<Metadata> {
	const id = Number.parseInt(params.id);
	if (isNaN(id)) notFound();

	const course = (await courseById(id)).course;

	const title = `${course.subject} ${trimCourseNum(course.course)}: ${course.name} at Purdue`;

  return {
    title: title,
		description: course.description,
		authors: [...new Set(course.sections[latestTerm(course)!]
			.flatMap(x=>x.instructors)
			.filter(x=>x.primary).map(x=>({name:x.name})))],
		openGraph: {
			url: `/course/${id}`,
			type: "website", title, description: course.description,
			images: [`/course/${id}/thumb`]
		},
		twitter: {
			card: "summary_large_image",
			title, description: course.description,
			images: [`/course/${id}/thumb`]
		}
  }
}

export default async function Page({ params }: {params: {id: string}}) {
	const id = Number.parseInt(params.id);
	if (isNaN(id)) notFound();

	const course = await courseById(id);
	const info = await getInfo();
	return <CourseDetailApp {...course} info={info} />;
}