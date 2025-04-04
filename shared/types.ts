export type Level = "Undergraduate" | "Graduate" | "Professional";
export const levels = ["Undergraduate", "Graduate", "Professional"];

export type PlusMinus = "+" | "-" | "";
export type Letters = "A" | "B" | "C" | "D";
export type Grade = `${Letters}${PlusMinus}` | "E" | "F" | "U" | "S" | "SI" | "P" | "PI" | "NS";

export const grades = [...["A","B","C","D"].flatMap(x => [`${x}+`, `${x}-`, x]), "E", "F", "U", "S", "SI", "P", "PI", "NS"];

export type PreReq = (
  { type: "course", level: Level|null, subject: string, course: string }
  | { type: "courseRange", subject: string, course: string, courseTo: string }
  | { type: "subject", subject: string }
  | { type: "attribute", attribute: string }
)&{
  minCredits: number|null,
  minGPA: number|null,
  grade: Grade|null,
  concurrent: boolean,
  corequisite?: boolean
} | {
  type: "range",
  what: string,
  min: number, max: number,
} | {
  type: "test",
  test: string,
  minScore: string
} | {
  type: "gpa",
  minimum: number
} | {
  type: "credits",
  minimum: number
} | {
  type: "studentAttribute",
  attr: string
};

export type CourseLikePreReq = Extract<PreReq, {concurrent: boolean}>;

export type Restriction =
  {exclusive: boolean}&({ type: "level", level: Level }
  | { type: "major", major: string }
  | { type: "degree", degree: string }
  | { type: "program", program: string }
  | { type: "college", college: string }
  | { type: "class", class: "Sophomore" | "Junior" | "Freshman" | "Senior",
      minCredit: number, maxCredit: number|null }
  | {type: "class", class: "Professional", year: number}
  | { type: "cohort", cohort: string })

export type PreReqs = {type: "leaf", leaf: PreReq} | (
  ({type: "or"} | {type: "and"})&{vs: PreReqs[]}
);

export const termPre = ["spring", "summer", "fall", "winter"];
export type Term = `${"spring" | "fall" | "summer" | "winter"}${number}`

export type RMPInfo = {
	avgDifficulty: number,
	avgRating: number,
	rmpUrl: string,
	numRatings: number,
	wouldTakeAgainPercent: number
};

export type InstructorGrade = {
  grade: Partial<Record<Grade, number>>,
  gpa: number|null, gpaSections: number, // sections with non-null gpa / which have letter grades
  numSections: number
};

export const emptyInstructorGrade: InstructorGrade = {grade: {}, gpa: null, gpaSections: 0, numSections: 0 };

export function toInstructorGrade(x: Partial<Record<Grade,number>>): InstructorGrade {
  let gpa = 0, gpaTot=0;
  for (const [k,v] of Object.entries(x) as [Grade,number][]) {
      if (gradeGPA[k]!==undefined) {
        gpa += gradeGPA[k]*v;
        gpaTot += v;
      }
  }

  return {
    grade: x, gpa: gpaTot==0 ? null : gpa/gpaTot,
    numSections: 1, gpaSections: gpaTot==0 ? 0 : 1
  };
}

export function mergeGrades(arr: InstructorGrade[]): InstructorGrade {
  let gpa = 0, totSec=0, gpaTot=0;
  const out: Partial<Record<Grade, number>> = {};

  for (const x of arr) {
    for (const [k,v] of Object.entries(x.grade) as [Grade,number][]) {
      if (out[k]==undefined) out[k]=v;
      else out[k]+=v;
    }

    if (x.gpa!=null) {
      gpa += x.gpaSections*x.gpa;
      gpaTot += x.gpaSections;
    }

    totSec+=x.numSections;
  }

  if (totSec==0) return emptyInstructorGrade;

  for (const k in out) out[k as Grade]!/=totSec;

  return { grade: out, gpa: gpaTot==0 ? null : gpa/gpaTot,
    numSections: totSec, gpaSections: gpaTot };
};

export type Day = "M"|"T"|"W"|"R"|"F"|"S";

export type Seats = {
  used: number, left: number
};

export type CourseInstructor = {primary: boolean, name: string};

export type Section = {
  name?: string, // section name if it differs from course name, e.g. in variable title courses
  crn: number,
  section: string,

  times: {
    day: Day,
    time: string
  }[],

  seats?: Seats,
  room?: string[],

  //utc for timezone independence...
  dateRange: [string, string],
  scheduleType: string,
  
  instructors: CourseInstructor[]
};

