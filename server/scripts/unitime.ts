import {parseArgs} from "node:util";
import {devices} from "playwright";
import {chromium} from "playwright-extra";
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {DBAvailabilityNotification, DBCourse, DBProperty, DBSectionEnrollment, DBTerm, loadDB} from "./db.ts";
import {readFile, rm} from "node:fs/promises";
import {createDecipheriv} from "node:crypto";
import Papa from "papaparse";
import {Course, formatTerm, Seats, Term, termIdx} from "../../shared/types.ts";
import {deepEquals} from "./fetch.ts";
import {exit} from "node:process";

const {values, positionals} = parseArgs({
	options: {
		db: { type: "string", short: "d" },
		secret: { type: "string", short: "s" },
		show: {type: "boolean", short: "x"},
		key: {type: "string", short: "k"},
		browser: {type: "string", short: "b"}
	},
	allowPositionals: true
});

const knex = loadDB(values);

type CSVRecord = {
	Enrollment: string,
	Limit: string,
	Location: string,
	"First Date": string
	"Last Date": string,
	Type: string,
	Name: string,
	Section: string
};

type SectionData = {
	room: string[],
	seats?: Seats,
	courses: Set<string>,
	crn: number
}

async function handleCSV(term: Term, path: string) {
	const file = await readFile(path, "utf-8");
	const res = Papa.parse<CSVRecord>(file, { header: true, skipEmptyLines: true });
	if (res.errors.length>0) {
		console.error("csv errors", ...res.errors);
		return;
	}

	const sectionData = new Map<number, SectionData>();

	for (const rec of res.data) {
		if (rec.Type=="Special" || rec.Type.endsWith("Examination")) continue;

		const secs = rec.Section.matchAll(/^\s*(\d+)-.+$/gm).toArray();
		if (secs.length==0) continue;
		const courses = new Set(rec.Name.matchAll(/^\s*(\w+) .*?(\d+).*?$/gm)
			.toArray().map(v=>`${v[1]} ${v[2]}`));

		for (let i=0; i<secs.length; i++) {
			const crn = Number.parseInt(secs[i][1]);
			const secData: Partial<SectionData> = sectionData.get(crn) ?? {};
			const toN = (x: string) => {
				if (x.length==0) return null;
				const n = Number.parseInt(x);
				if (isNaN(n)) throw new Error("invalid number");
				return n;
			}

			const enrollment = toN(rec.Enrollment), limit=toN(rec.Limit);
			const seats: Seats|undefined = enrollment==null || limit==null ? undefined
				: {used: enrollment, left: limit - enrollment};

			if (seats==undefined && secData.seats!=undefined) continue;
			if (seats!=undefined && secData.seats!=undefined
				&& (seats.left!=secData.seats.left || seats.used!=secData.seats.used))
				throw new Error("inconsistent enrollment count");

			sectionData.set(crn, {
				room: [...secData.room ?? [], rec.Location],
				seats, crn, courses
			});
		}
	}

	console.log(`updating courses with ${sectionData.size} sections`);

	let enrollmentsChanged = 0, availabilitiesSatisfied=0;
	const scrapeTime = Date.now();

	await knex.transaction(async trx => {
		const courses = (await trx<DBCourse>("course").select()).map(c=>{
			return {...c, parsed: JSON.parse(c.data) as Course};
		});

		const crnToCourse = new Map<number,typeof courses[0]>(courses.flatMap(c=>
			Object.entries(c.parsed.sections).filter(([k])=>k==term)
				.flatMap(([,v])=>v.map(sec=>[sec.crn, c]))
		));

		const changedCourses = new Map<number, Course>();
		for (const s of sectionData.values()) {
			s.room = [...new Set(s.room)];
			s.room.sort();

			const c = crnToCourse.get(s.crn);
			if (!c || !(term in c.parsed.sections)) continue;
			// basic safeguard
			if (!s.courses.has(`${c.subject} ${c.course}`))
				throw new Error("mismatched CRN");

			if (s.seats!=undefined) {
				availabilitiesSatisfied+=await trx<DBAvailabilityNotification>("availability_notification")
					.where({course: c.id, sent: false, term, crn: s.crn})
					.andWhere("threshold", "<=", s.seats.left)
					.update({satisfied: true});

				// technically i only need to compare with old section
				// however this is more robust and i want to populate the table even if nothing changed
				const lastRecords = await trx<DBSectionEnrollment>("section_enrollment")
					.where({ course: c.id, crn: s.crn, term })
					.orderBy("id", "desc")
					.limit(2);
				
				if (lastRecords.length<2 || lastRecords[0].enrollment!=s.seats.used
					|| lastRecords[0].enrollment!=lastRecords[1].enrollment) {

					enrollmentsChanged++;
					await trx<DBSectionEnrollment>("section_enrollment")
						.insert({
							course: c.id, crn: s.crn, term,
							time: scrapeTime, enrollment: s.seats.used
						});
				} else {
					await trx<DBSectionEnrollment>("section_enrollment")
						.update({time: scrapeTime}).where({id: lastRecords[0].id});
				}
			}

			const oldCourseSections = c.parsed.sections[term];

			const oldSection = oldCourseSections.find(sec=>sec.crn==s.crn);
			if (oldSection==undefined
				|| (deepEquals(oldSection.seats, s.seats) && deepEquals(oldSection.room, s.room)))
				continue;

			oldSection.seats = s.seats;
			oldSection.room = s.room;

			changedCourses.set(c.id, c.parsed);
		}

		for (const [cid, c] of changedCourses.entries()) {
			await trx<DBCourse>("course").update({data: JSON.stringify(c)}).where({id: cid});
			const left = c.sections[term].map(x=>x.seats ? x.seats.left : 0).reduce((a,b)=>a+b);

			availabilitiesSatisfied+=await trx<DBAvailabilityNotification>("availability_notification")
				.where({course: cid, sent:false, term, crn: null})
				.andWhere("threshold", "<=", left)
				.update({satisfied: true});
		}
	});

	console.log(`${enrollmentsChanged} enrollments changed, ${availabilitiesSatisfied} availabilities satisfied`);
}

