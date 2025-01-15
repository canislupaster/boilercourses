import { Collapse } from "react-collapse";
import { ServerSearch } from "../../shared/types";
import { Card } from "./card";
import { Text } from "./util";
import { useAPIResponse } from "./wrapper";
import { Carousel } from "./clientutil";

export function SimilarCourses({id}: {id: number}) {
	const ret = useAPIResponse<ServerSearch["results"],number>("similar", {data: id});

	return <Collapse isOpened >
		{ret!=null && ret.res.length>0 && <div className="flex flex-col mt-2" >
			<Text v="md" className="mb-2" >Similar Courses</Text>
			<Carousel items={ret.res.map(c =>
				<Card key={`${c.course.id}\n${c.course.varTitle}`} type="card" course={c.course} className="h-full" />
			)} />
		</div>}
	</Collapse>;
}