export const validDays = ["M","T","W","R","F","S"];

export type InstructorGrades = Record<Term, InstructorGrade>;

export type Attachment = {
  type: "web"|"doc",
  name: string,
  updated: string,
  href?: string,
  author: string
};

export type Course = {
  name: string,
  subject: string,
  course: number, //5 digits
  instructor: Record<string, InstructorGrades>,
  sections: Record<Term, Section[]>,

  lastUpdated: string,

  description: string,
  learningOutcomes?: string|string[],

  credits: {type: "range", min: number, max: number}|{type: "fixed", values: number[]},
  attributes: string[],
  prereqs: PreReqs | "failed" | "none", //may fail to parse
  restrictions: Restriction[],

  attachments?: Record<Term, Attachment[]>
};

export type Instructor = {
  name: string,
	grades: {
    subject: string, course: string, term: Term,
    data: Partial<Record<Grade, number>>
  }[],

  nicknames: string[],
  dept?: string,
  title?: string,
  office?: string,
  site?: string,
  email?: string,

  lastUpdated: string,
};

export type InstructorId = {
  id: number, instructor: Instructor,
  rmp?: RMPInfo, courses: CourseId[]
};

export function normalizeName(name: string) {
  const n=name.split(",").reverse().join(" ").toLowerCase()
    .replaceAll(/[^a-z ]/g,"").split(/\s+/g).filter(x=>x.length>0);
  return n.toSpliced(1, n.length-2).join(" ");
}

export const gradeGPA: Partial<Record<Grade, number>> = {
  ...Object.fromEntries([
    "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A"
  ].map((x,i) => [x,(i%3==0 ? 0.7 : (i%3==1 ? 1 : 1.3)) + Math.floor(i/3)])),
  "A+": 4, "E": 0, "F": 0
};

export type ServerResponse<T> = {
  status:"error",
  error: "notFound"|"unauthorized"|"badRequest"|"loading"
    |"rateLimited"|"other"|"sessionExpire"|"banned",
  message: string|null
} | {status: "ok", result: T}

export function errorName(err: (ServerResponse<unknown>&{status:"error"})["error"]) {
  let name = "Unknown error";
  switch (err) {
    case "badRequest": name = "Bad Request"; break;
    case "loading": name = "Loading"; break;
    case "notFound": name = "Not Found"; break;
    case "other": name = "Other Error"; break;
    case "rateLimited": name = "Rate Limited"; break;
    case "banned": name = "You've been banned!"; break;
    case "sessionExpire": name = "Session expired"; break;
    case "unauthorized": name = "Unauthorized"; break;
  }
  return name;
}

export type ServerInfo = {
  terms: Partial<Record<Term,{ id: string, name: string, lastUpdated: string }>>,
  subjects: { abbr: string, name: string }[],
  attributes: { id: string, name: string }[],
  scheduleTypes: string[],
  searchLimit: number,
  nCourses: number,
  nInstructor: number
};

// just what goes on the card...
// oof.
// (otherwise each search is like 2-5 MB, tens of thousands of lines of JSON...)
export type SmallCourse = {
  id: number,

  name: string,
  varTitle: string|null,
  subject: string,
  course: number,
  termInstructors: Record<Term,CourseInstructor[]>,

  lastUpdated: string,

  description: string,
  credits: {type: "range", min: number, max: number}|{type: "fixed", values: number[]},
  attributes: string[],
  scheduleTypes: string[],

  grades: InstructorGrade,

  views: number,
  ratings: number, avgRating: number|null
};

// course after indexing / server processing, normal course is used during scraping
export type CourseId = {
  course: Course, id: number,
  views: number, ratings: number, avgRating: number|null
};

export const toSmallCourse = (cid: CourseId): SmallCourse => ({
  id: cid.id, ...cid.course, varTitle: null,
  termInstructors: Object.fromEntries(Object.entries(cid.course.sections)
    .map(([k,v]) => [k as Term, mergeInstructors(v.flatMap(x=>x.instructors))])),
  grades: mergeGrades(Object.values(cid.course.instructor).flatMap(x=>Object.values(x))),
  scheduleTypes: [...new Set(Object.values(cid.course.sections).flat().map(s=>s.scheduleType))],
  views: cid.views, ratings: cid.ratings, avgRating: cid.avgRating
});

