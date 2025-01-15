import * as cheerio from "cheerio";

import {fetchDispatcher, logArray} from "./fetch.ts";
import {Attachment, Course, Term} from "../../shared/types.ts";
import {Knex} from "knex";
import {DBCourse, DBTerm} from "./db.ts";

async function getAttachments(subject: string, num: number) {
	const res = await fetchDispatcher<cheerio.CheerioAPI|null>({
		transform: async (r)=>cheerio.load(await r.text()),
		handleErr: (r) => Promise.resolve(r.status==500 ? null : "retry")
	},
		"https://sswis.mypurdue.purdue.edu/CourseInsights/courseDocument/displayCourseDocs", {
		body: new URLSearchParams({
			courseDesc: `${subject} ${num}`
		}),
		method: "POST",
		headers:{
			"Content-Type": "application/x-www-form-urlencoded",
			"Referer": "https://sswis.mypurdue.purdue.edu/CourseInsights/"
		}
	});

	if (res==null) return {};

	const docs = res("#displayCourseDocs").children().toArray();

	const byTermId: Record<string, Attachment[]> = {};

	for (const d of docs) {
		if ("id" in d.attribs && d.attribs.id.startsWith("collapse")) {
			const termId = d.attribs.id.match(/^collapse(\d+)$/)![1];
			const docs = res(d).find("#listCourseDocs").first().find("p").toArray();
			const pages = res(d).find("#listCoursePages").first().find("p").toArray();

			const getInfo = (x: typeof d, type: "web"|"doc"): Attachment => {
				const txts = res(x).children().first()
					.contents().toArray().filter(y=>y.nodeType==3)
					.map(v=>res(v).text().trim());
				const name = txts.join(" ").trim();

				const m = res(x).find("small").text().match(/^\s*(?:Added|Updated) by ((?:.|\n)+?)\s+- Last Updated on ([\d-]+)\s*$/)
				if (m==null) throw new Error("bad metadata");
				
				const out: Attachment = {
					type, name,
					updated: new Date(m[2]).toISOString(),
					author: m[1].trim().replaceAll(/\s+/g, " ")
				};

				for (const a of res(x).find("a").toArray()) {
					if (!("href" in a.attribs)) continue;

					try {
						out.href=new URL(a.attribs.href, "https://sswis.mypurdue.purdue.edu/CourseInsights/").href;
						break;
					} catch {
						continue;
					}
				}

				return out;
			};

			const vs = [ ...docs.map(v=>getInfo(v, "doc")), ...pages.map(v=>getInfo(v, "web")) ];
			if (vs.length>0) byTermId[termId]=vs;
		}
	}

	return byTermId;
}

export async function addAttachments(knex: Knex, courseIds?: number[]) {
	await knex.transaction(async (tr) => {
		const terms = await tr<DBTerm>("term").select("*");
		let q = tr<DBCourse>("course").select("*");
		if (courseIds) q=q.whereIn("id", courseIds);

		const courses = await q;

		console.log(`adding attachments for ${courses.length} courses`);

		const termIdToTerm = new Map(terms.map(v=>[v.purdue_id, v.id]));

		await logArray(courses, async ({subject,course,data,id}) => {
			const attach = await getAttachments(subject,course);
			if (Object.entries(attach).length==0) return;

			const c = JSON.parse(data) as Course;
			c.attachments = Object.fromEntries(Object.entries(attach)
				.map(([k,v]): [Term|undefined, Attachment[]] => [termIdToTerm.get(k), v])
				.filter(x=>x[0]!=undefined) as [Term, Attachment[]][]);
			
				await tr<DBCourse>("course").where({id}).update({data: JSON.stringify(c)});
		}, ({subject,course})=>`${subject} ${course}`);
	});
}