let secretJSON: string;
if (values.key) {
	const secret = new Uint8Array(await readFile(values.secret!));
	const iv = secret.slice(0,16);
	const dec = createDecipheriv("aes-256-cbc", new Uint8Array(Buffer.from(values.key, "hex")), iv);
	secretJSON = dec.update(secret.slice(16), undefined, "utf-8") + dec.final("utf-8");
} else {
	secretJSON=await readFile(values.secret!, "utf-8");
}

const secret = JSON.parse(secretJSON) as {
	username: string, password: string, signCount: number
};

const signCount = (await knex<DBProperty>("properties").where({name: "sign_count"}).first("value"))?.value;
if (signCount!=undefined) {
	secret.signCount = Math.max(secret.signCount, Number.parseInt(signCount));
	if (isNaN(secret.signCount)) throw new Error("NaN sign count");
}

console.log("starting browser");

const browser = await chromium.use(StealthPlugin()).launch({
	headless: !values.show,
	executablePath: values.browser
});

const ctx = await browser.newContext({
	...devices["Desktop Chrome"],
	locale: "en-US",
});

const pg = await ctx.newPage();

await pg.bringToFront();
await pg.goto("https://timetable.mypurdue.purdue.edu/Timetabling/main.action");

await pg.getByText("Log In").click();

await pg.locator("#username").fill(secret.username);
//should not be necessary but there's something wrong with my server('s container's chromium) or something. works fine locally and used to work idfk
await pg.waitForTimeout(1000);
await pg.locator("#password").fill(secret.password);

const cdp = await ctx.newCDPSession(pg);
await cdp.send("WebAuthn.enable", {enableUI: false});

const auth = await cdp.send("WebAuthn.addVirtualAuthenticator", {
	options: {
		protocol: "ctap2", transport: "usb",
		automaticPresenceSimulation: true, isUserVerified: true
	}
});

await cdp.send("WebAuthn.addCredential", {
	authenticatorId: auth.authenticatorId,
	// i have no idea how to access this type
	credential: secret as never
});

console.log("logging in");
await pg.getByRole("button", {name: "Log In"}).click();
console.log("waiting for unitime");
await pg.waitForURL("https://timetable.mypurdue.purdue.edu/Timetabling/main.action", {waitUntil: "load"});

await knex<DBProperty>("properties")
	.insert({name: "sign_count", value: (secret.signCount+1).toString()})
	.onConflict("name").merge();

console.log("...and we're in.");

const terms = await knex<DBTerm>("term").select("*");
const activeTerms = positionals.map(p=>{
	const t = terms.find(v=>v.id==p);

	if (!t) {
		console.error(`term ${p} not found`);
		return null;
	}

	return t;
});

if (positionals.length==0) {
	let latest: DBTerm|null=null, idx=-1;
	for (const t of terms) {
		const ni = termIdx(t.id);
		if (ni>idx) {
			latest=t; idx=ni;
		}
	}

	activeTerms.push(latest);
}

for (const t of activeTerms) {
	if (t==null) continue;
	console.log(`downloading timetable for ${formatTerm(t.id)}`);

	const timeout = 1000*60*15;

	await pg.reload();
	const dl = pg.waitForEvent("download", { timeout });

	await pg.evaluate((termName)=>{
		document.write(`<a href="https://timetable.mypurdue.purdue.edu/Timetabling/export?output=events.csv&type=room&term=${termName}PWL&flags=96" id="xd" >click me!</a>`);
	}, t.name.replaceAll(" ", ""));

	await pg.click("#xd", { timeout });
	
	const path = await (await dl).path();
	console.log(`reading room schedule from ${path} (${(await dl).suggestedFilename()})`);

	try {
		await handleCSV(t.id, path);
	} finally {
		console.log(`removing ${path}`);
		await (await dl).delete();
	}

	console.log(`done with ${formatTerm(t.id)}`);
}

console.log("exiting");

await cdp.detach();
await pg.close();
await ctx.close();
await browser.close();
exit(0);