export type ServerSearch = {
  results: ({score: number, course:SmallCourse})[],
  numHits: number, npage: number, ms: number
};

//pls don't store anything using this
//purdue term string identifiers are guaranteed to be good, this is just for ordering
export function termIdx(t: Term) {
  const i = termPre.findIndex((v) => t.startsWith(v));
  return Number.parseInt(t.slice(termPre[i].length))*termPre.length + i;
}

export function creditStr(course: {credits: Course["credits"]}) {
  let out;
  if (course.credits.type=="range") {
    out=`${course.credits.min} to ${course.credits.max} credits`;
  } else {
    const lv = course.credits.values[course.credits.values.length-1];
    out=`${lv} credit${lv==1 ? "" : "s"}`;
    if (course.credits.values.length>1)
      out=`${course.credits.values.slice(0,-1).join(", ")} or ${out}`;
  }

  return out;
}

//latest section first
export function sectionsByTerm(course: Course) {
  return ([...Object.entries(course.sections)] as [Term,Section[]][])
    .sort(([a,],[b,]) => termIdx(b)-termIdx(a));
}

export function mergeInstructors(xs: CourseInstructor[]) {
  const primarySet = new Set(xs.filter(x=>x.primary).map(x=>x.name));
  return xs.map(x=>({name: x.name, primary: primarySet.has(x.name)}));
}

export function allCourseInstructors(course: Course, term?: Term) {
  //looks complicated but im bent on having this specific behavior...
  //lmfao what's wrong with me
  const isPrimary = new Map<string, boolean>();
  for (const [,v] of Object.entries(course.sections).sort(([t1], [t2])=>{
    if (t2==term && t1!=term) return -1;
    else if (t1==term && t2!=term) return 1;

    return termIdx(t1 as Term)-termIdx(t2 as Term);
  })) {
    for (const i of mergeInstructors(v.flatMap(x=>x.instructors))) {
      isPrimary.set(i.name, i.primary);
    }
  }

  return [...isPrimary.entries()].map(x=>({name: x[0], primary: x[1]}));
}

export function instructorStr(course: Course) {
  const t = latestTerm(course)!;
  const arr = [...new Set(course.sections[t].flatMap(x=>x.instructors)
    .filter(x=>x.primary).map(x=>x.name))];
  const [instructors, extra] = [arr.slice(0,2), arr.length<=2 ? null : arr.length-2];
  return `${instructors.length==0 ? `No instructors assigned for ${formatTerm(t)}`
    : instructors.join(", ")}${extra==null ? "" : ` and ${extra} other${extra==1 ? "" : "s"}`}`;
}

export function formatTerm(t: Term) {
  const x = termPre.find((v) => t.startsWith(v))!;
  return `${x[0].toUpperCase()}${x.slice(1)} ${t.slice(x.length)}`;
}

export function latestTermofTerms(terms: Term[], restrict?: Term[]): Term|null {
  let latest=null, idx=-1;
  for (const k of terms) {
    const v = termIdx(k);
    if (v>idx && (restrict===undefined || restrict.includes(k))) {
      idx=v; latest=k;
    }
  }

  return latest;
}

export function latestTerm(course: Course, restrict?: Term[]): Term|null {
  return latestTermofTerms(Object.keys(course.sections) as Term[],restrict);
}

export function trimCourseNum(num: number): number {
  if (num%100 == 0) return Math.floor(num/100);
  else return num;
}

export const scheduleAbbr = (schedule: string) =>
  ({
    Recitation: "Rec",
    Lecture: "Lec",
    Laboratory: "Lab",
    "Practice Study Observation": "PSO"
  })[schedule] ?? schedule;

export function minutesInDay(t: string) {
	const re = /(\d+):(\d+) (am|pm)/;
	const m = t.match(re);
	if (m==null) throw new Error("invalid time");

	return 60*(Number.parseInt(m[1])%12)+Number.parseInt(m[2])+(m[3]=="pm" ? 12*60 : 0);
}

export const abbr = (s: string, len: number=300) =>
	s.length > len ? `${s.substring(0, len-3)}...` : s;

export function commaNum(x: number) {
  const s = [...x.toString()];
  const o = [];
  while (s.length>3) {
    o.push(s.splice(-3).join(""));
  }
  o.push(s);
  return o.reverse().join(",");
}
