import {Knex} from "knex";
import {Instructor, normalizeName, RMPInfo} from "../../shared/types.ts";
import {deepEquals, fetchDispatcher, logArray, postHTML} from "./fetch.ts";
import {DBInstructor} from "./db.ts";
import {Grades} from "./grades.ts";

async function RMPGraphQL<T>(query: string, variables: object) {
	return await fetchDispatcher<T>({
		transform: x => x.json()
	}, "https://www.ratemyprofessors.com/graphql", {
		method: "POST",
		body: JSON.stringify({ query, variables }),
		headers: {
			"Content-Type": "application/json",
			//stolen from https://github.com/Michigan-Tech-Courses/rate-my-professors/blob/master/src/constants.ts lmao
			"Authorization": "Basic dGVzdDp0ZXN0" //hehe its magic!
		}
	});
}

const schoolName = "Purdue University - West Lafayette";

export async function updateInstructors({instructors,grades,knex}:{
	instructors: Set<string>, grades: Grades[], knex: Knex
}) {
	console.log(`retrieving professor ratings`);

	const res = await RMPGraphQL<{
		data: {newSearch: {schools: {edges: {node: {id: string, name: string}}[]}}}
	}>(`query SearchSchool($query: SchoolSearchQuery!) {
		newSearch {
			schools(query: $query) {
				edges {
					node {
						id
						name
					}
				}
			}
		}
	}`, {
		query: {text: schoolName}
	});

	const schoolCandidates = res.data.newSearch.schools.edges;
	if (schoolCandidates.length==0) {
		throw new Error(`no schools found matching ${schoolName}`);
	}

	const schoolID = schoolCandidates[0].node.id;
	console.log(`using school ${schoolCandidates[0].node.name}`)

	const gradeByInstructor = new Map<string, Grades[]>();
	for (const x of grades) {
		const normed = normalizeName(x.instructor);
		gradeByInstructor.set(normed, [...(gradeByInstructor.get(normed) ?? []), x]);
	}

	await logArray(instructors.keys().toArray(), async (k) => {
		//thanks https://github.com/Michigan-Tech-Courses/rate-my-professors/blob/master/src/queries.ts
		const res = await RMPGraphQL<{
			data: {newSearch: {teachers: {edges: {node: {
				id: string, firstName: string, lastName: string,
				avgDifficulty: number, avgRating: number, numRatings: number, wouldTakeAgainPercent: number
			}}[]}}}
		}>(`query NewSearchTeachersQuery($text: String!, $schoolID: ID!) {
			newSearch {
				teachers(query: {text: $text, schoolID: $schoolID}) {
					edges {
						cursor
						node {
							id
							firstName
							lastName
							avgDifficulty
							avgRating
							numRatings
							wouldTakeAgainPercent
						}
					}
				}
			}
		}`, { text: k, schoolID });

		const nname = normalizeName(k);
		const candidate = res.data.newSearch.teachers.edges.map(x => x.node).find(x => 
			normalizeName(`${x.firstName} ${x.lastName}`)==nname
		);
		
		const instructor: Omit<Instructor, "lastUpdated"> = {
			name: k,
			grades: gradeByInstructor.get(nname)?.map(g=>({...g, instructor:undefined})) ?? [],
			nicknames: []
		};

		let rmp:RMPInfo|null=null;

		if (candidate!==undefined) {
			const rmpId = Number.parseInt(Buffer.from(candidate.id,"base64").toString("utf-8").trimIfStarts("Teacher-"));
			if (!isFinite(rmpId)) throw new Error("invalid RMP teacher id");

			rmp={
				avgDifficulty: candidate.avgDifficulty,
				avgRating: candidate.avgRating, numRatings: candidate.numRatings,
				wouldTakeAgainPercent: candidate.wouldTakeAgainPercent,
				rmpUrl: `https://www.ratemyprofessors.com/professor/${rmpId}`
			};
		}

		const search = await postHTML("https://www.purdue.edu/directory/Advanced", [
			["SearchString", k],
			["SelectedSearchTypeId", "0"],
			["UsingParam", "Search by Name"],
			["CampusParam", "West Lafayette"],
			["DepartmentParam", "All Departments"],
			["SchoolParam", "All Schools"]
		]);

		const lis = search("#results li").toArray();
		const li = lis
			.map((x):[string,typeof lis[0]]=>[search(x).find(".cn-name").first().text().trim(),x])
			.find(x=>normalizeName(x[0])==nname);
		
		if (li!==undefined) {
			const x = search(li[1]);

			const els = new Map(x.find("table > tbody > tr").toArray().map(x=>[
					search(x).children("th"),
					search(x).children("td")
				].map(v=>search(v).text().trim()))
				.map(a=>[a[0].toLowerCase(),a[1]]));
			
			if (els.has("nickname"))
				instructor.nicknames.push(els.get("nickname")!);
			
			const keyMap: [string, "email"|"dept"|"office"|"site"|"title"][] = [
				["email", "email"], ["department", "dept"], ["office", "office"],
				["url", "site"], ["title", "title"]
			];

			for (const [k,v] of keyMap) {
				const a = els.get(k);
				if (a!==undefined) instructor[v]=a;
			}
		}

		await knex.transaction(async tx => {
			const d = await tx<DBInstructor>("instructor")
				.where("name", k).select("data").first();

			if (d!=undefined) {
				const old = JSON.parse(d.data) as Instructor;
				if (deepEquals({...old, lastUpdated: undefined}, instructor))
					return;
			}

			await tx<DBInstructor>("instructor")
				.insert({
					name: k, data: JSON.stringify({
						...instructor, lastUpdated: new Date().toISOString()
					}), rmp
				}).onConflict("name").merge();
		})
	}, x => x);
}