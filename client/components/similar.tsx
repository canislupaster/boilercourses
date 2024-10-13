import { Collapse } from "react-collapse";
import { ServerSearch } from "../../shared/types";
import { Card } from "./card";
import { bgColor, containerDefault, Text } from "./util";
import { useAPI } from "./wrapper";

export function SimilarCourses({id}: {id: number}) {
	const ret = useAPI<ServerSearch["results"],number>("similar", {data: id});

	return <Collapse isOpened={ret!=null && ret.res.length>0} key={ret!=null ? 1 : 0} >
		<div className="flex flex-col mt-2" >
			<Text v="md" className="mb-2" >Similar Courses</Text>
			<div className={`flex flex-row flex-nowrap overflow-x-auto w-full ${containerDefault} p-3 gap-3`} >
				{ret!=null && ret.res.map(c =>
					<Card {...c} key={`${c.course.id}\n${c.course.varTitle}`} course={c.course} className={`flex-shrink-0 basis-96 ${bgColor.secondary} max-w-[80dvw]`} />
				)}
			</div>
		</div>
	</Collapse>;
}