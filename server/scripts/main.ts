import {exit} from "node:process";
import {parseArgs} from "node:util";
import {addProxies, fetchDispatcher, getHTML} from "./fetch.ts";
import {formatTerm, Term, termIdx} from "../../shared/types.ts";
import {getGrades, Grades} from "./grades.ts";
import {readFile} from "node:fs/promises";
import {updateCourses} from "./course.ts";
import {DBInstructor, DBTerm, loadDB} from "./db.ts";
import {updateInstructors} from "./prof.ts";
import {addAttachments} from "./attachments.ts";

const {values, positionals} = parseArgs({
	options: {
		db: { type: "string", short: "d" },
		subject: { type: "string", short: "s" },
		after: { type: "string" },
		allInstructors: { type: "boolean", short: "a", default: false }, //update info for all professors, even those who don't appear in term's catalog
		proxies: { type: "string", short: "p" },
		grades: { type: "string", short: "g", default: "https://github.com/eduxstad/boiler-grades/raw/main/grades.xlsx" }
	},
	allowPositionals: true
});

const knex = loadDB(values);

console.log("loading terms...");
const terms = await getHTML("https://selfservice.mypurdue.purdue.edu/prod/bwckschd.p_disp_dyn_sched");
const termList = terms("select[name=\"p_term\"]").children()
	.toArray()
	.filter(x=>x.attribs.value!==undefined && x.attribs.value.length>0)
	.map((e):[string,string] => [terms(e).text().trim(), e.attribs.value]);

if (values.proxies!==undefined) await addProxies(values.proxies);

function tryOr<T>(f: () => T, d: T) {
	try {return f();} catch {return d;}
}

const gradePath = tryOr<{type:"online",url:string}|{type:"file", path:string}>(
	()=>({type: "online", url: new URL(values.grades).href}),
	{type: "file", path: values.grades}
);

console.log(`getting grades from ${values.grades}`);

let grades: Grades[];
if (gradePath.type=="online")
	grades=getGrades(await fetchDispatcher({transform: x=>x.arrayBuffer()}, gradePath.url));
else grades=getGrades(await readFile(gradePath.path) as unknown as ArrayBuffer);

const courseIds = new Set<number>();

async function scrape(term: Term|null) {
	if (term==null)
		console.log("term not specified, using latest");
	else console.log(`scraping term ${formatTerm(term)}`);
	
	let idx: number=-1, termId: string|undefined;
	if (term!=null) {
		idx=termIdx(term);
		termId = termList.find(([k,]) => k.startsWith(formatTerm(term!)))?.at(1);
	} else {
		for (const [k,v] of termList) {
			const t = k.split(" ").slice(0,2).join("").toLowerCase() as Term;
			if (termIdx(t)>idx) {
				term=t; idx=termIdx(t); termId=v;
			}
		}
	}

	if (term==undefined || termId==undefined)
		throw new Error("term not found");

	await knex<DBTerm>("term").insert({
		id: term,
		purdue_id: termId, name: formatTerm(term),
		last_updated: Date.now()
	}).onConflict("id").merge();

	const {instructors: courseInstructors, courseIds: newCourseIds} = await updateCourses({
		term, termId, subjectArg: values.subject, knex, grades
	});

	for (const x of newCourseIds) courseIds.add(x);
	
	let updatedInstructors = new Set(courseInstructors.map(x=>x[0]));
	if (values.allInstructors) updatedInstructors=updatedInstructors.union(new Set(
		(await knex<DBInstructor>("instructor").select("name")).map(x=>x.name)
	));

	await updateInstructors({instructors: updatedInstructors, knex, grades});

	console.log("updating references...");
	for (const [k,v] of courseInstructors) {
		await knex("course_instructor").insert({course: v, instructor: k})
			.onConflict(["course", "instructor"]).ignore();
	}

	console.log(`done with ${formatTerm(term)}`);
}

if (values.after!==undefined) {
	const i = termList.findIndex(([k,]) => k.startsWith(formatTerm(values.after as Term)));
	if (i==-1) throw new Error(`term ${values.after} not found`);

	const terms = termList.slice(0,i+1).map(v=>{
		const p = v[0].split(/\s+/g).slice(0,2);
		return `${p[0].toLowerCase()}${p[1]}`;
	}).reverse();

	console.log(`found ${terms.join(",")} at/after ${values.after}`);
	for (const x of terms) await scrape(x as Term);
} else if (positionals.length>0) {
	for (const x of positionals) await scrape(x as Term);
} else {
	await scrape(null);
}

await addAttachments(knex, [...courseIds.values()]);
console.log("done, exiting");
exit(0)