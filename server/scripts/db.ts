import {abort} from "node:process";
import {RMPInfo, Term} from "../../shared/types.ts";
import {default as knexBuilder} from "knex";

export type DBCourse = {
	id: number,
	subject: string, course: number, name: string,
	data: string //Course
};

export type DBInstructor = {
	id: number,
	//stored in separate columns so i can query rmp quickly w/o all data w/o using extract
	name: string,
	rmp: RMPInfo|null,
	data: string //Instructor (rmp is duplicated :/, but its fine)
};

export type DBTerm = {
	id: Term,
	purdue_id: string,
	name: string,
	last_updated: number
};

export type DBSubject = { abbr: string, name: string };
export type DBAttribute = { id: string, name: string };
export type DBSchedType = { name: string };

export type DBAvailabilityNotification = {
	id: number,
	course: number,
	user: number,
	term: Term,
	crn: number|null,
	threshold: number|null,
	satisfied: boolean,
	sent: boolean
};

export type DBProperty = {
	name: string, value: string
};

export function loadDB(values: {db?: string}) {
	if (values.db==undefined) {
		console.error("no database");
		abort();
	}

	console.log("loading database...");
	return knexBuilder({
		client: "better-sqlite3",
		connection: {filename: values.db},
		useNullAsDefault: false
	});
}