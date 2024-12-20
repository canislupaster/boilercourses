import { creditStr, formatTerm, instructorStr, sectionsByTerm, trimCourseNum } from "../../../../../shared/types";
import { courseById, makeThumbnail } from "../../../server";
 
export const runtime = "edge";
 
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const course = (await courseById(Number.parseInt((await params).id))).course;
  const terms = sectionsByTerm(course).map(x => x[0]);

  return makeThumbnail(`${course.subject} ${trimCourseNum(course.course)}: ${course.name}`,
    `${formatTerm(terms[terms.length-1])} | ${creditStr(course)} | ${instructorStr(course)}`);
}